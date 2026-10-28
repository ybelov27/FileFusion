// Renders tools/social-card.html to ui/public/social-card.png (1200x630, link previews)
// and .github/social-preview.png (1280x640, GitHub repo preview).
// Needs Google Chrome and `npm i playwright-core`. Serve the repo root, then:
//   node tools/social-card.ts http://localhost:8000
import { chromium } from "playwright-core";

const base = process.argv[2];
const browser = await chromium.launch({ channel: "chrome" });
const outputs: [width: number, height: number, path: string][] = [
  [1200, 630, "ui/public/social-card.png"],
  [1280, 640, ".github/social-preview.png"],
];
for (const [w, h, out] of outputs) {
  const page = await browser.newPage({ viewport: { width: w, height: h } });
  await page.goto(`${base}/tools/social-card.html`, {
    waitUntil: "networkidle",
  });
  await page.evaluate(() => document.fonts.ready);
  await page.screenshot({ path: out });
  await page.close();
}
await browser.close();
