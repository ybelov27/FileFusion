/*
 * Small DOM helpers shared by the pages.
 */

/** Returns the element with this id, or throws if the page is missing it. */
export function byId<T extends HTMLElement = HTMLElement>(id: string): T {
  const node = document.getElementById(id);
  if (!node) throw new Error(`Missing #${id}`);
  return node as T;
}

type Attrs = Record<string, string | ((event: Event) => void)>;

/** Creates an element; "class", "text" and on* keys are handled specially. */
export function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  attrs: Attrs = {},
  children: (Node | string | null | undefined)[] = [],
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (typeof v === "function") node.addEventListener(k.slice(2), v);
    else if (k === "class") node.className = v;
    else if (k === "text") node.textContent = v;
    else node.setAttribute(k, v);
  }
  children.forEach((c) => {
    if (c != null) node.append(c);
  });
  return node;
}

export function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

export function downloadBlob(url: string, name: string): void {
  const a = el("a", { href: url, download: name });
  document.body.append(a);
  a.click();
  a.remove();
}

/** Accepts files dropped anywhere on the page, highlighting the drop zone. */
export function acceptDrops(
  zone: HTMLElement,
  onFiles: (files: FileList) => void,
): void {
  for (const type of ["dragenter", "dragover"] as const)
    document.addEventListener(type, (e) => {
      e.preventDefault();
      zone.classList.add("dragging");
    });
  document.addEventListener("dragleave", (e) => {
    if (!e.relatedTarget) zone.classList.remove("dragging");
  });
  document.addEventListener("drop", (e) => {
    e.preventDefault();
    zone.classList.remove("dragging");
    if (e.dataTransfer?.files.length) onFiles(e.dataTransfer.files);
  });
}

/** Makes an element open a file picker on click, Enter or Space. */
export function openPickerOn(
  target: HTMLElement,
  input: HTMLInputElement,
): void {
  target.addEventListener("click", () => input.click());
  target.addEventListener("keydown", (e) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      input.click();
    }
  });
}
