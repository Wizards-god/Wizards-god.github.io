// Intro: "p." → types "parjanya." → zooms through the counter of the second "a".
// Loaded with a dynamic import, only on the visits where it plays.
//
// The overlay markup (components/Intro.astro) is pre-rendered SVG outlines,
// so it paints on the first frame with no web font.

import { introGlyphs as G } from '../data/intro-glyphs';
import { html, wait, dur, emit } from './motion';
import { pageRevealed } from './page';

interface IntroConfig {
  minMs: number;
  maxWaitMs: number;
}

const HOLE_R = 100000;
const RECT = `M${-HOLE_R} ${-HOLE_R}H${HOLE_R}V${HOLE_R}H${-HOLE_R}Z`;

/** Ease-in on the exponent: starts gently, then accelerates through the letter. */
const easeIn = (t: number) => t * t * t;

/** 0 → 1 between a and b, with eased ends (smoothstep). */
const smooth = (a: number, b: number, t: number) => {
  const x = Math.min(1, Math.max(0, (t - a) / (b - a)));
  return x * x * (3 - 2 * x);
};

function pageLoaded() {
  const load =
    document.readyState === 'complete'
      ? Promise.resolve()
      : new Promise<void>((r) => addEventListener('load', () => r(), { once: true }));
  const fonts = document.fonts?.ready.then(() => undefined) ?? Promise.resolve();
  const hero = document.querySelector<HTMLImageElement>('[data-hero-image]');
  const img = hero?.decode ? hero.decode().catch(() => undefined) : Promise.resolve();
  return Promise.all([load, fonts, img]);
}

function makePoint(svg: SVGSVGElement, x: number, y: number): DOMPointInit {
  if (typeof DOMPoint === 'function') return new DOMPoint(x, y);
  const p = svg.createSVGPoint();
  p.x = x;
  p.y = y;
  return p;
}

export async function runIntro(cfg: IntroConfig) {
  (window as unknown as { __introStarted?: boolean }).__introStarted = true;
  const overlay = document.getElementById('intro');
  const svg = overlay?.querySelector<SVGSVGElement>('svg');
  if (!overlay || !svg) return finish(null);

  const zoomGroup = svg.querySelector<SVGGElement>('[data-intro-zoom]')!;
  const bg = svg.querySelector<SVGPathElement>('[data-intro-bg]')!;
  const ink = svg.querySelector<SVGGElement>('[data-intro-ink]')!;
  const letters = [...svg.querySelectorAll<SVGPathElement>('[data-intro-letter]')];
  const period = svg.querySelector<SVGPathElement>('[data-intro-period]')!;
  const cover = svg.querySelector<SVGPathElement>('[data-intro-cover]');
  const counter = svg.querySelector<SVGPathElement>('[data-intro-counter]')!;
  const main = document.getElementById('main');
  const reduced = html.classList.contains('intro-reduced');
  const { cx, cy } = G.counter;

  let skipped = false;
  let zooming = false;
  let onSkipResolve: () => void = () => {};
  const skipSignal = new Promise<void>((r) => (onSkipResolve = r));
  const onSkip = (e: Event) => {
    if (e instanceof KeyboardEvent && (e.metaKey || e.ctrlKey || e.altKey)) return;
    if (zooming) return;
    skipped = true;
    onSkipResolve();
  };
  addEventListener('pointerdown', onSkip, true);
  addEventListener('keydown', onSkip, true);

  let holeAdded = false;
  const addHole = () => {
    if (holeAdded) return;
    holeAdded = true;
    bg.setAttribute('d', `${RECT} ${G.counter.d}`);
    overlay.classList.add('has-hole');
  };

  const setTyped = (n: number) => {
    letters.forEach((l, i) => l.classList.toggle('is-on', i < n));
    period.setAttribute('transform', `translate(${G.period.x[n - 1]} 0)`);
  };

  const typeIn = async () => {
    period.classList.add('is-typing');
    for (let n = 2; n <= letters.length; n++) {
      if (skipped) break;
      await Promise.race([wait(dur(60 + Math.random() * 30)), skipSignal]);
      if (skipped) break;
      setTyped(n);
    }
  };

  /** Smallest scale at which all four viewport corners sit inside the counter, ×1.1. */
  const targetScale = () => {
    const w = innerWidth;
    const h = innerHeight;
    const ctm = zoomGroup.getScreenCTM();
    const bb = counter.getBBox();
    const fallback = () => {
      const k = ctm ? ctm.a : 1;
      return Math.sqrt((w / (bb.width * k)) ** 2 + (h / (bb.height * k)) ** 2) * 1.35;
    };
    if (!ctm || typeof counter.isPointInFill !== 'function') return fallback();
    try {
      const inv = ctm.inverse();
      const corners = [
        [0, 0],
        [w, 0],
        [0, h],
        [w, h],
      ].map(([x, y]) => new DOMPoint(x, y).matrixTransform(inv));
      const inside = (s: number) =>
        corners.every((p) => counter.isPointInFill(makePoint(svg, cx + (p.x - cx) / s, cy + (p.y - cy) / s)));
      let lo = 1;
      let hi = 2;
      while (!inside(hi)) {
        lo = hi;
        hi *= 2;
        if (hi > 1e5) return fallback();
      }
      for (let i = 0; i < 32; i++) {
        const mid = (lo + hi) / 2;
        if (inside(mid)) hi = mid;
        else lo = mid;
      }
      return hi * 1.1;
    } catch {
      return fallback();
    }
  };

  const zoom = (ms: number) =>
    new Promise<void>((resolve) => {
      zooming = true;
      addHole();
      const sMax = targetScale();
      const logMax = Math.log(sMax);
      const D = dur(ms);

      // Depth cue: the page eases from 1.04 to 1 behind the counter.
      if (main) {
        const ctm = zoomGroup.getScreenCTM();
        if (ctm) {
          const o = new DOMPoint(cx, cy).matrixTransform(ctm);
          main.style.transformOrigin = `${o.x}px ${o.y + scrollY}px`;
        }
        main.animate([{ transform: 'scale(1.04)' }, { transform: 'none' }], {
          duration: D,
          easing: 'cubic-bezier(0.4, 0, 0.2, 1)',
        }).finished.finally(() => (main.style.transformOrigin = ''));
      }

      const start = performance.now();
      const frame = (now: number) => {
        const t = Math.min(1, (now - start) / D);
        const s = Math.exp(logMax * easeIn(t)); // log-space: s = sMax ** e(t)
        zoomGroup.setAttribute('transform', `translate(${cx} ${cy}) scale(${s}) translate(${-cx} ${-cy})`);
        // The hole starts opaque and turns see-through over the first ~40% of the zoom.
        if (cover) cover.style.opacity = String(1 - smooth(0, 0.4, t));
        // The letters fade to the background slowly, gone by ~70% of the zoom.
        ink.style.opacity = String(1 - smooth(0.12, 0.7, t));
        if (t < 1) requestAnimationFrame(frame);
        else resolve();
      };
      requestAnimationFrame(frame);
    });

  // Reduced motion: no typing, just the word, then a short fade.
  if (reduced) {
    setTyped(letters.length);
    period.classList.add('is-solid');
  }

  try {
    await Promise.race([
      Promise.all([wait(dur(cfg.minMs)), pageLoaded()]),
      wait(dur(cfg.maxWaitMs)),
      skipSignal,
    ]);

    if (reduced) {
      await Promise.race([wait(400), skipSignal]);
      await overlay.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 250, fill: 'forwards' }).finished;
      return;
    }

    await typeIn();
    setTyped(letters.length);
    period.classList.remove('is-typing');
    period.classList.add('is-solid');
    if (!skipped) await Promise.race([wait(dur(300)), skipSignal]);
    await zoom(skipped ? 350 : 1100);
  } finally {
    removeEventListener('pointerdown', onSkip, true);
    removeEventListener('keydown', onSkip, true);
    finish(overlay);
  }
}

function finish(overlay: HTMLElement | null) {
  overlay?.remove();
  document.querySelectorAll<HTMLElement>('[data-intro-inert]').forEach((n) => {
    n.inert = false;
    n.removeAttribute('data-intro-inert');
  });
  emit('intro:done');
  pageRevealed({ animateContent: false });
}
