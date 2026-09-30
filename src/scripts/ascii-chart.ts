// Keeps the hero's ASCII chart alive: re-seeds the walk with the current time
// in India (IST), then steps it up or down every couple of seconds. Pauses when
// the chart is off-screen or the tab is hidden; static under reduced motion.

import { CHART, istStamp, plot, randomWalk } from '../lib/ascii-chart';
import { prefersReducedMotion, pageSignal } from './motion';

const MIN_MS = 1800;
const MAX_MS = 3200;

function render(pre: HTMLElement, series: number[], open: number, stamp: string) {
  const rows = plot(series);
  const last = series[series.length - 1];
  const change = ((last - open) / open) * 100;
  const frag = document.createDocumentFragment();
  const span = (cls: string, text: string) => {
    const s = document.createElement('span');
    s.className = cls;
    s.textContent = text;
    return s;
  };
  frag.append(span('ascii__head', `PRJ · random walk · seed ${stamp} IST`), '\n');
  for (const r of rows) {
    frag.append(`${r.label} ${r.label.trim() ? '┤' : '│'}${r.cells}`);
    if (r.last) frag.append(span('ascii__last', ` ${last.toFixed(2)}`));
    frag.append('\n');
  }
  const pad = ' '.repeat(rows[0].label.length + 2);
  frag.append(span('ascii__head', `${pad}${change >= 0 ? '+' : ''}${change.toFixed(2)}% since open`));
  pre.replaceChildren(frag);
}

export function initAsciiChart() {
  const root = document.querySelector<HTMLElement>('[data-ascii]');
  const pre = root?.querySelector<HTMLElement>('[data-ascii-pre]');
  if (!root || !pre) return;

  const stamp = istStamp();
  const base = pre.querySelector('.ascii__head')?.textContent?.match(/seed (\S+)/)?.[1] ?? '';
  const { series, walker } = randomWalk(`PRJ|${base}|${stamp} IST`, CHART.points);
  const open = series[0];
  render(pre, series, open, stamp);

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
    render(pre, series, open, stamp);
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
