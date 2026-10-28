/*
 * PDF operations: merge, split, reorder/rotate/delete pages, and compress.
 * pdf-lib edits documents; pdf.js renders pages (thumbnails and compression).
 * Loaded on demand when the PDF tools open.
 */
import { PDFDocument, degrees } from "pdf-lib";
import * as pdfjs from "pdfjs-dist";
import workerUrl from "pdfjs-dist/build/pdf.worker.min.mjs?url";
import {
  canvasToBlob,
  context2d,
  makeCanvas,
  rasterize,
} from "../convert/image.ts";
import { extOf } from "../convert/formats.ts";

pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;

export const isPdf = (file: File) =>
  extOf(file.name) === "pdf" || file.type === "application/pdf";

const pdfBlob = (bytes: Uint8Array) =>
  new Blob([bytes] as BlobPart[], { type: "application/pdf" });

async function loadPdf(file: Blob): Promise<PDFDocument> {
  try {
    return await PDFDocument.load(await file.arrayBuffer(), {
      ignoreEncryption: true,
    });
  } catch {
    throw new Error("This PDF could not be read. It may be damaged.");
  }
}

/** Opens a PDF with pdf.js; call `release()` when done to free the worker memory. */
async function openWithPdfjs(data: ArrayBuffer) {
  const task = pdfjs.getDocument({ data });
  const doc = await task.promise;
  return { doc, release: () => task.destroy() };
}

export async function pageCount(file: Blob): Promise<number> {
  return (await loadPdf(file)).getPageCount();
}

/** Merges PDFs and images (each image becomes a page) in the given order. */
export async function mergeFiles(files: File[]): Promise<Blob> {
  const out = await PDFDocument.create();
  for (const file of files) {
    if (isPdf(file)) {
      const src = await loadPdf(file);
      for (const page of await out.copyPages(src, src.getPageIndices()))
        out.addPage(page);
    } else {
      const { blob, width, height } = await rasterize(file, "image/jpeg");
      const jpg = await out.embedJpg(await blob.arrayBuffer());
      const page = out.addPage([width * 0.75, height * 0.75]);
      page.drawImage(jpg, {
        x: 0,
        y: 0,
        width: width * 0.75,
        height: height * 0.75,
      });
    }
  }
  return pdfBlob(await out.save());
}

/**
 * Parses page ranges like "1-3, 5, 8-" into zero-based page index groups.
 * An open end ("8-") runs to the last page.
 */
export function parseRanges(input: string, count: number): number[][] {
  const groups: number[][] = [];
  for (const part of input
    .split(",")
    .map((p) => p.trim())
    .filter(Boolean)) {
    const m = /^(\d*)\s*-\s*(\d*)$/.exec(part) ?? /^(\d+)$/.exec(part);
    if (!m) throw new Error(`"${part}" isn't a page or range like 2-5.`);
    const from = Number(m[1] || 1);
    const to = part.includes("-") ? Number(m[2] || count) : from;
    if (from < 1 || to > count || from > to)
      throw new Error(`"${part}" is outside pages 1–${count}.`);
    groups.push(Array.from({ length: to - from + 1 }, (_, i) => from - 1 + i));
  }
  if (!groups.length) throw new Error("Enter at least one page or range.");
  return groups;
}

/** Copies the given page groups out of a PDF: one new PDF per group. */
export async function splitPdf(
  file: File,
  groups: number[][],
): Promise<Blob[]> {
  const src = await loadPdf(file);
  const outputs: Blob[] = [];
  for (const indices of groups) {
    const out = await PDFDocument.create();
    for (const page of await out.copyPages(src, indices)) out.addPage(page);
    outputs.push(pdfBlob(await out.save()));
  }
  return outputs;
}

export interface PagePlan {
  index: number; // original zero-based page index
  rotate: number; // extra clockwise rotation in degrees
}

/** Writes a new PDF with pages in the planned order, rotated as planned. */
export async function rebuildPdf(file: File, plan: PagePlan[]): Promise<Blob> {
  const src = await loadPdf(file);
  const out = await PDFDocument.create();
  const pages = await out.copyPages(
    src,
    plan.map((p) => p.index),
  );
  pages.forEach((page, i) => {
    const extra = plan[i]?.rotate ?? 0;
    page.setRotation(degrees((page.getRotation().angle + extra) % 360));
    out.addPage(page);
  });
  return pdfBlob(await out.save());
}

/** Renders every page as a small thumbnail, calling back as each is ready. */
export async function renderThumbnails(
  file: File,
  maxSize: number,
  onPage: (index: number, url: string) => void,
): Promise<number> {
  const { doc, release } = await openWithPdfjs(await file.arrayBuffer());
  try {
    for (let i = 1; i <= doc.numPages; i++) {
      const page = await doc.getPage(i);
      const base = page.getViewport({ scale: 1 });
      const viewport = page.getViewport({
        scale: maxSize / Math.max(base.width, base.height),
      });
      const canvas = makeCanvas(
        Math.ceil(viewport.width),
        Math.ceil(viewport.height),
      );
      await page.render({ canvas, canvasContext: context2d(canvas), viewport })
        .promise;
      onPage(
        i - 1,
        URL.createObjectURL(await canvasToBlob(canvas, "image/jpeg", 0.7)),
      );
      page.cleanup();
    }
    return doc.numPages;
  } finally {
    await release();
  }
}

export const COMPRESSION = {
  light: { dpi: 150, quality: 0.8, label: "Light (best quality)" },
  medium: { dpi: 120, quality: 0.65, label: "Medium (recommended)" },
  strong: { dpi: 90, quality: 0.5, label: "Strong (smallest file)" },
};
export type CompressionLevel = keyof typeof COMPRESSION;

/**
 * Re-renders every page as a JPEG at the chosen resolution. Great for scans
 * and photo-heavy PDFs; text becomes part of the image.
 */
export async function compressPdf(
  file: File,
  level: CompressionLevel,
  onProgress?: (done: number, total: number) => void,
): Promise<Blob> {
  const { dpi, quality } = COMPRESSION[level];
  const { doc, release } = await openWithPdfjs(await file.arrayBuffer());
  const out = await PDFDocument.create();
  try {
    for (let i = 1; i <= doc.numPages; i++) {
      const page = await doc.getPage(i);
      const size = page.getViewport({ scale: 1 }); // PDF points (1/72 inch)
      const viewport = page.getViewport({ scale: dpi / 72 });
      const canvas = makeCanvas(
        Math.ceil(viewport.width),
        Math.ceil(viewport.height),
      );
      const ctx = context2d(canvas);
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      await page.render({ canvas, canvasContext: ctx, viewport }).promise;
      const jpg = await out.embedJpg(
        await (await canvasToBlob(canvas, "image/jpeg", quality)).arrayBuffer(),
      );
      out
        .addPage([size.width, size.height])
        .drawImage(jpg, { x: 0, y: 0, width: size.width, height: size.height });
      page.cleanup();
      onProgress?.(i, doc.numPages);
    }
  } finally {
    await release();
  }
  return pdfBlob(await out.save());
}
