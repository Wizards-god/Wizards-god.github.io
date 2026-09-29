// Client entry. Bundled once and kept across client-side navigations, so
// per-page setup hangs off the 'page:init' event instead of running inline.

import { html, emit } from './motion';
import { initTheme } from './theme';
import { initGlow } from './glow';
import { initPage, initialReveal, pageRevealed } from './page';
import { initHeader } from './header';
import { startReveal } from './reveal';
import { initTabs } from './tabs';
import { initInteractions } from './interactions';
import { initFilters } from './filters';
import { initAsk } from './ask';

declare global {
  interface Window {
    __siteReady?: boolean;
  }
}

window.__siteReady = true;

initTheme();
initGlow();
initPage();
initHeader();
initInteractions();
initAsk();

document.addEventListener('page:init', () => {
  initTabs();
  initFilters();
});
document.addEventListener('page:revealed', () => startReveal());

emit('page:init');

if (html.classList.contains('intro-active')) {
  const el = document.getElementById('intro');
  const cfg = {
    minMs: Number(el?.dataset.minMs ?? 700),
    maxWaitMs: Number(el?.dataset.maxWaitMs ?? 3500),
  };
  import('./intro')
    .then((m) => m.runIntro(cfg))
    .catch(() => {
      document.getElementById('intro')?.remove();
      document.querySelectorAll<HTMLElement>('[data-intro-inert]').forEach((n) => (n.inert = false));
      pageRevealed();
    });
} else {
  initialReveal();
}
