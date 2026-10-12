// Scroll reveals: elements marked [data-reveal] fade in and rise 20px the first
// time they're about 15% on screen. Children of [data-reveal-stagger] come in
// one after another, about 90ms apart (the delay itself is in global.css).

import { prefersReducedMotion } from './motion';

let observer: IntersectionObserver | null = null;

export function startReveal() {
  observer?.disconnect();
  const hiddenElements = [...document.querySelectorAll<HTMLElement>('[data-reveal]:not(.is-revealed)')];
  if (!hiddenElements.length) return;

  if (prefersReducedMotion() || !('IntersectionObserver' in window)) {
    hiddenElements.forEach((element) => element.classList.add('is-revealed'));
    return;
  }

  // Number the children of each staggered group, so CSS can delay them in
  // turn. The count starts again every 6, so long lists don't drag on.
  document.querySelectorAll<HTMLElement>('[data-reveal-stagger]').forEach((group) => {
    [...group.children].forEach((child, position) => {
      if (child.hasAttribute('data-reveal')) (child as HTMLElement).style.setProperty('--reveal-i', String(position % 6));
    });
  });

  observer = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        // A very tall element might never get to 15% of its own height on
        // screen, so 15% of the screen's height counts too.
        if (entry.intersectionRatio >= 0.15 || entry.intersectionRect.height >= innerHeight * 0.15) {
          entry.target.classList.add('is-revealed');
          observer?.unobserve(entry.target);
        }
      }
    },
    { threshold: [0, 0.15, 0.3] },
  );
  hiddenElements.forEach((element) => observer!.observe(element));
}

/** Reveals everything inside `scope` right away, e.g. items a filter just showed. */
export function revealWithin(scope: Element) {
  scope.querySelectorAll('[data-reveal]').forEach((element) => {
    element.classList.add('is-revealed');
    observer?.unobserve(element);
  });
}
