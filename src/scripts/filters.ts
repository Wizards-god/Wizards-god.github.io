// Lists you can narrow down: the projects page and the bookshelf. This runs
// the tag and year filter chips, the rows/cards switch on /projects, "Show
// more" on the bookshelf, and the gen-ed toggle on /coursework.
//
// The filter chips and the rows/cards switch are hidden for now (see
// site.listControls in src/data/site.ts). This code is ready for when they
// come back; until then it simply finds no chips to wire up.

import { animate, dur, EASE, prefersReducedMotion, pageSignal } from './motion';
import { revealWithin } from './reveal';

/** Items that just appeared slide up one after another. */
function staggerIn(items: HTMLElement[]) {
  if (prefersReducedMotion()) return;
  items.forEach((item, position) =>
    animate(item, [{ opacity: 0, transform: 'translateY(12px)' }, { opacity: 1, transform: 'none' }], {
      duration: dur(450),
      delay: dur(position * 70),
      easing: EASE.out,
      fill: 'backwards',
    }),
  );
}

/** Runs `changeDom`, and animates `element`'s height from what it was to what it is now. */
async function animateHeight(element: HTMLElement, changeDom: () => void) {
  if (prefersReducedMotion()) {
    changeDom();
    return;
  }
  const heightBefore = element.offsetHeight;
  changeDom();
  const heightAfter = element.offsetHeight;
  if (heightBefore === heightAfter) return;
  element.style.overflow = 'clip';
  await animate(element, [{ height: `${heightBefore}px` }, { height: `${heightAfter}px` }], {
    duration: dur(400),
    easing: EASE.ui,
  });
  element.style.overflow = '';
}

function setUpFilteredList(filterRoot: HTMLElement) {
  const list = filterRoot.querySelector<HTMLElement>('[data-filter-list]');
  if (!list) return;
  const items = [...list.querySelectorAll<HTMLElement>('[data-item]')];
  const statusMessage = filterRoot.querySelector<HTMLElement>('[data-filter-status]');
  const emptyMessage = filterRoot.querySelector<HTMLElement>('[data-filter-empty]');
  const showMoreButton = filterRoot.querySelector<HTMLButtonElement>('[data-show-more]');
  const limit = Number(filterRoot.dataset.limit ?? 0); // 0 means show everything
  const noun = filterRoot.dataset.noun ?? 'items'; // for the screen-reader count, e.g. "4 books shown"
  const chosenFilters: Record<string, string> = {}; // e.g. { tags: 'maths', year: '2026' }
  let expanded = false;

  // An item matches when, for every filter, it has the chosen value (or the filter is "all").
  const matchesFilters = (item: HTMLElement) =>
    Object.entries(chosenFilters).every(([key, value]) => {
      if (!value || value === 'all') return true;
      return (item.dataset[key] ?? '').split('|').includes(value);
    });

  const update = (animateChange: boolean) => {
    const visibleBefore = new Set(items.filter((item) => !item.hidden));
    const matching = items.filter(matchesFilters);
    const shown = limit && !expanded ? matching.slice(0, limit) : matching;

    const changeDom = () => {
      items.forEach((item) => (item.hidden = !shown.includes(item)));
      if (emptyMessage) emptyMessage.hidden = matching.length > 0;
      if (showMoreButton) {
        showMoreButton.hidden = !limit || matching.length <= limit;
        showMoreButton.textContent = expanded ? 'Show less' : `Show more (${matching.length - limit})`;
        showMoreButton.setAttribute('aria-expanded', String(expanded));
      }
    };

    if (!animateChange) {
      changeDom(); // matches what the server rendered, so nothing shifts on load
      return;
    }
    animateHeight(list, changeDom);
    revealWithin(list);
    staggerIn(shown.filter((item) => !visibleBefore.has(item)));
    if (statusMessage) statusMessage.textContent = `${matching.length} ${noun} shown`;
  };

  const signal = pageSignal();

  // Clicking the chip that's already chosen goes back to "all".
  filterRoot.querySelectorAll<HTMLButtonElement>('[data-filter-key]').forEach((chip) => {
    chip.addEventListener(
      'click',
      () => {
        const key = chip.dataset.filterKey!;
        const value = chip.dataset.filterValue!;
        const nextValue = chosenFilters[key] === value ? 'all' : value;
        chosenFilters[key] = nextValue;
        filterRoot
          .querySelectorAll<HTMLButtonElement>(`[data-filter-key="${key}"]`)
          .forEach((sameGroupChip) =>
            sameGroupChip.setAttribute('aria-pressed', String((sameGroupChip.dataset.filterValue ?? 'all') === nextValue)),
          );
        update(true);
      },
      { signal },
    );
  });

  showMoreButton?.addEventListener(
    'click',
    () => {
      expanded = !expanded;
      update(true);
    },
    { signal },
  );

  // Rows or cards (projects page). The choice is remembered for next time.
  const viewButtons = filterRoot.querySelectorAll<HTMLButtonElement>('[data-view]');
  if (viewButtons.length) {
    const setView = (view: string, remember: boolean) => {
      list.dataset.layout = view;
      viewButtons.forEach((button) => button.setAttribute('aria-pressed', String(button.dataset.view === view)));
      if (remember) {
        try {
          localStorage.setItem('projects-view', view);
        } catch {
          // Storage is off; the choice just won't be remembered.
        }
      }
    };
    let savedView: string | null = null;
    try {
      savedView = localStorage.getItem('projects-view');
    } catch {
      savedView = null;
    }
    if (savedView === 'rows' || savedView === 'grid') setView(savedView, false);
    viewButtons.forEach((button) =>
      button.addEventListener(
        'click',
        () => {
          setView(button.dataset.view!, true);
          staggerIn(items.filter((item) => !item.hidden));
        },
        { signal },
      ),
    );
  }

  filterRoot.classList.add('is-enhanced');
  update(false);
}

/** Coursework: STEM courses by default, and a button that shows the gen eds as well. */
function setUpGenEdToggle(button: HTMLButtonElement) {
  const courseList = document.getElementById(button.getAttribute('aria-controls') ?? '');
  const label = button.querySelector<HTMLElement>('[data-gened-label]');
  const statusMessage = document.querySelector<HTMLElement>('[data-gened-status]');
  if (!courseList) return;
  const genEdRows = [...courseList.querySelectorAll<HTMLElement>('[data-category="gen-ed"]')];
  const genEdOnlyTerms = [...courseList.querySelectorAll<HTMLElement>('[data-gened-only]')]; // semesters with nothing else in them
  let showingGenEds = false;

  button.addEventListener(
    'click',
    () => {
      showingGenEds = !showingGenEds;
      animateHeight(courseList, () => {
        genEdRows.forEach((row) => (row.hidden = !showingGenEds));
        genEdOnlyTerms.forEach((term) => (term.hidden = !showingGenEds));
      });
      revealWithin(courseList);
      if (showingGenEds) staggerIn(genEdRows);
      button.setAttribute('aria-pressed', String(showingGenEds));
      if (label) label.textContent = showingGenEds ? 'Hide gen eds' : `Show gen eds (${genEdRows.length})`;
      if (statusMessage) {
        statusMessage.textContent = showingGenEds ? `Showing ${genEdRows.length} gen ed courses` : 'Showing STEM courses only';
      }
    },
    { signal: pageSignal() },
  );
  button.dataset.enhanced = '';
}

export function initFilters() {
  document.querySelectorAll<HTMLElement>('[data-filter-root]:not(.is-enhanced)').forEach(setUpFilteredList);
  document.querySelectorAll<HTMLButtonElement>('[data-gened-toggle]:not([data-enhanced])').forEach(setUpGenEdToggle);
}
