// Generates one landing page per popular conversion (ui/<slug>.html) and
// ui/public/sitemap.xml. Runs before every build (npm run build/dev), or:
//   node tools/build-pages.ts
import fs from "node:fs";
import path from "node:path";

const SITE = "https://ybelov27.github.io/FileFusion/";
const UI = path.join(import.meta.dirname, "..", "ui");
const TODAY = new Date().toISOString().slice(0, 10);

const IMG = "image/*,.png,.jpg,.jpeg,.webp,.gif,.svg,.bmp,.avif,.ico";
type Faq = [question: string, answer: string];

interface ConverterPage {
  slug: string;
  from: string;
  to: string;
  // Format preselected in the converter (a key of FORMATS in ui/src/convert/formats.ts).
  target: string;
  icon: string;
  accept: string;
  group: "image" | "audio" | "data" | "text";
  intro: string;
  uses: string[];
  faqs: Faq[];
}

const pages: ConverterPage[] = [
  {
    slug: "image-to-pdf",
    from: "Image",
    to: "PDF",
    target: "pdf",
    icon: "picture_as_pdf",
    accept: IMG,
    group: "image",
    intro:
      "Turn photos, screenshots and scans into PDF documents you can email, print or upload to forms that only accept PDFs.",
    uses: [
      "Submit receipts and IDs to forms that require PDF",
      "Send screenshots as a single printable document",
      "Archive scans in a format every device opens",
    ],
    faqs: [
      [
        "Which image types can I convert to PDF?",
        "JPG, PNG, WEBP, GIF, SVG, BMP and AVIF. Each image becomes a PDF page sized to the picture.",
      ],
      [
        "Will the PDF be blurry?",
        "No. The image is embedded at its original resolution as high-quality JPEG.",
      ],
    ],
  },
  {
    slug: "png-to-jpg",
    from: "PNG",
    to: "JPG",
    target: "jpg",
    icon: "image",
    accept: ".png,image/png",
    group: "image",
    intro:
      "Shrink large PNG screenshots and graphics into compact JPG files that load faster and fit email attachment limits.",
    uses: [
      "Cut screenshot file sizes for email and chat",
      "Meet upload limits on job and school portals",
      "Make photos saved as PNG easier to share",
    ],
    faqs: [
      [
        "What happens to transparent areas?",
        "JPG has no transparency, so transparent pixels become white.",
      ],
      [
        "How much smaller will my file be?",
        "Photos often shrink 5 to 10 times. Flat graphics shrink less.",
      ],
    ],
  },
  {
    slug: "jpg-to-png",
    from: "JPG",
    to: "PNG",
    target: "png",
    icon: "photo",
    accept: ".jpg,.jpeg,image/jpeg",
    group: "image",
    intro:
      "Convert JPG photos to lossless PNG so further edits do not add more compression artifacts.",
    uses: [
      "Edit images without repeated quality loss",
      "Use photos in tools that require PNG",
      "Prepare images for design work",
    ],
    faqs: [
      [
        "Does converting to PNG improve quality?",
        "It stops further loss but cannot restore detail the JPG already lost.",
      ],
      [
        "Why is the PNG larger?",
        "PNG is lossless, so it stores every pixel exactly. That takes more space than JPG.",
      ],
    ],
  },
  {
    slug: "webp-to-png",
    from: "WEBP",
    to: "PNG",
    target: "png",
    icon: "photo",
    accept: ".webp,image/webp",
    group: "image",
    intro:
      "Saved an image from a website and got a WEBP file? Convert it to PNG so it opens everywhere, transparency included.",
    uses: [
      "Open web images in older editors and apps",
      "Keep transparent backgrounds intact",
      "Upload to sites that reject WEBP",
    ],
    faqs: [
      [
        "Is transparency preserved?",
        "Yes. PNG supports transparency, so transparent areas stay transparent.",
      ],
      [
        "Can I convert animated WEBP?",
        "The first frame is converted to a still PNG.",
      ],
    ],
  },
  {
    slug: "webp-to-jpg",
    from: "WEBP",
    to: "JPG",
    target: "jpg",
    icon: "image",
    accept: ".webp,image/webp",
    group: "image",
    intro:
      "Convert WEBP images to universally supported JPG for sharing, printing and uploading.",
    uses: [
      "Share web images with anyone",
      "Print images from any app",
      "Upload to sites that only take JPG",
    ],
    faqs: [
      [
        "Why can't I open WEBP files?",
        "Some older apps and devices do not support WEBP. JPG works everywhere.",
      ],
      [
        "Will I lose quality?",
        "Very little. Images are saved at high JPG quality.",
      ],
    ],
  },
  {
    slug: "jpg-to-webp",
    from: "JPG",
    to: "WEBP",
    target: "webp",
    icon: "bolt",
    accept: ".jpg,.jpeg,image/jpeg",
    group: "image",
    intro:
      "Make your website faster by converting JPG images to WEBP, which is typically 25 to 35 percent smaller at the same quality.",
    uses: [
      "Speed up page loads and Core Web Vitals",
      "Reduce hosting bandwidth",
      "Optimize blog and store images",
    ],
    faqs: [
      [
        "Do all browsers support WEBP?",
        "Yes, every modern browser supports WEBP.",
      ],
      [
        "Can I convert many images at once?",
        "Yes. Drop a whole folder of JPGs and use Convert all.",
      ],
    ],
  },
  {
    slug: "png-to-webp",
    from: "PNG",
    to: "WEBP",
    target: "webp",
    icon: "bolt",
    accept: ".png,image/png",
    group: "image",
    intro:
      "Convert PNG graphics to WEBP for much smaller files that still keep transparency.",
    uses: [
      "Lighter logos and UI graphics",
      "Faster landing pages",
      "Smaller app and game assets",
    ],
    faqs: [
      ["Is transparency kept?", "Yes. WEBP supports transparency."],
      ["How much smaller is WEBP?", "Often half the size of the PNG or less."],
    ],
  },
  {
    slug: "svg-to-png",
    from: "SVG",
    to: "PNG",
    target: "png",
    icon: "gesture",
    accept: ".svg,image/svg+xml",
    group: "image",
    intro:
      "Rasterize SVG icons and illustrations to PNG for apps, documents and social posts that do not accept vector files.",
    uses: [
      "Use icons in slides and docs",
      "Post vector art on social media",
      "Create app store and favicon assets",
    ],
    faqs: [
      [
        "What size will the PNG be?",
        "The SVG's own width and height are used.",
      ],
      [
        "Is the background transparent?",
        "Yes, transparent areas stay transparent.",
      ],
    ],
  },
  {
    slug: "png-to-ico",
    from: "PNG",
    to: "ICO",
    target: "ico",
    icon: "tab",
    accept: IMG,
    group: "image",
    intro:
      "Create a favicon.ico for your website from any PNG, JPG or SVG logo in one click.",
    uses: [
      "Add a favicon to your site",
      "Make Windows shortcut icons",
      "Replace a blurry default icon",
    ],
    faqs: [
      [
        "What size is the icon?",
        "Up to 256 by 256 pixels, centered on a transparent square.",
      ],
      [
        "How do I use it on my site?",
        'Upload favicon.ico to your site root or add <link rel="icon" href="/favicon.ico">.',
      ],
    ],
  },
  {
    slug: "image-to-base64",
    from: "Image",
    to: "Base64",
    target: "datauri",
    icon: "data_object",
    accept: IMG,
    group: "image",
    intro:
      "Encode any image as a Base64 data URI you can paste straight into HTML, CSS, JSON or email templates.",
    uses: [
      "Inline small icons in CSS",
      "Embed images in HTML emails",
      "Put images inside JSON payloads",
    ],
    faqs: [
      [
        "What do I get?",
        "A text file containing a data URI like data:image/png;base64,...",
      ],
      [
        "Should I inline big images?",
        "No. Base64 adds about a third to the size. Use it for small images.",
      ],
    ],
  },
  {
    slug: "mp3-to-wav",
    from: "MP3",
    to: "WAV",
    target: "wav",
    icon: "audiotrack",
    accept: "audio/*,.mp3",
    group: "audio",
    intro:
      "Convert MP3 files to uncompressed WAV for audio editors, samplers, DJ software and transcription tools.",
    uses: [
      "Import into DAWs and samplers",
      "Feed speech-to-text tools",
      "Burn audio CDs",
    ],
    faqs: [
      [
        "Is the WAV better quality?",
        "It is uncompressed, so no further quality is lost, but it cannot restore what MP3 removed.",
      ],
      [
        "Why is the WAV so big?",
        "WAV stores raw audio, about 10 MB per minute of stereo sound.",
      ],
    ],
  },
  {
    slug: "m4a-to-wav",
    from: "M4A",
    to: "WAV",
    target: "wav",
    icon: "graphic_eq",
    accept: "audio/*,.m4a,.aac",
    group: "audio",
    intro:
      "Turn iPhone voice memos and M4A or AAC audio into WAV files that every editor understands.",
    uses: [
      "Edit voice memos in any editor",
      "Submit recordings that must be WAV",
      "Prepare audio for transcription",
    ],
    faqs: [
      [
        "Does this work with iPhone voice memos?",
        "Yes, voice memos are M4A files.",
      ],
      [
        "What about OGG, OPUS and FLAC?",
        "Those convert to WAV too. Just drop them in.",
      ],
    ],
  },
  {
    slug: "csv-to-json",
    from: "CSV",
    to: "JSON",
    target: "json",
    icon: "data_object",
    accept: ".csv,text/csv",
    group: "data",
    intro:
      "Convert spreadsheet exports to a clean JSON array of objects, ready for APIs, apps and scripts.",
    uses: [
      "Seed a database or mock API",
      "Load spreadsheet data into JavaScript",
      "Share data with developers",
    ],
    faqs: [
      [
        "How are columns mapped?",
        "The first row becomes the keys; every other row becomes an object.",
      ],
      [
        "Are quoted commas handled?",
        "Yes. Quoted fields, escaped quotes and line breaks inside cells all work.",
      ],
    ],
  },
  {
    slug: "json-to-csv",
    from: "JSON",
    to: "CSV",
    target: "csv",
    icon: "table_chart",
    accept: ".json,application/json",
    group: "data",
    intro:
      "Open JSON data in Excel or Google Sheets by converting it to CSV with one column per key.",
    uses: [
      "Analyze API responses in a spreadsheet",
      "Share data with non-developers",
      "Import into tools that take CSV",
    ],
    faqs: [
      [
        "What JSON shapes work?",
        "An array of objects, an array of arrays, or an object holding an array.",
      ],
      [
        "What about nested objects?",
        "Nested values are written as JSON text in their cell.",
      ],
    ],
  },
  {
    slug: "csv-to-sql",
    from: "CSV",
    to: "SQL",
    target: "sql",
    icon: "storage",
    accept: ".csv,text/csv",
    group: "data",
    intro:
      "Generate a CREATE TABLE statement and INSERT rows from any CSV, ready to run in Postgres, MySQL or SQLite.",
    uses: [
      "Load spreadsheets into a database",
      "Create seed data for tests",
      "Move data between systems",
    ],
    faqs: [
      [
        "Are column types detected?",
        "Numeric columns become NUMERIC; everything else is TEXT.",
      ],
      ["Are quotes escaped?", "Yes. Values like O'Brien are escaped safely."],
    ],
  },
  {
    slug: "csv-to-markdown",
    from: "CSV",
    to: "Markdown",
    target: "md",
    icon: "grid_on",
    accept: ".csv,text/csv",
    group: "data",
    intro:
      "Turn CSV into a Markdown table for READMEs, docs, GitHub issues and notes apps.",
    uses: [
      "Add tables to GitHub READMEs",
      "Paste data into Notion or Obsidian",
      "Document results in pull requests",
    ],
    faqs: [
      [
        "Are pipes escaped?",
        "Yes, so cells containing | do not break the table.",
      ],
      [
        "Where does the header row come from?",
        "The first CSV row becomes the table header.",
      ],
    ],
  },
  {
    slug: "json-to-yaml",
    from: "JSON",
    to: "YAML",
    target: "yaml",
    icon: "settings_ethernet",
    accept: ".json,application/json",
    group: "data",
    intro:
      "Convert JSON records to readable YAML for config files, Kubernetes manifests and CI pipelines.",
    uses: [
      "Write config files by hand more easily",
      "Prepare fixtures for tests",
      "Review data in a cleaner format",
    ],
    faqs: [
      [
        "Are strings quoted safely?",
        "Values that YAML could misread, like yes, no or numbers, are quoted.",
      ],
      [
        "Can I convert YAML back?",
        "Convert to JSON Lines or CSV instead; YAML input is not supported yet.",
      ],
    ],
  },
  {
    slug: "xml-to-json",
    from: "XML",
    to: "JSON",
    target: "json",
    icon: "account_tree",
    accept: ".xml,application/xml,text/xml",
    group: "data",
    intro:
      "Convert XML feeds and exports to JSON. Each record element becomes an object; attributes and child elements become fields.",
    uses: [
      "Modernize legacy XML exports",
      "Use XML feeds in JavaScript apps",
      "Turn XML into spreadsheets via JSON or CSV",
    ],
    faqs: [
      [
        "How is the XML structured into records?",
        "Each child of the root element is a record.",
      ],
      [
        "Are attributes kept?",
        "Yes. Attributes become fields alongside child elements.",
      ],
    ],
  },
  {
    slug: "json-to-xml",
    from: "JSON",
    to: "XML",
    target: "xml",
    icon: "code",
    accept: ".json,application/json",
    group: "data",
    intro:
      "Convert JSON arrays to well-formed XML for legacy systems, feeds and enterprise integrations.",
    uses: [
      "Feed systems that only accept XML",
      "Create XML fixtures for tests",
      "Exchange data with older APIs",
    ],
    faqs: [
      [
        "Are invalid tag names fixed?",
        "Yes. Keys are sanitized into valid XML element names.",
      ],
      [
        "Are special characters escaped?",
        "Yes. Ampersands, quotes and angle brackets are escaped.",
      ],
    ],
  },
  {
    slug: "markdown-to-html",
    from: "Markdown",
    to: "HTML",
    target: "html",
    icon: "article",
    accept: ".md,.markdown,text/markdown",
    group: "text",
    intro:
      "Turn Markdown notes and READMEs into a clean, styled HTML page you can publish or email.",
    uses: [
      "Publish notes as web pages",
      "Send formatted docs by email",
      "Preview READMEs offline",
    ],
    faqs: [
      [
        "What Markdown is supported?",
        "Headings, bold, italic, links, images, lists, quotes, code blocks and rules.",
      ],
      [
        "Is the HTML styled?",
        "Yes, with a simple readable stylesheet you can edit.",
      ],
    ],
  },
  {
    slug: "html-to-markdown",
    from: "HTML",
    to: "Markdown",
    target: "md",
    icon: "code",
    accept: ".html,.htm,text/html",
    group: "text",
    intro:
      "Convert saved web pages and HTML exports into tidy Markdown for docs, wikis and notes apps.",
    uses: [
      "Move content into Obsidian or Notion",
      "Clean up CMS exports",
      "Write docs from existing pages",
    ],
    faqs: [
      [
        "Are scripts and styles removed?",
        "Yes. Only the readable content is kept.",
      ],
      [
        "Are links and images kept?",
        "Yes, as Markdown links and image references.",
      ],
    ],
  },
  {
    slug: "markdown-to-pdf",
    from: "Markdown",
    to: "PDF",
    target: "pdf",
    icon: "picture_as_pdf",
    accept: ".md,.markdown,text/markdown",
    group: "text",
    intro: "Turn Markdown notes into a printable PDF document in seconds.",
    uses: [
      "Print notes and checklists",
      "Share docs with people who don't use Markdown",
      "Attach notes to emails",
    ],
    faqs: [
      [
        "Is formatting preserved?",
        "The PDF contains the text content in a clean monospace layout. For styled output, convert to HTML first.",
      ],
      [
        "What page size is used?",
        "US Letter, with long documents split across pages.",
      ],
    ],
  },
  {
    slug: "text-to-pdf",
    from: "Text",
    to: "PDF",
    target: "pdf",
    icon: "description",
    accept: ".txt,text/plain",
    group: "text",
    intro:
      "Convert plain text files to clean, paginated PDFs ready for printing or sharing.",
    uses: [
      "Print logs and notes",
      "Share text that must not be edited",
      "Archive transcripts",
    ],
    faqs: [
      [
        "Are long lines wrapped?",
        "Yes. Lines wrap to fit the page and long files span multiple pages.",
      ],
      [
        "What font is used?",
        "A monospace font, so columns and code stay aligned.",
      ],
    ],
  },
  {
    slug: "html-to-text",
    from: "HTML",
    to: "Text",
    target: "txt",
    icon: "notes",
    accept: ".html,.htm,text/html",
    group: "text",
    intro:
      "Strip tags, scripts and styles from HTML to get just the readable text.",
    uses: [
      "Extract article text",
      "Prepare content for AI or search tools",
      "Clean pasted HTML",
    ],
    faqs: [
      [
        "Are line breaks kept?",
        "Paragraphs, headings and list items each start on a new line.",
      ],
      [
        "Is any code run?",
        "No. The HTML is parsed safely and scripts are discarded.",
      ],
    ],
  },
];

const esc = (s: string): string =>
  String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
const CSP =
  "default-src 'self'; script-src 'self' https://accounts.google.com/gsi/client; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com https://accounts.google.com/gsi/style; font-src https://fonts.gstatic.com; img-src 'self' data: blob: https://*.googleusercontent.com; connect-src 'self' https://api.github.com https://accounts.google.com/gsi/; frame-src https://accounts.google.com/gsi/; object-src 'none'; base-uri 'none'; form-action 'none'";
const GH =
  '<svg class="gh-mark" viewBox="0 0 16 16" width="18" height="18" aria-hidden="true"><path fill="currentColor" d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z"/></svg>';
const SHARED_FAQS: Faq[] = [
  [
    "Is it free?",
    "Yes. File Fusion is free and open source, with no limits, ads or watermarks.",
  ],
  [
    "Are my files uploaded?",
    "No. The conversion runs in your browser, so your files never leave your device.",
  ],
];

function related(p: ConverterPage): ConverterPage[] {
  const same = pages.filter((q) => q !== p && q.group === p.group);
  const other = pages.filter((q) => q !== p && q.group !== p.group);
  return [...same.slice(0, 6), ...other.filter((_, i) => i % 5 === 0)].slice(
    0,
    8,
  );
}

function page(p: ConverterPage): string {
  const title = `${p.from} to ${p.to} Converter: Free, Private, No Upload | File Fusion`;
  const h1 = `${p.from} to ${p.to} converter`;
  const desc =
    `Convert ${p.from} to ${p.to} free in your browser. ${(p.intro.split(". ")[0] ?? p.intro).replace(/\.$/, "")}. No uploads, no sign-up, no watermarks.`.slice(
      0,
      300,
    );
  const url = `${SITE}${p.slug}.html`;
  const faqs = [...p.faqs, ...SHARED_FAQS];
  const ld = [
    {
      "@context": "https://schema.org",
      "@type": "WebApplication",
      name: `File Fusion ${p.from} to ${p.to} Converter`,
      url,
      applicationCategory: "UtilitiesApplication",
      operatingSystem: "Any (web browser)",
      browserRequirements: "Requires JavaScript",
      isAccessibleForFree: true,
      offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
      description: desc,
    },
    {
      "@context": "https://schema.org",
      "@type": "FAQPage",
      mainEntity: faqs.map(([q, a]) => ({
        "@type": "Question",
        name: q,
        acceptedAnswer: { "@type": "Answer", text: a },
      })),
    },
    {
      "@context": "https://schema.org",
      "@type": "BreadcrumbList",
      itemListElement: [
        { "@type": "ListItem", position: 1, name: "File Fusion", item: SITE },
        { "@type": "ListItem", position: 2, name: h1, item: url },
      ],
    },
  ];
  return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <meta http-equiv="Content-Security-Policy" content="${CSP}">
    <meta name="referrer" content="strict-origin-when-cross-origin">
    <title>${esc(title)}</title>
    <meta name="description" content="${esc(desc)}">
    <link rel="canonical" href="${url}">
    <meta property="og:title" content="${esc(h1)} · File Fusion">
    <meta property="og:description" content="${esc(desc)}">
    <meta property="og:url" content="${url}">
    <meta property="og:image" content="${SITE}social-card.png">
    <meta property="og:image:width" content="1200">
    <meta property="og:image:height" content="630">
    <meta property="og:type" content="website">
    <meta property="og:site_name" content="File Fusion">
    <meta name="twitter:card" content="summary_large_image">
    <meta name="twitter:image" content="${SITE}social-card.png">
    <link rel="icon" href="data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24'><path fill='%231a73e8' d='M10 4H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2h-8l-2-2z'/></svg>">
    <link href="https://fonts.googleapis.com/css2?family=Google+Sans:wght@400;500;700&display=swap" rel="stylesheet">
    <link href="https://fonts.googleapis.com/icon?family=Material+Icons" rel="stylesheet">
    <link rel="stylesheet" href="./landing-styles.css">
    <script type="application/ld+json">${JSON.stringify(ld)}</script>
</head>
<body>
    <nav class="topnav">
        <a class="logo" href="./">
            <span class="material-icons logo-icon">folder_shared</span>
            <span class="logo-text">File Fusion</span>
        </a>
        <div class="nav-links">
            <a href="./#formats">All converters</a>
            <a href="./#faq">FAQ</a>
        </div>
        <div class="nav-actions">
            <a class="gh-star" href="https://github.com/ybelov27/FileFusion" target="_blank" rel="noopener" aria-label="Star File Fusion on GitHub (opens GitHub)" title="Opens File Fusion on GitHub. Click the Star button at the top right to star it.">
                ${GH}<span>Star</span><span class="gh-count" hidden><svg class="gh-star-icon" viewBox="0 0 16 16" width="16" height="16" aria-hidden="true"><path class="star-fill" d="M8 .25a.75.75 0 0 1 .673.418l1.882 3.815 4.21.612a.75.75 0 0 1 .416 1.279l-3.046 2.97.719 4.192a.751.751 0 0 1-1.088.791L8 12.347l-3.766 1.98a.75.75 0 0 1-1.088-.79l.72-4.194L.818 6.374a.75.75 0 0 1 .416-1.28l4.21-.611L7.327.668A.75.75 0 0 1 8 .25Z"/><path class="star-outline" d="M8 .25a.75.75 0 0 1 .673.418l1.882 3.815 4.21.612a.75.75 0 0 1 .416 1.279l-3.046 2.97.719 4.192a.751.751 0 0 1-1.088.791L8 12.347l-3.766 1.98a.75.75 0 0 1-1.088-.79l.72-4.194L.818 6.374a.75.75 0 0 1 .416-1.28l4.21-.611L7.327.668A.75.75 0 0 1 8 .25Zm0 2.445L6.615 5.5a.75.75 0 0 1-.564.41l-3.097.45 2.24 2.184a.75.75 0 0 1 .216.664l-.528 3.084 2.769-1.456a.75.75 0 0 1 .698 0l2.77 1.456-.53-3.084a.75.75 0 0 1 .216-.664l2.24-2.183-3.096-.45a.75.75 0 0 1-.564-.41L8 2.694Z"/></svg><span class="gh-count-num" data-gh-stars></span></span>
            </a>
            <a href="app.html?to=${p.target}" class="btn-primary small">Open converter</a>
        </div>
    </nav>

    <header class="hero">
        <div class="content-left">
            <nav class="breadcrumb" aria-label="Breadcrumb"><a href="./">File Fusion</a> <span aria-hidden="true">›</span> ${esc(h1)}</nav>
            <div class="pill"><span class="material-icons">verified_user</span> 100% private · runs in your browser</div>
            <h1 class="hero-title page-title">${esc(p.from)} to <span class="accent">${esc(p.to)}</span></h1>
            <p class="hero-subtitle">${esc(p.intro)} Free, no sign-up, and your files never leave your device.</p>
            <ul class="trust">
                <li><span class="material-icons">check_circle</span> No upload</li>
                <li><span class="material-icons">check_circle</span> No watermark</li>
                <li><span class="material-icons">check_circle</span> Batch convert</li>
            </ul>
        </div>
        <div class="content-right">
            <div class="drop-card" id="hero-drop" data-target="${p.target}" tabindex="0" role="button" aria-label="Choose ${esc(p.from)} files to convert to ${esc(p.to)}">
                <div class="drop-inner">
                    <span class="material-icons drop-icon">${p.icon}</span>
                    <h2>Drop ${esc(p.from)} files here</h2>
                    <p>or <span class="link">choose files</span> to convert to ${esc(p.to)}</p>
                </div>
                <input type="file" id="hero-input" accept="${esc(p.accept)}" multiple hidden>
            </div>
            <p class="drop-caption"><span class="material-icons">lock</span> Processed locally. Nothing is uploaded to any server.</p>
        </div>
    </header>

    <section class="section alt">
        <h2 class="section-title">How to convert ${esc(p.from)} to ${esc(p.to)}</h2>
        <div class="steps">
            <div class="step"><span class="step-num">1</span><h3>Add your ${esc(p.from)} files</h3><p>Drop them above or choose them from your device. You can add many at once.</p></div>
            <div class="step"><span class="step-num">2</span><h3>Convert to ${esc(p.to)}</h3><p>${esc(p.to)} is preselected. Click Convert, or Convert all for a batch.</p></div>
            <div class="step"><span class="step-num">3</span><h3>Download</h3><p>Your ${esc(p.to)} files are ready instantly. Nothing was uploaded.</p></div>
        </div>
    </section>

    <section class="section">
        <h2 class="section-title">What people use it for</h2>
        <ul class="uses">
${p.uses.map((u) => `            <li><span class="material-icons">task_alt</span>${esc(u)}</li>`).join("\n")}
        </ul>
    </section>

    <section class="section alt" id="faq">
        <h2 class="section-title">${esc(p.from)} to ${esc(p.to)} FAQ</h2>
        <div class="faq">
${faqs.map(([q, a], i) => `            <details${i === 0 ? " open" : ""}><summary>${esc(q)}</summary><p>${esc(a)}</p></details>`).join("\n")}
        </div>
    </section>

    <section class="section">
        <h2 class="section-title">More free converters</h2>
        <div class="format-grid">
${related(p)
  .map(
    (q) =>
      `            <a class="format-card" href="${q.slug}.html"><span class="material-icons">${q.icon}</span><strong>${esc(q.from)} → ${esc(q.to)}</strong><span>${esc(q.uses[0] ?? "")}</span></a>`,
  )
  .join("\n")}
        </div>
    </section>

    <section class="final-cta">
        <h2>Found it useful?</h2>
        <p>Help others find a converter that respects their privacy.</p>
        <div class="final-actions">
            <a href="https://github.com/ybelov27/FileFusion" class="btn-primary light" target="_blank" rel="noopener">${GH} Star on GitHub</a>
            <a href="#" class="btn-ghost" data-share="copy" data-share-url="${url}"><span class="material-icons">link</span> <span data-share-label>Copy link</span></a>
        </div>
    </section>

    <footer class="footer">
        <span>© File Fusion · Open source file conversion</span>
        <span class="footer-links">
            <a href="./">Home</a>
            <a href="privacy.html">Privacy</a>
            <a href="https://github.com/ybelov27/FileFusion" target="_blank" rel="noopener">GitHub</a>
        </span>
    </footer>

    <script type="module" src="./src/landing.ts"></script>
</body>
</html>
`;
}

for (const p of pages)
  fs.writeFileSync(path.join(UI, `${p.slug}.html`), page(p));

const urls: [path: string, priority: string][] = [
  ["", "1.0"],
  ...pages.map((p): [string, string] => [`${p.slug}.html`, "0.8"]),
  ["app.html", "0.7"],
  ["privacy.html", "0.3"],
];
fs.writeFileSync(
  path.join(UI, "public", "sitemap.xml"),
  `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.map(([u, pr]) => `  <url><loc>${SITE}${u}</loc><lastmod>${TODAY}</lastmod><priority>${pr}</priority></url>`).join("\n")}
</urlset>
`,
);

// Keep the generated pages out of git with an exact list (not a wildcard), so
// hand-written pages with similar names are never ignored by accident.
const GITIGNORE = path.join(UI, "..", ".gitignore");
const BEGIN = "# BEGIN generated converter pages (tools/build-pages.ts)";
const END = "# END generated converter pages";
const block = [BEGIN, ...pages.map((p) => `/ui/${p.slug}.html`), END].join(
  "\n",
);
const current = fs.existsSync(GITIGNORE)
  ? fs.readFileSync(GITIGNORE, "utf8")
  : "";
// Also recognise the marker written by the old tools/build-pages.mjs.
const start = Math.max(
  current.indexOf(BEGIN),
  current.indexOf(BEGIN.replace(".ts)", ".mjs)")),
);
const stop = current.indexOf(END);
fs.writeFileSync(
  GITIGNORE,
  start >= 0 && stop > start
    ? current.slice(0, start) + block + current.slice(stop + END.length)
    : current.replace(/\n*$/, "\n\n") + block + "\n",
);

// Machine-readable list for the landing page's "all converters" links.
fs.writeFileSync(
  path.join(UI, "..", "tools", "pages.json"),
  JSON.stringify(
    pages.map(({ slug, from, to, icon }) => ({ slug, from, to, icon })),
    null,
    2,
  ) + "\n",
);
console.log(`wrote ${pages.length} pages and sitemap.xml`);
