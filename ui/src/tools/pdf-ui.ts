/*
 * "PDF tools" view: merge, split, organize (reorder/rotate/delete) and compress.
 */
import { kindOf } from "../convert/formats.ts";
import { downloadBlob, el, formatSize, openPickerOn } from "../dom.ts";
import {
  baseName,
  zipFiles,
  type OutputFile,
  type Tool,
  type ToolContext,
} from "./context.ts";
import {
  COMPRESSION,
  compressPdf,
  isPdf,
  mergeFiles,
  pageCount,
  parseRanges,
  rebuildPdf,
  renderThumbnails,
  splitPdf,
  type CompressionLevel,
} from "./pdf-ops.ts";

export type PdfTab = "merge" | "split" | "organize" | "compress";
export const PDF_TABS: PdfTab[] = ["merge", "split", "organize", "compress"];
export const isPdfTab = (v: string | null): v is PdfTab =>
  PDF_TABS.includes(v as PdfTab);

const TAB_LABELS: Record<PdfTab, [icon: string, label: string]> = {
  merge: ["call_merge", "Merge"],
  split: ["call_split", "Split"],
  organize: ["view_module", "Organize"],
  compress: ["compress", "Compress"],
};

function saveAs(blob: Blob, name: string): void {
  const url = URL.createObjectURL(blob);
  downloadBlob(url, name);
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

async function saveAll(files: OutputFile[], zipName: string): Promise<void> {
  const [only] = files;
  if (files.length === 1 && only) saveAs(only.blob, only.name);
  else saveAs(await zipFiles(files), zipName);
}

function dropZone(
  icon: string,
  title: string,
  hint: string,
  multiple: boolean,
  accept: string,
  onFiles: (files: File[]) => void,
): HTMLElement {
  const input = el("input", { type: "file", accept, hidden: "" });
  input.multiple = multiple;
  const zone = el(
    "div",
    {
      class: "upload-area",
      tabindex: "0",
      role: "button",
      "aria-label": title,
    },
    [
      el("span", { class: "material-icons upload-icon", text: icon }),
      el("h2", { text: title }),
      el("p", { text: hint }),
      el("button", {
        class: "browse-btn",
        type: "button",
        text: "Browse Files",
      }),
      input,
    ],
  );
  openPickerOn(zone, input);
  input.addEventListener("change", () => {
    onFiles(Array.from(input.files ?? []));
    input.value = "";
  });
  return zone;
}

function busy<T>(
  button: HTMLButtonElement,
  label: string,
  work: () => Promise<T>,
): Promise<T | undefined> {
  const before = Array.from(button.childNodes);
  button.disabled = true;
  button.replaceChildren(el("span", { class: "spinner small" }), ` ${label}`);
  return work().finally(() => {
    button.disabled = false;
    button.replaceChildren(...before);
  });
}

export function mountPdfTools(
  root: HTMLElement,
  ctx: ToolContext,
): Tool & { showTab(tab: PdfTab): void } {
  const fail = (e: unknown) =>
    ctx.toast((e as Error).message || "Something went wrong.");
  const tabs = el("div", { class: "tabs", role: "tablist" });
  const panels = el("div");
  const tools = {
    merge: merge(),
    split: split(),
    organize: organize(),
    compress: compress(),
  };
  let active: PdfTab = "merge";

  function showTab(tab: PdfTab): void {
    active = tab;
    tabs.replaceChildren(
      ...PDF_TABS.map((t) => {
        const [icon, label] = TAB_LABELS[t];
        return el(
          "button",
          {
            class: `tab${t === tab ? " active" : ""}`,
            role: "tab",
            type: "button",
            "aria-selected": String(t === tab),
            onclick: () => showTab(t),
          },
          [el("span", { class: "material-icons", text: icon }), ` ${label}`],
        );
      }),
    );
    panels.replaceChildren(tools[tab].panel);
  }

  root.replaceChildren(
    el("div", { class: "tool-head" }, [
      el("h2", { text: "PDF tools" }),
      el("p", {
        text: "Merge, split, reorder and compress PDFs without uploading them anywhere.",
      }),
    ]),
    tabs,
    panels,
  );
  showTab("merge");

  /* ---------- Merge ---------- */
  function merge() {
    const files: File[] = [];
    const list = el("ul", { class: "queue" });
    const go = el("button", { class: "convert-btn", type: "button" }, [
      el("span", { class: "material-icons", text: "call_merge" }),
      " Merge into one PDF",
    ]);
    const bar = el("div", { class: "tool-settings", hidden: "" }, [
      el("p", {
        class: "hint",
        text: "Drag files into order with the arrows. Images become full pages.",
      }),
      el("div", { class: "toolbar-actions" }, [
        el(
          "button",
          {
            class: "text-btn",
            type: "button",
            onclick: () => {
              files.length = 0;
              render();
            },
          },
          ["Clear"],
        ),
        go,
      ]),
    ]);
    const add = (incoming: File[]) => {
      const usable = incoming.filter((f) => isPdf(f) || kindOf(f) === "image");
      if (usable.length < incoming.length)
        ctx.toast("Only PDFs and images can be merged.");
      files.push(...usable);
      render();
    };
    const move = (i: number, by: number) => {
      const [f] = files.splice(i, 1);
      if (f) files.splice(Math.max(0, Math.min(files.length, i + by)), 0, f);
      render();
    };
    function render() {
      bar.hidden = files.length === 0;
      go.disabled = files.length < 2;
      list.replaceChildren(
        ...files.map((f, i) =>
          el("li", { class: "queue-item" }, [
            el("span", {
              class: "material-icons file-icon",
              text: isPdf(f) ? "picture_as_pdf" : "image",
            }),
            el("div", { class: "file-meta" }, [
              el("div", {
                class: "file-name",
                text: `${i + 1}. ${f.name}`,
                title: f.name,
              }),
              el("div", { class: "file-sub", text: formatSize(f.size) }),
            ]),
            el("div", { class: "order-btns" }, [
              el(
                "button",
                {
                  class: "icon-btn",
                  type: "button",
                  "aria-label": `Move ${f.name} up`,
                  onclick: () => move(i, -1),
                },
                [el("span", { class: "material-icons", text: "arrow_upward" })],
              ),
              el(
                "button",
                {
                  class: "icon-btn",
                  type: "button",
                  "aria-label": `Move ${f.name} down`,
                  onclick: () => move(i, 1),
                },
                [
                  el("span", {
                    class: "material-icons",
                    text: "arrow_downward",
                  }),
                ],
              ),
            ]),
            el(
              "button",
              {
                class: "icon-btn remove",
                type: "button",
                "aria-label": `Remove ${f.name}`,
                onclick: () => {
                  files.splice(i, 1);
                  render();
                },
              },
              [el("span", { class: "material-icons", text: "close" })],
            ),
          ]),
        ),
      );
    }
    go.addEventListener(
      "click",
      () =>
        void busy(go, "Merging…", async () => {
          try {
            const blob = await mergeFiles(files);
            saveAs(blob, "merged.pdf");
            ctx.addHistory({
              name: "merged.pdf",
              from: "pdf",
              to: "merged",
              size: blob.size,
            });
            ctx.toast(`Merged ${files.length} files.`);
          } catch (e) {
            fail(e);
          }
        }),
    );
    const panel = el("div", {}, [
      dropZone(
        "call_merge",
        "Drop PDFs or images to merge",
        "Add as many as you like, then put them in order",
        true,
        ".pdf,application/pdf,image/*,.heic,.heif",
        add,
      ),
      bar,
      list,
    ]);
    return { panel, add };
  }

  /* ---------- Split ---------- */
  function split() {
    let file: File | undefined;
    let count = 0;
    const info = el("div", { class: "file-sub" });
    const every = el("input", {
      type: "radio",
      name: "split-mode",
      id: "split-every",
    });
    const ranges = el("input", {
      type: "radio",
      name: "split-mode",
      id: "split-ranges",
    });
    every.checked = true;
    const rangeText = el("input", {
      type: "text",
      id: "split-text",
      placeholder: "e.g. 1-3, 5, 8-",
      "aria-label": "Page ranges",
    });
    const together = el("input", { type: "checkbox", id: "split-one" });
    const go = el("button", { class: "convert-btn", type: "button" }, [
      el("span", { class: "material-icons", text: "call_split" }),
      " Split PDF",
    ]);
    const settings = el("div", { class: "tool-settings", hidden: "" }, [
      el("div", { class: "queue-item" }, [
        el("span", {
          class: "material-icons file-icon",
          text: "picture_as_pdf",
        }),
        el("div", { class: "file-meta" }, [
          el("div", { class: "file-name", text: "" }),
          info,
        ]),
      ]),
      el("div", { class: "setting-group mode-group" }, [
        el("label", {}, [every, " Every page as its own PDF"]),
        el("label", {}, [ranges, " Pages or ranges:"]),
        rangeText,
      ]),
      el("label", { class: "check" }, [
        together,
        " Put the selected pages into one PDF",
      ]),
      el("div", { class: "toolbar-actions" }, [go]),
    ]);
    rangeText.addEventListener("focus", () => (ranges.checked = true));
    const add = async (incoming: File[]) => {
      const pdf = incoming.find(isPdf);
      if (!pdf) return ctx.toast("Choose a PDF to split.");
      try {
        count = await pageCount(pdf);
      } catch (e) {
        return fail(e);
      }
      file = pdf;
      settings.hidden = false;
      const name = settings.querySelector(".file-name");
      if (name) name.textContent = pdf.name;
      info.textContent = `${count} page${count === 1 ? "" : "s"} · ${formatSize(pdf.size)}`;
    };
    go.addEventListener(
      "click",
      () =>
        void busy(go, "Splitting…", async () => {
          if (!file) return;
          try {
            let groups = every.checked
              ? Array.from({ length: count }, (_, i) => [i])
              : parseRanges(rangeText.value, count);
            if (together.checked) groups = [groups.flat()];
            const blobs = await splitPdf(file, groups);
            const base = baseName(file.name);
            const outputs = blobs.map((blob, i) => {
              const g = groups[i] ?? [];
              const first = (g[0] ?? 0) + 1;
              const last = (g[g.length - 1] ?? 0) + 1;
              return {
                blob,
                name: `${base}-${first === last ? `page-${first}` : `pages-${first}-${last}`}.pdf`,
              };
            });
            await saveAll(outputs, `${base}-split.zip`);
            ctx.addHistory({
              name: `${base} (split)`,
              from: "pdf",
              to: "split",
              size: file.size,
            });
            ctx.toast(
              `Created ${outputs.length} PDF${outputs.length > 1 ? "s" : ""}.`,
            );
          } catch (e) {
            fail(e);
          }
        }),
    );
    const panel = el("div", {}, [
      dropZone(
        "call_split",
        "Drop a PDF to split",
        "Extract every page or just the pages you need",
        false,
        ".pdf,application/pdf",
        (f) => void add(f),
      ),
      settings,
    ]);
    return { panel, add: (f: File[]) => void add(f) };
  }

  /* ---------- Organize ---------- */
  function organize() {
    let file: File | undefined;
    let pages: { index: number; rotate: number; url: string }[] = [];
    let dragFrom = -1;
    const grid = el("div", { class: "page-grid" });
    const save = el("button", { class: "convert-btn", type: "button" }, [
      el("span", { class: "material-icons", text: "save" }),
      " Save PDF",
    ]);
    const bar = el("div", { class: "tool-settings", hidden: "" }, [
      el("p", {
        class: "hint",
        text: "Drag pages to reorder. Rotate or remove pages with the buttons.",
      }),
      el("div", { class: "toolbar-actions" }, [save]),
    ]);
    function render() {
      bar.hidden = !file;
      save.disabled = pages.length === 0;
      grid.replaceChildren(
        ...pages.map((p, i) => {
          const card = el("div", { class: "page-card", draggable: "true" }, [
            el("div", { class: "page-thumb" }, [
              p.url
                ? el("img", {
                    src: p.url,
                    alt: `Page ${p.index + 1}`,
                    style: `transform: rotate(${p.rotate}deg)${p.rotate % 180 ? " scale(0.72)" : ""}`,
                  })
                : el("span", { class: "spinner" }),
            ]),
            el("div", { class: "page-actions" }, [
              el("span", { class: "page-num", text: String(i + 1) }),
              el(
                "button",
                {
                  class: "icon-btn",
                  type: "button",
                  "aria-label": `Move page ${i + 1} left`,
                  onclick: () => move(i, -1),
                },
                [el("span", { class: "material-icons", text: "chevron_left" })],
              ),
              el(
                "button",
                {
                  class: "icon-btn",
                  type: "button",
                  "aria-label": `Rotate page ${i + 1}`,
                  onclick: () => {
                    p.rotate = (p.rotate + 90) % 360;
                    render();
                  },
                },
                [el("span", { class: "material-icons", text: "rotate_right" })],
              ),
              el(
                "button",
                {
                  class: "icon-btn",
                  type: "button",
                  "aria-label": `Move page ${i + 1} right`,
                  onclick: () => move(i, 1),
                },
                [
                  el("span", {
                    class: "material-icons",
                    text: "chevron_right",
                  }),
                ],
              ),
              el(
                "button",
                {
                  class: "icon-btn",
                  type: "button",
                  "aria-label": `Delete page ${i + 1}`,
                  onclick: () => {
                    pages.splice(i, 1);
                    render();
                  },
                },
                [el("span", { class: "material-icons", text: "delete" })],
              ),
            ]),
          ]);
          card.addEventListener("dragstart", () => (dragFrom = i));
          card.addEventListener("dragover", (e) => e.preventDefault());
          card.addEventListener("drop", (e) => {
            e.preventDefault();
            e.stopPropagation();
            if (dragFrom >= 0 && dragFrom !== i) move(dragFrom, i - dragFrom);
            dragFrom = -1;
          });
          return card;
        }),
      );
    }
    function move(i: number, by: number) {
      const [p] = pages.splice(i, 1);
      if (p) pages.splice(Math.max(0, Math.min(pages.length, i + by)), 0, p);
      render();
    }
    const add = async (incoming: File[]) => {
      const pdf = incoming.find(isPdf);
      if (!pdf) return ctx.toast("Choose a PDF to organize.");
      pages.forEach((p) => p.url && URL.revokeObjectURL(p.url));
      file = pdf;
      try {
        const total = await pageCount(pdf);
        pages = Array.from({ length: total }, (_, index) => ({
          index,
          rotate: 0,
          url: "",
        }));
        render();
        await renderThumbnails(pdf, 220, (index, url) => {
          const page = pages.find((p) => p.index === index);
          if (page) page.url = url;
          render();
        });
      } catch (e) {
        fail(e);
      }
    };
    save.addEventListener(
      "click",
      () =>
        void busy(save, "Saving…", async () => {
          if (!file) return;
          try {
            const blob = await rebuildPdf(file, pages);
            const name = `${baseName(file.name)}-organized.pdf`;
            saveAs(blob, name);
            ctx.addHistory({
              name,
              from: "pdf",
              to: "organized",
              size: blob.size,
            });
          } catch (e) {
            fail(e);
          }
        }),
    );
    const panel = el("div", {}, [
      dropZone(
        "view_module",
        "Drop a PDF to reorder, rotate or delete pages",
        "You'll see every page as a thumbnail",
        false,
        ".pdf,application/pdf",
        (f) => void add(f),
      ),
      bar,
      grid,
    ]);
    return { panel, add: (f: File[]) => void add(f) };
  }

  /* ---------- Compress ---------- */
  function compress() {
    const items: { file: File; status: string; out?: Blob; note?: string }[] =
      [];
    const level = el(
      "select",
      { id: "pdf-level" },
      (Object.keys(COMPRESSION) as CompressionLevel[]).map((k) =>
        el("option", { value: k, text: COMPRESSION[k].label }),
      ),
    );
    level.value = "medium";
    const go = el("button", { class: "convert-btn", type: "button" }, [
      el("span", { class: "material-icons", text: "compress" }),
      " Compress",
    ]);
    const list = el("ul", { class: "queue" });
    const bar = el("div", { class: "tool-settings", hidden: "" }, [
      el("div", { class: "setting-group" }, [
        el("label", { for: "pdf-level", text: "Compression" }),
        level,
      ]),
      el("p", {
        class: "hint",
        text: "Best for scans and photo-heavy PDFs. Pages are re-rendered as images, so text can no longer be selected.",
      }),
      el("div", { class: "toolbar-actions" }, [go]),
    ]);
    function render() {
      bar.hidden = items.length === 0;
      list.replaceChildren(
        ...items.map((item) => {
          const out = item.out;
          return el("li", { class: `queue-item ${item.status}` }, [
            el("span", {
              class: "material-icons file-icon",
              text: out ? "check_circle" : "picture_as_pdf",
            }),
            el("div", { class: "file-meta" }, [
              el("div", {
                class: "file-name",
                text: item.file.name,
                title: item.file.name,
              }),
              el("div", {
                class: `file-sub${item.status === "error" ? " error" : ""}`,
                text:
                  item.note ??
                  (out
                    ? `${formatSize(item.file.size)} → ${formatSize(out.size)} (−${Math.round((1 - out.size / item.file.size) * 100)}%)`
                    : formatSize(item.file.size)),
              }),
            ]),
            item.status === "working"
              ? el("span", { class: "spinner", "aria-label": "Compressing" })
              : out
                ? el(
                    "button",
                    {
                      class: "convert-btn small",
                      type: "button",
                      onclick: () =>
                        saveAs(
                          out,
                          `${baseName(item.file.name)}-compressed.pdf`,
                        ),
                    },
                    [
                      el("span", { class: "material-icons", text: "download" }),
                      " Download",
                    ],
                  )
                : el("span"),
            el(
              "button",
              {
                class: "icon-btn remove",
                type: "button",
                "aria-label": `Remove ${item.file.name}`,
                onclick: () => {
                  items.splice(items.indexOf(item), 1);
                  render();
                },
              },
              [el("span", { class: "material-icons", text: "close" })],
            ),
          ]);
        }),
      );
    }
    const add = (incoming: File[]) => {
      const pdfs = incoming.filter(isPdf);
      if (pdfs.length < incoming.length)
        ctx.toast("Only PDFs can be compressed here.");
      pdfs.forEach((file) => items.push({ file, status: "ready" }));
      render();
    };
    go.addEventListener(
      "click",
      () =>
        void busy(go, "Compressing…", async () => {
          for (const item of items.filter((i) => i.status !== "done")) {
            item.status = "working";
            delete item.note;
            render();
            try {
              const out = await compressPdf(
                item.file,
                level.value as CompressionLevel,
                (done, total) => {
                  item.note = `Compressing page ${done} of ${total}…`;
                  render();
                },
              );
              delete item.note;
              if (out.size >= item.file.size) {
                item.status = "error";
                item.note =
                  "Already well compressed: the result would be larger, so the original is kept.";
              } else {
                item.out = out;
                item.status = "done";
                ctx.addHistory({
                  name: `${baseName(item.file.name)}-compressed.pdf`,
                  from: "pdf",
                  to: "compressed",
                  size: out.size,
                });
              }
            } catch (e) {
              item.status = "error";
              item.note = (e as Error).message;
            }
            render();
          }
        }),
    );
    const panel = el("div", {}, [
      dropZone(
        "compress",
        "Drop PDFs to make them smaller",
        "Great for scanned documents and emailing large files",
        true,
        ".pdf,application/pdf",
        add,
      ),
      bar,
      list,
    ]);
    return { panel, add };
  }

  return {
    showTab,
    addFiles(files: File[]) {
      tools[active].add(files);
    },
  };
}
