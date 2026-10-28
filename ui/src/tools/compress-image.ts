/*
 * Image compression and resizing: pick a quality, or a target file size and
 * let the encoder search for the best quality (and size) that fits.
 */
import { extOf } from "../convert/formats.ts";
import {
  canvasToBlob,
  context2d,
  loadImage,
  makeCanvas,
} from "../convert/image.ts";
import { baseName } from "./context.ts";

export type OutputFormat = "same" | "jpg" | "webp" | "png";

export interface CompressSettings {
  format: OutputFormat;
  maxWidth?: number;
  maxHeight?: number;
  mode: "quality" | "target";
  quality: number; // 0-1
  targetKB: number;
}

export interface CompressResult {
  blob: Blob;
  name: string;
  width: number;
  height: number;
  unchanged: boolean;
}

const MIME: Record<Exclude<OutputFormat, "same">, string> = {
  jpg: "image/jpeg",
  webp: "image/webp",
  png: "image/png",
};

function resolveFormat(
  file: File,
  format: OutputFormat,
): "jpg" | "webp" | "png" {
  if (format !== "same") return format;
  const ext = extOf(file.name);
  if (ext === "png") return "png";
  if (ext === "webp") return "webp";
  return "jpg"; // JPG, and anything that can't be written back (HEIC, GIF, BMP…)
}

function fit(w: number, h: number, maxW?: number, maxH?: number) {
  const k = Math.min(1, maxW ? maxW / w : 1, maxH ? maxH / h : 1);
  return {
    width: Math.max(1, Math.round(w * k)),
    height: Math.max(1, Math.round(h * k)),
  };
}

export async function compressImage(
  file: File,
  settings: CompressSettings,
): Promise<CompressResult> {
  const img = await loadImage(file);
  const format = resolveFormat(file, settings.format);
  const mime = MIME[format];
  let { width, height } = fit(
    img.naturalWidth,
    img.naturalHeight,
    settings.maxWidth,
    settings.maxHeight,
  );

  const encode = async (w: number, h: number, quality: number) => {
    const canvas = makeCanvas(w, h);
    const ctx = context2d(canvas);
    if (mime === "image/jpeg") {
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, w, h);
    }
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(img, 0, 0, w, h);
    const blob = await canvasToBlob(canvas, mime, quality);
    if (blob.type !== mime)
      throw new Error(`Your browser can't export ${format.toUpperCase()}.`);
    return blob;
  };

  let blob: Blob;
  if (settings.mode === "quality") {
    blob = await encode(width, height, settings.quality);
  } else {
    // Largest quality (and, if needed, size) that fits the target.
    const target = settings.targetKB * 1024;
    let best: Blob | undefined;
    for (let attempt = 0; attempt < 10 && !best; attempt++) {
      if (format === "png") {
        const b = await encode(width, height, 1);
        if (b.size <= target) best = b;
      } else {
        let lo = 0.05;
        let hi = 0.95;
        for (let i = 0; i < 7; i++) {
          const q = (lo + hi) / 2;
          const b = await encode(width, height, q);
          if (b.size <= target) {
            best = b;
            lo = q;
          } else hi = q;
        }
        if (!best) {
          const b = await encode(width, height, 0.05);
          if (b.size <= target) best = b;
        }
      }
      if (!best) {
        width = Math.max(1, Math.round(width * 0.8));
        height = Math.max(1, Math.round(height * 0.8));
      }
    }
    if (!best)
      throw new Error(`Couldn't get this image under ${settings.targetKB} KB.`);
    blob = best;
  }

  const ext = extOf(file.name);
  const original = ext === "jpeg" ? "jpg" : ext;
  const resized = width !== img.naturalWidth || height !== img.naturalHeight;
  // Never hand back a bigger file than the original when nothing else changed.
  if (!resized && original === format && blob.size >= file.size)
    return {
      blob: file,
      name: file.name,
      width,
      height,
      unchanged: true,
    };
  return {
    blob,
    name: `${baseName(file.name)}-compressed.${format}`,
    width,
    height,
    unchanged: false,
  };
}
