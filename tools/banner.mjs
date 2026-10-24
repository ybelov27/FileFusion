// Renders the README's ANSI-shadow ASCII banner as SVG: every "█" becomes a
// gradient tile and every box-drawing shadow character a crisp double line,
// so the art looks the same in every font. Writes .github/banner-{light,dark}.svg.
//   node tools/banner.mjs
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.join(path.dirname(new URL(import.meta.url).pathname), '..');
const G = {
    F: ['███████╗', '██╔════╝', '█████╗  ', '██╔══╝  ', '██║     ', '╚═╝     '],
    I: ['██╗', '██║', '██║', '██║', '██║', '╚═╝'],
    L: ['██╗     ', '██║     ', '██║     ', '██║     ', '███████╗', '╚══════╝'],
    E: ['███████╗', '██╔════╝', '█████╗  ', '██╔══╝  ', '███████╗', '╚══════╝'],
    U: ['██╗   ██╗', '██║   ██║', '██║   ██║', '██║   ██║', '╚██████╔╝', ' ╚═════╝ '],
    S: ['███████╗', '██╔════╝', '███████╗', '╚════██║', '███████║', '╚══════╝'],
    O: [' ██████╗ ', '██╔═══██╗', '██║   ██║', '██║   ██║', '╚██████╔╝', ' ╚═════╝ '],
    N: ['███╗   ██╗', '████╗  ██║', '██╔██╗ ██║', '██║╚██╗██║', '██║ ╚████║', '╚═╝  ╚═══╝'],
    ' ': Array(6).fill('   '),
};
const rows = Array.from({ length: 6 }, (_, r) => [...'FILE FUSION'].map((c) => G[c][r]).join(''));
const cols = Math.max(...rows.map((r) => [...r].length));

const CW = 12, CH = 22;              // cell size: terminal-like 1:~2 aspect
const W = 980, PAD_TOP = 26;
const X0 = Math.round((W - cols * CW) / 2);
const ARTH = rows.length * CH;
const H = PAD_TOP + ARTH + 92;
const GAP = 2.4, SW = 1.4;           // double-line spacing and stroke width

// Double box-drawing glyphs as two parallel strokes inside one cell.
function boxPath(ch, x, y) {
    const cx = x + CW / 2, cy = y + CH / 2, l = x, r = x + CW, t = y, b = y + CH;
    const o = GAP, segs = {
        '═': [[l, cy - o, r, cy - o], [l, cy + o, r, cy + o]],
        '║': [[cx - o, t, cx - o, b], [cx + o, t, cx + o, b]],
        '╗': [[l, cy - o, cx + o, cy - o, cx + o, b], [l, cy + o, cx - o, cy + o, cx - o, b]],
        '╔': [[r, cy - o, cx - o, cy - o, cx - o, b], [r, cy + o, cx + o, cy + o, cx + o, b]],
        '╝': [[cx + o, t, cx + o, cy + o, l, cy + o], [cx - o, t, cx - o, cy - o, l, cy - o]],
        '╚': [[cx - o, t, cx - o, cy + o, r, cy + o], [cx + o, t, cx + o, cy - o, r, cy - o]],
    }[ch];
    if (!segs) return '';
    return segs.map((pts) => 'M' + pts.reduce((acc, v, i) => acc + (i % 2 ? ',' : i ? ' L' : '') + v.toFixed(1), '')).join(' ');
}

let blocks = '', lines = '';
rows.forEach((row, ri) => {
    const chars = [...row], y = PAD_TOP + ri * CH;
    for (let ci = 0; ci < chars.length; ci++) {
        const ch = chars[ci];
        if (ch === '█') {
            // One rect per horizontal run of blocks, 1px taller than the row, so
            // letters stay seamless when GitHub scales the image down.
            let end = ci;
            while (chars[end + 1] === '█') end++;
            blocks += `<rect x="${X0 + ci * CW}" y="${y}" width="${(end - ci + 1) * CW}" height="${CH + 1}"/>`;
            ci = end;
        } else if (ch !== ' ') lines += boxPath(ch, X0 + ci * CW, y) + ' ';
    }
});

const TAG = 'convert any file  ·  right in your browser  ·  free &amp; open source';
const themes = {
    // Light blue to blue only. Deeper on white for contrast, brighter on GitHub's dark background.
    light: { stops: ['#5ab0ff', '#2b8cf0', '#1560d4'], shadow: '#93b9e6', sheen: 0.35, tag: '#5f6368', bar: 0.9 },
    dark: { stops: ['#a5d8ff', '#5aaeff', '#2a7ef0'], shadow: '#3d6ea8', sheen: 0.28, tag: '#8b949e', bar: 1 },
};

function svg({ stops, shadow, sheen, tag, bar }) {
    const artW = cols * CW, barY = PAD_TOP + ARTH + 22;
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" role="img" aria-labelledby="t">
<title id="t">File Fusion: convert any file, right in your browser, free and open source</title>
<style>
  .shine { animation: sweep 6s ease-in-out infinite; }
  @keyframes sweep { 0% { transform: translateX(-260px); } 45%, 100% { transform: translateX(${W + 260}px); } }
  @media (prefers-reduced-motion: reduce) { .shine { animation: none; opacity: 0; } }
</style>
<defs>
  <linearGradient id="fill" x1="${X0}" y1="0" x2="${X0 + artW}" y2="0" gradientUnits="userSpaceOnUse">
    <stop offset="0" stop-color="${stops[0]}"/>
    <stop offset="0.5" stop-color="${stops[1]}"/>
    <stop offset="1" stop-color="${stops[2]}"/>
  </linearGradient>
  <linearGradient id="sheen" x1="0" y1="${PAD_TOP}" x2="0" y2="${PAD_TOP + ARTH}" gradientUnits="userSpaceOnUse">
    <stop offset="0" stop-color="#fff" stop-opacity="${sheen}"/>
    <stop offset="0.5" stop-color="#fff" stop-opacity="0"/>
    <stop offset="1" stop-color="#001a40" stop-opacity="${(sheen * 0.45).toFixed(2)}"/>
  </linearGradient>
  <linearGradient id="glint" x1="0" y1="0" x2="1" y2="0">
    <stop offset="0" stop-color="#fff" stop-opacity="0"/>
    <stop offset="0.5" stop-color="#fff" stop-opacity="0.55"/>
    <stop offset="1" stop-color="#fff" stop-opacity="0"/>
  </linearGradient>
  <clipPath id="letters">${blocks}</clipPath>
</defs>
<path d="${lines.trim()}" fill="none" stroke="${shadow}" stroke-width="${SW}" stroke-linecap="square"/>
<g fill="url(#fill)">${blocks}</g>
<g clip-path="url(#letters)"><rect x="0" y="${PAD_TOP}" width="${W}" height="${ARTH + 1}" fill="url(#sheen)"/></g>
<g clip-path="url(#letters)"><g transform="skewX(-20)"><rect class="shine" x="0" y="${PAD_TOP - 10}" width="180" height="${ARTH + 20}" fill="url(#glint)"/></g></g>
<rect x="${X0}" y="${barY}" width="${artW}" height="3" rx="1.5" fill="url(#fill)" opacity="${bar}"/>
<text x="${W / 2}" y="${barY + 42}" text-anchor="middle" fill="${tag}" font-family="ui-monospace, SFMono-Regular, Menlo, Consolas, 'Liberation Mono', monospace" font-size="17" letter-spacing="0.5">${TAG}</text>
</svg>
`;
}

for (const [name, theme] of Object.entries(themes)) {
    fs.writeFileSync(path.join(ROOT, '.github', `banner-${name}.svg`), svg(theme));
}
console.log(`wrote .github/banner-light.svg and .github/banner-dark.svg (${W}x${H})`);
