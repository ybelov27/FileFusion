/*
 * A tiny PDF writer: one JPEG image per page. Enough for image-to-PDF and
 * text-to-PDF without pulling in a PDF library.
 */

export interface JpegPage {
  jpeg: Uint8Array;
  width: number;
  height: number;
  // Page size in points; defaults to the image at 96 dpi.
  ptWidth?: number;
  ptHeight?: number;
}

export function buildPdf(pages: JpegPage[]): Blob {
  const enc = new TextEncoder();
  const parts: Uint8Array[] = [];
  const offsets: number[] = [];
  let length = 0;
  const push = (chunk: string | Uint8Array) => {
    const b = typeof chunk === "string" ? enc.encode(chunk) : chunk;
    parts.push(b);
    length += b.length;
  };
  const obj = (n: number, body: () => void) => {
    offsets[n] = length;
    push(`${n} 0 obj\n`);
    body();
    push("\nendobj\n");
  };

  push("%PDF-1.4\n%\xE2\xE3\xCF\xD3\n");
  const pageIds = pages.map((_, i) => 3 + i * 3);
  obj(1, () => push("<< /Type /Catalog /Pages 2 0 R >>"));
  obj(2, () =>
    push(
      `<< /Type /Pages /Kids [${pageIds.map((id) => `${id} 0 R`).join(" ")}] /Count ${pages.length} >>`,
    ),
  );
  pages.forEach((p, i) => {
    const id = pageIds[i]!;
    const pw = (p.ptWidth || p.width * 0.75).toFixed(2);
    const ph = (p.ptHeight || p.height * 0.75).toFixed(2);
    const content = `q ${pw} 0 0 ${ph} 0 0 cm /Im0 Do Q`;
    obj(id, () =>
      push(
        `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${pw} ${ph}] /Resources << /XObject << /Im0 ${id + 1} 0 R >> >> /Contents ${id + 2} 0 R >>`,
      ),
    );
    obj(id + 1, () => {
      push(
        `<< /Type /XObject /Subtype /Image /Width ${p.width} /Height ${p.height} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${p.jpeg.length} >>\nstream\n`,
      );
      push(p.jpeg);
      push("\nendstream");
    });
    obj(id + 2, () =>
      push(`<< /Length ${content.length} >>\nstream\n${content}\nendstream`),
    );
  });
  const count = 3 + pages.length * 3;
  const xref = length;
  push(`xref\n0 ${count}\n0000000000 65535 f \n`);
  for (let n = 1; n < count; n++)
    push(`${String(offsets[n]).padStart(10, "0")} 00000 n \n`);
  push(
    `trailer\n<< /Size ${count} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`,
  );
  return new Blob(parts as BlobPart[], { type: "application/pdf" });
}
