// Small global interactions: copy-to-clipboard (email and code blocks), the
// toast, the wordmark name cycle, and the cycling "p." on the 404/resume pages.

import { prefersReducedMotion, dur } from './motion';

// ------------------------------------------------------------------ toast

let toastTimer = 0;

export function toast(message: string) {
  const el = document.querySelector<HTMLElement>('[data-toast]');
  if (!el) return;
  el.textContent = message;
  el.classList.add('is-visible');
  window.clearTimeout(toastTimer);
  toastTimer = window.setTimeout(() => el.classList.remove('is-visible'), dur(2000));
}

// ------------------------------------------------------------------- copy

async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.setAttribute('readonly', '');
    ta.style.cssText = 'position:fixed;opacity:0;pointer-events:none';
    document.body.append(ta);
    ta.select();
    let ok = false;
    try {
      ok = document.execCommand('copy');
    } catch {
      ok = false;
    }
    ta.remove();
    return ok;
  }
}

function initCopy() {
  document.addEventListener('click', async (e) => {
    const target = e.target as Element;

    const emailBtn = target.closest<HTMLElement>('[data-copy-email]');
    if (emailBtn) {
      const ok = await copyText(emailBtn.dataset.copyEmail ?? '');
      toast(ok ? 'Email copied to clipboard' : 'Copy failed. The address is ' + emailBtn.dataset.copyEmail);
      return;
    }

    const codeBtn = target.closest<HTMLButtonElement>('[data-copy-code]');
    if (codeBtn) {
      const code = codeBtn.closest('.code-block')?.querySelector('pre code')?.textContent ?? '';
      const ok = await copyText(code.replace(/\n$/, ''));
      codeBtn.textContent = ok ? 'copied' : 'failed';
      codeBtn.toggleAttribute('data-copied', ok);
      toast(ok ? 'Code copied' : 'Copy failed');
      window.setTimeout(() => {
        codeBtn.textContent = 'copy';
        codeBtn.removeAttribute('data-copied');
      }, dur(2000));
    }
  });
}

// ------------------------------------------------------ name in four scripts

/** "parjanya" in English, Kannada, Telugu and Sanskrit (Devanagari). */
export const NAMES = [
  { text: 'parjanya', lang: 'en' },
  { text: 'ಪರ್ಜನ್ಯ', lang: 'kn' },
  { text: 'పర్జన్య', lang: 'te' },
  { text: 'पर्जन्यः', lang: 'sa' },
] as const;

// Latest swap per element; an older swap that finishes late must not win.
const swaps = new WeakMap<HTMLElement, number>();

/** Swap an element's text with a soft fade/slide (or instantly under reduced motion). */
export async function crossfadeText(el: HTMLElement, text: string, lang: string, ms = 520) {
  const gen = (swaps.get(el) ?? 0) + 1;
  swaps.set(el, gen);
  if (prefersReducedMotion()) {
    el.textContent = text;
    el.lang = lang;
    return;
  }
  const half = dur(ms / 2);
  await el
    .animate([{ opacity: 1, transform: 'none' }, { opacity: 0, transform: 'translateY(-0.18em)' }], {
      duration: half,
      easing: 'cubic-bezier(0.4, 0, 1, 1)',
      fill: 'forwards',
    })
    .finished.catch(() => undefined);
  if (swaps.get(el) !== gen) return;
  el.textContent = text;
  el.lang = lang;
  const enter = el.animate([{ opacity: 0, transform: 'translateY(0.18em)' }, { opacity: 1, transform: 'none' }], {
    duration: half,
    easing: 'cubic-bezier(0, 0, 0.2, 1)',
  });
  el.getAnimations().forEach((a) => a !== enter && a.cancel());
  await enter.finished.catch(() => undefined);
}

const HOLD = 1600; // ms each name stays before the next one fades in

function initNameCycle() {
  let timer = 0;
  let index = 0;
  let active = false;
  const mark = () => document.querySelector<HTMLElement>('[data-wordmark]');
  const target = () => document.querySelector<HTMLElement>('[data-name-cycle]');

  const step = async () => {
    const t = target();
    if (!active || !t) return;
    index = (index + 1) % NAMES.length;
    await crossfadeText(t, NAMES[index].text, NAMES[index].lang);
    if (active) timer = window.setTimeout(step, dur(HOLD));
  };

  const start = () => {
    if (active || prefersReducedMotion()) return;
    active = true;
    mark()?.classList.add('is-cycling');
    timer = window.setTimeout(step, dur(450));
  };

  const stop = () => {
    if (!active) return;
    active = false;
    window.clearTimeout(timer);
    mark()?.classList.remove('is-cycling');
    const t = target();
    if (t && index !== 0) {
      index = 0;
      crossfadeText(t, NAMES[0].text, NAMES[0].lang, 360);
    }
  };

  document.addEventListener('pointerover', (e) => {
    if (e.pointerType === 'mouse' && (e.target as Element).closest('[data-wordmark]')) start();
  });
  document.addEventListener('pointerout', (e) => {
    const from = (e.target as Element).closest('[data-wordmark]');
    if (from && !from.contains(e.relatedTarget as Node)) stop();
  });
  document.addEventListener('focusin', (e) => {
    if ((e.target as Element).closest?.('[data-wordmark]')) start();
  });
  document.addEventListener('focusout', (e) => {
    if ((e.target as Element).closest?.('[data-wordmark]')) stop();
  });
  document.addEventListener('astro:before-preparation', stop);
}

// ------------------------------------------- cycling "p." (404, resume page)

const GLYPHS = ['p', 'ಪ', 'ప', 'प'];
const GLYPH_LANGS = ['en', 'kn', 'te', 'sa'];

function initGlyphCycle() {
  let timer = 0;
  let i = 0;
  const run = () => {
    window.clearTimeout(timer);
    i = 0;
    const el = document.querySelector<HTMLElement>('[data-p-glyph]');
    if (!el || prefersReducedMotion()) return;
    const tick = async () => {
      if (!el.isConnected) return;
      i = (i + 1) % GLYPHS.length;
      await crossfadeText(el, GLYPHS[i], GLYPH_LANGS[i], 700);
      timer = window.setTimeout(tick, dur(1500));
    };
    timer = window.setTimeout(tick, dur(1500));
  };
  document.addEventListener('page:init', run);
  document.addEventListener('page:leaving', () => window.clearTimeout(timer));
}

export function initInteractions() {
  initCopy();
  initNameCycle();
  initGlyphCycle();
}
