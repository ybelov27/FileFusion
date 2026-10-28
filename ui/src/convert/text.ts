/*
 * Markdown, HTML and plain-text conversions.
 */

export const escHtml = (s: unknown): string =>
  String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

export function htmlDocument(title: string, body: string): string {
  return (
    `<!DOCTYPE html>\n<html lang="en">\n<head>\n<meta charset="UTF-8">\n<title>${escHtml(title)}</title>\n` +
    "<style>body{font-family:system-ui,sans-serif;max-width:860px;margin:40px auto;padding:0 16px;line-height:1.6;color:#1f1f1f}" +
    "table{border-collapse:collapse;width:100%}th,td{border:1px solid #dadce0;padding:6px 10px;text-align:left}th{background:#f1f3f4}" +
    "pre{background:#f6f8fa;padding:12px;border-radius:8px;overflow:auto}code{font-family:ui-monospace,monospace}</style>\n" +
    `</head>\n<body>\n${body}\n</body>\n</html>\n`
  );
}

function inlineMd(s: string): string {
  return escHtml(s)
    .replace(/`([^`]+)`/g, "<code>$1</code>")
    .replace(/!\[([^\]]*)\]\(([^)\s]+)\)/g, '<img alt="$1" src="$2">')
    .replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, '<a href="$2">$1</a>')
    .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
    .replace(/(^|[^*])\*([^*]+)\*/g, "$1<em>$2</em>")
    .replace(/~~([^~]+)~~/g, "<del>$1</del>");
}

export function markdownToHtml(md: string): string {
  const lines = md.replace(/\r\n?/g, "\n").split("\n");
  const out: string[] = [];
  let para: string[] = [];
  let list: { tag: "ul" | "ol"; items: string[] } | null = null;
  let inCode = false;
  let code: string[] = [];
  const flushPara = () => {
    if (para.length) {
      out.push(`<p>${inlineMd(para.join(" "))}</p>`);
      para = [];
    }
  };
  const flushList = () => {
    if (list) {
      out.push(
        `<${list.tag}>${list.items.map((i) => `<li>${inlineMd(i)}</li>`).join("")}</${list.tag}>`,
      );
      list = null;
    }
  };
  for (const line of lines) {
    if (inCode) {
      if (/^```/.test(line)) {
        out.push(`<pre><code>${escHtml(code.join("\n"))}</code></pre>`);
        inCode = false;
        code = [];
      } else code.push(line);
      continue;
    }
    let m: RegExpExecArray | null;
    if (/^```/.test(line)) {
      flushPara();
      flushList();
      inCode = true;
    } else if ((m = /^(#{1,6})\s+(.*)$/.exec(line))) {
      flushPara();
      flushList();
      const level = m[1]!.length;
      out.push(`<h${level}>${inlineMd(m[2]!)}</h${level}>`);
    } else if (/^\s*([-*_])(\s*\1){2,}\s*$/.test(line)) {
      flushPara();
      flushList();
      out.push("<hr>");
    } else if ((m = /^>\s?(.*)$/.exec(line))) {
      flushPara();
      flushList();
      out.push(`<blockquote>${inlineMd(m[1]!)}</blockquote>`);
    } else if (
      (m = /^\s*[-*+]\s+(.*)$/.exec(line)) ||
      (m = /^\s*\d+[.)]\s+(.*)$/.exec(line))
    ) {
      flushPara();
      const tag = /^\s*\d/.test(line) ? "ol" : "ul";
      if (!list || list.tag !== tag) {
        flushList();
        list = { tag, items: [] };
      }
      list.items.push(m[1]!);
    } else if (!line.trim()) {
      flushPara();
      flushList();
    } else {
      flushList();
      para.push(line.trim());
    }
  }
  if (inCode) out.push(`<pre><code>${escHtml(code.join("\n"))}</code></pre>`);
  flushPara();
  flushList();
  return out.join("\n");
}

const htmlToDom = (html: string) =>
  new DOMParser().parseFromString(html, "text/html");

export function htmlToText(html: string): string {
  const doc = htmlToDom(html);
  doc.querySelectorAll("script,style,noscript").forEach((n) => n.remove());
  doc.querySelectorAll("br").forEach((n) => n.replaceWith("\n"));
  doc
    .querySelectorAll(
      "p,div,h1,h2,h3,h4,h5,h6,li,tr,pre,blockquote,section,article",
    )
    .forEach((n) => n.append("\n"));
  return (
    (doc.body.textContent || "")
      .replace(/[ \t]+\n/g, "\n")
      .replace(/\n{3,}/g, "\n\n")
      .trim() + "\n"
  );
}

export function htmlToMarkdown(html: string): string {
  const doc = htmlToDom(html);
  doc.querySelectorAll("script,style,noscript").forEach((n) => n.remove());
  const walk = (node: Node): string => {
    if (node.nodeType === Node.TEXT_NODE)
      return (node.textContent ?? "").replace(/\s+/g, " ");
    if (!(node instanceof Element)) return "";
    const inner = () => Array.from(node.childNodes).map(walk).join("");
    const text = node.textContent ?? "";
    const tag = node.tagName.toLowerCase();
    switch (tag) {
      case "h1":
      case "h2":
      case "h3":
      case "h4":
      case "h5":
      case "h6":
        return `\n\n${"#".repeat(Number(tag[1]))} ${inner().trim()}\n\n`;
      case "p":
      case "div":
      case "section":
      case "article":
        return `\n\n${inner().trim()}\n\n`;
      case "br":
        return "\n";
      case "strong":
      case "b":
        return `**${inner()}**`;
      case "em":
      case "i":
        return `*${inner()}*`;
      case "code":
        return `\`${text}\``;
      case "pre":
        return `\n\n\`\`\`\n${text.replace(/\n$/, "")}\n\`\`\`\n\n`;
      case "a":
        return `[${inner()}](${node.getAttribute("href") || ""})`;
      case "img":
        return `![${node.getAttribute("alt") || ""}](${node.getAttribute("src") || ""})`;
      case "hr":
        return "\n\n---\n\n";
      case "blockquote":
        return `\n\n> ${inner().trim()}\n\n`;
      case "ul":
      case "ol":
        return (
          "\n\n" +
          Array.from(node.children)
            .map(
              (li, i) =>
                `${tag === "ol" ? `${i + 1}.` : "-"} ${walk(li).trim()}`,
            )
            .join("\n") +
          "\n\n"
        );
      default:
        return inner();
    }
  };
  return (
    walk(doc.body)
      .replace(/\n{3,}/g, "\n\n")
      .trim() + "\n"
  );
}
