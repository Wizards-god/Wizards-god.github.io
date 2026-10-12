// The cursor glow: a soft light that trails the pointer around the page.
//
// It follows the pointer with a critically damped spring (the "SmoothDamp"
// formula from game development), so it glides after the cursor and settles
// without overshooting. The spring runs on real seconds rather than frames,
// so it feels the same on a 60 Hz and a 144 Hz screen. Each frame only moves
// the glow with translate3d, and the loop stops once it has caught up.

import { prefersReducedMotion, slow, dur } from './motion';

const SIZE = 450; // px; keep in step with .glow in components/Overlays.astro
const SMOOTH_TIME = 0.24; // seconds, roughly how long it takes to catch up (bigger = lazier)
const FADE_RADIUS = 190; // px from the centre to where the glow is completely gone

type Rgba = [red: number, green: number, blue: number, alpha: number];

/**
 * Reads the --glow colour token. It's written as "rgb(255 255 255 / 0.05)" in
 * the stylesheet, but the CSS minifier may hand it back as hex ("#ffffff0d").
 */
function parseColour(token: string): Rgba | null {
  const value = token.trim();

  const hex = value.match(/^#([\da-f]{3,4}|[\da-f]{6}|[\da-f]{8})$/i)?.[1];
  if (hex) {
    // Expand the short forms (#fff, #fff8) to two digits per channel.
    const digits = hex.length <= 4 ? [...hex].map((digit) => digit + digit).join('') : hex;
    const [red, green, blue, alpha = 255] = digits.match(/../g)!.map((pair) => parseInt(pair, 16));
    return [red, green, blue, alpha / 255];
  }

  const numbers = value.match(/[\d.]+%?/g);
  if (!value.startsWith('rgb') || !numbers || numbers.length < 3) return null;
  const [red, green, blue] = numbers.slice(0, 3).map(Number);
  const alphaText = numbers[3] ?? '1';
  const alpha = alphaText.endsWith('%') ? parseFloat(alphaText) / 100 : Number(alphaText);
  return [red, green, blue, alpha];
}

/** Interleaved gradient noise: a cheap, even-looking pattern in [0, 1). */
const gradientNoise = (x: number, y: number) => (52.9829189 * ((0.06711056 * x + 0.00583715 * y) % 1)) % 1;

/**
 * Paints the glow into a canvas. The glow is so faint that a CSS gradient
 * only gets about a dozen brightness levels to work with, and on a lot of
 * screens you can see each one as a ring. Here every pixel's alpha is nudged
 * up or down by up to a level with a fixed noise pattern (dithering), so the
 * steps blend into one smooth falloff.
 */
function paintGlow(canvas: HTMLCanvasElement, [red, green, blue, alpha]: Rgba) {
  const pixelRatio = Math.min(2, window.devicePixelRatio || 1);
  const size = Math.round(SIZE * pixelRatio);
  const radius = FADE_RADIUS * pixelRatio;
  const centre = size / 2;
  canvas.width = size;
  canvas.height = size;
  const context = canvas.getContext('2d');
  if (!context) return false;

  const image = context.createImageData(size, size);
  for (let row = 0; row < size; row++) {
    for (let column = 0; column < size; column++) {
      const dx = column + 0.5 - centre;
      const dy = row + 0.5 - centre;
      const distance = Math.sqrt(dx * dx + dy * dy) / radius; // 0 at the centre, 1 at the edge
      if (distance >= 1) continue;

      // Smoothstep from the edge in: about as bright and as wide as a plain
      // linear gradient, but flat at both ends, so there's no point in the
      // middle and no hard rim.
      const fromEdge = 1 - distance;
      const strength = fromEdge * fromEdge * (3 - 2 * fromEdge);
      // Two noise samples added together give a triangle-shaped spread from
      // -1 to 1, which hides the steps without adding visible grain.
      const noise = gradientNoise(column, row) + gradientNoise(column + 5.588, row + 5.588) - 1;

      const index = (row * size + column) * 4;
      image.data[index] = red;
      image.data[index + 1] = green;
      image.data[index + 2] = blue;
      image.data[index + 3] = Math.max(0, Math.round(strength * alpha * 255 + noise));
    }
  }
  context.putImageData(image, 0, 0);
  return true;
}

/**
 * Moves one axis of the spring forward by `dt` seconds. Returns the new
 * [position, velocity]. The decay factor is a cheap, accurate approximation
 * of exp(-ω·dt).
 */
function smoothDamp(position: number, target: number, velocity: number, dt: number): [number, number] {
  const omega = 2 / SMOOTH_TIME;
  const omegaDt = omega * dt;
  const decay = 1 / (1 + omegaDt + 0.48 * omegaDt * omegaDt + 0.235 * omegaDt * omegaDt * omegaDt);
  const offset = position - target;
  const pull = (velocity + omega * offset) * dt;
  return [target + (offset + pull) * decay, (velocity - omega * pull) * decay];
}

export function initGlow() {
  const glow = document.querySelector<HTMLElement>('[data-glow]');
  if (!glow) return;

  const halfSize = SIZE / 2;
  let glowX = innerWidth / 2;
  let glowY = innerHeight / 2;
  let velocityX = 0;
  let velocityY = 0;
  let targetX = glowX; // where the pointer is
  let targetY = glowY;
  let moving = false;
  let visible = false;
  let touching = false;
  let lastFrameTime = 0;

  // data-reduced="off" hides the glow for reduced motion (the default, "static", just stops the easing).
  const disabled = () => prefersReducedMotion() && glow.dataset.reduced === 'off';

  const placeGlow = () => {
    glow.style.transform = `translate3d(${(glowX - halfSize).toFixed(1)}px, ${(glowY - halfSize).toFixed(1)}px, 0)`;
    // The CSS uses this to dim the glow near the header (components/Overlays.astro).
    glow.style.setProperty('--glow-y', glowY.toFixed(1));
  };

  const followPointer = (now: number) => {
    // Cap the time step so coming back to a stalled tab doesn't make the glow
    // jump, and stretch it for ?slow=.
    const dt = Math.min(0.05, lastFrameTime ? (now - lastFrameTime) / 1000 : 1 / 60) / slow();
    lastFrameTime = now;

    if (prefersReducedMotion()) {
      glowX = targetX;
      glowY = targetY;
      velocityX = velocityY = 0;
    } else {
      [glowX, velocityX] = smoothDamp(glowX, targetX, velocityX, dt);
      [glowY, velocityY] = smoothDamp(glowY, targetY, velocityY, dt);
    }
    placeGlow();

    const caughtUp =
      Math.abs(targetX - glowX) < 0.1 && Math.abs(targetY - glowY) < 0.1 && Math.abs(velocityX) < 1 && Math.abs(velocityY) < 1;
    if (caughtUp) {
      glowX = targetX;
      glowY = targetY;
      velocityX = velocityY = 0;
      placeGlow();
      moving = false;
      glow.style.willChange = '';
      return;
    }
    requestAnimationFrame(followPointer);
  };

  const startMoving = () => {
    if (moving) return;
    moving = true;
    lastFrameTime = 0;
    glow.style.willChange = 'transform';
    requestAnimationFrame(followPointer);
  };

  // The smooth version of the glow is painted the first time it's needed, and
  // again whenever the theme switches its colour.
  let canvas: HTMLCanvasElement | null = null;
  const paint = () => {
    const colour = parseColour(getComputedStyle(glow).getPropertyValue('--glow'));
    if (!colour) return;
    canvas ??= document.createElement('canvas');
    if (!paintGlow(canvas, colour)) return;
    if (!canvas.isConnected) glow.append(canvas);
    glow.classList.add('is-painted');
  };
  new MutationObserver(() => canvas && paint()).observe(document.documentElement, {
    attributes: true,
    attributeFilter: ['data-theme'],
  });
  // Painting takes ~20 ms, so get it out of the way while the browser is idle
  // rather than on the first mouse move.
  if ('requestIdleCallback' in window) requestIdleCallback(() => canvas || paint());

  const show = (fadeMs: number) => {
    if (!canvas) paint();
    glow.style.transitionDuration = `${dur(fadeMs)}ms`;
    glow.classList.add('is-visible');
    visible = true;
  };

  const hide = (fadeMs: number) => {
    glow.style.transitionDuration = `${dur(fadeMs)}ms`;
    glow.classList.remove('is-visible');
    visible = false;
  };

  const jumpTo = (x: number, y: number) => {
    glowX = targetX = x;
    glowY = targetY = y;
    velocityX = velocityY = 0;
    placeGlow();
  };

  window.addEventListener(
    'pointermove',
    (event) => {
      if (disabled()) return;
      // A finger only moves the glow while it's pressed down.
      if (event.pointerType === 'touch' && !touching) return;
      targetX = event.clientX;
      targetY = event.clientY;
      // When it first appears, start right under the pointer instead of sliding in from somewhere.
      if (!visible) {
        jumpTo(targetX, targetY);
        show(300);
      }
      startMoving();
    },
    { passive: true },
  );

  // On touch screens the glow shows up where you touch, then fades once you let go.
  window.addEventListener(
    'pointerdown',
    (event) => {
      if (event.pointerType !== 'touch' || disabled()) return;
      touching = true;
      jumpTo(event.clientX, event.clientY);
      show(300);
    },
    { passive: true },
  );

  const endTouch = (event: PointerEvent) => {
    if (event.pointerType !== 'touch' || !touching) return;
    touching = false;
    hide(800);
  };
  window.addEventListener('pointerup', endTouch, { passive: true });
  window.addEventListener('pointercancel', endTouch, { passive: true }); // the browser took over to scroll

  // The pointer left the window.
  document.addEventListener('pointerout', (event) => {
    if (!event.relatedTarget && event.pointerType !== 'touch') hide(300);
  });
  window.addEventListener('blur', () => hide(300));
}
