// Page-transition shutter: two panels that meet in the middle while the next
// page loads, then split open once it has painted. Under reduced motion the
// same element does a short crossfade instead.

import { html, animate, dur, EASE } from './motion';

const el = () => document.querySelector<HTMLElement>('[data-shutter]');

let closed = false;
export const isShutterClosed = () => closed || html.classList.contains('page-entering');

function parts(root: HTMLElement) {
  return {
    top: root.querySelector<HTMLElement>('.shutter__panel--top')!,
    bottom: root.querySelector<HTMLElement>('.shutter__panel--bottom')!,
    fade: root.querySelector<HTMLElement>('.shutter__fade')!,
    label: root.querySelector<HTMLElement>('[data-shutter-label]')!,
  };
}

const cancelAll = (root: HTMLElement) =>
  root.querySelectorAll('*').forEach((n) => n.getAnimations().forEach((a) => a.cancel()));

/** "parjanya.me/projects" style label for the seam. */
export function labelFor(url: URL) {
  const path = url.pathname.replace(/\/$/, '');
  return `parjanya.me${path}`;
}

export async function closeShutter(ms = 500, label = '') {
  const root = el();
  if (!root) return;
  const { top, bottom, label: lab } = parts(root);
  cancelAll(root);
  root.classList.add('is-active');
  lab.textContent = label;
  const opts: KeyframeAnimationOptions = { duration: dur(ms), easing: EASE.shutter, fill: 'forwards' };
  const done = Promise.all([
    animate(top, [{ transform: 'translateY(-100%)' }, { transform: 'translateY(0)' }], opts),
    animate(bottom, [{ transform: 'translateY(100%)' }, { transform: 'translateY(0)' }], opts),
  ]);
  if (label) {
    animate(lab, [{ opacity: 0 }, { opacity: 1 }], {
      duration: dur(ms * 0.4),
      delay: dur(ms * 0.6),
      easing: 'linear',
      fill: 'forwards',
    });
  }
  await done;
  closed = true;
}

export async function openShutter(ms = 500) {
  const root = el();
  if (!root) return;
  const { top, bottom, label } = parts(root);
  root.classList.add('is-active');
  const opts: KeyframeAnimationOptions = { duration: dur(ms), easing: EASE.shutter, fill: 'forwards' };
  // Start the animations before dropping the CSS "closed" state so there is no gap frame.
  const done = Promise.all([
    animate(top, [{ transform: 'translateY(0)' }, { transform: 'translateY(-100%)' }], opts),
    animate(bottom, [{ transform: 'translateY(0)' }, { transform: 'translateY(100%)' }], opts),
  ]);
  if (label.textContent) {
    animate(label, [{ opacity: 1 }, { opacity: 0 }], { duration: dur(ms * 0.3), easing: 'linear', fill: 'forwards' });
  }
  html.classList.remove('page-entering');
  await done;
  cancelAll(root);
  label.textContent = '';
  root.classList.remove('is-active');
  closed = false;
}

/** Reduced-motion variant: a quick crossfade through the background colour. */
export async function fadeOut(ms = 150) {
  const root = el();
  if (!root) return;
  const { fade } = parts(root);
  cancelAll(root);
  root.classList.add('is-active');
  await animate(fade, [{ opacity: 0 }, { opacity: 1 }], { duration: dur(ms), easing: 'linear', fill: 'forwards' });
  closed = true;
}

export async function fadeIn(ms = 150) {
  const root = el();
  if (!root) return;
  const { fade } = parts(root);
  await animate(fade, [{ opacity: 1 }, { opacity: 0 }], { duration: dur(ms), easing: 'linear', fill: 'forwards' });
  cancelAll(root);
  root.classList.remove('is-active');
  closed = false;
}

export const shutterMode = () => el()?.dataset.mode ?? 'shutter';
export const setShutterMode = (m: 'shutter' | 'fade' | 'none') => {
  const root = el();
  if (root) root.dataset.mode = m;
};
