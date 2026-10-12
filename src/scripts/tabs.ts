// The experience tabs on the home page. They follow the standard accessible
// tabs pattern: only the selected tab is in the Tab order, arrow keys move
// between tabs, Home and End jump to the ends. A thin indicator slides to
// whichever tab is selected.

import { pageSignal, prefersReducedMotion } from './motion';

// Side by side (tabs on the left, going down) from 600px up, a scrolling strip above that.
const sideBySide = matchMedia('(min-width: 600px)');

function setUpTabs(tabsRoot: HTMLElement) {
  const tabList = tabsRoot.querySelector<HTMLElement>('[role="tablist"]');
  const tabs = [...tabsRoot.querySelectorAll<HTMLButtonElement>('[role="tab"]')];
  const indicator = tabsRoot.querySelector<HTMLElement>('.tabs__indicator');
  if (!tabList || !tabs.length) return;
  const panelFor = (tab: HTMLElement) => document.getElementById(tab.getAttribute('aria-controls') ?? '');
  let selected = Math.max(0, tabs.findIndex((tab) => tab.getAttribute('aria-selected') === 'true'));

  // The indicator is 1px in CSS and gets scaled to the tab's size along the strip.
  const moveIndicator = () => {
    if (!indicator) return;
    const tab = tabs[selected];
    if (sideBySide.matches) {
      indicator.style.transform = `translateY(${tab.offsetTop}px) scaleY(${tab.offsetHeight})`;
    } else {
      indicator.style.transform = `translateX(${tab.offsetLeft}px) scaleX(${tab.offsetWidth})`;
    }
  };

  // When the layout flips between vertical and horizontal, jump the indicator
  // into place instead of letting it slide diagonally across.
  const updateOrientation = () => {
    tabList.setAttribute('aria-orientation', sideBySide.matches ? 'vertical' : 'horizontal');
    indicator?.classList.add('no-anim');
    moveIndicator();
    requestAnimationFrame(() => requestAnimationFrame(() => indicator?.classList.remove('no-anim')));
  };

  const selectTab = (index: number, moveFocus: boolean) => {
    selected = (index + tabs.length) % tabs.length; // wraps around at both ends
    tabs.forEach((tab, position) => {
      const isSelected = position === selected;
      tab.setAttribute('aria-selected', String(isSelected));
      tab.tabIndex = isSelected ? 0 : -1;
      const panel = panelFor(tab);
      if (panel) panel.hidden = !isSelected;
    });
    moveIndicator();

    const tab = tabs[selected];
    if (moveFocus) tab.focus({ preventScroll: true });
    if (!sideBySide.matches) {
      // Keep the selected tab in view inside the strip, without scrolling the page.
      const left = tab.offsetLeft - (tabList.clientWidth - tab.offsetWidth) / 2;
      tabList.scrollTo({ left, behavior: prefersReducedMotion() ? 'auto' : 'smooth' });
    }
  };

  tabs.forEach((tab, position) => {
    tab.addEventListener('click', () => selectTab(position, false));
    tab.addEventListener('keydown', (event) => {
      const targetFor: Record<string, number> = {
        ArrowDown: selected + 1,
        ArrowRight: selected + 1,
        ArrowUp: selected - 1,
        ArrowLeft: selected - 1,
        Home: 0,
        End: tabs.length - 1,
      };
      if (!(event.key in targetFor)) return;
      event.preventDefault();
      selectTab(targetFor[event.key], true);
    });
  });

  const signal = pageSignal();
  sideBySide.addEventListener('change', updateOrientation, { signal });
  addEventListener('resize', moveIndicator, { passive: true, signal });
  document.fonts?.ready.then(moveIndicator); // tab sizes change once the web font arrives
  tabsRoot.classList.add('is-enhanced');
  updateOrientation();
}

export function initTabs() {
  document.querySelectorAll<HTMLElement>('[data-tabs]:not(.is-enhanced)').forEach(setUpTabs);
}
