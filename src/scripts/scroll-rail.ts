// The scroll rail down the right-hand side of the home page (the markup is in
// components/ScrollRail.astro). Two things move:
//
//   The ruler's needle, which marks how far down the page you are, with a
//   percentage beside it whose digits roll like a counter. The ruler is also
//   the page's scrollbar: drag the needle, or click anywhere on the ruler to
//   glide there.
//
//   A word for each section marked [data-rail-label]. Each word has three
//   places to be, and its letters fly from one to the next on curved paths,
//   each letter setting off a little after the one before it:
//
//     queued   lying flat in a stack in the bottom corner, like a contents list
//     riding   standing upright on the rail, level with its section's heading,
//              and scrolling up the page with it
//     pinned   lying flat again in a stack in the top corner, once the heading
//              has nearly gone off the top. The newest one there is the
//              section you're reading, so it's drawn brighter.
//
// Nothing here runs on a timer. Every letter's position comes straight from
// how far the page is scrolled, so scrolling back up plays it all in reverse.

import { html, pageSignal, prefersReducedMotion } from './motion';

// ------------------------------------------------------------ settings

/** Sizes, all in px unless they say otherwise. */
const LAYOUT = {
  /** Space between the flat words and the ruler. */
  gapToRuler: 10,
  /** How far apart the stacked words sit, at the top and at the bottom. */
  rowHeight: 20,
  /** From the bottom of the window up to the lowest queued word. */
  queueBottom: 34,
  /** From the top of the ask button up to the lowest queued word, since they share the corner. */
  aboveAskButton: 20,
  /** From the bottom of the (shrunk) header down to the first pinned word. */
  belowHeader: 24,
  /** Where the upright letters stand, measured in from the ruler's left edge. Ticks fill its right side. */
  rulerInset: 12,
  /** How far down the window a heading is, as a fraction of the window's height, when its word lands at the top. */
  landingLine: 0.14,
  /** The smallest gap allowed between the page's content and the flat words. Any less and the words are hidden. */
  minClearance: 16,
};

const MOTION = {
  /** How much scrolling it takes a word to rise out of the queue onto the rail. */
  liftDistance: 160,
  /** How much scrolling it takes a word to fly from the rail to the top. */
  flipDistance: 200,
  /** How far behind the letter before it each letter sets off, as a share of the whole trip. */
  stagger: 0.12,
  /** How far each letter's path bows out towards the page, in px, halfway through its flight. */
  arc: 28,
  /** The needle hides until this much of the page (as a fraction) has been scrolled. */
  quietUntil: 0.03,
  /** How far the pointer has to move, in px, before a press on the ruler counts as a drag instead of a click. */
  dragThreshold: 3,
};

// ------------------------------------------------------------ types

/** Where a letter's centre is in the window, and how far it's turned. */
interface Spot {
  x: number;
  y: number;
  angle: number;
}

interface RailWord {
  link: HTMLAnchorElement;
  letters: HTMLSpanElement[];
  /** The section's heading, which the word rides beside. */
  heading: HTMLElement;
  /** The heading's top, measured from the top of the page (not the window). */
  headingTop: number;
}

/** Sizes that only change when the window or the page does. See measure(). */
interface Measurements {
  /** The furthest the page can scroll. */
  maxScroll: number;
  /** The words use a monospace font, so every letter is the same width. */
  letterWidth: number;
  /** Where the upright letters stand on the rail. */
  railX: number;
  /** Where the flat words end: they're lined up on the right, against the ruler. */
  flatRight: number;
  rulerTop: number;
  rulerHeight: number;
  /** The middle of the first row in the top stack. */
  pileTop: number;
  /** The middle of the lowest row in the bottom stack. */
  queueBottom: number;
  /** A heading this far down the window has finished sending its word to the top. */
  landingY: number;
  /** Whether the flat words fit between the page's content and the ruler. */
  wordsFit: boolean;
}

// ------------------------------------------------------------ small helpers

const clamp01 = (value: number) => Math.min(1, Math.max(0, value));

/** Starts slowly, speeds up, then slows down again to land. */
const easeInOut = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2);

/** A point on a curve from `start` to `end` that bends towards `bend` (a quadratic Bézier curve). */
const bezier = (start: number, bend: number, end: number, t: number) =>
  (1 - t) ** 2 * start + 2 * (1 - t) * t * bend + t ** 2 * end;

/** An element's top, from the top of the page. It ignores transforms, which the scroll reveals use to slide headings in. */
function pageTop(element: HTMLElement) {
  let top = 0;
  for (let node: HTMLElement | null = element; node; node = node.offsetParent as HTMLElement | null) {
    top += node.offsetTop;
  }
  return top;
}

// ------------------------------------------------------------ setting up

/** Makes a link for each labelled section, with every letter in a span of its own so it can fly on its own. */
function buildWords(layer: HTMLElement): RailWord[] {
  layer.replaceChildren();
  const words: RailWord[] = [];

  for (const section of document.querySelectorAll<HTMLElement>('[data-rail-label]')) {
    const label = section.dataset.railLabel ?? '';
    const link = document.createElement('a');
    link.className = 'rail-word';
    link.href = `#${section.id}`;
    link.setAttribute('aria-label', label);

    const letters = [...label].map((character) => {
      const letter = document.createElement('span');
      letter.className = 'rail-letter';
      letter.setAttribute('aria-hidden', 'true');
      letter.textContent = character;
      return letter;
    });
    link.append(...letters);
    layer.append(link);

    const heading = section.querySelector<HTMLElement>('h2') ?? section;
    words.push({ link, letters, heading, headingTop: 0 });
  }
  return words;
}

/** The width of one letter, from a row of ten with the same style. */
function measureLetterWidth(layer: HTMLElement) {
  const probe = document.createElement('span');
  probe.className = 'rail-letter';
  probe.textContent = '0000000000';
  layer.append(probe);
  const width = probe.getBoundingClientRect().width / 10;
  probe.remove();
  return width;
}

/** Where the page's content stops on the right: the edge of a section, less its padding. */
function contentRightEdge() {
  const section = document.querySelector<HTMLElement>('[data-rail-label]');
  if (!section) return 0;
  return section.getBoundingClientRect().right - parseFloat(getComputedStyle(section).paddingRight);
}

function measure(ruler: HTMLElement, layer: HTMLElement, words: RailWord[]): Measurements {
  const windowHeight = html.clientHeight;
  const rulerBox = ruler.getBoundingClientRect();
  const letterWidth = measureLetterWidth(layer);
  const headerHeight = parseFloat(getComputedStyle(html).getPropertyValue('--header-h-small')) || 64;

  for (const word of words) word.headingTop = pageTop(word.heading);

  const flatRight = rulerBox.left - LAYOUT.gapToRuler;
  const longestWord = Math.max(0, ...words.map((word) => word.letters.length)) * letterWidth;

  // The bottom stack has to clear the ask button in the same corner, if it's there.
  const askButton = document.querySelector<HTMLElement>('[data-ask-open]');
  const askButtonTop = askButton ? askButton.getBoundingClientRect().top : windowHeight;
  const queueBottom = Math.min(windowHeight - LAYOUT.queueBottom, askButtonTop - LAYOUT.aboveAskButton);

  return {
    maxScroll: Math.max(0, html.scrollHeight - windowHeight),
    letterWidth,
    railX: rulerBox.left + LAYOUT.rulerInset,
    flatRight,
    rulerTop: rulerBox.top,
    rulerHeight: rulerBox.height,
    pileTop: headerHeight + LAYOUT.belowHeader,
    queueBottom,
    landingY: windowHeight * LAYOUT.landingLine,
    wordsFit: flatRight - longestWord >= contentRightEdge() + LAYOUT.minClearance,
  };
}

// ------------------------------------------------------------ where letters go

/** Letter `index` of a flat word whose middle is at height `y`. The word is lined up on the right, against the ruler. */
function flatSpot(sizes: Measurements, word: RailWord, index: number, y: number): Spot {
  const lettersAfter = word.letters.length - 1 - index;
  return { x: sizes.flatRight - (lettersAfter + 0.5) * sizes.letterWidth, y, angle: 0 };
}

/** Letter `index` of an upright word whose top is at `top`. It reads downwards, like the email on the other pages did. */
function uprightSpot(sizes: Measurements, index: number, top: number): Spot {
  return { x: sizes.railX, y: top + (index + 0.5) * sizes.letterWidth, angle: 90 };
}

/**
 * Puts each letter of a word somewhere between `from` and `to`, given how far
 * through the trip the word is (0 is still at `from`, 1 has arrived at `to`).
 * The first letter leaves first, and each one follows a curve that bows out
 * towards the page.
 */
function flyLetters(word: RailWord, from: (index: number) => Spot, to: (index: number) => Spot, progress: number) {
  // With reduced motion the letters don't fly: the whole word jumps across halfway through.
  const reduced = prefersReducedMotion();
  const stagger = reduced ? 0 : MOTION.stagger;
  const arc = reduced ? 0 : MOTION.arc;
  const tripDone = reduced ? Math.round(progress) : progress;

  // The last letter leaves latest, so stretch the trip to make sure it still lands when the word is done.
  const stretch = 1 + (word.letters.length - 1) * stagger;

  word.letters.forEach((letter, index) => {
    const t = easeInOut(clamp01(tripDone * stretch - index * stagger));
    const start = from(index);
    const end = to(index);

    // The curve bends towards a point halfway between the two ends, pushed left (towards the page) by `arc`.
    const bendX = (start.x + end.x) / 2 - arc;
    const bendY = (start.y + end.y) / 2;

    const x = bezier(start.x, bendX, end.x, t);
    const y = bezier(start.y, bendY, end.y, t);
    const angle = start.angle + (end.angle - start.angle) * t;
    letter.style.transform = `translate(${x}px, ${y}px) translate(-50%, -50%) rotate(${angle}deg)`;
  });
}

/** Works out where every word is for the current scroll position, and moves its letters there. */
function placeWords(sizes: Measurements, words: RailWord[], scrollTop: number) {
  let newestPinned = -1;

  words.forEach((word, index) => {
    const headingY = word.headingTop - scrollTop; // the heading's top, in the window
    const uprightLength = word.letters.length * sizes.letterWidth;

    // Each word has its own row in both stacks, in page order: the bottom
    // stack ends with the last section, the top one starts with the first.
    const queueY = sizes.queueBottom - (words.length - 1 - index) * LAYOUT.rowHeight;
    const pileY = sizes.pileTop + index * LAYOUT.rowHeight;

    // Rising onto the rail: starts as the heading comes up from below, and
    // finishes when the upright word would reach the word's own row.
    const lift = clamp01((queueY + MOTION.liftDistance - (headingY + uprightLength)) / MOTION.liftDistance);

    // Flying to the top: starts a little before the heading reaches the
    // landing line, and finishes as it gets there.
    let flip = clamp01((sizes.landingY + MOTION.flipDistance - headingY) / MOTION.flipDistance);

    // A heading near the end of the page may never get up to the landing line,
    // because the page runs out first. Its word makes the trip over the last
    // stretch of scrolling instead.
    const highestItGets = word.headingTop - sizes.maxScroll;
    if (highestItGets > sizes.landingY) {
      const tripStart = sizes.maxScroll - MOTION.flipDistance;
      flip = Math.max(flip, clamp01((scrollTop - tripStart) / MOTION.flipDistance));
    }

    const flat = (y: number) => (letter: number) => flatSpot(sizes, word, letter, y);
    const upright = (top: number) => (letter: number) => uprightSpot(sizes, letter, top);

    if (flip > 0) {
      // From the rail up to the top stack.
      flyLetters(word, upright(headingY), flat(pileY), flip);
      word.link.dataset.state = flip >= 1 ? 'pinned' : 'riding';
      if (flip >= 1) newestPinned = index;
    } else if (lift < 1) {
      // Out of the bottom stack, to stand on the rail just above the word's row.
      flyLetters(word, flat(queueY), upright(queueY - uprightLength), lift);
      word.link.dataset.state = 'queued';
    } else {
      // On the rail, keeping level with the heading.
      flyLetters(word, upright(headingY), upright(headingY), 1);
      word.link.dataset.state = 'riding';
    }
  });

  // The newest word in the top stack is the section you're reading.
  if (newestPinned >= 0) words[newestPinned].link.dataset.state = 'current';
}

// ------------------------------------------------------------ the needle

/** Rolls each digit column of the readout to show `percent`, leaving out leading zeros. */
function showPercent(digitColumns: HTMLElement[], percent: number) {
  const text = String(percent).padStart(digitColumns.length, ' ');
  digitColumns.forEach((column, index) => {
    const character = text[index];
    column.classList.toggle('is-blank', character === ' ');
    column.style.setProperty('--digit', character === ' ' ? '0' : character);
  });
}

// ------------------------------------------------------------ dragging

/**
 * Lets the ruler work as the page's scrollbar. Press anywhere on it and hold
 * to drag the needle up and down; a quick click glides to that spot instead.
 * `getSizes` hands over the latest measurements, since they change on resize.
 */
function makeDraggable(ruler: HTMLElement, getSizes: () => Measurements | null, signal: AbortSignal) {
  let pressed = false;
  let dragging = false;
  let pressY = 0;

  /** The scroll position that puts the needle level with the pointer. */
  const scrollTopAt = (pointerY: number) => {
    const sizes = getSizes();
    if (!sizes) return scrollY;
    return clamp01((pointerY - sizes.rulerTop) / sizes.rulerHeight) * sizes.maxScroll;
  };

  const stop = () => {
    pressed = false;
    dragging = false;
    ruler.classList.remove('is-dragging');
  };

  ruler.addEventListener(
    'pointerdown',
    (event) => {
      if (event.button !== 0) return; // only the main button (or a touch, or a pen)
      pressed = true;
      pressY = event.clientY;
      // Keep getting pointer moves even if the pointer wanders off the ruler mid-drag.
      ruler.setPointerCapture(event.pointerId);
      event.preventDefault(); // stops the drag selecting text on the page
    },
    { signal },
  );

  ruler.addEventListener(
    'pointermove',
    (event) => {
      if (!pressed) return;
      if (!dragging && Math.abs(event.clientY - pressY) < MOTION.dragThreshold) return;
      dragging = true;
      ruler.classList.add('is-dragging');
      // While dragging, the page follows the pointer exactly, with no smoothing.
      scrollTo({ top: scrollTopAt(event.clientY), behavior: 'instant' });
    },
    { signal },
  );

  ruler.addEventListener(
    'pointerup',
    (event) => {
      // A click without a drag glides to the spot (or jumps, with reduced motion).
      if (pressed && !dragging) {
        scrollTo({ top: scrollTopAt(event.clientY), behavior: prefersReducedMotion() ? 'instant' : 'smooth' });
      }
      stop();
    },
    { signal },
  );
  ruler.addEventListener('pointercancel', stop, { signal });
}

// ------------------------------------------------------------ start

export function initScrollRail() {
  const rail = document.querySelector<HTMLElement>('[data-scroll-rail]');
  const ruler = rail?.querySelector<HTMLElement>('[data-rail-ruler]');
  const needle = rail?.querySelector<HTMLElement>('[data-rail-needle]');
  const layer = rail?.querySelector<HTMLElement>('[data-rail-words]');
  if (!rail || !ruler || !needle || !layer) return; // not the home page

  const digitColumns = [...rail.querySelectorAll<HTMLElement>('[data-rail-digit]')];
  const words = buildWords(layer);
  // The side rails are hidden on narrower screens (see SideRails.astro).
  const wideScreen = matchMedia('(min-width: 1024px)');

  let sizes: Measurements | null = null;
  let shownPercent = -1;
  let frameQueued = false;

  const draw = () => {
    frameQueued = false;
    if (!sizes) return;
    const scrollTop = Math.max(0, scrollY); // Safari reports negative values while bouncing at the top

    const progress = sizes.maxScroll > 0 ? clamp01(scrollTop / sizes.maxScroll) : 0;
    needle.style.transform = `translateY(${progress * sizes.rulerHeight}px)`;
    needle.classList.toggle('is-quiet', progress < MOTION.quietUntil);
    const percent = Math.round(progress * 100);
    if (percent !== shownPercent) {
      showPercent(digitColumns, percent);
      shownPercent = percent;
    }

    if (sizes.wordsFit) placeWords(sizes, words, scrollTop);
  };

  // At most one draw per frame, however many scroll events come in.
  const queueDraw = () => {
    if (frameQueued) return;
    frameQueued = true;
    requestAnimationFrame(draw);
  };

  const remeasure = () => {
    sizes = wideScreen.matches ? measure(ruler, layer, words) : null;
    rail.dataset.words = sizes?.wordsFit ? 'on' : 'off';
    queueDraw();
  };

  // Everything here is removed when the router swaps the home page out.
  const signal = pageSignal();
  addEventListener('scroll', queueDraw, { passive: true, signal });
  addEventListener('resize', remeasure, { signal });
  wideScreen.addEventListener('change', remeasure, { signal });
  makeDraggable(ruler, () => sizes, signal);

  // The page gets taller as images and fonts load, which moves the headings down.
  const pageSizeWatcher = new ResizeObserver(remeasure);
  pageSizeWatcher.observe(document.body);
  signal.addEventListener('abort', () => pageSizeWatcher.disconnect());
  document.fonts?.ready.then(remeasure);
  // Sizes taken while the intro or the page shutter is playing can be wrong
  // (the ruler can measure as 0px tall), so measure again once the page is in view.
  document.addEventListener('page:revealed', remeasure, { signal });

  remeasure();
}
