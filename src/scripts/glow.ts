// Cursor glow: a large, faint radial gradient that eases toward the pointer.
// Compositor-only (translate3d), and the rAF loop stops once it settles.

import { prefersReducedMotion, dur } from './motion';

const SIZE = 450; // keep in sync with .glow in components/Overlays.astro
const LERP = 0.15;

export function initGlow() {
  const el = document.querySelector<HTMLElement>('[data-glow]');
  if (!el) return;

  const half = SIZE / 2;
  let x = innerWidth / 2;
  let y = innerHeight / 2;
  let tx = x;
  let ty = y;
  let running = false;
  let visible = false;
  let touchActive = false;

  const disabled = () => prefersReducedMotion() && el.dataset.reduced === 'off';

  const place = () => {
    el.style.transform = `translate3d(${(x - half).toFixed(1)}px, ${(y - half).toFixed(1)}px, 0)`;
  };

  const loop = () => {
    const k = prefersReducedMotion() ? 1 : LERP;
    x += (tx - x) * k;
    y += (ty - y) * k;
    if (Math.abs(tx - x) < 0.1 && Math.abs(ty - y) < 0.1) {
      x = tx;
      y = ty;
      place();
      running = false;
      el.style.willChange = '';
      return;
    }
    place();
    requestAnimationFrame(loop);
  };

  const kick = () => {
    if (running) return;
    running = true;
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
