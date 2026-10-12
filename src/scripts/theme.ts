// Light and dark mode: the toggle, the curtain that wipes across while the
// theme changes, and following the system setting. Picking the theme before
// the first paint (so there's no flash) happens in the inline <head> script,
// in components/Head.astro.

import { html, animate, dur, EASE, afterPaint, prefersReducedMotion } from './motion';

export type Theme = 'light' | 'dark';

// Matches --bg in global.css; used for the browser's own UI colour.
const BACKGROUND: Record<Theme, string> = { dark: '#1c1c1b', light: '#f5f4f0' };
const systemPrefersLight = matchMedia('(prefers-color-scheme: light)');

/** The theme the visitor picked earlier, if they ever did. */
function savedTheme(): Theme | null {
  try {
    const saved = localStorage.getItem('theme');
    return saved === 'light' || saved === 'dark' ? saved : null;
  } catch {
    return null;
  }
}

function saveTheme(theme: Theme) {
  try {
    localStorage.setItem('theme', theme);
  } catch {
    // Storage is off (private mode, say): the choice just lasts for this page.
  }
}

export const currentTheme = (): Theme => (html.dataset.theme === 'light' ? 'light' : 'dark');
const systemTheme = (): Theme => (systemPrefersLight.matches ? 'light' : 'dark');

/** Updates the browser UI colour and the toggle's label to match the theme. */
function syncThemeUi(theme: Theme) {
  document.querySelectorAll('meta[name="theme-color"]').forEach((meta) => meta.setAttribute('content', BACKGROUND[theme]));
  const otherTheme = theme === 'dark' ? 'light' : 'dark';
  document.querySelectorAll<HTMLButtonElement>('[data-theme-toggle]').forEach((button) => {
    button.setAttribute('aria-label', `Switch to ${otherTheme} theme`);
    button.classList.remove('is-flipping');
  });
}

/** Sets the theme on <html>, or on another root, like a page that's about to be swapped in. */
export function applyTheme(theme: Theme, root: HTMLElement = html) {
  root.dataset.theme = theme;
  root.style.colorScheme = theme;
  if (root === html) syncThemeUi(theme);
}

/** Switches the theme in one go, with colour transitions turned off for a moment. */
function switchInstantly(theme: Theme) {
  html.classList.add('theme-switching');
  applyTheme(theme);
  void getComputedStyle(html).backgroundColor; // makes the browser apply the new colours before transitions come back
  requestAnimationFrame(() => requestAnimationFrame(() => html.classList.remove('theme-switching')));
}

let switching = false;

async function toggleTheme(button?: HTMLElement | null) {
  if (switching) return;
  const nextTheme: Theme = currentTheme() === 'dark' ? 'light' : 'dark';
  saveTheme(nextTheme);

  const curtain = document.querySelector<HTMLElement>('[data-theme-curtain]');
  if (prefersReducedMotion() || !curtain) {
    switchInstantly(nextTheme);
    return;
  }

  switching = true;
  button?.classList.add('is-flipping'); // the sun/moon icon starts morphing straight away
  try {
    // The curtain is painted in the new theme's background. It slides in,
    // the theme switches behind it, and then it slides off the other side.
    curtain.dataset.theme = nextTheme;
    curtain.classList.add('is-active');
    await animate(curtain, [{ transform: 'translateX(-100%)' }, { transform: 'translateX(0)' }], {
      duration: dur(450),
      easing: EASE.shutter,
      fill: 'forwards',
    });
    switchInstantly(nextTheme);
    await afterPaint();
    await animate(curtain, [{ transform: 'translateX(0)' }, { transform: 'translateX(100%)' }], {
      duration: dur(550),
      easing: EASE.shutter,
      fill: 'forwards',
    });
  } finally {
    curtain.classList.remove('is-active');
    curtain.getAnimations().forEach((animation) => animation.cancel());
    switching = false;
  }
}

export function initTheme() {
  syncThemeUi(currentTheme());

  document.addEventListener('click', (event) => {
    const button = (event.target as Element | null)?.closest<HTMLElement>('[data-theme-toggle]');
    if (button) toggleTheme(button);
  });

  // Follow the operating system until the visitor picks a theme themselves.
  systemPrefersLight.addEventListener('change', () => {
    if (!savedTheme()) switchInstantly(systemTheme());
  });

  // Keep other open tabs in step.
  window.addEventListener('storage', (event) => {
    if (event.key === 'theme' && (event.newValue === 'light' || event.newValue === 'dark')) switchInstantly(event.newValue);
  });

  // A client-side navigation swaps the <html> attributes, so sync the UI again after each one.
  document.addEventListener('astro:after-swap', () => syncThemeUi(currentTheme()));
}
