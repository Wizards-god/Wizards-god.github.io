// Draws the preview cards (1200×630 PNGs) that show up when a page is shared
// as a link. The text is turned into outlines with opentype.js, so the cards
// come out the same no matter which fonts the build machine has installed.

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import opentype from 'opentype.js';
import sharp from 'sharp';

const WIDTH = 1200;
const HEIGHT = 630;
const MARGIN = 80;

// The dark theme's colours.
const COLOURS = {
  background: '#1c1c1b',
  border: '#343331',
  text: '#ebe9e4',
  muted: '#aeaca6',
  faint: '#938f89',
  accent: '#c6a15e',
};

type Font = ReturnType<typeof opentype.parse>;
const loadedFonts = new Map<string, Font>();

function loadFont(file: string): Font {
  let font = loadedFonts.get(file);
  if (!font) {
    const fontFile = readFileSync(join(process.cwd(), 'node_modules/geist/dist/fonts', file));
    font = opentype.parse(fontFile.buffer.slice(fontFile.byteOffset, fontFile.byteOffset + fontFile.byteLength));
    loadedFonts.set(file, font);
  }
  return font;
}

const fonts = {
  medium: () => loadFont('geist-sans/Geist-Medium.ttf'),
  semibold: () => loadFont('geist-sans/Geist-SemiBold.ttf'),
  regular: () => loadFont('geist-sans/Geist-Regular.ttf'),
  mono: () => loadFont('geist-mono/GeistMono-Regular.ttf'),
};

/**
 * Where each glyph goes: its advance width plus kerning against the next one,
 * plus `tracking` (in em) for letter spacing. This is done by hand because
 * opentype.js 2.0 produces NaN coordinates when its own letterSpacing option
 * is combined with kerning.
 */
function layOut(font: Font, text: string, size: number, tracking = 0) {
  const scale = size / font.unitsPerEm;
  const glyphs = font.stringToGlyphs(text);
  const positions: number[] = [];
  let x = 0;
  glyphs.forEach((glyph, index) => {
    positions.push(x);
    const nextGlyph = glyphs[index + 1];
    x += (glyph.advanceWidth ?? 0) * scale + (nextGlyph ? font.getKerningValue(glyph, nextGlyph) * scale : 0) + tracking * size;
  });
  return { glyphs, positions, width: x };
}

const textWidth = (font: Font, text: string, size: number, tracking = 0) => layOut(font, text, size, tracking).width;

/** Breaks text into lines that fit `maxWidth`. If it runs past `maxLines`, the last line ends in "…". */
function wrapText(font: Font, text: string, size: number, maxWidth: number, maxLines: number) {
  const words = text.split(/\s+/);
  const lines: string[] = [];
  let line = '';
  for (const word of words) {
    const withWord = line ? `${line} ${word}` : word;
    if (textWidth(font, withWord, size) <= maxWidth || !line) line = withWord;
    else {
      lines.push(line);
      line = word;
    }
  }
  if (line) lines.push(line);

  if (lines.length > maxLines) {
    const kept = lines.slice(0, maxLines);
    let lastLine = kept[maxLines - 1];
    while (textWidth(font, `${lastLine}…`, size) > maxWidth && lastLine.includes(' ')) {
      lastLine = lastLine.slice(0, lastLine.lastIndexOf(' '));
    }
    kept[maxLines - 1] = `${lastLine}…`;
    return kept;
  }
  return lines;
}

/** One line of text as an SVG <path>, with its baseline at (x, y). */
function textPath(font: Font, text: string, x: number, y: number, size: number, fill: string, tracking = 0) {
  const { glyphs, positions } = layOut(font, text, size, tracking);
  const pathData = glyphs.map((glyph, index) => glyph.getPath(x + positions[index], y, size).toPathData(1)).join('');
  return `<path fill="${fill}" d="${pathData}"/>`;
}

export interface OgCard {
  title: string;
  description?: string;
  /** Small mono label above the title, like "writing". */
  eyebrow?: string;
  /** The page's path, shown at the bottom as "parjanya.me/…". */
  path: string;
}

export async function renderOg({ title, description, eyebrow, path: pagePath }: OgCard) {
  const medium = fonts.medium();
  const semibold = fonts.semibold();
  const regular = fonts.regular();
  const mono = fonts.mono();

  let svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${WIDTH}" height="${HEIGHT}" viewBox="0 0 ${WIDTH} ${HEIGHT}">`;
  svg += `<rect width="${WIDTH}" height="${HEIGHT}" fill="${COLOURS.background}"/>`;
  svg += `<rect x="24.5" y="24.5" width="${WIDTH - 49}" height="${HEIGHT - 49}" rx="18" fill="none" stroke="${COLOURS.border}"/>`;

  // The "parjanya." wordmark, with the full stop in the accent colour.
  const wordmarkSize = 38;
  const wordmark = 'parjanya';
  svg += textPath(medium, wordmark, MARGIN, MARGIN + 34, wordmarkSize, COLOURS.text, -0.03);
  svg += textPath(medium, '.', MARGIN + textWidth(medium, wordmark, wordmarkSize, -0.03), MARGIN + 34, wordmarkSize, COLOURS.accent);

  let y = 250;
  if (eyebrow) {
    svg += textPath(mono, eyebrow, MARGIN, y - 80, 24, COLOURS.faint, 0.04);
  }

  // Long titles get a smaller size; either way, two lines at most.
  const titleSize = title.length > 36 ? 60 : 72;
  const titleLines = wrapText(semibold, title, titleSize, WIDTH - MARGIN * 2, 2);
  titleLines.forEach((line, index) => {
    svg += textPath(semibold, line, MARGIN, y + index * titleSize * 1.12, titleSize, COLOURS.text, -0.035);
  });
  y += (titleLines.length - 1) * titleSize * 1.12 + 62;

  if (description) {
    const descriptionSize = 29;
    const maxLines = titleLines.length > 1 ? 2 : 3;
    const lines = wrapText(regular, description, descriptionSize, WIDTH - MARGIN * 2 - 60, maxLines);
    lines.forEach((line, index) => {
      svg += textPath(regular, line, MARGIN, y + index * descriptionSize * 1.45, descriptionSize, COLOURS.muted);
    });
  }

  // The address along the bottom, after a small accent dot.
  const address = `parjanya.me${pagePath === '/' ? '' : pagePath}`;
  svg += `<circle cx="${MARGIN + 5}" cy="${HEIGHT - MARGIN - 7}" r="5" fill="${COLOURS.accent}"/>`;
  svg += textPath(mono, address, MARGIN + 22, HEIGHT - MARGIN, 22, COLOURS.faint, 0.02);
  svg += `</svg>`;

  return sharp(Buffer.from(svg)).png({ compressionLevel: 9 }).toBuffer();
}
