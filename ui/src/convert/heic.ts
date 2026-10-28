/*
 * HEIC/HEIF (iPhone photos) decoding with libheif compiled to WebAssembly.
 * Loaded on demand: the ~2 MB decoder only downloads when a HEIC file is used.
 */
import libheifFactory, {
  type Libheif,
} from "libheif-js/libheif-wasm/libheif-bundle.mjs";

let libheif: Promise<Libheif> | undefined;

/** Decodes the primary image of a HEIC/HEIF file into a PNG blob. */
export async function heicToPng(file: Blob): Promise<Blob> {
  libheif ??= libheifFactory();
  const lib = await libheif;
  const images = new lib.HeifDecoder().decode(
    new Uint8Array(await file.arrayBuffer()),
  );
  const image = images[0];
  if (!image) throw new Error("This HEIC file has no image in it.");
  try {
    const width = image.get_width();
    const height = image.get_height();
    const pixels = await new Promise<ImageData>((resolve, reject) =>
      image.display(new ImageData(width, height), (result) =>
        result
          ? resolve(result)
          : reject(new Error("This HEIC image could not be decoded.")),
      ),
    );
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    canvas.getContext("2d")?.putImageData(pixels, 0, 0);
    return await new Promise<Blob>((resolve, reject) =>
      canvas.toBlob(
        (b) => (b ? resolve(b) : reject(new Error("Could not export PNG."))),
        "image/png",
      ),
    );
  } finally {
    images.forEach((img) => img.free());
  }
}
