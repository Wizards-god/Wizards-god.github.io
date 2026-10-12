// The intro: a "p." types itself out into "parjanya.", and then the page zooms
// straight through the hole in the second "a", with the site waiting on the
// other side.
//
// main.ts only imports this file on the visits where the intro actually plays.
// The overlay (components/Intro.astro) is SVG outlines of the letters made at
// build time, so it's on screen from the very first frame, no web font needed.

import { introGlyphs } from '../data/intro-glyphs';
import { html, wait, dur } from './motion';
import { pageRevealed } from './page';

interface IntroSettings {
  /** Keep the intro up at least this long, even if the page is ready sooner. */
  minMs: number;
  /** Never wait longer than this for the page to finish loading. */
  maxWaitMs: number;
}

const LETTER_DELAY_MS = 60; // time between typed letters...
const LETTER_JITTER_MS = 30; // ...plus up to this much, so it doesn't feel robotic
const PAUSE_BEFORE_ZOOM_MS = 300;
const ZOOM_MS = 1100;
const QUICK_ZOOM_MS = 350; // after a click or key press

/** Cubic ease-in. The zoom starts gently and then speeds up through the letter. */
const easeIn = (t: number) => t * t * t;

/** Goes from 0 to 1 as `value` moves from `start` to `end`, with soft ends. */
function smoothstep(start: number, end: number, value: number) {
  const x = Math.min(1, Math.max(0, (value - start) / (end - start)));
  return x * x * (3 - 2 * x);
}

/** Resolves once the page has loaded and the web fonts are ready. */
function pageReady() {
  const loaded =
    document.readyState === 'complete'
      ? Promise.resolve()
      : new Promise<void>((resolve) => addEventListener('load', () => resolve(), { once: true }));
  const fontsReady = document.fonts?.ready.then(() => undefined) ?? Promise.resolve();
  return Promise.all([loaded, fontsReady]);
}

/**
 * Any click, tap or key press skips ahead to a quicker version of the zoom.
 * Once the zoom has started there's nothing left to skip, so input is ignored.
 */
function listenForSkip() {
  let skipped = false;
  let zooming = false;
  let resolveSkip = () => {};
  const skipRequested = new Promise<void>((resolve) => (resolveSkip = resolve));

  const onInput = (event: Event) => {
    // Let keyboard shortcuts (Ctrl+R and friends) through without skipping.
    if (event instanceof KeyboardEvent && (event.metaKey || event.ctrlKey || event.altKey)) return;
    if (zooming) return;
    skipped = true;
    resolveSkip();
  };
  addEventListener('pointerdown', onInput, true);
  addEventListener('keydown', onInput, true);

  return {
    skipRequested,
    get skipped() {
      return skipped;
    },
    zoomStarted() {
      zooming = true;
    },
    stopListening() {
      removeEventListener('pointerdown', onInput, true);
      removeEventListener('keydown', onInput, true);
    },
  };
}

export async function runIntro(settings: IntroSettings) {
  const overlay = document.getElementById('intro');
  const svg = overlay?.querySelector<SVGSVGElement>('svg');
  if (!overlay || !svg) return finish(null);

  const zoomGroup = svg.querySelector<SVGGElement>('[data-intro-zoom]')!;
  const background = svg.querySelector<SVGPathElement>('[data-intro-bg]')!;
  const ink = svg.querySelector<SVGGElement>('[data-intro-ink]')!;
  const letters = [...svg.querySelectorAll<SVGPathElement>('[data-intro-letter]')];
  const fullStop = svg.querySelector<SVGPathElement>('[data-intro-period]')!;
  const holeCover = svg.querySelector<SVGPathElement>('[data-intro-cover]');
  const counter = svg.querySelector<SVGPathElement>('[data-intro-counter]')!;
  const main = document.getElementById('main');
  const reducedMotion = html.classList.contains('intro-reduced');

  // The point we zoom into: the middle of the hole in the second "a".
  const { cx: centreX, cy: centreY } = introGlyphs.counter;

  const skip = listenForSkip();

  /** Shows the first `count` letters, with the full stop riding along after them like a cursor. */
  function showLetters(count: number) {
    letters.forEach((letter, index) => letter.classList.toggle('is-on', index < count));
    fullStop.setAttribute('transform', `translate(${introGlyphs.period.x[count - 1]} 0)`);
  }

  async function typeName() {
    fullStop.classList.add('is-typing');
    for (let count = 2; count <= letters.length; count++) {
      if (skip.skipped) break;
      await Promise.race([wait(dur(LETTER_DELAY_MS + Math.random() * LETTER_JITTER_MS)), skip.skipRequested]);
      if (skip.skipped) break;
      showLetters(count);
    }
  }

  let holeCut = false;

  /**
   * Cuts the counter out of the background, so the page shows through the "a".
   * The background is one huge rectangle; adding the counter's outline to the
   * same path (fill-rule="evenodd") turns it into a hole.
   */
  function cutHole() {
    if (holeCut) return;
    holeCut = true;
    background.setAttribute('d', `${background.getAttribute('d')} ${introGlyphs.counter.d}`);
    overlay!.classList.add('has-hole');
  }

  /**
   * How far to zoom: just past the point where all four corners of the screen
   * fit inside the counter, i.e. the hole covers everything. Screens are all
   * different sizes, so this is found with a binary search, using
   * isPointInFill to ask whether a corner lands inside the hole at a given scale.
   */
  function findZoomScale() {
    const width = innerWidth;
    const height = innerHeight;
    const toScreen = zoomGroup.getScreenCTM();
    const counterBox = counter.getBBox();

    // Rough answer for browsers that can't do the exact one: scale until the
    // counter's box is bigger than the screen's diagonal, with some margin.
    const roughScale = () => {
      const unitsToPixels = toScreen ? toScreen.a : 1;
      return (
        Math.sqrt((width / (counterBox.width * unitsToPixels)) ** 2 + (height / (counterBox.height * unitsToPixels)) ** 2) *
        1.35
      );
    };
    if (!toScreen || typeof counter.isPointInFill !== 'function') return roughScale();

    try {
      const toSvg = toScreen.inverse();
      const corners = [
        [0, 0],
        [width, 0],
        [0, height],
        [width, height],
      ].map(([x, y]) => new DOMPoint(x, y).matrixTransform(toSvg));

      // At scale s a screen corner lines up with this point of the unzoomed word.
      const coversScreen = (scale: number) =>
        corners.every((corner) =>
          counter.isPointInFill(new DOMPoint(centreX + (corner.x - centreX) / scale, centreY + (corner.y - centreY) / scale)),
        );

      // Double until we overshoot, then halve the gap 32 times.
      let tooSmall = 1;
      let bigEnough = 2;
      while (!coversScreen(bigEnough)) {
        tooSmall = bigEnough;
        bigEnough *= 2;
        if (bigEnough > 1e5) return roughScale();
      }
      for (let step = 0; step < 32; step++) {
        const middle = (tooSmall + bigEnough) / 2;
        if (coversScreen(middle)) bigEnough = middle;
        else tooSmall = middle;
      }
      return bigEnough * 1.1; // a little past "only just covered"
    } catch {
      return roughScale();
    }
  }

  function zoomThroughLetter(durationMs: number) {
    return new Promise<void>((resolve) => {
      skip.zoomStarted();
      cutHole();
      const maxScale = findZoomScale();
      const logMaxScale = Math.log(maxScale);
      const duration = dur(durationMs);

      // A bit of depth: the page behind the letter settles from 104% to 100%
      // while we fly in, scaling from the point under the counter.
      if (main) {
        const toScreen = zoomGroup.getScreenCTM();
        if (toScreen) {
          const origin = new DOMPoint(centreX, centreY).matrixTransform(toScreen);
          main.style.transformOrigin = `${origin.x}px ${origin.y + scrollY}px`;
        }
        main
          .animate([{ transform: 'scale(1.04)' }, { transform: 'none' }], {
            duration,
            easing: 'cubic-bezier(0.4, 0, 0.2, 1)',
          })
          .finished.finally(() => (main.style.transformOrigin = ''));
      }

      const startTime = performance.now();
      const drawFrame = (now: number) => {
        const progress = Math.min(1, (now - startTime) / duration);

        // Scaling straight from 1 to maxScale looks wrong: nearly all the motion
        // happens in the first few frames and then it crawls. What your eye
        // follows is the relative change in size, so the ease runs on the
        // exponent instead: scale = maxScale ^ easeIn(progress).
        const scale = Math.exp(logMaxScale * easeIn(progress));

        // Writing the transform attribute (not CSS) makes the browser redraw
        // crisp vector edges at every scale instead of stretching a bitmap.
        zoomGroup.setAttribute(
          'transform',
          `translate(${centreX} ${centreY}) scale(${scale}) translate(${-centreX} ${-centreY})`,
        );
        // The hole starts out covered and turns see-through over the first 40% of the zoom...
        if (holeCover) holeCover.style.opacity = String(1 - smoothstep(0, 0.4, progress));
        // ...and the letters fade into the background, gone by about 70%.
        ink.style.opacity = String(1 - smoothstep(0.12, 0.7, progress));

        if (progress < 1) requestAnimationFrame(drawFrame);
        else resolve();
      };
      requestAnimationFrame(drawFrame);
    });
  }

  // With reduced motion there's no typing and no zoom: just the word, then a short fade.
  if (reducedMotion) {
    showLetters(letters.length);
    fullStop.classList.add('is-solid');
  }

  try {
    // Hold on the "p." until the page is ready (but not forever), or until a skip.
    await Promise.race([
      Promise.all([wait(dur(settings.minMs)), pageReady()]),
      wait(dur(settings.maxWaitMs)),
      skip.skipRequested,
    ]);

    if (reducedMotion) {
      await Promise.race([wait(400), skip.skipRequested]);
      await overlay.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 250, fill: 'forwards' }).finished;
      return;
    }

    await typeName();
    showLetters(letters.length);
    fullStop.classList.remove('is-typing');
    fullStop.classList.add('is-solid');
    if (!skip.skipped) await Promise.race([wait(dur(PAUSE_BEFORE_ZOOM_MS)), skip.skipRequested]);
    await zoomThroughLetter(skip.skipped ? QUICK_ZOOM_MS : ZOOM_MS);
  } finally {
    skip.stopListening();
    finish(overlay);
  }
}

/** Takes the overlay away and hands control back to the page. */
function finish(overlay: HTMLElement | null) {
  overlay?.remove();
  // BaseLayout made the page inert while the intro covered it.
  document.querySelectorAll<HTMLElement>('[data-intro-inert]').forEach((element) => {
    element.inert = false;
    element.removeAttribute('data-intro-inert');
  });
  pageRevealed({ animateContent: false });
}
