/*
 * "Compress & resize" view: batch image compression with quality or
 * target-size modes and optional maximum dimensions.
 */
import { kindOf } from "../convert/formats.ts";
import { downloadBlob, el, formatSize, openPickerOn } from "../dom.ts";
import {
  compressImage,
  type CompressResult,
  type CompressSettings,
  type OutputFormat,
} from "./compress-image.ts";
import { zipFiles, type Tool, type ToolContext } from "./context.ts";

interface Item {
  file: File;
  status: "ready" | "working" | "done" | "error";
  result?: CompressResult & { url: string };
  error?: string;
}

export function mountCompress(root: HTMLElement, ctx: ToolContext): Tool {
  const items: Item[] = [];
  const input = el("input", {
    type: "file",
    accept: "image/*,.heic,.heif",
    multiple: "",
    hidden: "",
  });
  const drop = el(
    "div",
    {
      class: "upload-area",
      tabindex: "0",
      role: "button",
      "aria-label": "Choose images to compress",
    },
    [
      el("span", {
        class: "material-icons upload-icon",
        text: "photo_size_select_large",
      }),
      el("h2", { text: "Drop images to compress or resize" }),
      el("p", { text: "JPG, PNG, WEBP, HEIC (iPhone), GIF, BMP, AVIF" }),
      el("button", {
        class: "browse-btn",
        type: "button",
        text: "Browse Files",
      }),
      input,
    ],
  );

  const format = el("select", { id: "cmp-format" }, [
    el("option", { value: "same", text: "Same as original" }),
    el("option", { value: "jpg", text: "JPG" }),
    el("option", { value: "webp", text: "WEBP (smallest)" }),
    el("option", { value: "png", text: "PNG (lossless)" }),
  ]);
  const maxW = el("input", {
    id: "cmp-w",
    type: "number",
    min: "1",
    placeholder: "Original",
    inputmode: "numeric",
  });
  const maxH = el("input", {
    id: "cmp-h",
    type: "number",
    min: "1",
    placeholder: "Original",
    inputmode: "numeric",
  });
  const modeQuality = el("input", {
    type: "radio",
    name: "cmp-mode",
    value: "quality",
    id: "cmp-mode-q",
  });
  const modeTarget = el("input", {
    type: "radio",
    name: "cmp-mode",
    value: "target",
    id: "cmp-mode-t",
  });
  modeQuality.checked = true;
  const quality = el("input", {
    id: "cmp-q",
    type: "range",
    min: "10",
    max: "100",
    value: "80",
  });
  const qualityLabel = el("span", { class: "range-value", text: "80%" });
  const targetKB = el("input", {
    id: "cmp-kb",
    type: "number",
    min: "5",
    value: "200",
    inputmode: "numeric",
  });
  const qualityRow = el("div", { class: "setting-group" }, [
    el("label", { for: "cmp-q", text: "Quality" }),
    quality,
    qualityLabel,
  ]);
  const targetRow = el("div", { class: "setting-group", hidden: "" }, [
    el("label", { for: "cmp-kb", text: "Max file size" }),
    targetKB,
    el("span", { text: "KB" }),
  ]);
  const run = el("button", { class: "convert-btn", type: "button" }, [
    el("span", { class: "material-icons", text: "compress" }),
    " Compress all",
  ]);
  const zip = el("button", { class: "text-btn", type: "button", hidden: "" }, [
    "Download all (ZIP)",
  ]);
  const clear = el("button", {
    class: "text-btn",
    type: "button",
    text: "Clear",
  });
  const panel = el("div", { class: "tool-settings", hidden: "" }, [
    el("div", { class: "setting-group" }, [
      el("label", { for: "cmp-format", text: "Format" }),
      format,
    ]),
    el("div", { class: "setting-group" }, [
      el("label", { for: "cmp-w", text: "Max width" }),
      maxW,
      el("label", { for: "cmp-h", text: "Max height" }),
      maxH,
      el("span", { text: "px" }),
    ]),
    el(
      "div",
      {
        class: "setting-group mode-group",
        role: "radiogroup",
        "aria-label": "Compression mode",
      },
      [
        el("label", {}, [modeQuality, " Set quality"]),
        el("label", {}, [modeTarget, " Target file size"]),
      ],
    ),
    qualityRow,
    targetRow,
    el("div", { class: "toolbar-actions" }, [clear, zip, run]),
  ]);
  const list = el("ul", { class: "queue" });

  root.replaceChildren(
    el("div", { class: "tool-head" }, [
      el("h2", { text: "Compress & resize images" }),
      el("p", {
        text: "Shrink photos for email, forms and websites, or resize them to exact dimensions. Everything happens on your device.",
      }),
    ]),
    drop,
    panel,
    list,
  );

  const settings = (): CompressSettings => ({
    format: format.value as OutputFormat,
    maxWidth: Number(maxW.value) || undefined,
    maxHeight: Number(maxH.value) || undefined,
    mode: modeTarget.checked ? "target" : "quality",
    quality: Number(quality.value) / 100,
    targetKB: Math.max(5, Number(targetKB.value) || 200),
  });

  const reset = (item: Item) => {
    if (item.result) URL.revokeObjectURL(item.result.url);
    delete item.result;
    delete item.error;
    item.status = "ready";
  };
  // Any settings change makes finished results stale.
  for (const control of [
    format,
    maxW,
    maxH,
    quality,
    targetKB,
    modeQuality,
    modeTarget,
  ])
    control.addEventListener("input", () => {
      qualityLabel.textContent = `${quality.value}%`;
      qualityRow.hidden = modeTarget.checked;
      targetRow.hidden = !modeTarget.checked;
      items.forEach((i) => i.status !== "working" && reset(i));
      render();
    });

  function render(): void {
    panel.hidden = items.length === 0;
    drop.classList.toggle("compact", items.length > 0);
    zip.hidden = items.filter((i) => i.status === "done").length < 2;
    list.replaceChildren(
      ...items.map((item) => {
        const r = item.result;
        const saved =
          r && !r.unchanged
            ? Math.round((1 - r.blob.size / item.file.size) * 100)
            : 0;
        const sub = item.error
          ? el("div", { class: "file-sub error", text: item.error })
          : el("div", {
              class: "file-sub",
              text: r
                ? r.unchanged
                  ? `${formatSize(item.file.size)} · already as small as it gets at these settings`
                  : `${formatSize(item.file.size)} → ${formatSize(r.blob.size)} (${saved >= 0 ? "−" : "+"}${Math.abs(saved)}%) · ${r.width}×${r.height}`
                : formatSize(item.file.size),
            });
        const action =
          item.status === "working"
            ? el("span", { class: "spinner", "aria-label": "Compressing" })
            : r
              ? el(
                  "button",
                  {
                    class: "convert-btn small",
                    type: "button",
                    onclick: () => downloadBlob(r.url, r.name),
                  },
                  [
                    el("span", { class: "material-icons", text: "download" }),
                    " Download",
                  ],
                )
              : el("span");
        return el("li", { class: `queue-item ${item.status}` }, [
          el("span", {
            class: "material-icons file-icon",
            text: r ? "check_circle" : "image",
          }),
          el("div", { class: "file-meta" }, [
            el("div", {
              class: "file-name",
              text: item.file.name,
              title: item.file.name,
            }),
            sub,
          ]),
          action,
          el(
            "button",
            {
              class: "icon-btn remove",
              type: "button",
              "aria-label": `Remove ${item.file.name}`,
              onclick: () => {
                reset(item);
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

  async function compressAll(): Promise<void> {
    const options = settings();
    const pending = items.filter((i) => i.status !== "done");
    for (const item of pending) {
      reset(item);
      item.status = "working";
      render();
      try {
        const result = await compressImage(item.file, options);
        item.result = { ...result, url: URL.createObjectURL(result.blob) };
        item.status = "done";
        ctx.addHistory({
          name: result.name,
          from: "image",
          to: "compressed",
          size: result.blob.size,
        });
      } catch (e) {
        item.status = "error";
        item.error = (e as Error).message;
      }
      render();
    }
    const done = items.filter((i) => i.result);
    const before = done.reduce((s, i) => s + i.file.size, 0);
    const after = done.reduce((s, i) => s + (i.result?.blob.size ?? 0), 0);
    if (done.length)
      ctx.toast(
        `Saved ${formatSize(Math.max(0, before - after))} across ${done.length} image${done.length > 1 ? "s" : ""}.`,
      );
  }

  function addFiles(files: File[]): void {
    const images = files.filter((f) => kindOf(f) === "image");
    if (images.length < files.length)
      ctx.toast("Only images can be compressed here.");
    images.forEach((file) => items.push({ file, status: "ready" }));
    render();
  }

  openPickerOn(drop, input);
  input.addEventListener("change", () => {
    addFiles(Array.from(input.files ?? []));
    input.value = "";
  });
  run.addEventListener("click", () => void compressAll());
  clear.addEventListener("click", () => {
    items.forEach(reset);
    items.length = 0;
    render();
  });
  zip.addEventListener("click", async () => {
    const blob = await zipFiles(
      items.flatMap((i) => (i.result ? [i.result] : [])),
    );
    const url = URL.createObjectURL(blob);
    downloadBlob(url, "compressed-images.zip");
    setTimeout(() => URL.revokeObjectURL(url), 10_000);
  });

  render();
  return { addFiles };
}
