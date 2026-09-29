// Scroll reveal: [data-reveal] elements fade in and rise 20px once, when about
// 15% visible. Children of [data-reveal-stagger] get a ~90ms stagger.

import { prefersReducedMotion } from './motion';

let io: IntersectionObserver | null = null;

export function startReveal() {
  io?.disconnect();
  const els = [...document.querySelectorAll<HTMLElement>('[data-reveal]:not(.is-revealed)')];
  if (!els.length) return;

  if (prefersReducedMotion() || !('IntersectionObserver' in window)) {
    els.forEach((el) => el.classList.add('is-revealed'));
    return;
  }

  document.querySelectorAll<HTMLElement>('[data-reveal-stagger]').forEach((parent) => {
    [...parent.children].forEach((child, i) => {
      if (child.hasAttribute('data-reveal')) (child as HTMLElement).style.setProperty('--reveal-i', String(i % 6));
    });
  });

  io = new IntersectionObserver(
    (entries) => {
      for (const e of entries) {
        if (!e.isIntersecting) continue;
        // Tall elements may never reach 15% of their own height; also accept 15% of the viewport.
        if (e.intersectionRatio >= 0.15 || e.intersectionRect.height >= innerHeight * 0.15) {
          e.target.classList.add('is-revealed');
          io?.unobserve(e.target);
        }
      }
    },
    { threshold: [0, 0.15, 0.3] },
  );
  els.forEach((el) => io!.observe(el));
}

/** Reveal anything inside `root` right away (e.g. items shown by a filter). */
export function revealWithin(root: Element) {
  root.querySelectorAll('[data-reveal]').forEach((el) => {
    el.classList.add('is-revealed');
    io?.unobserve(el);
  });
}
