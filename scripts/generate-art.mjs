// One-off generator for placeholder artwork (project covers, thumbnails and a
// portrait stand-in). Output lands in src/assets/ and is committed; replace
// any of these files with real images and keep the same names.
//
// Run: node scripts/generate-art.mjs

import { mkdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';
import opentype from 'opentype.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const out = (p) => join(root, 'src/assets', p);
mkdirSync(out('projects'), { recursive: true });

// Deterministic PRNG so the art is stable between runs.
function mulberry32(seed) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const gauss = (rand) => {
  const u = 1 - rand();
  const v = rand();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
};

const C = {
  bg: '#1c1c1b',
  surface: '#242423',
  border: '#343331',
  text: '#ebe9e4',
  muted: '#aeaca6',
  faint: '#938f89',
  accent: '#c6a15e',
  bid: '#7f8a72',
  ask: '#9a7263',
};

const png = (svg, file) => sharp(Buffer.from(svg)).png({ compressionLevel: 9 }).toFile(out(file));

// ---- Order book ladder ------------------------------------------------------
function orderBook(W, H, seed) {
  const rand = mulberry32(seed);
  const rows = 22;
  const rowH = (H - 120) / rows;
  const mid = W / 2;
  let s = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">`;
  s += `<rect width="${W}" height="${H}" fill="${C.surface}"/>`;
  for (let i = 0; i < rows; i++) {
    const y = 60 + i * rowH;
    const isAsk = i < rows / 2;
    const depth = Math.abs(i - rows / 2 + 0.5);
    const size = (0.25 + rand() * 0.75) * (0.35 + depth / rows) * (W * 0.42);
    const color = isAsk ? C.ask : C.bid;
    const x = isAsk ? mid + 8 : mid - 8 - size;
    s += `<rect x="${x.toFixed(1)}" y="${(y + 3).toFixed(1)}" width="${size.toFixed(1)}" height="${(rowH - 6).toFixed(1)}" rx="3" fill="${color}" fill-opacity="${(0.35 + rand() * 0.4).toFixed(2)}"/>`;
    s += `<rect x="${mid - 1}" y="${y.toFixed(1)}" width="2" height="${rowH.toFixed(1)}" fill="${C.border}"/>`;
  }
  s += `<rect x="40" y="${(H / 2 - 1).toFixed(1)}" width="${W - 80}" height="2" fill="${C.accent}" fill-opacity="0.9"/>`;
  s += `</svg>`;
  return s;
}

// ---- Monte Carlo paths --------------------------------------------------------
function paths(W, H, seed, n = 60) {
  const rand = mulberry32(seed);
  const steps = 120;
  const dx = (W - 80) / steps;
  const all = [];
  for (let k = 0; k < n; k++) {
    let v = 0;
    const pts = [];
    for (let i = 0; i <= steps; i++) {
      pts.push(v);
      v += gauss(rand) * 0.9 + 0.02;
    }
    all.push(pts);
  }
  const flat = all.flat();
  const lo = Math.min(...flat);
  const hi = Math.max(...flat);
  const y = (v) => H - 50 - ((v - lo) / (hi - lo)) * (H - 100);
  let s = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">`;
  s += `<rect width="${W}" height="${H}" fill="${C.surface}"/>`;
  for (let g = 1; g < 5; g++) {
    s += `<rect x="40" y="${(50 + (g * (H - 100)) / 5).toFixed(1)}" width="${W - 80}" height="1" fill="${C.border}"/>`;
  }
  for (const pts of all) {
    const d = pts.map((v, i) => `${i ? 'L' : 'M'}${(40 + i * dx).toFixed(1)} ${y(v).toFixed(1)}`).join('');
    s += `<path d="${d}" fill="none" stroke="${C.muted}" stroke-opacity="0.22" stroke-width="1.5"/>`;
  }
  const mean = all[0].map((_, i) => all.reduce((a, p) => a + p[i], 0) / all.length);
  const dm = mean.map((v, i) => `${i ? 'L' : 'M'}${(40 + i * dx).toFixed(1)} ${y(v).toFixed(1)}`).join('');
  s += `<path d="${dm}" fill="none" stroke="${C.accent}" stroke-width="3"/>`;
  s += `</svg>`;
  return s;
}

// ---- Glyph helpers -------------------------------------------------------------
const fontBuf = readFileSync(join(root, 'node_modules/geist/dist/fonts/geist-sans/Geist-Medium.ttf'));
const font = opentype.parse(fontBuf.buffer.slice(fontBuf.byteOffset, fontBuf.byteOffset + fontBuf.byteLength));

function markSvg(W, H, { bg = C.surface, size = 0.5 } = {}) {
  const p = font.charToGlyph('p');
  const dot = font.charToGlyph('.');
  const fs = H * size * 1.35;
  const pPath = p.getPath(0, 0, fs);
  const dPath = dot.getPath((p.advanceWidth / 1000) * fs, 0, fs);
  const bb = pPath.getBoundingBox();
  const db = dPath.getBoundingBox();
  const w = db.x2 - bb.x1;
  const tx = W / 2 - (bb.x1 + w / 2);
  const ty = H / 2 + (0.272 * fs);
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
<rect width="${W}" height="${H}" fill="${bg}"/>
<g transform="translate(${tx.toFixed(1)} ${ty.toFixed(1)})"><path fill="${C.text}" d="${pPath.toPathData(1)}"/><path fill="${C.accent}" d="${dPath.toPathData(1)}"/></g>
</svg>`;
}

// Halftone portrait stand-in: a big "p" rendered as a dot screen.
async function halftone(W, H) {
  const cols = 44;
  const cell = W / cols;
  const rows = Math.floor(H / cell);
  const glyph = markSvg(cols, rows, { bg: '#000', size: 0.62 }).replace(C.text, '#fff').replace(C.accent, '#fff');
  const { data } = await sharp(Buffer.from(glyph), { density: 72 })
    .resize(cols, rows)
    .greyscale()
    .raw()
    .toBuffer({ resolveWithObject: true });
  const rand = mulberry32(7);
  let s = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">`;
  s += `<rect width="${W}" height="${H}" fill="${C.surface}"/>`;
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const v = data[r * cols + c] / 255;
      const base = 0.08 + rand() * 0.06;
      const radius = (cell / 2) * Math.max(base, v * 0.92);
      const col = v > 0.5 ? C.text : C.faint;
      s += `<circle cx="${(c * cell + cell / 2).toFixed(1)}" cy="${(r * cell + cell / 2).toFixed(1)}" r="${radius.toFixed(2)}" fill="${col}" fill-opacity="${v > 0.5 ? 0.9 : 0.35}"/>`;
    }
  }
  s += `</svg>`;
  return s;
}

function shield(W, H) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
<rect width="${W}" height="${H}" fill="${C.surface}"/>
<g transform="translate(${W / 2 - 36} ${H / 2 - 36}) scale(3)" fill="none" stroke="${C.muted}" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
<path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z"/>
<path d="m9 12 2 2 4-4" stroke="${C.accent}"/>
</g>
</svg>`;
}

await png(orderBook(1200, 750, 11), 'projects/order-book-cover.png');
await png(orderBook(320, 240, 11), 'projects/order-book-thumb.png');
await png(paths(1200, 750, 5), 'projects/monte-carlo-cover.png');
await png(paths(320, 240, 5, 24), 'projects/monte-carlo-thumb.png');
await png(markSvg(320, 240), 'projects/parjanya-me-thumb.png');
await png(shield(320, 240), 'projects/cyber-safety-thumb.png');
await png(await halftone(880, 1100), 'portrait-placeholder.png');
console.log('[art] wrote placeholder art to src/assets/');
