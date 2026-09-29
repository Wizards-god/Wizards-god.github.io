// Page lifecycle. Decides when a page is "revealed" (after the intro, after
// the shutter opens, or immediately) and choreographs client-side navigation.
//
// <html> classes (first set by the inline head script):
//   intro-active   intro overlay is up
//   page-entering  shutter is closed at first paint (hard refresh within a session)
//   chrome-wait    header / rails / status pill hidden until reveal
//   chrome-in      ...then animate in;  chrome-done  settled, no animation
//   content-wait   [data-enter] elements hidden until reveal;  content-in  animate in
//
// Events on document:
//   page:init      a page's DOM is ready for per-page setup (initial load and after each swap)
//   page:revealed  the page is visible; start scroll reveals
//   page:leaving   a client-side navigation has started

import { html, afterPaint, prefersReducedMotion, isTouchDevice, wait, dur, emit } from './motion';
import { closeShutter, openShutter, fadeOut, fadeIn, isShutterClosed, labelFor, setShutterMode, shutterMode } from './shutter';
import { applyTheme, currentTheme } from './theme';

let routerNav = false;
let swapped = false;

function settleChrome() {
  if (html.classList.contains('chrome-done')) return;
  html.classList.add('chrome-in');
  window.setTimeout(() => {
    html.classList.remove('chrome-in');
    html.classList.add('chrome-done');
  }, dur(1500));
}

/**
 * Everything is in place: run entrance animations and start scroll reveals.
 * After the intro the hero was already visible through the letter, so page
 * content does not animate in again (only the chrome does).
 */
export function pageRevealed({ animateContent = true } = {}) {
  html.classList.remove('page-entering', 'content-wait', 'chrome-wait', 'intro-active', 'intro-reduced');
  settleChrome();
  if (animateContent) html.classList.add('content-in');
  if (routerNav) focusHeading();
  emit('page:revealed', { routerNav });
  routerNav = false;
  swapped = false;
}

function focusHeading() {
  const h1 = document.querySelector<HTMLElement>('main h1');
  if (!h1) return;
  if (!h1.hasAttribute('tabindex')) h1.setAttribute('tabindex', '-1');
  h1.focus({ preventScroll: true });
}

/** First load of a document: reveal now, or after the hard-refresh shutter opens. */
export async function initialReveal() {
  if (html.classList.contains('intro-active')) return; // the intro calls pageRevealed()
  if (html.classList.contains('page-entering')) {
    await Promise.race([document.fonts.ready, wait(700)]);
    await afterPaint();
    await openShutter(500);
  }
  pageRevealed();
}

async function onRouterPageLoad() {
  emit('page:init');
  if (isShutterClosed()) {
    await afterPaint();
    if (shutterMode() === 'fade') await fadeIn(150);
    else await openShutter(Number(document.querySelector<HTMLElement>('[data-shutter]')?.dataset.ms ?? 500));
  }
  pageRevealed();
}

export function initPage() {
  document.addEventListener('astro:before-preparation', (ev) => {
    const e = ev as Event & {
      navigationType: 'push' | 'replace' | 'traverse';
      to: URL;
      loader: () => Promise<void>;
    };
    routerNav = true;
    swapped = false;
    emit('page:leaving');

    const traverse = e.navigationType === 'traverse';
    let mode: 'shutter' | 'fade' | 'none' = 'shutter';
    if (prefersReducedMotion()) mode = 'fade';
    else if (traverse && isTouchDevice()) mode = 'none'; // don't fight iOS swipe-back
    setShutterMode(mode);
    if (mode === 'none') return;

    const ms = traverse ? 300 : 500;
    const shutterEl = document.querySelector<HTMLElement>('[data-shutter]');
    if (shutterEl) shutterEl.dataset.ms = String(ms);

    // Close the shutter and fetch the next page in parallel.
    const original = e.loader;
    e.loader = async () => {
      const cover = mode === 'fade' ? fadeOut(150) : closeShutter(ms, labelFor(e.to));
      await Promise.all([cover, original()]);
    };
  });

  // Carry our <html> state into the incoming document before attributes are swapped.
  document.addEventListener('astro:before-swap', (ev) => {
    const e = ev as Event & { newDocument: Document };
    const next = e.newDocument.documentElement;
    applyTheme(currentTheme(), next);
    const slowVar = html.style.getPropertyValue('--slow');
    if (slowVar) next.style.setProperty('--slow', slowVar);
    const keep = ['js', 'reveal-ready'].filter((c) => html.classList.contains(c));
    keep.push('chrome-done', shutterMode() === 'none' ? 'content-in' : 'content-wait');
    next.className = keep.join(' ');
  });

  document.addEventListener('astro:after-swap', () => {
    swapped = true;
  });

  // Astro also fires page-load for the initial document (on window "load");
  // that one is handled by initialReveal(), so only react after a swap.
  document.addEventListener('astro:page-load', () => {
    if (routerNav && swapped) onRouterPageLoad();
  });
}
