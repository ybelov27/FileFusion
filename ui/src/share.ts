/*
 * Share buttons. Any element with data-share="native|copy|x|reddit|linkedin|hn"
 * shares the site (or data-share-url) when clicked.
 */
import { config } from "./config.ts";

const TEXT =
  "File Fusion: a free, open-source file converter that runs entirely in your browser. No uploads, no sign-up.";

const intents: Record<string, (url: string, text: string) => string> = {
  x: (u, t) =>
    `https://twitter.com/intent/tweet?text=${encodeURIComponent(t)}&url=${encodeURIComponent(u)}`,
  reddit: (u, t) =>
    `https://www.reddit.com/submit?url=${encodeURIComponent(u)}&title=${encodeURIComponent(t)}`,
  linkedin: (u) =>
    `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(u)}`,
  hn: (u, t) =>
    `https://news.ycombinator.com/submitlink?u=${encodeURIComponent(u)}&t=${encodeURIComponent(t)}`,
};

async function copy(url: string, button: HTMLElement): Promise<void> {
  try {
    await navigator.clipboard.writeText(url);
    const label =
      button.querySelector<HTMLElement>("[data-share-label]") ?? button;
    const before = label.textContent;
    label.textContent = "Link copied";
    setTimeout(() => {
      label.textContent = before;
    }, 2000);
  } catch {
    window.prompt("Copy this link:", url);
  }
}

export function wireShareButtons(root: ParentNode): void {
  root.querySelectorAll<HTMLElement>("[data-share]").forEach((el) => {
    const kind = el.dataset.share ?? "";
    const url = el.dataset.shareUrl || config.siteUrl;
    const text = el.dataset.shareText || TEXT;
    if (kind === "native" && !("share" in navigator)) {
      el.hidden = true;
      return;
    }
    const intent = intents[kind];
    if (intent) {
      el.setAttribute("href", intent(url, text));
      el.setAttribute("target", "_blank");
      el.setAttribute("rel", "noopener");
      return;
    }
    el.addEventListener("click", (e) => {
      e.preventDefault();
      if (kind === "native")
        navigator.share({ title: "File Fusion", text, url }).catch(() => {});
      else if (kind === "copy") void copy(url, el);
    });
  });
}
