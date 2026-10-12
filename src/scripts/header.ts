// The header: it shrinks once you scroll, hides while you scroll down and
// comes back when you scroll up. It also moves the underline in the nav,
// follows which section of the home page you're on, and runs the mobile menu.

import { html, dur, EASE, prefersReducedMotion } from './motion';

const findHeader = () => document.querySelector<HTMLElement>('[data-header]');

// ------------------------------------------------------------ scrolling

function initScrollBehaviour() {
  let lastScrollY = scrollY;
  let updateQueued = false;

  const update = () => {
    updateQueued = false;
    const header = findHeader();
    if (!header) return;
    const y = Math.max(0, scrollY); // Safari reports negative values while bouncing at the top
    header.classList.toggle('is-scrolled', y > 8);

    // Never hide it near the top, while the menu is open, or while it has focus.
    const menuOpen = html.classList.contains('menu-open');
    const focusInside = header.contains(document.activeElement);
    if (y < 200 || menuOpen || focusInside) header.classList.remove('is-hidden');
    else if (y > lastScrollY + 4) header.classList.add('is-hidden');
    else if (y < lastScrollY - 4) header.classList.remove('is-hidden');
    lastScrollY = y;
  };

  // At most one update per frame, however many scroll events come in.
  addEventListener(
    'scroll',
    () => {
      if (!updateQueued) {
        updateQueued = true;
        requestAnimationFrame(update);
      }
    },
    { passive: true },
  );
  // Tabbing into the header brings it back.
  document.addEventListener('focusin', (event) => {
    if (findHeader()?.contains(event.target as Node)) findHeader()?.classList.remove('is-hidden');
  });
  document.addEventListener('astro:after-swap', () => {
    lastScrollY = 0;
    findHeader()?.classList.remove('is-hidden');
    update();
  });
  update();
}

// ------------------------------------------------------------ nav underline

/** Which nav link a URL belongs to, from its first path segment. */
function navKeyForPath(path: string): string | null {
  const firstSegment = path.split('/').filter(Boolean)[0] ?? '';
  return ['about', 'projects', 'writing', 'coursework'].includes(firstSegment) ? firstSegment : null;
}

let activeKey: string | null | undefined;

/**
 * Marks a nav link as active. Each label has its own underline, sized and
 * placed by CSS from the text itself, so it lines up at any window size, zoom
 * or font. When the active link changes, the new underline animates in from
 * where the old one was (the FLIP trick), which keeps the sliding look without
 * measuring anything for the resting state.
 */
function setActiveLink(key: string | null, animateChange = true) {
  if (key === activeKey) return;
  const nav = document.querySelector<HTMLElement>('[data-site-nav]');
  if (!nav) return;
  const underlineOf = (linkKey: string | null | undefined) =>
    linkKey ? nav.querySelector<HTMLElement>(`[data-nav-key="${linkKey}"] .site-nav__line`) : null;

  const oldUnderline = underlineOf(activeKey);
  const oldBox = oldUnderline ? oldUnderline.getBoundingClientRect() : null;
  nav.querySelectorAll<HTMLElement>('[data-nav-key]').forEach((link) => link.classList.toggle('is-active', link.dataset.navKey === key));
  activeKey = key;

  const newUnderline = underlineOf(key);
  if (!newUnderline || !animateChange || prefersReducedMotion()) return;
  const newBox = newUnderline.getBoundingClientRect();
  if (!newBox.width) return;

  // Start the new underline exactly on top of the old one, then let it slide
  // home. With no old underline it just grows out from the left.
  const startingPoint =
    oldBox && oldBox.width
      ? `translateX(${oldBox.left - newBox.left}px) scaleX(${oldBox.width / newBox.width})`
      : 'scaleX(0)';
  newUnderline.animate([{ transform: startingPoint }, { transform: 'none' }], { duration: dur(320), easing: EASE.ui });
}

/** Sets aria-current on the link for the page we're on, and returns its key. */
function markCurrentPage() {
  const key = navKeyForPath(location.pathname);
  document.querySelectorAll<HTMLAnchorElement>('[data-nav-key]').forEach((link) => {
    if (link.dataset.navKey === key) link.setAttribute('aria-current', 'page');
    else link.removeAttribute('aria-current');
  });
  return key;
}

let sectionObserver: IntersectionObserver | null = null;

/**
 * On the home page the sections share names with the nav links, so the
 * underline follows whichever section is in the middle of the screen.
 */
function followHomeSections() {
  sectionObserver?.disconnect();
  sectionObserver = null;
  const sections = [...document.querySelectorAll<HTMLElement>('[data-nav-section]')];
  if (!sections.length) return;

  const isVisible = new Map<Element, boolean>();
  sectionObserver = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => isVisible.set(entry.target, entry.isIntersecting));
      const current = sections.find((section) => isVisible.get(section));
      setActiveLink(current?.dataset.navSection ?? null);
    },
    // Only a thin band around the middle of the screen counts as "on" a section.
    { rootMargin: '-45% 0px -50% 0px' },
  );
  sections.forEach((section) => sectionObserver!.observe(section));
}

function initNavUnderline() {
  let firstPage = true;
  document.addEventListener('page:init', () => {
    setActiveLink(markCurrentPage(), !firstPage); // no slide on the very first page
    firstPage = false;
    followHomeSections();
  });
}

// ------------------------------------------------------------ mobile menu

const FOCUSABLE = 'a[href], button:not([disabled]), input, select, textarea, [tabindex]:not([tabindex="-1"])';

function initMobileMenu() {
  const drawer = document.querySelector<HTMLElement>('[data-drawer]');
  const backdrop = document.querySelector<HTMLElement>('[data-drawer-backdrop]');
  if (!drawer || !backdrop) return;
  const findMenuButton = () => document.querySelector<HTMLButtonElement>('[data-menu-toggle]');
  // Everything behind the open menu, which shouldn't be reachable until it closes.
  const pageBehind = () =>
    [...document.querySelectorAll<HTMLElement>('main, .site-footer, .rails, .skip-link, [data-wordmark]')];

  let isOpen = false;

  const setOpen = (open: boolean, { restoreFocus = true } = {}) => {
    if (open === isOpen) return;
    isOpen = open;
    const menuButton = findMenuButton();
    html.classList.toggle('menu-open', isOpen);
    drawer.classList.toggle('is-open', isOpen);
    drawer.inert = !isOpen;
    backdrop.hidden = !isOpen;
    pageBehind().forEach((element) => (element.inert = isOpen));
    menuButton?.setAttribute('aria-expanded', String(isOpen));
    menuButton?.setAttribute('aria-label', isOpen ? 'Close menu' : 'Open menu');
    if (isOpen) drawer.querySelector<HTMLElement>(FOCUSABLE)?.focus({ preventScroll: true });
    else if (restoreFocus) menuButton?.focus({ preventScroll: true });
  };

  drawer.inert = true;

  document.addEventListener('click', (event) => {
    const target = event.target as Element;
    if (target.closest('[data-menu-toggle]')) setOpen(!isOpen);
    else if (target.closest('[data-drawer-backdrop]')) setOpen(false);
    else if (isOpen && target.closest('[data-drawer] a')) setOpen(false, { restoreFocus: false });
  });

  document.addEventListener('keydown', (event) => {
    if (!isOpen) return;
    if (event.key === 'Escape') {
      event.preventDefault();
      setOpen(false);
      return;
    }
    if (event.key !== 'Tab') return;

    // Keep Tab inside the menu: the header's buttons (theme, menu) plus everything in the drawer.
    const focusable = [
      ...document.querySelectorAll<HTMLElement>('[data-header] [data-theme-toggle], [data-menu-toggle]'),
      ...drawer.querySelectorAll<HTMLElement>(FOCUSABLE),
    ].filter((element) => element.offsetParent !== null);
    if (!focusable.length) return;
    // Wrap around at both ends.
    const current = focusable.indexOf(document.activeElement as HTMLElement);
    let next: number;
    if (event.shiftKey) next = current <= 0 ? focusable.length - 1 : current - 1;
    else next = current === focusable.length - 1 ? 0 : current + 1;
    event.preventDefault();
    focusable[next].focus();
  });

  // The menu only exists on narrow screens, so close it if the window gets wide.
  matchMedia('(min-width: 768px)').addEventListener('change', (query) => {
    if (query.matches) setOpen(false, { restoreFocus: false });
  });
  document.addEventListener('astro:before-preparation', () => setOpen(false, { restoreFocus: false }));
}

export function initHeader() {
  initScrollBehaviour();
  initNavUnderline();
  initMobileMenu();
}
