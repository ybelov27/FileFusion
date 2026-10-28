# Contributing to File Fusion

Thanks for helping! File Fusion is a static site written in TypeScript: the app lives in `ui/src/`, the pages in `ui/`, and everything runs in the browser.

## Run it locally

```bash
npm install
npm run dev
```

Then open http://localhost:8000. Before opening a pull request, run `npm run build` (it type-checks and builds) and `npm run format`.

## Add a conversion format

1. Add the format to `FORMATS` and `TARGETS_BY_KIND` in `ui/src/convert/formats.ts`.
2. Implement it in `convert()` (`ui/src/convert/index.ts`) using browser APIs only. Files must never be uploaded. Heavy libraries should be loaded with `await import(...)` so they only download when used.
3. Optionally add a landing page entry in `tools/build-pages.ts`; `npm run dev` and `npm run build` regenerate the pages.

## Good first contributions

- New formats: DOCX to text, YAML input, EPUB to PDF, SVG optimization
- Translations of the landing page
- Accessibility and mobile polish

Open an issue with the **Request a conversion format** template if you're unsure where to start.

## Pull requests

- Keep changes focused and describe how you tested them.
- Never commit API keys, `.env` files or OAuth client secrets.
