// Small things that work on every page: copy buttons (the email address and
// code blocks), the little toast message, my name cycling through scripts when
// you hover it in the header, and the cycling "p." on the 404, 429 and resume
// pages.

import { prefersReducedMotion, dur } from './motion';

// ------------------------------------------------------------ toast

let toastTimer = 0;

/** Shows a short message at the bottom of the screen for two seconds. */
function showToast(message: string) {
  const toast = document.querySelector<HTMLElement>('[data-toast]');
  if (!toast) return;
  toast.textContent = message;
  toast.classList.add('is-visible');
  window.clearTimeout(toastTimer);
  toastTimer = window.setTimeout(() => toast.classList.remove('is-visible'), dur(2000));
}

// ------------------------------------------------------------ copying

/** Copies text to the clipboard. Returns whether it worked. */
async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    // Older browsers, or a page without clipboard permission: fall back to
    // selecting a hidden textarea and using the old copy command.
    const textarea = document.createElement('textarea');
    textarea.value = text;
    textarea.setAttribute('readonly', '');
    textarea.style.cssText = 'position:fixed;opacity:0;pointer-events:none';
    document.body.append(textarea);
    textarea.select();
    let copied = false;
    try {
      copied = document.execCommand('copy');
    } catch {
      copied = false;
    }
    textarea.remove();
    return copied;
  }
}

function initCopyButtons() {
  document.addEventListener('click', async (event) => {
    const target = event.target as Element;

    const emailButton = target.closest<HTMLElement>('[data-copy-email]');
    if (emailButton) {
      const copied = await copyText(emailButton.dataset.copyEmail ?? '');
      showToast(copied ? 'Email copied to clipboard' : 'Copy failed. The address is ' + emailButton.dataset.copyEmail);
      return;
    }

    const codeButton = target.closest<HTMLButtonElement>('[data-copy-code]');
    if (codeButton) {
      const code = codeButton.closest('.code-block')?.querySelector('pre code')?.textContent ?? '';
      const copied = await copyText(code.replace(/\n$/, ''));
      codeButton.textContent = copied ? 'copied' : 'failed';
      codeButton.toggleAttribute('data-copied', copied);
      showToast(copied ? 'Code copied' : 'Copy failed');
      window.setTimeout(() => {
        codeButton.textContent = 'copy';
        codeButton.removeAttribute('data-copied');
      }, dur(2000));
    }
  });
}

// ------------------------------------------------------------ swapping text

// The newest swap for each element. If an older swap finishes late, it checks
// this and backs off instead of overwriting the newer text.
const latestSwap = new WeakMap<HTMLElement, number>();

/** Swaps an element's text with a soft fade and slide (or instantly with reduced motion). */
async function crossfadeText(element: HTMLElement, text: string, lang: string, ms = 520) {
  const swapNumber = (latestSwap.get(element) ?? 0) + 1;
  latestSwap.set(element, swapNumber);
  if (prefersReducedMotion()) {
    element.textContent = text;
    element.lang = lang;
    return;
  }

  const half = dur(ms / 2);
  // The old text drifts up and fades out...
  await element
    .animate([{ opacity: 1, transform: 'none' }, { opacity: 0, transform: 'translateY(-0.18em)' }], {
      duration: half,
      easing: 'cubic-bezier(0.4, 0, 1, 1)',
      fill: 'forwards',
    })
    .finished.catch(() => undefined);
  if (latestSwap.get(element) !== swapNumber) return;

  // ...and the new text rises into place.
  element.textContent = text;
  element.lang = lang;
  const fadeIn = element.animate([{ opacity: 0, transform: 'translateY(0.18em)' }, { opacity: 1, transform: 'none' }], {
    duration: half,
    easing: 'cubic-bezier(0, 0, 0.2, 1)',
  });
  element.getAnimations().forEach((animation) => animation !== fadeIn && animation.cancel());
  await fadeIn.finished.catch(() => undefined);
}

// ------------------------------------------------------------ my name in four scripts

/** "parjanya" in English, Kannada, Telugu and Sanskrit (written in Devanagari). */
const NAMES = [
  { text: 'parjanya', lang: 'en' },
  { text: 'ಪರ್ಜನ್ಯ', lang: 'kn' },
  { text: 'పర్జన్య', lang: 'te' },
  { text: 'पर्जन्यः', lang: 'sa' },
] as const;

const NAME_HOLD_MS = 1600; // how long each name stays before the next one fades in

function initNameCycle() {
  let timer = 0;
  let current = 0; // index into NAMES
  let cycling = false;
  const findWordmark = () => document.querySelector<HTMLElement>('[data-wordmark]');
  const findName = () => document.querySelector<HTMLElement>('[data-name-cycle]');

  const showNextName = async () => {
    const name = findName();
    if (!cycling || !name) return;
    current = (current + 1) % NAMES.length;
    await crossfadeText(name, NAMES[current].text, NAMES[current].lang);
    if (cycling) timer = window.setTimeout(showNextName, dur(NAME_HOLD_MS));
  };

  const startCycling = () => {
    if (cycling || prefersReducedMotion()) return;
    cycling = true;
    findWordmark()?.classList.add('is-cycling'); // makes the full stop blink
    timer = window.setTimeout(showNextName, dur(450));
  };

  // Back to plain "parjanya" as soon as the pointer or focus leaves.
  const stopCycling = () => {
    if (!cycling) return;
    cycling = false;
    window.clearTimeout(timer);
    findWordmark()?.classList.remove('is-cycling');
    const name = findName();
    if (name && current !== 0) {
      current = 0;
      crossfadeText(name, NAMES[0].text, NAMES[0].lang, 360);
    }
  };

  // Mouse only: a tap on a phone is a click on the link, not a hover.
  document.addEventListener('pointerover', (event) => {
    if (event.pointerType === 'mouse' && (event.target as Element).closest('[data-wordmark]')) startCycling();
  });
  document.addEventListener('pointerout', (event) => {
    const leaving = (event.target as Element).closest('[data-wordmark]');
    if (leaving && !leaving.contains(event.relatedTarget as Node)) stopCycling();
  });
  document.addEventListener('focusin', (event) => {
    if ((event.target as Element).closest?.('[data-wordmark]')) startCycling();
  });
  document.addEventListener('focusout', (event) => {
    if ((event.target as Element).closest?.('[data-wordmark]')) stopCycling();
  });
  document.addEventListener('astro:before-preparation', stopCycling);
}

// ------------------------------------------------------------ cycling "p." (404, 429, resume)

const P_GLYPHS = [
  { text: 'p', lang: 'en' },
  { text: 'ಪ', lang: 'kn' },
  { text: 'ప', lang: 'te' },
  { text: 'प', lang: 'sa' },
] as const;

const GLYPH_HOLD_MS = 1500;

function initGlyphCycle() {
  let timer = 0;
  let current = 0;

  const startOnThisPage = () => {
    window.clearTimeout(timer);
    current = 0;
    const glyph = document.querySelector<HTMLElement>('[data-p-glyph]');
    if (!glyph || prefersReducedMotion()) return;

    const showNextGlyph = async () => {
      if (!glyph.isConnected) return;
      current = (current + 1) % P_GLYPHS.length;
      await crossfadeText(glyph, P_GLYPHS[current].text, P_GLYPHS[current].lang, 700);
      timer = window.setTimeout(showNextGlyph, dur(GLYPH_HOLD_MS));
    };
    timer = window.setTimeout(showNextGlyph, dur(GLYPH_HOLD_MS));
  };

  document.addEventListener('page:init', startOnThisPage);
  document.addEventListener('page:leaving', () => window.clearTimeout(timer));
}

export function initInteractions() {
  initCopyButtons();
  initNameCycle();
  initGlyphCycle();
}
