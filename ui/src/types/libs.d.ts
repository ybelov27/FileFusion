// Typings for the small parts of untyped libraries File Fusion uses.

declare module "libheif-js/libheif-wasm/libheif-bundle.mjs" {
  interface HeifImage {
    get_width(): number;
    get_height(): number;
    display(
      target: ImageData,
      callback: (result: ImageData | null) => void,
    ): void;
    free(): void;
  }
  interface HeifDecoder {
    decode(data: Uint8Array): HeifImage[];
  }
  export interface Libheif {
    HeifDecoder: new () => HeifDecoder;
  }
  const factory: (options?: object) => Promise<Libheif>;
  export default factory;
}

declare module "gifenc" {
  export type Palette = number[][];
  export interface GIFEncoderInstance {
    writeFrame(
      index: Uint8Array,
      width: number,
      height: number,
      options?: { palette?: Palette; delay?: number; repeat?: number },
    ): void;
    finish(): void;
    bytes(): Uint8Array;
  }
  export function GIFEncoder(): GIFEncoderInstance;
  export function quantize(
    rgba: Uint8Array | Uint8ClampedArray,
    maxColors: number,
  ): Palette;
  export function applyPalette(
    rgba: Uint8Array | Uint8ClampedArray,
    palette: Palette,
  ): Uint8Array;
}
