// Vitesse code themes with every token colour nudged just far enough to reach
// WCAG AA (4.5:1) against this site's code-block backgrounds, including the
// tinted background of highlighted lines.

import vitesseDark from '@shikijs/themes/vitesse-dark';
import vitesseLight from '@shikijs/themes/vitesse-light';

const MIN_CONTRAST = 4.6;

const hex = (h) => {
  const s = h.replace('#', '');
  const full = s.length <= 4 ? [...s].map((c) => c + c).join('') : s;
  const n = (i) => parseInt(full.slice(i, i + 2), 16);
  return { r: n(0), g: n(2), b: n(4), a: full.length === 8 ? n(6) / 255 : 1 };
};
const toHex = ({ r, g, b }) => '#' + [r, g, b].map((v) => Math.round(v).toString(16).padStart(2, '0')).join('');
const over = (fg, bg) => ({ r: fg.r * fg.a + bg.r * (1 - fg.a), g: fg.g * fg.a + bg.g * (1 - fg.a), b: fg.b * fg.a + bg.b * (1 - fg.a), a: 1 });
const lum = ({ r, g, b }) => {
  const f = (v) => ((v /= 255) <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4);
  return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
};
const contrast = (a, b) => {
  const [x, y] = [lum(a), lum(b)].sort((m, n) => n - m);
  return (x + 0.05) / (y + 0.05);
};
const mix = (a, b, t) => ({ r: a.r + (b.r - a.r) * t, g: a.g + (b.g - a.g) * t, b: a.b + (b.b - a.b) * t, a: 1 });

function adjust(color, backgrounds, towards) {
  const base = over(hex(color), backgrounds[0]);
  let c = base;
  for (let t = 0; t <= 1.0001; t += 0.02) {
    c = mix(base, towards, t);
    if (backgrounds.every((bg) => contrast(c, bg) >= MIN_CONTRAST)) break;
  }
  return toHex(c);
}

function accessible(theme, name, backgrounds, towards) {
  const fix = (c) => (typeof c === 'string' && c.startsWith('#') ? adjust(c, backgrounds, towards) : c);
  return {
    ...theme,
    name,
    colors: { ...theme.colors, 'editor.foreground': fix(theme.colors?.['editor.foreground'] ?? theme.fg) },
    fg: fix(theme.fg),
    tokenColors: (theme.tokenColors ?? []).map((tc) =>
      tc.settings?.foreground ? { ...tc, settings: { ...tc.settings, foreground: fix(tc.settings.foreground) } } : tc,
    ),
  };
}

// Code-block surface and the accent-tinted highlighted-line colour, per theme (see global.css).
const darkBgs = [hex('#242423'), over({ ...hex('#c6a15e'), a: 0.12 }, hex('#242423'))];
const lightBgs = [hex('#ffffff'), over({ ...hex('#8a6528'), a: 0.1 }, hex('#ffffff'))];

export const siteDark = accessible(vitesseDark, 'site-dark', darkBgs, hex('#ffffff'));
export const siteLight = accessible(vitesseLight, 'site-light', lightBgs, hex('#000000'));
