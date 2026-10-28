/*
 * Image conversions using the browser's own decoders and <canvas>.
 */
import { buildPdf, type JpegPage } from "./pdf-writer.ts";

export function context2d(canvas: HTMLCanvasElement): CanvasRenderingContext2D {
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Your browser can't draw images.");
  return ctx;
}

export function makeCanvas(width: number, height: number): HTMLCanvasElement {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  return canvas;
}

export async function loadImage(file: Blob): Promise<HTMLImageElement> {
  const url = URL.createObjectURL(file);
  try {
    const img = new Image();
    img.decoding = "async";
    img.src = url;
    await img.decode();
    return img;
  } catch {
    throw new Error("This image could not be read by your browser.");
  } finally {
    setTimeout(() => URL.revokeObjectURL(url), 0);
  }
}

export function canvasToBlob(
  canvas: HTMLCanvasElement,
  mime: string,
  quality?: number,
): Promise<Blob> {
  return new Promise((resolve, reject) =>
    canvas.toBlob(
      (b) =>
        b
          ? resolve(b)
          : reject(new Error(`Your browser can't export ${mime}.`)),
      mime,
      quality,
    ),
  );
}

const MIME_LABELS: Record<string, string> = {
  "image/png": "PNG",
  "image/jpeg": "JPG",
  "image/webp": "WEBP",
};

export async function rasterize(
  file: Blob,
  mime: string,
): Promise<{ blob: Blob; width: number; height: number }> {
  const img = await loadImage(file);
  const w = img.naturalWidth || 1024;
  const h = img.naturalHeight || 1024;
  const canvas = makeCanvas(w, h);
  const ctx = context2d(canvas);
  if (mime === "image/jpeg") {
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, w, h);
  }
  ctx.drawImage(img, 0, 0, w, h);
  const blob = await canvasToBlob(canvas, mime, 0.92);
  if (blob.type !== mime)
    throw new Error(`Your browser can't export ${MIME_LABELS[mime] ?? mime}.`);
  return { blob, width: w, height: h };
}

async function drawToCanvas(
  file: Blob,
  maxSize?: number,
): Promise<HTMLCanvasElement> {
  const img = await loadImage(file);
  let w = img.naturalWidth || 1024;
  let h = img.naturalHeight || 1024;
  if (maxSize && Math.max(w, h) > maxSize) {
    const k = maxSize / Math.max(w, h);
    w = Math.max(1, Math.round(w * k));
    h = Math.max(1, Math.round(h * k));
  }
  const canvas = makeCanvas(w, h);
  context2d(canvas).drawImage(img, 0, 0, w, h);
  return canvas;
}

// 24-bit BMP on a white background (BMP has no reliable alpha support).
export async function imageToBmp(file: Blob): Promise<Blob> {
  const src = await drawToCanvas(file);
  const { width: w, height: h } = src;
  const flat = makeCanvas(w, h);
  const ctx = context2d(flat);
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, w, h);
  ctx.drawImage(src, 0, 0);
  const px = ctx.getImageData(0, 0, w, h).data;
  const rowSize = Math.ceil((w * 3) / 4) * 4;
  const buf = new ArrayBuffer(54 + rowSize * h);
  const v = new DataView(buf);
  v.setUint16(0, 0x4d42, true);
  v.setUint32(2, buf.byteLength, true);
  v.setUint32(10, 54, true);
  v.setUint32(14, 40, true);
  v.setInt32(18, w, true);
  v.setInt32(22, h, true);
  v.setUint16(26, 1, true);
  v.setUint16(28, 24, true);
  v.setUint32(34, rowSize * h, true);
  v.setInt32(38, 2835, true);
  v.setInt32(42, 2835, true);
  const out = new Uint8Array(buf);
  for (let y = 0; y < h; y++) {
    let o = 54 + (h - 1 - y) * rowSize;
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4;
      out[o++] = px[i + 2]!;
      out[o++] = px[i + 1]!;
      out[o++] = px[i]!;
    }
  }
  return new Blob([buf], { type: "image/bmp" });
}

// ICO containing one PNG image, centered in a square of up to 256px.
export async function imageToIco(file: Blob): Promise<Blob> {
  const src = await drawToCanvas(file, 256);
  const size = Math.max(src.width, src.height);
  const sq = makeCanvas(size, size);
  context2d(sq).drawImage(src, (size - src.width) / 2, (size - src.height) / 2);
  const png = new Uint8Array(
    await (await canvasToBlob(sq, "image/png")).arrayBuffer(),
  );
  const head = new DataView(new ArrayBuffer(22));
  head.setUint16(2, 1, true);
  head.setUint16(4, 1, true);
  head.setUint8(6, size >= 256 ? 0 : size);
  head.setUint8(7, size >= 256 ? 0 : size);
  head.setUint16(10, 1, true);
  head.setUint16(12, 32, true);
  head.setUint32(14, png.length, true);
  head.setUint32(18, 22, true);
  return new Blob([head.buffer, png], { type: "image/x-icon" });
}

export function fileToDataUri(file: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result));
    r.onerror = () => reject(new Error("Could not read the file."));
    r.readAsDataURL(file);
  });
}

export async function imageToPdf(file: Blob): Promise<Blob> {
  const { blob, width, height } = await rasterize(file, "image/jpeg");
  return buildPdf([
    { jpeg: new Uint8Array(await blob.arrayBuffer()), width, height },
  ]);
}

// Render plain text onto letter-sized canvases and wrap them as PDF pages.
export async function textToPdf(text: string): Promise<Blob> {
  const W = 1275; // 150 dpi letter page
  const H = 1650;
  const M = 120;
  const LH = 34;
  const canvas = makeCanvas(W, H);
  const ctx = context2d(canvas);
  const font = "22px ui-monospace, Menlo, Consolas, monospace";
  ctx.font = font;
  const lines: string[] = [];
  for (const raw of text
    .replace(/\r\n?/g, "\n")
    .replace(/\t/g, "    ")
    .split("\n")) {
    let line = "";
    for (const word of raw.split(/(\s+)/)) {
      if (ctx.measureText(line + word).width > W - 2 * M && line) {
        lines.push(line);
        line = word.trimStart();
      } else line += word;
      while (ctx.measureText(line).width > W - 2 * M) {
        let cut = line.length - 1;
        while (cut > 1 && ctx.measureText(line.slice(0, cut)).width > W - 2 * M)
          cut--;
        lines.push(line.slice(0, cut));
        line = line.slice(cut);
      }
    }
    lines.push(line);
  }
  const perPage = Math.floor((H - 2 * M) / LH);
  const pages: JpegPage[] = [];
  for (let i = 0; i < Math.max(lines.length, 1); i += perPage) {
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = "#1f1f1f";
    ctx.font = font;
    ctx.textBaseline = "top";
    lines
      .slice(i, i + perPage)
      .forEach((l, j) => ctx.fillText(l, M, M + j * LH));
    const blob = await canvasToBlob(canvas, "image/jpeg", 0.9);
    pages.push({
      jpeg: new Uint8Array(await blob.arrayBuffer()),
      width: W,
      height: H,
      ptWidth: 612,
      ptHeight: 792,
    });
  }
  return buildPdf(pages);
}
