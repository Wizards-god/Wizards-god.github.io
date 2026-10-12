// One-off generator for the placeholder artwork: project covers, thumbnails
// and the stand-in portrait. The images land in src/assets/ and are committed,
// so this only needs running again if the art itself changes. To use a real
// image instead, just replace the file and keep its name.
//
// Run: node scripts/generate-art.mjs

import { mkdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';
import opentype from 'opentype.js';

const projectRoot = join(dirname(fileURLToPath(import.meta.url)), '..');
const assetPath = (file) => join(projectRoot, 'src/assets', file);
mkdirSync(assetPath('projects'), { recursive: true });

// A seeded random number generator (mulberry32), so the art comes out the same every run.
function mulberry32(seed) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** A standard normal random number (Box–Muller). */
function standardNormal(random) {
  const u = 1 - random();
  const v = random();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

// The dark theme's colours, plus a muted green and red for the order book.
const COLOURS = {
  background: '#1c1c1b',
  surface: '#242423',
  border: '#343331',
  text: '#ebe9e4',
  muted: '#aeaca6',
  faint: '#938f89',
  accent: '#c6a15e',
  bid: '#7f8a72',
  ask: '#9a7263',
};

const savePng = (svg, file) => sharp(Buffer.from(svg)).png({ compressionLevel: 9 }).toFile(assetPath(file));

// ---- Order book ladder -------------------------------------------------
// Asks stacked above the middle line, bids below, with bars that get longer
// further from the middle, like a depth ladder.
function orderBookArt(width, height, seed) {
  const random = mulberry32(seed);
  const rows = 22;
  const rowHeight = (height - 120) / rows;
  const middle = width / 2;
  let svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">`;
  svg += `<rect width="${width}" height="${height}" fill="${COLOURS.surface}"/>`;
  for (let row = 0; row < rows; row++) {
    const y = 60 + row * rowHeight;
    const isAsk = row < rows / 2;
    const distanceFromMiddle = Math.abs(row - rows / 2 + 0.5);
    const barLength = (0.25 + random() * 0.75) * (0.35 + distanceFromMiddle / rows) * (width * 0.42);
    const colour = isAsk ? COLOURS.ask : COLOURS.bid;
    const x = isAsk ? middle + 8 : middle - 8 - barLength;
    svg += `<rect x="${x.toFixed(1)}" y="${(y + 3).toFixed(1)}" width="${barLength.toFixed(1)}" height="${(rowHeight - 6).toFixed(1)}" rx="3" fill="${colour}" fill-opacity="${(0.35 + random() * 0.4).toFixed(2)}"/>`;
    svg += `<rect x="${middle - 1}" y="${y.toFixed(1)}" width="2" height="${rowHeight.toFixed(1)}" fill="${COLOURS.border}"/>`;
  }
  svg += `<rect x="40" y="${(height / 2 - 1).toFixed(1)}" width="${width - 80}" height="2" fill="${COLOURS.accent}" fill-opacity="0.9"/>`;
  svg += `</svg>`;
  return svg;
}

// ---- Monte Carlo paths -------------------------------------------------
// A fan of random walks in grey, with their average drawn on top in the accent colour.
function monteCarloArt(width, height, seed, pathCount = 60) {
  const random = mulberry32(seed);
  const steps = 120;
  const stepWidth = (width - 80) / steps;

  const walks = [];
  for (let walk = 0; walk < pathCount; walk++) {
    let value = 0;
    const points = [];
    for (let step = 0; step <= steps; step++) {
      points.push(value);
      value += standardNormal(random) * 0.9 + 0.02;
    }
    walks.push(points);
  }

  const allValues = walks.flat();
  const lowest = Math.min(...allValues);
  const highest = Math.max(...allValues);
  const yFor = (value) => height - 50 - ((value - lowest) / (highest - lowest)) * (height - 100);
  const pathData = (points) =>
    points.map((value, step) => `${step ? 'L' : 'M'}${(40 + step * stepWidth).toFixed(1)} ${yFor(value).toFixed(1)}`).join('');

  let svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">`;
  svg += `<rect width="${width}" height="${height}" fill="${COLOURS.surface}"/>`;
  for (let line = 1; line < 5; line++) {
    svg += `<rect x="40" y="${(50 + (line * (height - 100)) / 5).toFixed(1)}" width="${width - 80}" height="1" fill="${COLOURS.border}"/>`;
  }
  for (const points of walks) {
    svg += `<path d="${pathData(points)}" fill="none" stroke="${COLOURS.muted}" stroke-opacity="0.22" stroke-width="1.5"/>`;
  }
  const average = walks[0].map((_, step) => walks.reduce((total, points) => total + points[step], 0) / walks.length);
  svg += `<path d="${pathData(average)}" fill="none" stroke="${COLOURS.accent}" stroke-width="3"/>`;
  svg += `</svg>`;
  return svg;
}

// ---- The "p." mark -----------------------------------------------------
const fontFile = readFileSync(join(projectRoot, 'node_modules/geist/dist/fonts/geist-sans/Geist-Medium.ttf'));
const font = opentype.parse(fontFile.buffer.slice(fontFile.byteOffset, fontFile.byteOffset + fontFile.byteLength));

/** "p." centred in a box, with the full stop in the accent colour. `size` is the mark's height relative to the box. */
function markArt(width, height, { background = COLOURS.surface, size = 0.5 } = {}) {
  const pGlyph = font.charToGlyph('p');
  const fullStopGlyph = font.charToGlyph('.');
  const fontSize = height * size * 1.35;
  const pPath = pGlyph.getPath(0, 0, fontSize);
  const fullStopPath = fullStopGlyph.getPath((pGlyph.advanceWidth / 1000) * fontSize, 0, fontSize);
  const pBox = pPath.getBoundingBox();
  const fullStopBox = fullStopPath.getBoundingBox();
  const markWidth = fullStopBox.x2 - pBox.x1;
  const offsetX = width / 2 - (pBox.x1 + markWidth / 2);
  const offsetY = height / 2 + 0.272 * fontSize; // drops the x-height band to the middle
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
<rect width="${width}" height="${height}" fill="${background}"/>
<g transform="translate(${offsetX.toFixed(1)} ${offsetY.toFixed(1)})"><path fill="${COLOURS.text}" d="${pPath.toPathData(1)}"/><path fill="${COLOURS.accent}" d="${fullStopPath.toPathData(1)}"/></g>
</svg>`;
}

// The stand-in portrait: a big "p" printed as a halftone dot screen. The mark
// is drawn small (one pixel per dot), and each pixel's brightness sets its dot's size.
async function halftoneArt(width, height) {
  const columns = 44;
  const cellSize = width / columns;
  const rows = Math.floor(height / cellSize);
  const whiteMark = markArt(columns, rows, { background: '#000', size: 0.62 })
    .replace(COLOURS.text, '#fff')
    .replace(COLOURS.accent, '#fff');
  const { data: brightness } = await sharp(Buffer.from(whiteMark), { density: 72 })
    .resize(columns, rows)
    .greyscale()
    .raw()
    .toBuffer({ resolveWithObject: true });

  const random = mulberry32(7);
  let svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">`;
  svg += `<rect width="${width}" height="${height}" fill="${COLOURS.surface}"/>`;
  for (let row = 0; row < rows; row++) {
    for (let column = 0; column < columns; column++) {
      const value = brightness[row * columns + column] / 255;
      const smallestDot = 0.08 + random() * 0.06; // a faint dot even where there's no letter
      const radius = (cellSize / 2) * Math.max(smallestDot, value * 0.92);
      const insideLetter = value > 0.5;
      svg += `<circle cx="${(column * cellSize + cellSize / 2).toFixed(1)}" cy="${(row * cellSize + cellSize / 2).toFixed(1)}" r="${radius.toFixed(2)}" fill="${insideLetter ? COLOURS.text : COLOURS.faint}" fill-opacity="${insideLetter ? 0.9 : 0.35}"/>`;
    }
  }
  svg += `</svg>`;
  return svg;
}

await savePng(orderBookArt(1200, 750, 11), 'projects/order-book-cover.png');
await savePng(orderBookArt(320, 240, 11), 'projects/order-book-thumb.png');
await savePng(monteCarloArt(1200, 750, 5), 'projects/monte-carlo-cover.png');
await savePng(monteCarloArt(320, 240, 5, 24), 'projects/monte-carlo-thumb.png');
await savePng(markArt(320, 240), 'projects/parjanya-me-thumb.png');
await savePng(await halftoneArt(880, 1100), 'portrait-placeholder.png');
console.log('[art] wrote placeholder art to src/assets/');
