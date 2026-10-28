/*
 * Video to animated GIF: the browser decodes the video, frames are drawn to a
 * canvas and encoded with gifenc. Loaded on demand.
 */
import { GIFEncoder, applyPalette, quantize } from "gifenc";

export interface GifOptions {
  fps?: number;
  maxWidth?: number;
  maxSeconds?: number;
}

function loadVideo(file: Blob): Promise<HTMLVideoElement> {
  return new Promise((resolve, reject) => {
    const video = document.createElement("video");
    video.muted = true;
    video.playsInline = true;
    video.preload = "auto";
    video.onloadeddata = () => resolve(video);
    video.onerror = () =>
      reject(new Error("This video could not be read by your browser."));
    video.src = URL.createObjectURL(file);
  });
}

function seek(video: HTMLVideoElement, time: number): Promise<void> {
  return new Promise((resolve) => {
    video.onseeked = () => resolve();
    video.currentTime = time;
  });
}

/** Encodes up to `maxSeconds` of a video as a looping GIF. */
export async function videoToGif(
  file: Blob,
  { fps = 10, maxWidth = 480, maxSeconds = 15 }: GifOptions = {},
): Promise<Blob> {
  const video = await loadVideo(file);
  try {
    const scale = Math.min(1, maxWidth / video.videoWidth);
    const width = Math.max(1, Math.round(video.videoWidth * scale));
    const height = Math.max(1, Math.round(video.videoHeight * scale));
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    if (!ctx) throw new Error("Your browser can't draw video frames.");

    const duration = Math.min(video.duration || 0, maxSeconds);
    const frames = Math.max(1, Math.floor(duration * fps));
    const gif = GIFEncoder();
    for (let i = 0; i < frames; i++) {
      await seek(video, i / fps);
      ctx.drawImage(video, 0, 0, width, height);
      const { data } = ctx.getImageData(0, 0, width, height);
      const palette = quantize(data, 256);
      gif.writeFrame(applyPalette(data, palette), width, height, {
        palette,
        delay: 1000 / fps,
      });
    }
    gif.finish();
    return new Blob([gif.bytes()] as BlobPart[], { type: "image/gif" });
  } finally {
    URL.revokeObjectURL(video.src);
  }
}
