// Cursor glow: a soft radial gradient that trails the pointer.
//
// Movement uses a critically damped spring (the "SmoothDamp" formulation), so
// it glides after the cursor without overshooting, and it is timed in seconds
// rather than per frame, so it feels the same at 60 Hz and 144 Hz. The loop is
// compositor-only (translate3d) and stops once the glow has settled.

import { prefersReducedMotion, slow, dur } from './motion';

const SIZE = 450; // keep in sync with .glow in components/Overlays.astro
const SMOOTH_TIME = 0.24; // seconds; larger = lazier follow

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

  const show = (ms: number) => {
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
