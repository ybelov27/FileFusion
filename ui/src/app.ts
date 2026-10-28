/*
 * Entry point for the converter (app.html).
 */
import { auth } from "./auth.ts";
import {
  FORMATS,
  convert,
  extOf,
  isTarget,
  kindOf,
  targetsFor,
  type ConvertResult,
  type Kind,
  type Target,
} from "./convert/index.ts";
import {
  acceptDrops,
  byId,
  downloadBlob,
  el,
  formatSize,
  openPickerOn,
} from "./dom.ts";
import { handoff } from "./handoff.ts";
import { wireShareButtons } from "./share.ts";
import type { Tool, ToolContext } from "./tools/context.ts";
import type { PdfTab } from "./tools/pdf-ui.ts";

type Status = "ready" | "working" | "done" | "error";

interface QueueItem {
  id: number;
  file: File;
  target: Target;
  status: Status;
  result?: ConvertResult & { url: string };
  error?: string;
}

interface HistoryEntry {
  name: string;
  from: string;
  to: string;
  size: number;
  at: number;
}

const VIEWS = ["convert", "compress", "pdf", "history"] as const;
type View = (typeof VIEWS)[number];
const isView = (v: string | null | undefined): v is View =>
  VIEWS.includes(v as View);
const PDF_TABS: readonly PdfTab[] = ["merge", "split", "organize", "compress"];
const isPdfFile = (f: File) =>
  extOf(f.name) === "pdf" || f.type === "application/pdf";

const queue: QueueItem[] = [];
let nextId = 1;
let searchTerm = "";
const requested = new URLSearchParams(location.search).get("to");
const preferredTarget: Target | null = isTarget(requested) ? requested : null;

/* ---------- Helpers ---------- */

const ICONS: Record<Kind, string> = {
  image: "image",
  data: "table_chart",
  markdown: "article",
  html: "code",
  text: "description",
  audio: "audiotrack",
  video: "movie",
};

function iconFor(file: File): string {
  const kind = kindOf(file);
  return kind ? ICONS[kind] : "insert_drive_file";
}

let toastTimer: ReturnType<typeof setTimeout> | undefined;
function toast(message: string): void {
  const node = byId("toast");
  node.textContent = message;
  node.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => node.classList.remove("show"), 3500);
}

const labelOf = (t: string) => (isTarget(t) ? FORMATS[t].label : t);

/* ---------- History (per signed-in account, stored on this device) ---------- */

const historyKey = () => `ff_history_${auth.user?.id ?? "guest"}`;

function readHistory(): HistoryEntry[] {
  try {
    return (
      (JSON.parse(localStorage.getItem(historyKey()) ?? "null") as
        HistoryEntry[] | null) ?? []
    );
  } catch {
    return [];
  }
}

function addHistory(entry: HistoryEntry): void {
  const list = [entry, ...readHistory()].slice(0, 100);
  try {
    localStorage.setItem(historyKey(), JSON.stringify(list));
  } catch {
    /* storage unavailable */
  }
  renderHistory();
}

function renderHistory(): void {
  const all = readHistory();
  const list = all.filter((h) => h.name.toLowerCase().includes(searchTerm));
  byId("history").replaceChildren(
    ...list.map((h) =>
      el("li", { class: "queue-item" }, [
        el("span", { class: "material-icons file-icon", text: "task_alt" }),
        el("div", { class: "file-meta" }, [
          el("div", { class: "file-name", text: h.name }),
          el("div", {
            class: "file-sub",
            text: `${h.from.toUpperCase()} → ${labelOf(h.to)} · ${formatSize(h.size)} · ${new Date(h.at).toLocaleString()}`,
          }),
        ]),
      ]),
    ),
  );
  byId("history-empty").hidden = list.length > 0;
  byId("history-count").textContent = all.length ? String(all.length) : "";
}

/* ---------- Queue ---------- */

const bulkTarget = byId<HTMLSelectElement>("bulk-target");

function addFiles(files: Iterable<File>): void {
  let rejected = 0;
  const all = Array.from(files);
  // PDFs have their own tools; send them there instead of rejecting them.
  const pdfs = all.filter(isPdfFile);
  if (pdfs.length) {
    void openPdfTools(pdfs.length > 1 ? "merge" : "organize").then((t) =>
      t.addFiles(pdfs),
    );
    toast("PDFs opened in PDF tools.");
    if (pdfs.length === all.length) return;
  }
  for (const file of all.filter((f) => !isPdfFile(f))) {
    const targets = targetsFor(file);
    const first = targets[0];
    if (!first) {
      rejected++;
      continue;
    }
    const bulk = bulkTarget.value;
    const target =
      preferredTarget && targets.includes(preferredTarget)
        ? preferredTarget
        : isTarget(bulk) && targets.includes(bulk)
          ? bulk
          : first;
    queue.push({ id: nextId++, file, target, status: "ready" });
  }
  if (rejected)
    toast(
      `${rejected} file${rejected > 1 ? "s" : ""} skipped: format not supported yet.`,
    );
  renderQueue();
  showView("convert");
}

function renderBulkOptions(): void {
  const current = bulkTarget.value;
  const union: Target[] = [];
  queue.forEach((q) =>
    targetsFor(q.file).forEach((t) => {
      if (!union.includes(t)) union.push(t);
    }),
  );
  bulkTarget.replaceChildren(
    ...union.map((t) => el("option", { value: t, text: FORMATS[t].label })),
  );
  if (isTarget(current) && union.includes(current)) bulkTarget.value = current;
  else if (preferredTarget && union.includes(preferredTarget))
    bulkTarget.value = preferredTarget;
}

function renderQueue(): void {
  const visible = queue.filter((q) =>
    q.file.name.toLowerCase().includes(searchTerm),
  );
  byId("queue").replaceChildren(...visible.map(renderItem));
  byId("queue-toolbar").hidden = queue.length === 0;
  byId("queue-count").textContent = queue.length ? String(queue.length) : "";
  renderBulkOptions();
  byId("drop-zone").classList.toggle("compact", queue.length > 0);
  const anyDone = queue.some((q) => q.status === "done");
  byId("signin-nudge").hidden = !(auth.enabled && !auth.user && anyDone);
  byId("share-card").hidden = shareDismissed || !anyDone;
}

function renderItem(item: QueueItem): HTMLLIElement {
  const select = el(
    "select",
    {
      "aria-label": `Convert ${item.file.name} to`,
      onchange: (e) => {
        const value = (e.target as HTMLSelectElement).value;
        if (!isTarget(value)) return;
        item.target = value;
        resetItem(item);
        renderQueue();
      },
    },
    targetsFor(item.file).map((t) =>
      el("option", { value: t, text: FORMATS[t].label }),
    ),
  );
  select.value = item.target;
  select.disabled = item.status === "working";

  let action: HTMLElement;
  const result = item.result;
  if (item.status === "done" && result) {
    action = el(
      "button",
      {
        class: "convert-btn small",
        onclick: () => downloadBlob(result.url, result.name),
      },
      [el("span", { class: "material-icons", text: "download" }), " Download"],
    );
  } else if (item.status === "working") {
    action = el("span", { class: "spinner", "aria-label": "Converting" });
  } else {
    action = el(
      "button",
      { class: "convert-btn small outline", onclick: () => void run(item) },
      [item.status === "error" ? "Retry" : "Convert"],
    );
  }

  const sub =
    item.status === "error"
      ? el("div", {
          class: "file-sub error",
          text: item.error ?? "Conversion failed.",
        })
      : el("div", {
          class: "file-sub",
          text: result
            ? `${formatSize(item.file.size)} → ${formatSize(result.blob.size)} · ready`
            : `${extOf(item.file.name).toUpperCase() || "FILE"} · ${formatSize(item.file.size)}`,
        });

  return el("li", { class: `queue-item ${item.status}` }, [
    el("span", {
      class: "material-icons file-icon",
      text: item.status === "done" ? "check_circle" : iconFor(item.file),
    }),
    el("div", { class: "file-meta" }, [
      el("div", {
        class: "file-name",
        text: item.file.name,
        title: item.file.name,
      }),
      sub,
    ]),
    el("div", { class: "file-target" }, [
      el("span", { class: "material-icons arrow", text: "arrow_forward" }),
      select,
    ]),
    action,
    el(
      "button",
      {
        class: "icon-btn remove",
        "aria-label": `Remove ${item.file.name}`,
        onclick: () => remove(item),
      },
      [el("span", { class: "material-icons", text: "close" })],
    ),
  ]);
}

function resetItem(item: QueueItem): void {
  if (item.result) URL.revokeObjectURL(item.result.url);
  delete item.result;
  delete item.error;
  item.status = "ready";
}

function remove(item: QueueItem): void {
  resetItem(item);
  queue.splice(queue.indexOf(item), 1);
  renderQueue();
}

async function run(item: QueueItem): Promise<QueueItem> {
  if (item.status === "working") return item;
  resetItem(item);
  item.status = "working";
  renderQueue();
  try {
    const { blob, name } = await convert(item.file, item.target);
    item.result = { blob, name, url: URL.createObjectURL(blob) };
    item.status = "done";
    addHistory({
      name,
      from: extOf(item.file.name),
      to: item.target,
      size: blob.size,
      at: Date.now(),
    });
  } catch (e) {
    item.status = "error";
    item.error = (e as Error).message || "Conversion failed.";
  }
  renderQueue();
  return item;
}

async function convertAll(): Promise<void> {
  const bulk = bulkTarget.value;
  queue.forEach((q) => {
    if (
      q.status !== "done" &&
      isTarget(bulk) &&
      targetsFor(q.file).includes(bulk)
    )
      q.target = bulk;
  });
  const pending = queue.filter((q) => q.status !== "done");
  for (const item of pending) await run(item);
  const done = pending.filter((q) => q.status === "done");
  const only = done[0]?.result;
  if (done.length === 1 && only) downloadBlob(only.url, only.name);
  if (done.length)
    toast(`Converted ${done.length} file${done.length > 1 ? "s" : ""}.`);
}

/* ---------- Views & input ---------- */

let activeView: View = "convert";

function showView(name: View): void {
  activeView = name;
  for (const v of VIEWS) byId(`view-${v}`).hidden = v !== name;
  if (name === "compress") void openCompress();
  if (name === "pdf") void openPdfTools();
  document
    .querySelectorAll<HTMLElement>(".nav-links li")
    .forEach((li) => li.classList.toggle("active", li.dataset.view === name));
  setSidebar(false);
  if (name === "history") renderHistory();
}

function setSidebar(open: boolean): void {
  document.body.classList.toggle("sidebar-open", open);
  byId("scrim").hidden = !open;
}

const input = byId<HTMLInputElement>("file-input");
const drop = byId("drop-zone");

input.addEventListener("change", () => {
  if (input.files) addFiles(input.files);
  input.value = "";
});
openPickerOn(drop, input);
byId("new-btn").addEventListener("click", () => {
  showView("convert");
  input.click();
});

/* ---------- Tools (loaded the first time they are opened) ---------- */

const toolContext: ToolContext = {
  toast,
  addHistory: (entry) => addHistory({ ...entry, at: Date.now() }),
};
let compressTool: Promise<Tool> | undefined;
let pdfTool: Promise<Tool & { showTab(tab: PdfTab): void }> | undefined;

function openCompress(): Promise<Tool> {
  compressTool ??= import("./tools/compress-ui.ts").then((m) =>
    m.mountCompress(byId("view-compress"), toolContext),
  );
  if (activeView !== "compress") showView("compress");
  return compressTool;
}

async function openPdfTools(tab?: PdfTab): Promise<Tool> {
  pdfTool ??= import("./tools/pdf-ui.ts").then((m) =>
    m.mountPdfTools(byId("view-pdf"), toolContext),
  );
  if (activeView !== "pdf") showView("pdf");
  const tool = await pdfTool;
  if (tab) tool.showTab(tab);
  return tool;
}

/** Sends dropped or pasted files to whichever view is open. */
function routeFiles(files: File[]): void {
  if (activeView === "compress")
    void openCompress().then((t) => t.addFiles(files));
  else if (activeView === "pdf")
    void openPdfTools().then((t) => t.addFiles(files));
  else addFiles(files);
}

const activeZone = () =>
  document.querySelector<HTMLElement>(`#view-${activeView} .upload-area`) ??
  drop;
acceptDrops(document.body, (files) => routeFiles(Array.from(files)));
for (const type of ["dragenter", "dragover"] as const)
  document.addEventListener(type, () => activeZone().classList.add("dragging"));
for (const type of ["dragleave", "drop"] as const)
  document.addEventListener(type, (e) => {
    if (type === "drop" || !e.relatedTarget)
      document
        .querySelectorAll(".upload-area.dragging")
        .forEach((z) => z.classList.remove("dragging"));
  });

document.addEventListener("paste", (e) => {
  const files = Array.from(e.clipboardData?.files ?? []);
  if (!files.length) return;
  routeFiles(
    files.map((f, i) =>
      f.name && f.name !== "image.png"
        ? f
        : new File(
            [f],
            `pasted-${Date.now()}-${i}.${f.type.split("/")[1] || "png"}`,
            {
              type: f.type,
            },
          ),
    ),
  );
});

byId("convert-all").addEventListener("click", () => void convertAll());
byId("clear-queue").addEventListener("click", () => {
  queue.slice().forEach(resetItem);
  queue.length = 0;
  renderQueue();
});
byId("clear-history").addEventListener("click", () => {
  try {
    localStorage.removeItem(historyKey());
  } catch {
    /* ignore */
  }
  renderHistory();
});
byId<HTMLInputElement>("search").addEventListener("input", (e) => {
  searchTerm = (e.target as HTMLInputElement).value.trim().toLowerCase();
  renderQueue();
  renderHistory();
});
byId("menu-toggle").addEventListener("click", () =>
  setSidebar(!document.body.classList.contains("sidebar-open")),
);
byId("scrim").addEventListener("click", () => setSidebar(false));
document.querySelectorAll<HTMLElement>(".nav-links li").forEach((li) =>
  li.addEventListener("click", () => {
    const view = li.dataset.view;
    if (isView(view)) showView(view);
  }),
);

/* ---------- Sharing ---------- */

let shareDismissed = false;
try {
  shareDismissed = localStorage.getItem("ff_share_dismissed") === "1";
} catch {
  /* storage unavailable */
}
wireShareButtons(document);
byId("share-dismiss").addEventListener("click", () => {
  shareDismissed = true;
  try {
    localStorage.setItem("ff_share_dismissed", "1");
  } catch {
    /* storage unavailable */
  }
  renderQueue();
});

/* ---------- Account ---------- */

const menu = byId("account-menu");
const profileBtn = byId<HTMLButtonElement>("profile-btn");
profileBtn.addEventListener("click", (e) => {
  e.stopPropagation();
  menu.hidden = !menu.hidden;
  profileBtn.setAttribute("aria-expanded", String(!menu.hidden));
});
document.addEventListener("click", (e) => {
  if (!menu.contains(e.target as Node)) menu.hidden = true;
});
byId("sign-out").addEventListener("click", () => {
  menu.hidden = true;
  auth.signOut();
  toast("Signed out.");
});

function renderAccount(user: typeof auth.user): void {
  profileBtn.hidden = !user;
  byId("gsi-header").hidden = Boolean(user) || !auth.enabled;
  if (user) {
    profileBtn.replaceChildren(
      user.picture
        ? el("img", {
            src: user.picture,
            alt: user.name,
            referrerpolicy: "no-referrer",
          })
        : document.createTextNode((user.name || "?").charAt(0).toUpperCase()),
    );
    profileBtn.title = `${user.name}\n${user.email}`;
    const avatar = byId<HTMLImageElement>("account-avatar");
    avatar.src = user.picture || "";
    avatar.hidden = !user.picture;
    byId("account-name").textContent = user.name;
    const email = byId("account-email");
    email.textContent = user.email;
    email.title = user.email;
  }
  renderQueue();
  renderHistory();
}

let wasSignedIn = Boolean(auth.user);
auth.onChange((user) => {
  renderAccount(user);
  if (user && !wasSignedIn)
    toast(`Signed in as ${user.givenName || user.name}.`);
  wasSignedIn = Boolean(user);
});
const narrow = window.matchMedia("(max-width: 600px)").matches;
void auth.renderButton(
  byId("gsi-header"),
  narrow
    ? { type: "icon", shape: "circle", size: "medium" }
    : { size: "medium", text: "signin" },
);
void auth.renderButton(byId("gsi-nudge"), { text: "continue_with" });

/* ---------- Files handed over from the landing page ---------- */

// Links like app.html?view=pdf&tool=merge (from the landing pages) open a tool.
const startView = new URLSearchParams(location.search).get("view");
const startTab = new URLSearchParams(location.search).get("tool");
const opening: Promise<unknown> =
  startView === "pdf"
    ? openPdfTools(PDF_TABS.find((t) => t === startTab))
    : startView === "compress"
      ? openCompress()
      : Promise.resolve();

void opening.then(async () => {
  const files = await handoff.take();
  if (files.length) routeFiles(files);
});
renderQueue();
renderHistory();
