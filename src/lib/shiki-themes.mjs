// The code highlighting themes: Vitesse, with every token colour nudged just
// far enough to pass WCAG AA contrast (4.5:1) on this site's code blocks,
// including the tinted background of highlighted lines.

import vitesseDark from '@shikijs/themes/vitesse-dark';
import vitesseLight from '@shikijs/themes/vitesse-light';

const MIN_CONTRAST = 4.6; // a little over 4.5, to be safe after rounding

/** "#rgb", "#rgba", "#rrggbb" or "#rrggbbaa" → { r, g, b, a }, with a from 0 to 1. */
function parseHex(hex) {
  const digits = hex.replace('#', '');
  const fullDigits = digits.length <= 4 ? [...digits].map((digit) => digit + digit).join('') : digits;
  const channel = (start) => parseInt(fullDigits.slice(start, start + 2), 16);
  return { r: channel(0), g: channel(2), b: channel(4), a: fullDigits.length === 8 ? channel(6) / 255 : 1 };
}

const toHex = ({ r, g, b }) => '#' + [r, g, b].map((value) => Math.round(value).toString(16).padStart(2, '0')).join('');

/** What a see-through colour looks like painted over a solid one. */
const paintOver = (top, bottom) => ({
  r: top.r * top.a + bottom.r * (1 - top.a),
  g: top.g * top.a + bottom.g * (1 - top.a),
  b: top.b * top.a + bottom.b * (1 - top.a),
  a: 1,
});

/** WCAG relative luminance. */
function luminance({ r, g, b }) {
  const linear = (value) => ((value /= 255) <= 0.03928 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4);
  return 0.2126 * linear(r) + 0.7152 * linear(g) + 0.0722 * linear(b);
}

/** WCAG contrast ratio between two colours, from 1 to 21. */
function contrastRatio(first, second) {
  const [lighter, darker] = [luminance(first), luminance(second)].sort((x, y) => y - x);
  return (lighter + 0.05) / (darker + 0.05);
}

/** The colour `amount` of the way from `from` to `to`. */
const blend = (from, to, amount) => ({
  r: from.r + (to.r - from.r) * amount,
  g: from.g + (to.g - from.g) * amount,
  b: from.b + (to.b - from.b) * amount,
  a: 1,
});

/**
 * Moves `colour` towards `towards` (white on dark, black on light) in 2%
 * steps until it has enough contrast on every background, so colours that
 * already pass don't change at all.
 */
function withEnoughContrast(colour, backgrounds, towards) {
  const original = paintOver(parseHex(colour), backgrounds[0]);
  let adjusted = original;
  for (let amount = 0; amount <= 1.0001; amount += 0.02) {
    adjusted = blend(original, towards, amount);
    if (backgrounds.every((background) => contrastRatio(adjusted, background) >= MIN_CONTRAST)) break;
  }
  return toHex(adjusted);
}

/** A copy of `theme` with every foreground colour fixed up for contrast. */
function accessibleTheme(theme, name, backgrounds, towards) {
  const fix = (colour) =>
    typeof colour === 'string' && colour.startsWith('#') ? withEnoughContrast(colour, backgrounds, towards) : colour;
  return {
    ...theme,
    name,
    colors: { ...theme.colors, 'editor.foreground': fix(theme.colors?.['editor.foreground'] ?? theme.fg) },
    fg: fix(theme.fg),
    tokenColors: (theme.tokenColors ?? []).map((rule) =>
      rule.settings?.foreground ? { ...rule, settings: { ...rule.settings, foreground: fix(rule.settings.foreground) } } : rule,
    ),
  };
}

// The code block background and the accent-tinted background of a
// highlighted line, for each theme (see global.css).
const darkBackgrounds = [parseHex('#242423'), paintOver({ ...parseHex('#c6a15e'), a: 0.12 }, parseHex('#242423'))];
const lightBackgrounds = [parseHex('#ffffff'), paintOver({ ...parseHex('#8a6528'), a: 0.1 }, parseHex('#ffffff'))];

export const siteDark = accessibleTheme(vitesseDark, 'site-dark', darkBackgrounds, parseHex('#ffffff'));
export const siteLight = accessibleTheme(vitesseLight, 'site-light', lightBackgrounds, parseHex('#000000'));
