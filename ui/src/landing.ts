/*
 * Entry point for the home page and the generated converter pages.
 */
import { acceptDrops, openPickerOn } from "./dom.ts";
import { handoff } from "./handoff.ts";
import { wireShareButtons } from "./share.ts";
import { showStarCount } from "./stars.ts";

const drop = document.getElementById("hero-drop");
const input = document.getElementById("hero-input") as HTMLInputElement | null;
// Conversion pages (e.g. png-to-jpg.html) preselect their target format in the
// converter; tool pages (e.g. merge-pdf.html) open that tool.
function converterUrl(): string {
  const params = new URLSearchParams();
  const { target, view, tool } = drop?.dataset ?? {};
  if (target) params.set("to", target);
  if (view) params.set("view", view);
  if (tool) params.set("tool", tool);
  const query = params.toString();
  return query ? `app.html?${query}` : "app.html";
}

async function start(files: FileList | null): Promise<void> {
  if (!files?.length) return;
  try {
    await handoff.put(files);
  } catch {
    /* fall through: the converter opens empty */
  }
  location.href = converterUrl();
}

if (drop && input) {
  openPickerOn(drop, input);
  input.addEventListener("change", () => void start(input.files));
  acceptDrops(drop, (files) => void start(files));
  document.addEventListener("paste", (e) => {
    if (e.clipboardData?.files.length) void start(e.clipboardData.files);
  });
}

wireShareButtons(document);
void showStarCount();

// Google sign-in only loads on pages that show it (the home page), so the
// converter pages never load Google's script or show One Tap.
const navUser = document.getElementById("nav-user");
const gsiNav = document.getElementById("gsi-nav");
const gsiHero = document.getElementById("gsi-hero");
if (navUser || gsiNav || gsiHero) {
  const { auth } = await import("./auth.ts");
  auth.onChange((user) => {
    if (gsiNav) gsiNav.hidden = Boolean(user) || !auth.enabled;
    if (gsiHero) gsiHero.hidden = Boolean(user) || !auth.enabled;
    if (!navUser) return;
    navUser.hidden = !user;
    if (user) {
      navUser.replaceChildren();
      if (user.picture) {
        const img = document.createElement("img");
        img.src = user.picture;
        img.alt = "";
        img.referrerPolicy = "no-referrer";
        navUser.append(img);
      }
      navUser.append(`Hi, ${user.givenName || user.name}`);
    }
  });
  void auth.renderButton(gsiNav, { size: "medium", text: "signin" });
  void auth.renderButton(gsiHero, { size: "large", text: "continue_with" });
  void auth.promptOneTap();
}
