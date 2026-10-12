// Shared motion helpers: checking for reduced motion, the ?slow= multiplier,
// and small promise wrappers around timers and the Web Animations API.

export const html = document.documentElement;

const reducedMotionQuery = matchMedia('(prefers-reduced-motion: reduce)');
export const prefersReducedMotion = () => reducedMotionQuery.matches;

export const isTouchDevice = () => matchMedia('(hover: none), (pointer: coarse)').matches;

/**
 * How much to slow every animation down. Adding ?slow=4 to the URL makes
 * everything four times slower, which is handy for checking motion. The head
 * script stores it for the session and sets it as --slow on <html>.
 */
export function slow(): number {
  const multiplier = parseFloat(getComputedStyle(html).getPropertyValue('--slow'));
  return Number.isFinite(multiplier) && multiplier > 0 ? multiplier : 1;
}

/** A duration with the ?slow= multiplier applied. */
export const dur = (ms: number) => ms * slow();

export const wait = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

/** Resolves after the browser has painted at least one frame. */
export const afterPaint = () =>
  new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));

// The same curves as the --ease-* tokens in global.css.
export const EASE = {
  ui: 'cubic-bezier(0.645, 0.045, 0.355, 1)',
  shutter: 'cubic-bezier(0.76, 0, 0.24, 1)',
  out: 'cubic-bezier(0.2, 0.7, 0.2, 1)',
} as const;

/**
 * element.animate() that resolves once the animation finishes (or gets
 * cancelled), and sets will-change only while it runs.
 */
export function animate(
  element: Element,
  keyframes: Keyframe[] | PropertyIndexedKeyframes,
  options: KeyframeAnimationOptions,
): Promise<Animation> {
  const node = element as HTMLElement;
  const animatedProperties = Array.isArray(keyframes) ? Object.keys(keyframes[0] ?? {}) : Object.keys(keyframes);
  const willChange = animatedProperties.filter((property) => property === 'transform' || property === 'opacity').join(', ');
  if (willChange) node.style.willChange = willChange;

  const animation = element.animate(keyframes, options);
  return animation.finished
    .catch(() => animation)
    .then(() => {
      if (willChange) node.style.willChange = '';
      return animation;
    });
}

/**
 * An AbortSignal that fires when the client-side router swaps the current
 * page out. Per-page code passes it to addEventListener so its listeners
 * don't pile up across navigations.
 */
let pageController = new AbortController();
document.addEventListener('astro:before-swap', () => {
  pageController.abort();
  pageController = new AbortController();
});
export const pageSignal = () => pageController.signal;

/** Fires a custom event on document, for things like 'page:init' that several modules listen for. */
export const emit = (name: string) => document.dispatchEvent(new CustomEvent(name));
