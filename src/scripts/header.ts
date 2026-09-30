// Header: shrink on scroll, hide on scroll down, sliding active-page indicator,
// section tracking on the home page, and the mobile drawer.

import { html } from './motion';

const header = () => document.querySelector<HTMLElement>('[data-header]');

// ------------------------------------------------------------ scroll state

function initScroll() {
  let lastY = scrollY;
  let ticking = false;

  const update = () => {
    ticking = false;
    const h = header();
    if (!h) return;
    const y = Math.max(0, scrollY);
    h.classList.toggle('is-scrolled', y > 8);
    const menuOpen = html.classList.contains('menu-open');
    const focusInside = h.contains(document.activeElement);
    if (y < 200 || menuOpen || focusInside) h.classList.remove('is-hidden');
    else if (y > lastY + 4) h.classList.add('is-hidden');
    else if (y < lastY - 4) h.classList.remove('is-hidden');
    lastY = y;
  };

  addEventListener(
    'scroll',
    () => {
      if (!ticking) {
        ticking = true;
        requestAnimationFrame(update);
      }
    },
    { passive: true },
  );
  document.addEventListener('focusin', (e) => {
    if (header()?.contains(e.target as Node)) header()?.classList.remove('is-hidden');
  });
  document.addEventListener('astro:after-swap', () => {
    lastY = 0;
    header()?.classList.remove('is-hidden');
    update();
  });
  update();
}

// ------------------------------------------------------- active indicator

function keyForPath(path: string): string | null {
  const seg = path.split('/').filter(Boolean)[0] ?? '';
  return ['about', 'projects', 'writing', 'coursework'].includes(seg) ? seg : null;
}

let currentKey: string | null = null;

/**
 * Put the accent underline exactly under the active link's text. Measured
 * from the label's box (not the padded link), so padding never widens it.
 */
function moveIndicator(key: string | null, instant = false) {
  const nav = document.querySelector<HTMLElement>('[data-site-nav]');
  const bar = nav?.querySelector<HTMLElement>('.site-nav__indicator');
  if (!nav || !bar) return;
  currentKey = key;
  const link = key ? nav.querySelector<HTMLElement>(`[data-nav-key="${key}"]`) : null;
  nav.querySelectorAll('[data-nav-key]').forEach((a) => a.classList.toggle('is-active', a === link));
  const label = link?.querySelector<HTMLElement>('.site-nav__label') ?? link;
  if (!label || label.offsetWidth === 0) {
    bar.style.opacity = '0';
    return;
  }
  // Layout offsets (not getBoundingClientRect) so the nav items' entrance
  // transform can't skew the measurement. The nav is the offsetParent.
  let x = 0;
  let y = 0;
  for (let n: HTMLElement | null = label; n && n !== nav; n = n.offsetParent as HTMLElement | null) {
    x += n.offsetLeft;
    y += n.offsetTop;
  }
  y += label.offsetHeight + 3;
  const w = label.offsetWidth;
  if (instant) bar.classList.add('no-anim');
  bar.style.opacity = '1';
  bar.style.transform = `translate(${x}px, ${y}px) scaleX(${w})`;
  if (instant) requestAnimationFrame(() => requestAnimationFrame(() => bar.classList.remove('no-anim')));
}

function setCurrentPage() {
  const key = keyForPath(location.pathname);
  document.querySelectorAll<HTMLAnchorElement>('[data-nav-key]').forEach((a) => {
    if (a.dataset.navKey === key) a.setAttribute('aria-current', 'page');
    else a.removeAttribute('aria-current');
  });
  return key;
}

let sectionObserver: IntersectionObserver | null = null;

function trackHomeSections() {
  sectionObserver?.disconnect();
  sectionObserver = null;
  const sections = [...document.querySelectorAll<HTMLElement>('[data-nav-section]')];
  if (!sections.length) return;
  const visible = new Map<Element, boolean>();
  sectionObserver = new IntersectionObserver(
    (entries) => {
      entries.forEach((e) => visible.set(e.target, e.isIntersecting));
      const active = sections.find((s) => visible.get(s));
      moveIndicator(active?.dataset.navSection ?? null);
    },
    { rootMargin: '-45% 0px -50% 0px' },
  );
  sections.forEach((s) => sectionObserver!.observe(s));
}

function initIndicator() {
  const onPage = (instant: boolean) => {
    const key = setCurrentPage();
    moveIndicator(key, instant);
    trackHomeSections();
  };
  let first = true;
  document.addEventListener('page:init', () => {
    onPage(first);
    first = false;
  });
  // Re-measure whenever the labels change size: window resizes, and the web
  // font swapping in after the first measurement (which shifts every label).
  const nav = document.querySelector<HTMLElement>('[data-site-nav]');
  if (nav && 'ResizeObserver' in window) {
    const ro = new ResizeObserver(() => moveIndicator(currentKey, true));
    ro.observe(nav);
    nav.querySelectorAll('.site-nav__label').forEach((l) => ro.observe(l));
  }
  addEventListener('resize', () => moveIndicator(currentKey, true), { passive: true });
  document.fonts?.addEventListener?.('loadingdone', () => moveIndicator(currentKey, true));
  document.fonts?.ready.then(() => moveIndicator(currentKey, true));
}

// ------------------------------------------------------------ mobile drawer

const FOCUSABLE = 'a[href], button:not([disabled]), input, select, textarea, [tabindex]:not([tabindex="-1"])';

function initDrawer() {
  const drawer = document.querySelector<HTMLElement>('[data-drawer]');
  const backdrop = document.querySelector<HTMLElement>('[data-drawer-backdrop]');
  if (!drawer || !backdrop) return;
  const toggle = () => document.querySelector<HTMLButtonElement>('[data-menu-toggle]');
  const outside = () =>
    [...document.querySelectorAll<HTMLElement>('main, .site-footer, .rails, .skip-link, [data-wordmark]')];

  let open = false;

  const setOpen = (next: boolean, { restoreFocus = true } = {}) => {
    if (next === open) return;
    open = next;
    const btn = toggle();
    html.classList.toggle('menu-open', open);
    drawer.classList.toggle('is-open', open);
    drawer.inert = !open;
    backdrop.hidden = !open;
    outside().forEach((n) => (n.inert = open));
    btn?.setAttribute('aria-expanded', String(open));
    btn?.setAttribute('aria-label', open ? 'Close menu' : 'Open menu');
    if (open) drawer.querySelector<HTMLElement>(FOCUSABLE)?.focus({ preventScroll: true });
    else if (restoreFocus) btn?.focus({ preventScroll: true });
  };

  drawer.inert = true;

  document.addEventListener('click', (e) => {
    const t = e.target as Element;
    if (t.closest('[data-menu-toggle]')) setOpen(!open);
    else if (t.closest('[data-drawer-backdrop]')) setOpen(false);
    else if (open && t.closest('[data-drawer] a')) setOpen(false, { restoreFocus: false });
  });

  document.addEventListener('keydown', (e) => {
    if (!open) return;
    if (e.key === 'Escape') {
      e.preventDefault();
      setOpen(false);
      return;
    }
    if (e.key !== 'Tab') return;
    // Trap focus: header controls (theme toggle, menu button) + drawer contents.
    const pool = [
      ...document.querySelectorAll<HTMLElement>('[data-header] [data-theme-toggle], [data-menu-toggle]'),
      ...drawer.querySelectorAll<HTMLElement>(FOCUSABLE),
    ].filter((n) => n.offsetParent !== null);
    if (!pool.length) return;
    const i = pool.indexOf(document.activeElement as HTMLElement);
    const next = e.shiftKey ? (i <= 0 ? pool.length - 1 : i - 1) : i === pool.length - 1 ? 0 : i + 1;
    e.preventDefault();
    pool[next].focus();
  });

  matchMedia('(min-width: 768px)').addEventListener('change', (m) => {
    if (m.matches) setOpen(false, { restoreFocus: false });
  });
  document.addEventListener('astro:before-preparation', () => setOpen(false, { restoreFocus: false }));
}

export function initHeader() {
  initScroll();
  initIndicator();
  initDrawer();
}
