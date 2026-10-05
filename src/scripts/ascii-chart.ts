// Keeps the hero's ASCII chart alive: re-seeds the fair walk with the current
// time in India (IST), then steps it every couple of seconds. The footer is
// recomputed from the window on screen each time. Pauses when the chart is
// off-screen or the tab is hidden; static under reduced motion.

import { CHART, changeLine, istStamp, plot, randomWalk, windowStats } from '../lib/ascii-chart';
import { prefersReducedMotion, pageSignal } from './motion';

const MIN_MS = 1800;
const MAX_MS = 3200;

function render(pre: HTMLElement, why: HTMLElement | null, series: number[], stamp: string) {
  const rows = plot(series);
  const last = series[series.length - 1];
  const stats = windowStats(series);
  const frag = document.createDocumentFragment();
  const span = (cls: string, text: string) => {
    const s = document.createElement('span');
    s.className = cls;
    s.textContent = text;
    return s;
  };
  frag.append(span('ascii__head', `PRJ · fair random walk · seed ${stamp} IST`), '\n');
  for (const r of rows) {
    frag.append(`${r.label} ${r.label.trim() ? '┤' : '│'}${r.cells}`);
    if (r.last) frag.append(span('ascii__last', ` ${last.toFixed(2)}`));
    frag.append('\n');
  }
  const pad = ' '.repeat(rows[0].label.length + 2);
  frag.append(span('ascii__head', `${pad}${changeLine(stats)}`), '\n');
  frag.append(span('ascii__head', `${pad}${stats.line2}`));
  pre.replaceChildren(frag);
  // The "why" link sits under the <pre>, lined up with the footer.
  if (why) why.style.paddingLeft = `${pad.length}ch`;
}

export function initAsciiChart() {
  const root = document.querySelector<HTMLElement>('[data-ascii]');
  const pre = root?.querySelector<HTMLElement>('[data-ascii-pre]');
  if (!root || !pre) return;
  const why = root.querySelector<HTMLElement>('[data-ascii-why]');

  const stamp = istStamp();
  const base = pre.querySelector('.ascii__head')?.textContent?.match(/seed (\S+)/)?.[1] ?? '';
  const { series, walker } = randomWalk(`PRJ|${base}|${stamp} IST`, CHART.points);
  render(pre, why, series, stamp);

  if (prefersReducedMotion()) return;

  let timer = 0;
  let onScreen = true;
  const signal = pageSignal();

  const schedule = () => {
    window.clearTimeout(timer);
    if (!onScreen || document.hidden || signal.aborted) return;
    timer = window.setTimeout(tick, MIN_MS + Math.random() * (MAX_MS - MIN_MS));
  };

  const tick = () => {
    if (!pre.isConnected) return;
    series.push(walker.step());
    series.shift();
    render(pre, why, series, stamp);
    schedule();
  };

  const io = new IntersectionObserver(([e]) => {
    onScreen = e.isIntersecting;
    schedule();
  });
  io.observe(root);
  document.addEventListener('visibilitychange', schedule, { signal });
  signal.addEventListener('abort', () => {
    window.clearTimeout(timer);
    io.disconnect();
  });
}
