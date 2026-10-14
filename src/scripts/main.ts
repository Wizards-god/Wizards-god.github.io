// The site's one client-side script. It's bundled once and stays alive across
// client-side navigations, so anything that has to run for each new page
// listens for 'page:init' instead of running at the top level.

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
import { initAsciiChart } from './ascii-chart';
import { initScrollRail } from './scroll-rail';

declare global {
  interface Window {
    __siteReady?: boolean;
  }
}

// The head script checks this as a fail-safe: if it's never set, it shows the
// page anyway after a few seconds.
window.__siteReady = true;

// Set up once, for the whole visit.
initTheme();
initGlow();
initPage();
initHeader();
initInteractions();
initAsk();

// Set up again for every page.
document.addEventListener('page:init', () => {
  initTabs();
  initFilters();
  initAsciiChart();
  initScrollRail();
});
document.addEventListener('page:revealed', () => startReveal());

emit('page:init');

if (html.classList.contains('intro-active')) {
  const overlay = document.getElementById('intro');
  const settings = {
    minMs: Number(overlay?.dataset.minMs ?? 700),
    maxWaitMs: Number(overlay?.dataset.maxWaitMs ?? 3500),
  };
  // The intro only loads on the visits that play it.
  import('./intro')
    .then((intro) => intro.runIntro(settings))
    .catch(() => {
      // If it fails to load, skip it rather than leave the page covered.
      document.getElementById('intro')?.remove();
      document.querySelectorAll<HTMLElement>('[data-intro-inert]').forEach((element) => (element.inert = false));
      pageRevealed();
    });
} else {
  initialReveal();
}
