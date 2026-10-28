/*
 * File Fusion in-browser conversion engine.
 * Every conversion runs locally: files never leave the user's device.
 */
import { audioBufferToWav, decodeAudio } from "./audio.ts";
import {
  FORMATS,
  kindOf,
  normalizedExt,
  targetsFor,
  type Target,
} from "./formats.ts";
import {
  fileToDataUri,
  imageToBmp,
  imageToIco,
  imageToPdf,
  rasterize,
  textToPdf,
} from "./image.ts";
import {
  parseDelimited,
  parseJsonLines,
  parseJsonTable,
  parseXmlTable,
  toDelimited,
  toHtmlTable,
  toJsonLines,
  toMarkdownTable,
  toSql,
  toXml,
  toYaml,
  type Table,
} from "./table.ts";
import {
  escHtml,
  htmlDocument,
  htmlToMarkdown,
  htmlToText,
  markdownToHtml,
} from "./text.ts";

export { FORMATS, extOf, isTarget, kindOf, targetsFor } from "./formats.ts";
export type { Kind, Target } from "./formats.ts";

export interface ConvertResult {
  blob: Blob;
  name: string;
}

function readTable(src: string, ext: string): Table {
  const clean = src.replace(/^\uFEFF/, "");
  try {
    if (ext === "json") return parseJsonTable(clean);
    if (ext === "jsonl") return parseJsonLines(clean);
    if (ext === "xml") return parseXmlTable(clean);
    return parseDelimited(clean, ext === "tsv" ? "\t" : ",");
  } catch (e) {
    throw new Error(
      `Couldn't read ${ext.toUpperCase()}: ${(e as Error).message}`,
    );
  }
}

export async function convert(
  file: File,
  target: Target,
): Promise<ConvertResult> {
  const kind = kindOf(file);
  const base = file.name.replace(/\.[^.]+$/, "") || "converted";
  const format = FORMATS[target];
  const name = `${base}.${"ext" in format ? format.ext : target}`;
  const blob = (b: Blob): ConvertResult => ({ blob: b, name });
  const text = (s: string): ConvertResult =>
    blob(new Blob([s], { type: `${format.mime};charset=utf-8` }));

  if (!targetsFor(file).includes(target))
    throw new Error(`Can't convert this file to ${format.label}.`);

  if (kind === "audio" || kind === "video") {
    if (target === "gif") {
      const { videoToGif } = await import("./video.ts");
      return blob(await videoToGif(file));
    }
    const audio = await decodeAudio(file).catch(() => {
      throw new Error(
        kind === "video"
          ? "Couldn't read the sound in this video (it may have no audio track)."
          : "This audio format could not be decoded by your browser.",
      );
    });
    if (target === "mp3") {
      const { audioBufferToMp3 } = await import("./mp3.ts");
      return blob(await audioBufferToMp3(audio));
    }
    return blob(audioBufferToWav(audio));
  }

  if (kind === "image") {
    if (target === "pdf") return blob(await imageToPdf(file));
    if (target === "bmp") return blob(await imageToBmp(file));
    if (target === "ico") return blob(await imageToIco(file));
    if (target === "datauri") return text((await fileToDataUri(file)) + "\n");
    return blob((await rasterize(file, format.mime)).blob);
  }

  const src = await file.text();
  if (kind === "data") {
    const table = readTable(src, normalizedExt(file));
    switch (target) {
      case "json":
        return text(JSON.stringify(table.records, null, 2) + "\n");
      case "csv":
        return text(toDelimited(table, ","));
      case "tsv":
        return text(toDelimited(table, "\t"));
      case "md":
        return text(toMarkdownTable(table));
      case "html":
        return text(toHtmlTable(table, base));
      case "yaml":
        return text(toYaml(table));
      case "xml":
        return text(toXml(table));
      case "jsonl":
        return text(toJsonLines(table));
      case "sql":
        return text(toSql(table, base));
    }
  }
  if (kind === "markdown") {
    if (target === "html") return text(htmlDocument(base, markdownToHtml(src)));
    if (target === "txt") return text(htmlToText(markdownToHtml(src)));
    if (target === "pdf")
      return blob(await textToPdf(htmlToText(markdownToHtml(src))));
  }
  if (kind === "html") {
    if (target === "txt") return text(htmlToText(src));
    if (target === "md") return text(htmlToMarkdown(src));
    if (target === "pdf") return blob(await textToPdf(htmlToText(src)));
  }
  if (kind === "text") {
    if (target === "html")
      return text(htmlDocument(base, `<pre>${escHtml(src)}</pre>`));
    if (target === "md") return text(src);
    if (target === "pdf") return blob(await textToPdf(src));
  }
  throw new Error("Unsupported conversion.");
}
