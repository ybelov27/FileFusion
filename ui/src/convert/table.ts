/*
 * Tabular data: CSV, TSV, JSON, JSON Lines and XML in; CSV, TSV, JSON, JSON
 * Lines, Markdown, HTML, YAML, XML and SQL out.
 */
import { escHtml, htmlDocument } from "./text.ts";

export type Row = Record<string, unknown>;
export interface Table {
  headers: string[];
  records: Row[];
}

function tableFromRecords(records: Row[]): Table {
  const headers: string[] = [];
  records.forEach((r) =>
    Object.keys(r).forEach((k) => {
      if (!headers.includes(k)) headers.push(k);
    }),
  );
  return { headers, records };
}

const asRow = (v: unknown): Row =>
  v && typeof v === "object" && !Array.isArray(v) ? (v as Row) : { value: v };

export function parseDelimited(text: string, delim: string): Table {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"' && text[i + 1] === '"') {
        field += '"';
        i++;
      } else if (c === '"') inQuotes = false;
      else field += c;
    } else if (c === '"') inQuotes = true;
    else if (c === delim) {
      row.push(field);
      field = "";
    } else if (c === "\n" || c === "\r") {
      if (c === "\r" && text[i + 1] === "\n") i++;
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else field += c;
  }
  if (field !== "" || row.length) {
    row.push(field);
    rows.push(row);
  }
  const [first, ...rest] = rows.filter((r) => r.some((v) => v !== ""));
  if (!first) return { headers: [], records: [] };
  const headers = first.map((h, i) => h.trim() || `column_${i + 1}`);
  const records = rest.map((r) =>
    Object.fromEntries(headers.map((h, i) => [h, r[i] ?? ""])),
  );
  return { headers, records };
}

export function parseJsonTable(text: string): Table {
  let data: unknown = JSON.parse(text);
  if (!Array.isArray(data)) {
    const arrayProp =
      data && typeof data === "object"
        ? Object.values(data).find(Array.isArray)
        : undefined;
    data = arrayProp ?? [data];
  }
  const list = data as unknown[];
  const [head, ...rest] = list;
  if (Array.isArray(head)) {
    const headers = head.map(String);
    return {
      headers,
      records: rest.map((r) =>
        Object.fromEntries(
          headers.map((h, i) => [h, Array.isArray(r) ? r[i] : undefined]),
        ),
      ),
    };
  }
  return tableFromRecords(list.map(asRow));
}

export function parseJsonLines(text: string): Table {
  const records = text
    .split(/\r?\n/)
    .filter((l) => l.trim())
    .map((l, i) => {
      try {
        return asRow(JSON.parse(l));
      } catch (e) {
        throw new Error(`line ${i + 1}: ${(e as Error).message}`);
      }
    });
  return tableFromRecords(records);
}

// Treats the root's child elements as rows and their children (or attributes) as fields.
export function parseXmlTable(text: string): Table {
  const doc = new DOMParser().parseFromString(text, "application/xml");
  const err = doc.querySelector("parsererror");
  if (err) throw new Error(err.textContent?.split("\n")[0] || "invalid XML");
  const records = Array.from(doc.documentElement.children).map((row) => {
    const o: Row = {};
    Array.from(row.attributes).forEach((a) => {
      o[a.name] = a.value;
    });
    const kids = Array.from(row.children);
    if (kids.length)
      kids.forEach((k) => {
        o[k.tagName] = k.children.length ? k.innerHTML.trim() : k.textContent;
      });
    else if (!row.attributes.length) o[row.tagName] = row.textContent;
    return o;
  });
  return tableFromRecords(records);
}

const cell = (v: unknown): string =>
  v == null ? "" : typeof v === "object" ? JSON.stringify(v) : String(v);

export function toDelimited(
  { headers, records }: Table,
  delim: string,
): string {
  const esc = (v: unknown) => {
    const s = cell(v);
    return /["\n\r]/.test(s) || s.includes(delim)
      ? `"${s.replace(/"/g, '""')}"`
      : s;
  };
  return (
    [
      headers.map(esc).join(delim),
      ...records.map((r) => headers.map((h) => esc(r[h])).join(delim)),
    ].join("\n") + "\n"
  );
}

export function toMarkdownTable({ headers, records }: Table): string {
  const esc = (v: unknown) =>
    cell(v).replace(/\|/g, "\\|").replace(/\n/g, "<br>");
  return (
    [
      `| ${headers.map(esc).join(" | ")} |`,
      `| ${headers.map(() => "---").join(" | ")} |`,
      ...records.map((r) => `| ${headers.map((h) => esc(r[h])).join(" | ")} |`),
    ].join("\n") + "\n"
  );
}

export function toHtmlTable(
  { headers, records }: Table,
  title: string,
): string {
  const head = `<tr>${headers.map((h) => `<th>${escHtml(h)}</th>`).join("")}</tr>`;
  const rows = records
    .map(
      (r) =>
        `<tr>${headers.map((h) => `<td>${escHtml(cell(r[h]))}</td>`).join("")}</tr>`,
    )
    .join("\n");
  return htmlDocument(
    title,
    `<table>\n<thead>${head}</thead>\n<tbody>\n${rows}\n</tbody>\n</table>`,
  );
}

export function toYaml({ records }: Table): string {
  const scalar = (v: unknown): string => {
    if (v == null || v === "") return "''";
    if (typeof v === "number" || typeof v === "boolean") return String(v);
    if (typeof v === "object") return JSON.stringify(v);
    const s = String(v);
    return /^[\w.\-/ ]+$/.test(s) &&
      !/^(true|false|null|yes|no|~|-?\d[\d.e+-]*)$/i.test(s) &&
      s.trim() === s
      ? s
      : JSON.stringify(s);
  };
  const key = (k: string) => (/^[\w.-]+$/.test(k) ? k : JSON.stringify(k));
  if (!records.length) return "[]\n";
  return (
    records
      .map((r) => {
        const entries = Object.entries(r);
        if (!entries.length) return "- {}";
        return entries
          .map(([k, v], i) => `${i ? "  " : "- "}${key(k)}: ${scalar(v)}`)
          .join("\n");
      })
      .join("\n") + "\n"
  );
}

export function toXml({ headers, records }: Table): string {
  const tag = (h: string) => {
    let t = h.replace(/[^\w.-]/g, "_");
    if (!/^[A-Za-z_]/.test(t)) t = `_${t}`;
    return t;
  };
  const escXml = (s: string) => escHtml(s).replace(/'/g, "&apos;");
  const rows = records.map(
    (r) =>
      `  <row>\n${headers.map((h) => `    <${tag(h)}>${escXml(cell(r[h]))}</${tag(h)}>`).join("\n")}\n  </row>`,
  );
  return `<?xml version="1.0" encoding="UTF-8"?>\n<rows>\n${rows.join("\n")}\n</rows>\n`;
}

export function toJsonLines({ records }: Table): string {
  return records.map((r) => JSON.stringify(r)).join("\n") + "\n";
}

export function toSql({ headers, records }: Table, name: string): string {
  const ident = (s: string) => `"${s.replace(/"/g, '""')}"`;
  const table = ident(
    name.replace(/[^\w]+/g, "_").replace(/^_+|_+$/g, "") || "data",
  );
  const numeric = headers.map(
    (h) =>
      records.length > 0 &&
      records.every(
        (r) =>
          r[h] == null || r[h] === "" || /^-?\d+(\.\d+)?$/.test(String(r[h])),
      ),
  );
  const value = (v: unknown, i: number) => {
    if (v == null || v === "") return "NULL";
    if (numeric[i]) return String(v);
    if (typeof v === "boolean") return v ? "TRUE" : "FALSE";
    return `'${cell(v).replace(/'/g, "''")}'`;
  };
  const cols = headers.map(ident).join(", ");
  const create = `CREATE TABLE ${table} (\n${headers.map((h, i) => `  ${ident(h)} ${numeric[i] ? "NUMERIC" : "TEXT"}`).join(",\n")}\n);\n\n`;
  return (
    create +
    records
      .map(
        (r) =>
          `INSERT INTO ${table} (${cols}) VALUES (${headers.map((h, i) => value(r[h], i)).join(", ")});`,
      )
      .join("\n") +
    "\n"
  );
}
