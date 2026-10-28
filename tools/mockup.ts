// Renders ui/app.html with sample files and saves it as the landing-page mockup.
// Needs Google Chrome and `npm i playwright-core`. Serve ui/ first, then:
//   node tools/mockup.ts http://localhost:8000 ui/converter-screenshot.png
import { chromium } from "playwright-core";

const [base, out] = process.argv.slice(2);
const browser = await chromium.launch({ channel: "chrome" });
const page = await browser.newPage({
  viewport: { width: 1200, height: 800 },
  deviceScaleFactor: 2,
});

await page.addInitScript(() => {
  localStorage.setItem(
    "ff_user",
    JSON.stringify({
      id: "demo",
      name: "Alex Rivera",
      givenName: "Alex",
      email: "alex@example.com",
      picture: "",
    }),
  );
});
await page.goto(`${base}/app.html`, { waitUntil: "networkidle" });

await page.evaluate(async () => {
  const canvas = document.createElement("canvas");
  canvas.width = 1600;
  canvas.height = 1000;
  const ctx = canvas.getContext("2d")!;
  const g = ctx.createLinearGradient(0, 0, 1600, 1000);
  g.addColorStop(0, "#4285f4");
  g.addColorStop(1, "#a142f4");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 1600, 1000);
  const png = await new Promise<Blob>((resolve) =>
    canvas.toBlob((b) => resolve(b!), "image/png"),
  );
  const rows = ["region,month,revenue,units"];
  for (let i = 0; i < 400; i++)
    rows.push(
      `R${i % 7},2026-${String((i % 12) + 1).padStart(2, "0")},${1000 + i * 37},${i % 90}`,
    );
  const files = [
    new File([png], "vacation-photo.png", { type: "image/png" }),
    new File([rows.join("\n")], "q3-sales-report.csv", { type: "text/csv" }),
    new File([png], "product-shot.png", { type: "image/png" }),
    new File(
      ["# Release notes\n\n- Faster conversions\n- Batch mode\n"],
      "release-notes.md",
    ),
    new File(
      [
        JSON.stringify([
          { id: 1, name: "Ada" },
          { id: 2, name: "Linus" },
        ]),
      ],
      "customers.json",
    ),
  ];
  const dt = new DataTransfer();
  files.forEach((f) => dt.items.add(f));
  const input = document.getElementById("file-input") as HTMLInputElement;
  input.files = dt.files;
  input.dispatchEvent(new Event("change"));
});

// Pick targets that show off the range, then convert the first three.
const selects = page.locator(".queue-item select");
await selects.nth(0).selectOption("pdf");
await selects.nth(1).selectOption("json");
await selects.nth(2).selectOption("webp");
await selects.nth(3).selectOption("html");
await selects.nth(4).selectOption("csv");
for (let i = 0; i < 3; i++) {
  await page
    .locator(".queue-item")
    .nth(i)
    .getByRole("button", { name: "Convert" })
    .click();
  await page
    .locator(".queue-item")
    .nth(i)
    .getByRole("button", { name: "Download" })
    .waitFor();
}
await page.mouse.move(0, 0);
await page.waitForTimeout(4500); // let the "Converted" toast slide away
await page.screenshot({ path: out });
await browser.close();
