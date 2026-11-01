// Generates stylized, category-themed SVG thumbnails into /public/demo so the
// app is fully self-contained and never renders broken images. Run: node scripts/generate-demo-images.mjs
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const outDir = join(__dirname, "..", "public", "demo");
mkdirSync(outDir, { recursive: true });

const themes = [
  { key: "sanitation", label: "Sanitation", a: "#4d7c0f", b: "#1a2e05", glyph: "🗑️" },
  { key: "water", label: "Water Leakage", a: "#0369a1", b: "#082f49", glyph: "💧" },
  { key: "roads", label: "Roads", a: "#57534e", b: "#1c1917", glyph: "🕳️" },
  { key: "lighting", label: "Street Lighting", a: "#b45309", b: "#3b1d02", glyph: "💡" },
  { key: "drainage", label: "Drainage", a: "#0f766e", b: "#042f2e", glyph: "🚿" },
  { key: "footpath", label: "Footpath", a: "#7c2d12", b: "#1c1917", glyph: "🚶" },
  { key: "infrastructure", label: "Public Infrastructure", a: "#6d28d9", b: "#1e1b4b", glyph: "🪑" },
  { key: "waste", label: "Waste Management", a: "#15803d", b: "#052e16", glyph: "♻️" },
];

function svg({ key, label, a, b, glyph }) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="480" height="360" viewBox="0 0 480 360" role="img" aria-label="${label}">
  <defs>
    <linearGradient id="g-${key}" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="${a}"/>
      <stop offset="1" stop-color="${b}"/>
    </linearGradient>
    <radialGradient id="v-${key}" cx="0.5" cy="0.4" r="0.8">
      <stop offset="0.4" stop-color="rgba(255,255,255,0.10)"/>
      <stop offset="1" stop-color="rgba(0,0,0,0.35)"/>
    </radialGradient>
    <pattern id="grid-${key}" width="24" height="24" patternUnits="userSpaceOnUse">
      <path d="M24 0H0V24" fill="none" stroke="rgba(255,255,255,0.05)" stroke-width="1"/>
    </pattern>
  </defs>
  <rect width="480" height="360" fill="url(#g-${key})"/>
  <rect width="480" height="360" fill="url(#grid-${key})"/>
  <rect width="480" height="360" fill="url(#v-${key})"/>
  <g transform="translate(240 150)" text-anchor="middle">
    <circle r="58" fill="rgba(0,0,0,0.28)"/>
    <text y="20" font-size="60">${glyph}</text>
  </g>
  <text x="24" y="330" font-family="Inter, Arial, sans-serif" font-size="18" font-weight="600" fill="rgba(255,255,255,0.92)">${label}</text>
  <text x="24" y="350" font-family="Inter, Arial, sans-serif" font-size="12" fill="rgba(255,255,255,0.6)">FixLoop demo evidence</text>
</svg>`;
}

for (const t of themes) {
  writeFileSync(join(outDir, `${t.key}.svg`), svg(t), "utf8");
}

// Distinct "after" (resolved) variants — brighter, with a check badge.
for (const t of themes) {
  const after = svg(t)
    .replace("</svg>", "")
    .replace(
      /<text x="24" y="350"[^>]*>[^<]*<\/text>/,
      `<g transform="translate(410 40)"><circle r="22" fill="#16a34a"/><path d="M-9 0 l6 7 l12 -14" fill="none" stroke="#fff" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/></g><text x="24" y="350" font-family="Inter, Arial, sans-serif" font-size="12" fill="rgba(255,255,255,0.7)">Resolved — verification evidence</text>`
    )
    .concat("</svg>");
  writeFileSync(join(outDir, `${t.key}-after.svg`), after, "utf8");
}

console.log(`Wrote ${themes.length * 2} demo thumbnails to public/demo`);
