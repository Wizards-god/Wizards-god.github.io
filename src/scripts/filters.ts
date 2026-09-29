// Filterable lists (projects, bookshelf): tag/year chips, a rows/grid view
// toggle, and "Show more" with an animated height change.

import { animate, dur, EASE, prefersReducedMotion, pageSignal } from './motion';
import { revealWithin } from './reveal';

type Item = HTMLElement & { dataset: DOMStringMap };

function staggerIn(items: HTMLElement[]) {
  if (prefersReducedMotion()) return;
  items.forEach((el, i) =>
    animate(el, [{ opacity: 0, transform: 'translateY(12px)' }, { opacity: 1, transform: 'none' }], {
      duration: dur(450),
      delay: dur(i * 70),
      easing: EASE.out,
      fill: 'backwards',
    }),
  );
}

/** Animate an element's height across a DOM change made by `mutate`. */
async function animateHeight(el: HTMLElement, mutate: () => void) {
  if (prefersReducedMotion()) {
    mutate();
    return;
  }
  const from = el.offsetHeight;
  mutate();
  const to = el.offsetHeight;
  if (from === to) return;
  el.style.overflow = 'clip';
  await animate(el, [{ height: `${from}px` }, { height: `${to}px` }], { duration: dur(400), easing: EASE.ui });
  el.style.overflow = '';
}

function setupFilter(root: HTMLElement) {
  const list = root.querySelector<HTMLElement>('[data-filter-list]');
  if (!list) return;
  const items = [...list.querySelectorAll<Item>('[data-item]')];
  const status = root.querySelector<HTMLElement>('[data-filter-status]');
  const empty = root.querySelector<HTMLElement>('[data-filter-empty]');
  const moreBtn = root.querySelector<HTMLButtonElement>('[data-show-more]');
  const limit = Number(root.dataset.limit ?? 0);
  const noun = root.dataset.noun ?? 'items';
  const state: Record<string, string> = {};
  let expanded = false;

  const matches = (el: Item) =>
    Object.entries(state).every(([key, value]) => {
      if (!value || value === 'all') return true;
      return (el.dataset[key] ?? '').split('|').includes(value);
    });

  const apply = (animateChange: boolean) => {
    const before = new Set(items.filter((i) => !i.hidden));
    const matching = items.filter(matches);
    const shown = limit && !expanded ? matching.slice(0, limit) : matching;
    const mutate = () => {
      items.forEach((i) => (i.hidden = !shown.includes(i)));
      if (empty) empty.hidden = matching.length > 0;
      if (moreBtn) {
        moreBtn.hidden = !limit || matching.length <= limit;
        moreBtn.textContent = expanded ? 'Show less' : `Show more (${matching.length - limit})`;
        moreBtn.setAttribute('aria-expanded', String(expanded));
      }
    };
    if (!animateChange) {
      mutate(); // matches the server-rendered state, so no layout shift
      return;
    }
    animateHeight(list, mutate);
    revealWithin(list);
    staggerIn(shown.filter((i) => !before.has(i)));
    if (status) status.textContent = `${matching.length} ${noun} shown`;
  };

  const signal = pageSignal();

  root.querySelectorAll<HTMLButtonElement>('[data-filter-key]').forEach((btn) => {
    btn.addEventListener(
      'click',
      () => {
        const key = btn.dataset.filterKey!;
        const value = btn.dataset.filterValue!;
        const next = state[key] === value ? 'all' : value;
        state[key] = next;
        root.querySelectorAll<HTMLButtonElement>(`[data-filter-key="${key}"]`).forEach((b) =>
          b.setAttribute('aria-pressed', String((b.dataset.filterValue ?? 'all') === next)),
        );
        apply(true);
      },
      { signal },
    );
  });

  moreBtn?.addEventListener(
    'click',
    () => {
      expanded = !expanded;
      apply(true);
    },
    { signal },
  );

  // Rows / grid toggle (projects).
  const views = root.querySelectorAll<HTMLButtonElement>('[data-view]');
  if (views.length) {
    const setView = (v: string, persist: boolean) => {
      list.dataset.layout = v;
      views.forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.view === v)));
      if (persist) {
        try {
          localStorage.setItem('projects-view', v);
        } catch {
          /* ignore */
        }
      }
    };
    let saved: string | null = null;
    try {
      saved = localStorage.getItem('projects-view');
    } catch {
      saved = null;
    }
    if (saved === 'rows' || saved === 'grid') setView(saved, false);
    views.forEach((b) =>
      b.addEventListener(
        'click',
        () => {
          setView(b.dataset.view!, true);
          staggerIn(items.filter((i) => !i.hidden));
        },
        { signal },
      ),
    );
  }

  root.classList.add('is-enhanced');
  apply(false);
}

export function initFilters() {
  document.querySelectorAll<HTMLElement>('[data-filter-root]:not(.is-enhanced)').forEach(setupFilter);
}
