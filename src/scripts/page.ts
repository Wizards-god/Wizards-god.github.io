// How a page arrives. This decides when a page counts as "revealed" (after
// the intro, after the shutter opens, or straight away) and choreographs
// client-side navigation between pages.
//
// Classes on <html> (the head script sets the first ones):
//   intro-active   the intro overlay is up
//   page-entering  the shutter starts closed (a refresh partway through a visit)
//   chrome-wait    header, side rails and status pill hidden until the reveal...
//   chrome-in      ...then animating in, and chrome-done once they've settled
//   content-wait   [data-enter] elements hidden until the reveal, then content-in
//
// Events on document:
//   page:init      a page's DOM is ready for setup (first load, and after every swap)
//   page:revealed  the page is visible, so scroll reveals can start
//   page:leaving   a client-side navigation has started

import { html, afterPaint, prefersReducedMotion, isTouchDevice, wait, dur, emit } from './motion';
import {
  closeShutter,
  openShutter,
  fadeOut,
  fadeIn,
  isShutterClosed,
  labelFor,
  setShutterMode,
  shutterMode,
  type ShutterMode,
} from './shutter';
import { applyTheme, currentTheme } from './theme';

// Both are reset once the page is revealed.
let navigatingInSite = false; // this page came from a client-side navigation
let pageSwapped = false; // ...and the router has already swapped in the new page

/** The header and side rails animate in once, then stay put for the rest of the visit. */
function settleChrome() {
  if (html.classList.contains('chrome-done')) return;
  html.classList.add('chrome-in');
  window.setTimeout(() => {
    html.classList.remove('chrome-in');
    html.classList.add('chrome-done');
  }, dur(1500));
}

/**
 * Everything is in place: run the entrance animations and start the scroll
 * reveals. After the intro, the hero has already been seen through the
 * letter, so the page content doesn't animate in a second time (only the
 * header and rails do).
 */
export function pageRevealed({ animateContent = true } = {}) {
  html.classList.remove('page-entering', 'content-wait', 'chrome-wait', 'intro-active', 'intro-reduced');
  settleChrome();
  if (animateContent) html.classList.add('content-in');
  if (navigatingInSite) focusPageHeading();
  emit('page:revealed');
  navigatingInSite = false;
  pageSwapped = false;
}

/** After a client-side navigation, move focus to the new page's heading, like a real page load would. */
function focusPageHeading() {
  const heading = document.querySelector<HTMLElement>('main h1');
  if (!heading) return;
  if (!heading.hasAttribute('tabindex')) heading.setAttribute('tabindex', '-1');
  heading.focus({ preventScroll: true });
}

/** A fresh page load: reveal now, or after the shutter opens if it started closed. */
export async function initialReveal() {
  if (html.classList.contains('intro-active')) return; // the intro reveals the page itself
  if (html.classList.contains('page-entering')) {
    await Promise.race([document.fonts.ready, wait(700)]);
    await afterPaint();
    await openShutter(500);
  }
  pageRevealed();
}

async function onNewPageLoaded() {
  emit('page:init');
  if (isShutterClosed()) {
    await afterPaint();
    if (shutterMode() === 'fade') await fadeIn(150);
    else await openShutter(Number(document.querySelector<HTMLElement>('[data-shutter]')?.dataset.ms ?? 500));
  }
  pageRevealed();
}

export function initPage() {
  document.addEventListener('astro:before-preparation', (event) => {
    const navigation = event as Event & {
      navigationType: 'push' | 'replace' | 'traverse';
      to: URL;
      loader: () => Promise<void>;
    };
    navigatingInSite = true;
    pageSwapped = false;
    emit('page:leaving');

    // Back/forward on a touch screen usually means a swipe, and the phone
    // already animates that, so the shutter stays out of its way.
    const isBackOrForward = navigation.navigationType === 'traverse';
    let mode: ShutterMode = 'shutter';
    if (prefersReducedMotion()) mode = 'fade';
    else if (isBackOrForward && isTouchDevice()) mode = 'none';
    setShutterMode(mode);
    if (mode === 'none') return;

    const shutterMs = isBackOrForward ? 300 : 500;
    const shutter = document.querySelector<HTMLElement>('[data-shutter]');
    if (shutter) shutter.dataset.ms = String(shutterMs);

    // Close the shutter and fetch the next page at the same time.
    const loadNextPage = navigation.loader;
    navigation.loader = async () => {
      const cover = mode === 'fade' ? fadeOut(150) : closeShutter(shutterMs, labelFor(navigation.to));
      await Promise.all([cover, loadNextPage()]);
    };
  });

  // Carry the current <html> state over to the incoming page before the router
  // copies its attributes across.
  document.addEventListener('astro:before-swap', (event) => {
    const incoming = (event as Event & { newDocument: Document }).newDocument.documentElement;
    applyTheme(currentTheme(), incoming);
    const slowSetting = html.style.getPropertyValue('--slow');
    if (slowSetting) incoming.style.setProperty('--slow', slowSetting);
    const classesToKeep = ['js', 'reveal-ready'].filter((className) => html.classList.contains(className));
    classesToKeep.push('chrome-done', shutterMode() === 'none' ? 'content-in' : 'content-wait');
    incoming.className = classesToKeep.join(' ');
  });

  document.addEventListener('astro:after-swap', () => {
    pageSwapped = true;
  });

  // Astro fires page-load for the very first page as well (on window "load"),
  // but initialReveal() already handles that one, so only react after a swap.
  document.addEventListener('astro:page-load', () => {
    if (navigatingInSite && pageSwapped) onNewPageLoaded();
  });
}
