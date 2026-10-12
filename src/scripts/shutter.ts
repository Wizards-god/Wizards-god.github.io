// The page-transition shutter: two panels slide together while the next page
// loads, then split open once it has painted. With reduced motion the same
// element does a short crossfade instead.

import { html, animate, dur, EASE } from './motion';

export type ShutterMode = 'shutter' | 'fade' | 'none';

const findShutter = () => document.querySelector<HTMLElement>('[data-shutter]');

let closed = false;
export const isShutterClosed = () => closed || html.classList.contains('page-entering');

function partsOf(shutter: HTMLElement) {
  return {
    topPanel: shutter.querySelector<HTMLElement>('.shutter__panel--top')!,
    bottomPanel: shutter.querySelector<HTMLElement>('.shutter__panel--bottom')!,
    fadeLayer: shutter.querySelector<HTMLElement>('.shutter__fade')!,
    label: shutter.querySelector<HTMLElement>('[data-shutter-label]')!,
  };
}

/** Stops anything still animating inside the shutter, so a new move starts clean. */
const cancelAnimations = (shutter: HTMLElement) =>
  shutter.querySelectorAll('*').forEach((node) => node.getAnimations().forEach((animation) => animation.cancel()));

/** The text shown along the seam while the panels are shut, like "parjanya.me/projects". */
export function labelFor(url: URL) {
  const path = url.pathname.replace(/\/$/, '');
  return `parjanya.me${path}`;
}

export async function closeShutter(ms = 500, labelText = '') {
  const shutter = findShutter();
  if (!shutter) return;
  const { topPanel, bottomPanel, label } = partsOf(shutter);
  cancelAnimations(shutter);
  shutter.classList.add('is-active');
  label.textContent = labelText;

  const timing: KeyframeAnimationOptions = { duration: dur(ms), easing: EASE.shutter, fill: 'forwards' };
  const panelsShut = Promise.all([
    animate(topPanel, [{ transform: 'translateY(-100%)' }, { transform: 'translateY(0)' }], timing),
    animate(bottomPanel, [{ transform: 'translateY(100%)' }, { transform: 'translateY(0)' }], timing),
  ]);
  // The label fades in over the last 40% of the close.
  if (labelText) {
    animate(label, [{ opacity: 0 }, { opacity: 1 }], {
      duration: dur(ms * 0.4),
      delay: dur(ms * 0.6),
      easing: 'linear',
      fill: 'forwards',
    });
  }
  await panelsShut;
  closed = true;
}

export async function openShutter(ms = 500) {
  const shutter = findShutter();
  if (!shutter) return;
  const { topPanel, bottomPanel, label } = partsOf(shutter);
  shutter.classList.add('is-active');

  // The animations start before the CSS "closed" state is dropped, so there's
  // never a frame where the panels are neither.
  const timing: KeyframeAnimationOptions = { duration: dur(ms), easing: EASE.shutter, fill: 'forwards' };
  const panelsOpen = Promise.all([
    animate(topPanel, [{ transform: 'translateY(0)' }, { transform: 'translateY(-100%)' }], timing),
    animate(bottomPanel, [{ transform: 'translateY(0)' }, { transform: 'translateY(100%)' }], timing),
  ]);
  if (label.textContent) {
    animate(label, [{ opacity: 1 }, { opacity: 0 }], { duration: dur(ms * 0.3), easing: 'linear', fill: 'forwards' });
  }
  html.classList.remove('page-entering');

  await panelsOpen;
  cancelAnimations(shutter);
  label.textContent = '';
  shutter.classList.remove('is-active');
  closed = false;
}

/** The reduced-motion version of closing: a quick fade to the background colour. */
export async function fadeOut(ms = 150) {
  const shutter = findShutter();
  if (!shutter) return;
  const { fadeLayer } = partsOf(shutter);
  cancelAnimations(shutter);
  shutter.classList.add('is-active');
  await animate(fadeLayer, [{ opacity: 0 }, { opacity: 1 }], { duration: dur(ms), easing: 'linear', fill: 'forwards' });
  closed = true;
}

/** ...and of opening. */
export async function fadeIn(ms = 150) {
  const shutter = findShutter();
  if (!shutter) return;
  const { fadeLayer } = partsOf(shutter);
  await animate(fadeLayer, [{ opacity: 1 }, { opacity: 0 }], { duration: dur(ms), easing: 'linear', fill: 'forwards' });
  cancelAnimations(shutter);
  shutter.classList.remove('is-active');
  closed = false;
}

// The mode is stored on the element itself, so it survives the page swap
// (the shutter is one of the elements the router keeps).
export const shutterMode = () => findShutter()?.dataset.mode ?? 'shutter';

export const setShutterMode = (mode: ShutterMode) => {
  const shutter = findShutter();
  if (shutter) shutter.dataset.mode = mode;
};
