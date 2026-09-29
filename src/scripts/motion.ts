// Shared motion helpers: reduced-motion checks, the ?slow= multiplier, and
// small promise wrappers around timers and the Web Animations API.

export const html = document.documentElement;

const reducedQuery = matchMedia('(prefers-reduced-motion: reduce)');
export const prefersReducedMotion = () => reducedQuery.matches;
export const onReducedMotionChange = (fn: () => void) => reducedQuery.addEventListener('change', fn);

export const isTouchDevice = () => matchMedia('(hover: none), (pointer: coarse)').matches;

/** Global duration multiplier from ?slow=N (persisted per session by the head script). */
export function slow(): number {
  const v = parseFloat(getComputedStyle(html).getPropertyValue('--slow'));
  return Number.isFinite(v) && v > 0 ? v : 1;
}

export const dur = (ms: number) => ms * slow();

export const wait = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

export const nextFrame = () => new Promise<void>((r) => requestAnimationFrame(() => r()));

/** Resolves after the browser has painted at least one frame. */
export const afterPaint = () =>
  new Promise<void>((r) => requestAnimationFrame(() => requestAnimationFrame(() => r())));

export const EASE = {
  ui: 'cubic-bezier(0.645, 0.045, 0.355, 1)',
  shutter: 'cubic-bezier(0.76, 0, 0.24, 1)',
  out: 'cubic-bezier(0.2, 0.7, 0.2, 1)',
} as const;

/** element.animate() that resolves when finished (or cancelled) and cleans up will-change. */
export function animate(
  el: Element,
  keyframes: Keyframe[] | PropertyIndexedKeyframes,
  options: KeyframeAnimationOptions,
): Promise<Animation> {
  const node = el as HTMLElement;
  const props = Array.isArray(keyframes)
    ? Object.keys(keyframes[0] ?? {})
    : Object.keys(keyframes);
  const willChange = props.filter((p) => p === 'transform' || p === 'opacity').join(', ');
  if (willChange) node.style.willChange = willChange;
  const anim = el.animate(keyframes, options);
  return anim.finished
    .catch(() => anim)
    .then(() => {
      if (willChange) node.style.willChange = '';
      return anim;
    });
}

/**
 * An AbortSignal that fires when the current page is swapped out by the
 * client-side router. Use it for listeners registered by per-page code.
 */
let pageController = new AbortController();
document.addEventListener('astro:before-swap', () => {
  pageController.abort();
  pageController = new AbortController();
});
export const pageSignal = () => pageController.signal;

/** Tiny pub/sub on document for cross-module events such as 'intro:done'. */
export const emit = (name: string, detail?: unknown) =>
  document.dispatchEvent(new CustomEvent(name, { detail }));
