// Open Graph card renderer (1200×630 PNG). Text is converted to outlines with
// opentype.js so the output never depends on fonts installed on the build machine.

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import opentype from 'opentype.js';
import sharp from 'sharp';

const W = 1200;
const H = 630;
const PAD = 80;

const C = {
  bg: '#1c1c1b',
  border: '#343331',
  text: '#ebe9e4',
  muted: '#aeaca6',
  faint: '#938f89',
  accent: '#c6a15e',
};

type Font = ReturnType<typeof opentype.parse>;
const cache = new Map<string, Font>();

function font(file: string): Font {
  let f = cache.get(file);
  if (!f) {
    const buf = readFileSync(join(process.cwd(), 'node_modules/geist/dist/fonts', file));
    f = opentype.parse(buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength));
    cache.set(file, f);
  }
  return f;
}

const fonts = {
  medium: () => font('geist-sans/Geist-Medium.ttf'),
  semibold: () => font('geist-sans/Geist-SemiBold.ttf'),
  regular: () => font('geist-sans/Geist-Regular.ttf'),
  mono: () => font('geist-mono/GeistMono-Regular.ttf'),
};

function wrap(f: Font, text: string, size: number, maxWidth: number, maxLines: number) {
  const words = text.split(/\s+/);
  const lines: string[] = [];
  let line = '';
  for (const w of words) {
    const next = line ? `${line} ${w}` : w;
    if (measure(f, next, size) <= maxWidth || !line) line = next;
    else {
      lines.push(line);
      line = w;
    }
  }
  if (line) lines.push(line);
  if (lines.length > maxLines) {
    const kept = lines.slice(0, maxLines);
    let last = kept[maxLines - 1];
    while (measure(f, `${last}…`, size) > maxWidth && last.includes(' ')) last = last.slice(0, last.lastIndexOf(' '));
    kept[maxLines - 1] = `${last}…`;
    return kept;
  }
  return lines;
}

// Manual layout (advance + pair kerning + tracking). opentype.js 2.0 emits NaN
// coordinates when its own `letterSpacing` option is combined with kerning.
function layout(f: Font, text: string, size: number, tracking = 0) {
  const scale = size / f.unitsPerEm;
  const glyphs = f.stringToGlyphs(text);
  const xs: number[] = [];
  let x = 0;
  glyphs.forEach((g, i) => {
    xs.push(x);
    const next = glyphs[i + 1];
    x += (g.advanceWidth ?? 0) * scale + (next ? f.getKerningValue(g, next) * scale : 0) + tracking * size;
  });
  return { glyphs, xs, width: x };
}

const measure = (f: Font, text: string, size: number, tracking = 0) => layout(f, text, size, tracking).width;

function path(f: Font, text: string, x: number, y: number, size: number, fill: string, tracking = 0) {
  const { glyphs, xs } = layout(f, text, size, tracking);
  const d = glyphs.map((g, i) => g.getPath(x + xs[i], y, size).toPathData(1)).join('');
  return `<path fill="${fill}" d="${d}"/>`;
}

export interface OgCard {
  title: string;
  description?: string;
  eyebrow?: string;
  path: string;
}

export async function renderOg({ title, description, eyebrow, path: urlPath }: OgCard) {
  const medium = fonts.medium();
  const semibold = fonts.semibold();
  const regular = fonts.regular();
  const mono = fonts.mono();

  let svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">`;
  svg += `<rect width="${W}" height="${H}" fill="${C.bg}"/>`;
  svg += `<rect x="24.5" y="24.5" width="${W - 49}" height="${H - 49}" rx="18" fill="none" stroke="${C.border}"/>`;

  // Wordmark "parjanya." with the full stop in the accent colour.
  const wmSize = 38;
  const wm = 'parjanya';
  svg += path(medium, wm, PAD, PAD + 34, wmSize, C.text, -0.03);
  svg += path(medium, '.', PAD + measure(medium, wm, wmSize, -0.03), PAD + 34, wmSize, C.accent);

  let y = 250;
  if (eyebrow) {
    svg += path(mono, eyebrow, PAD, y - 80, 24, C.faint, 0.04);
  }

  const titleSize = title.length > 36 ? 60 : 72;
  const titleLines = wrap(semibold, title, titleSize, W - PAD * 2, 2);
  titleLines.forEach((l, i) => {
    svg += path(semibold, l, PAD, y + i * titleSize * 1.12, titleSize, C.text, -0.035);
  });
  y += (titleLines.length - 1) * titleSize * 1.12 + 62;

  if (description) {
    const descSize = 29;
    const lines = wrap(regular, description, descSize, W - PAD * 2 - 60, titleLines.length > 1 ? 2 : 3);
    lines.forEach((l, i) => {
      svg += path(regular, l, PAD, y + i * descSize * 1.45, descSize, C.muted);
    });
  }

  const url = `parjanya.me${urlPath === '/' ? '' : urlPath}`;
  svg += `<circle cx="${PAD + 5}" cy="${H - PAD - 7}" r="5" fill="${C.accent}"/>`;
  svg += path(mono, url, PAD + 22, H - PAD, 22, C.faint, 0.02);
  svg += `</svg>`;

  return sharp(Buffer.from(svg)).png({ compressionLevel: 9 }).toBuffer();
}
