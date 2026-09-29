// Light/dark theme: toggle, curtain wipe, system-preference sync.
// The no-flash part lives in the inline <head> script (components/Head.astro).

import { html, animate, dur, EASE, afterPaint, prefersReducedMotion } from './motion';

export type Theme = 'light' | 'dark';

const BG: Record<Theme, string> = { dark: '#1c1c1b', light: '#f5f4f0' };
const systemLight = matchMedia('(prefers-color-scheme: light)');

function stored(): Theme | null {
  try {
    const v = localStorage.getItem('theme');
    return v === 'light' || v === 'dark' ? v : null;
  } catch {
    return null;
  }
}

function store(t: Theme) {
  try {
    localStorage.setItem('theme', t);
  } catch {
    /* private mode: the choice lasts for this page only */
  }
}

export const currentTheme = (): Theme => (html.dataset.theme === 'light' ? 'light' : 'dark');
const systemTheme = (): Theme => (systemLight.matches ? 'light' : 'dark');

function syncChrome(t: Theme) {
  document.querySelectorAll('meta[name="theme-color"]').forEach((m) => m.setAttribute('content', BG[t]));
  const next = t === 'dark' ? 'light' : 'dark';
  document.querySelectorAll<HTMLButtonElement>('[data-theme-toggle]').forEach((b) => {
    b.setAttribute('aria-label', `Switch to ${next} theme`);
    b.classList.remove('is-flipping');
  });
}

/** Set the theme on <html> (or on another root, e.g. a document about to be swapped in). */
export function applyTheme(t: Theme, root: HTMLElement = html) {
  root.dataset.theme = t;
  root.style.colorScheme = t;
  if (root === html) syncChrome(t);
}

function flip(t: Theme) {
  html.classList.add('theme-switching');
  applyTheme(t);
  void getComputedStyle(html).backgroundColor; // commit styles before re-enabling transitions
  requestAnimationFrame(() => requestAnimationFrame(() => html.classList.remove('theme-switching')));
}

let switching = false;

async function toggle(button?: HTMLElement | null) {
  if (switching) return;
  const target: Theme = currentTheme() === 'dark' ? 'light' : 'dark';
  store(target);

  const curtain = document.querySelector<HTMLElement>('[data-theme-curtain]');
  if (prefersReducedMotion() || !curtain) {
    flip(target);
    return;
  }

  switching = true;
  button?.classList.add('is-flipping'); // sun/moon morph starts right away
  try {
    // The curtain paints in the *target* theme's background.
    curtain.dataset.theme = target;
    curtain.classList.add('is-active');
    await animate(curtain, [{ transform: 'translateX(-100%)' }, { transform: 'translateX(0)' }], {
      duration: dur(450),
      easing: EASE.shutter,
      fill: 'forwards',
    });
    flip(target);
    await afterPaint();
    await animate(curtain, [{ transform: 'translateX(0)' }, { transform: 'translateX(100%)' }], {
      duration: dur(550),
      easing: EASE.shutter,
      fill: 'forwards',
    });
  } finally {
    curtain.classList.remove('is-active');
    curtain.getAnimations().forEach((a) => a.cancel());
    switching = false;
  }
}

export function initTheme() {
  syncChrome(currentTheme());

  document.addEventListener('click', (e) => {
    const btn = (e.target as Element | null)?.closest<HTMLElement>('[data-theme-toggle]');
    if (btn) toggle(btn);
  });

  // Follow the OS while the visitor hasn't picked a theme.
  systemLight.addEventListener('change', () => {
    if (!stored()) flip(systemTheme());
  });

  // Keep other tabs in sync.
  window.addEventListener('storage', (e) => {
    if (e.key === 'theme' && (e.newValue === 'light' || e.newValue === 'dark')) flip(e.newValue);
  });

  // Client-side navigation swaps <html> attributes; re-assert the theme after every swap.
  document.addEventListener('astro:after-swap', () => syncChrome(currentTheme()));
}
