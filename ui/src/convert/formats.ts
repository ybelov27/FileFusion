/*
 * Which formats File Fusion knows, how to recognise an input file, and which
 * outputs each kind of input can be converted to.
 */

export const FORMATS = {
  png: { label: "PNG", mime: "image/png" },
  jpg: { label: "JPG", mime: "image/jpeg" },
  webp: { label: "WEBP", mime: "image/webp" },
  bmp: { label: "BMP", mime: "image/bmp" },
  ico: { label: "ICO (favicon)", mime: "image/x-icon" },
  datauri: { label: "Base64 data URI", mime: "text/plain", ext: "txt" },
  pdf: { label: "PDF", mime: "application/pdf" },
  json: { label: "JSON", mime: "application/json" },
  jsonl: { label: "JSON Lines", mime: "application/jsonl" },
  sql: { label: "SQL inserts", mime: "application/sql" },
  csv: { label: "CSV", mime: "text/csv" },
  tsv: { label: "TSV", mime: "text/tab-separated-values" },
  md: { label: "Markdown", mime: "text/markdown" },
  html: { label: "HTML", mime: "text/html" },
  yaml: { label: "YAML", mime: "application/yaml" },
  xml: { label: "XML", mime: "application/xml" },
  txt: { label: "Text", mime: "text/plain" },
  wav: { label: "WAV", mime: "audio/wav" },
  mp3: { label: "MP3", mime: "audio/mpeg" },
  gif: { label: "GIF (animated)", mime: "image/gif" },
} satisfies Record<string, { label: string; mime: string; ext?: string }>;

export type Target = keyof typeof FORMATS;
export type Kind =
  "image" | "data" | "audio" | "video" | "markdown" | "html" | "text";

const IMAGE_IN = [
  "png",
  "jpg",
  "jpeg",
  "webp",
  "gif",
  "bmp",
  "svg",
  "avif",
  "ico",
  "heic",
  "heif",
];
const DATA_IN = ["csv", "tsv", "json", "jsonl", "ndjson", "xml"];
const AUDIO_IN = ["mp3", "wav", "ogg", "oga", "m4a", "aac", "flac", "opus"];
const VIDEO_IN = ["mp4", "m4v", "mov", "webm"];

const TARGETS_BY_KIND: Record<Kind, Target[]> = {
  image: ["png", "jpg", "webp", "pdf", "bmp", "ico", "datauri"],
  data: ["json", "csv", "tsv", "md", "html", "yaml", "xml", "jsonl", "sql"],
  markdown: ["html", "txt", "pdf"],
  html: ["txt", "md", "pdf"],
  text: ["html", "md", "pdf"],
  audio: ["mp3", "wav"],
  video: ["mp3", "wav", "gif"],
};

export function isTarget(value: string | null): value is Target {
  return value !== null && Object.hasOwn(FORMATS, value);
}

export function extOf(name: string): string {
  const m = /\.([a-z0-9]+)$/i.exec(name || "");
  return m?.[1] ? m[1].toLowerCase() : "";
}

export function kindOf(file: File): Kind | null {
  const ext = extOf(file.name);
  const type = file.type || "";
  if (IMAGE_IN.includes(ext) || type.startsWith("image/")) return "image";
  if (DATA_IN.includes(ext)) return "data";
  if (AUDIO_IN.includes(ext) || type.startsWith("audio/")) return "audio";
  if (VIDEO_IN.includes(ext) || type.startsWith("video/")) return "video";
  if (ext === "md" || ext === "markdown") return "markdown";
  if (ext === "html" || ext === "htm") return "html";
  if (ext === "txt") return "text";
  return null;
}

const EXT_ALIASES: Record<string, string> = {
  jpeg: "jpg",
  markdown: "md",
  htm: "html",
  ndjson: "jsonl",
};

/** iPhone photos: browsers other than Safari can't decode these natively. */
export function isHeic(file: Blob & { name?: string }): boolean {
  const ext = extOf(file.name ?? "");
  return (
    ext === "heic" ||
    ext === "heif" ||
    file.type === "image/heic" ||
    file.type === "image/heif"
  );
}

export function normalizedExt(file: File): string {
  const ext = extOf(file.name);
  return EXT_ALIASES[ext] ?? ext;
}

export function targetsFor(file: File): Target[] {
  const kind = kindOf(file);
  if (!kind) return [];
  const own = normalizedExt(file);
  return TARGETS_BY_KIND[kind].filter((t) => t !== own);
}
