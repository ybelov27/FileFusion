/*
 * What the converter page gives each tool (compress, PDF tools) when it mounts.
 */
import { zipSync } from "fflate";

export interface ToolContext {
  toast(message: string): void;
  addHistory(entry: {
    name: string;
    from: string;
    to: string;
    size: number;
  }): void;
}

export interface Tool {
  addFiles(files: File[]): void;
}

export interface OutputFile {
  name: string;
  blob: Blob;
}

/** Bundles several outputs into one ZIP (stored, since images/PDFs are already compressed). */
export async function zipFiles(files: OutputFile[]): Promise<Blob> {
  const entries: Record<string, Uint8Array> = {};
  for (const f of files) {
    let name = f.name;
    for (let n = 2; name in entries; n++)
      name = f.name.replace(/(\.[^.]+)?$/, ` (${n})$1`);
    entries[name] = new Uint8Array(await f.blob.arrayBuffer());
  }
  return new Blob([zipSync(entries, { level: 0 })] as BlobPart[], {
    type: "application/zip",
  });
}

export const baseName = (name: string) =>
  name.replace(/\.[^.]+$/, "") || "file";
