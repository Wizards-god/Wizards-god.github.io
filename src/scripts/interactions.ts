// Small global interactions: copy-to-clipboard (email and code blocks), the
// toast, and the wordmark glyph easter egg.

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

// ------------------------------------------------ wordmark glyph easter egg

// "p" in Telugu, Kannada and Devanagari, then back to Latin.
const GLYPHS = ['ప', 'ಪ', 'प', 'p'];

function initEasterEgg() {
  let timer = 0;
  let i = 0;
  const target = () => document.querySelector<HTMLElement>('[data-glyph-cycle]');

  const stop = () => {
    window.clearInterval(timer);
    timer = 0;
    const t = target();
    if (t) t.textContent = 'p';
  };

  const start = () => {
    if (prefersReducedMotion() || timer) return;
    const t = target();
    if (!t) return;
    i = 0;
    t.textContent = GLYPHS[i];
    timer = window.setInterval(() => {
      i = (i + 1) % GLYPHS.length;
      t.textContent = GLYPHS[i];
    }, 700);
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

export function initInteractions() {
  initCopy();
  initEasterEgg();
}
