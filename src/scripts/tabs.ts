// Experience tabs: WAI-ARIA tabs pattern with roving tabindex, arrow keys,
// Home/End, and a 2px indicator that slides to the active tab.

import { pageSignal } from './motion';

const wide = matchMedia('(min-width: 600px)');

function setup(root: HTMLElement) {
  const list = root.querySelector<HTMLElement>('[role="tablist"]');
  const tabs = [...root.querySelectorAll<HTMLButtonElement>('[role="tab"]')];
  const indicator = root.querySelector<HTMLElement>('.tabs__indicator');
  if (!list || !tabs.length) return;
  const panelOf = (t: HTMLElement) => document.getElementById(t.getAttribute('aria-controls') ?? '');
  let active = Math.max(0, tabs.findIndex((t) => t.getAttribute('aria-selected') === 'true'));

  const placeIndicator = () => {
    if (!indicator) return;
    const t = tabs[active];
    if (wide.matches) {
      indicator.style.transform = `translateY(${t.offsetTop}px) scaleY(${t.offsetHeight})`;
    } else {
      indicator.style.transform = `translateX(${t.offsetLeft}px) scaleX(${t.offsetWidth})`;
    }
  };

  const orient = () => {
    list.setAttribute('aria-orientation', wide.matches ? 'vertical' : 'horizontal');
    indicator?.classList.add('no-anim');
    placeIndicator();
    requestAnimationFrame(() => requestAnimationFrame(() => indicator?.classList.remove('no-anim')));
  };

  const select = (i: number, focus: boolean) => {
    active = (i + tabs.length) % tabs.length;
    tabs.forEach((t, j) => {
      const on = j === active;
      t.setAttribute('aria-selected', String(on));
      t.tabIndex = on ? 0 : -1;
      const p = panelOf(t);
      if (p) p.hidden = !on;
    });
    placeIndicator();
    const t = tabs[active];
    if (focus) t.focus({ preventScroll: true });
    if (!wide.matches) {
      // Keep the active tab in view inside the horizontal strip without scrolling the page.
      const left = t.offsetLeft - (list.clientWidth - t.offsetWidth) / 2;
      list.scrollTo({ left, behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
    }
  };

  tabs.forEach((t, i) => {
    t.addEventListener('click', () => select(i, false));
    t.addEventListener('keydown', (e) => {
      const map: Record<string, number> = {
        ArrowDown: active + 1,
        ArrowRight: active + 1,
        ArrowUp: active - 1,
        ArrowLeft: active - 1,
        Home: 0,
        End: tabs.length - 1,
      };
      if (!(e.key in map)) return;
      e.preventDefault();
      select(map[e.key], true);
    });
  });

  const signal = pageSignal();
  wide.addEventListener('change', orient, { signal });
  addEventListener('resize', placeIndicator, { passive: true, signal });
  document.fonts?.ready.then(placeIndicator);
  root.classList.add('is-enhanced');
  orient();
}

export function initTabs() {
  document.querySelectorAll<HTMLElement>('[data-tabs]:not(.is-enhanced)').forEach(setup);
}
