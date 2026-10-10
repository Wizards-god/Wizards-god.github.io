// Cursor glow: a soft radial gradient that trails the pointer.
//
// Movement uses a critically damped spring (the "SmoothDamp" formulation), so
// it glides after the cursor without overshooting, and it is timed in seconds
// rather than per frame, so it feels the same at 60 Hz and 144 Hz. The loop is
// compositor-only (translate3d) and stops once the glow has settled.

import { prefersReducedMotion, slow, dur } from './motion';

const SIZE = 450; // keep in sync with .glow in components/Overlays.astro
const SMOOTH_TIME = 0.24; // seconds; larger = lazier follow
const FADE_RADIUS = 190; // px from the centre to where the glow is fully gone

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

      // Smoothstep from the edge in: about as bright and as wide as the old
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

/** One axis of a critically damped spring. Returns [position, velocity]. */
function smoothDamp(current: number, target: number, velocity: number, dt: number): [number, number] {
  const omega = 2 / SMOOTH_TIME;
  const x = omega * dt;
  const decay = 1 / (1 + x + 0.48 * x * x + 0.235 * x * x * x);
  const change = current - target;
  const temp = (velocity + omega * change) * dt;
  return [target + (change + temp) * decay, (velocity - omega * temp) * decay];
}

export function initGlow() {
  const el = document.querySelector<HTMLElement>('[data-glow]');
  if (!el) return;

  const half = SIZE / 2;
  let x = innerWidth / 2;
  let y = innerHeight / 2;
  let vx = 0;
  let vy = 0;
  let tx = x;
  let ty = y;
  let running = false;
  let visible = false;
  let touchActive = false;
  let lastTime = 0;

  const disabled = () => prefersReducedMotion() && el.dataset.reduced === 'off';

  const place = () => {
    el.style.transform = `translate3d(${(x - half).toFixed(1)}px, ${(y - half).toFixed(1)}px, 0)`;
    // The CSS uses this to dim the glow near the header (components/Overlays.astro).
    el.style.setProperty('--glow-y', y.toFixed(1));
  };

  const loop = (now: number) => {
    // Clamp dt so a stalled tab doesn't make the glow jump; ?slow= stretches time.
    const dt = Math.min(0.05, lastTime ? (now - lastTime) / 1000 : 1 / 60) / slow();
    lastTime = now;
    if (prefersReducedMotion()) {
      x = tx;
      y = ty;
      vx = vy = 0;
    } else {
      [x, vx] = smoothDamp(x, tx, vx, dt);
      [y, vy] = smoothDamp(y, ty, vy, dt);
    }
    place();
    const settled = Math.abs(tx - x) < 0.1 && Math.abs(ty - y) < 0.1 && Math.abs(vx) < 1 && Math.abs(vy) < 1;
    if (settled) {
      x = tx;
      y = ty;
      vx = vy = 0;
      place();
      running = false;
      el.style.willChange = '';
      return;
    }
    requestAnimationFrame(loop);
  };

  const kick = () => {
    if (running) return;
    running = true;
    lastTime = 0;
    el.style.willChange = 'transform';
    requestAnimationFrame(loop);
  };

  // The smooth version of the glow is painted the first time it's shown, and
  // again whenever the theme switches its colour.
  let canvas: HTMLCanvasElement | null = null;
  const paint = () => {
    const colour = parseColour(getComputedStyle(el).getPropertyValue('--glow'));
    if (!colour) return;
    canvas ??= document.createElement('canvas');
    if (!paintGlow(canvas, colour)) return;
    if (!canvas.isConnected) el.append(canvas);
    el.classList.add('is-painted');
  };
  new MutationObserver(() => canvas && paint()).observe(document.documentElement, {
    attributes: true,
    attributeFilter: ['data-theme'],
  });
  // Painting takes ~20 ms, so get it out of the way while the browser is idle
  // rather than on the first mouse move.
  if ('requestIdleCallback' in window) requestIdleCallback(() => canvas || paint());

  const show = (ms: number) => {
    if (!canvas) paint();
    el.style.transitionDuration = `${dur(ms)}ms`;
    el.classList.add('is-visible');
    visible = true;
  };

  const hide = (ms: number) => {
    el.style.transitionDuration = `${dur(ms)}ms`;
    el.classList.remove('is-visible');
    visible = false;
  };

  const jumpTo = (px: number, py: number) => {
    x = tx = px;
    y = ty = py;
    vx = vy = 0;
    place();
  };

  window.addEventListener(
    'pointermove',
    (e) => {
      if (disabled()) return;
      if (e.pointerType === 'touch' && !touchActive) return;
      tx = e.clientX;
      ty = e.clientY;
      if (!visible) {
        jumpTo(tx, ty);
        show(300);
      }
      kick();
    },
    { passive: true },
  );

  window.addEventListener(
    'pointerdown',
    (e) => {
      if (e.pointerType !== 'touch' || disabled()) return;
      touchActive = true;
      jumpTo(e.clientX, e.clientY);
      show(300);
    },
    { passive: true },
  );

  const endTouch = (e: PointerEvent) => {
    if (e.pointerType !== 'touch' || !touchActive) return;
    touchActive = false;
    hide(800);
  };
  window.addEventListener('pointerup', endTouch, { passive: true });
  window.addEventListener('pointercancel', endTouch, { passive: true }); // browser took over scrolling

  // Pointer left the window.
  document.addEventListener('pointerout', (e) => {
    if (!e.relatedTarget && e.pointerType !== 'touch') hide(300);
  });
  window.addEventListener('blur', () => hide(300));
}
