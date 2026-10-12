// Keeps the home page chart moving. The build drew a first frame; here it gets
// re-seeded with the current time in India, and then takes a step every couple
// of seconds. The two lines underneath are worked out again from whatever is
// on screen after every step.
//
// It pauses while the chart is scrolled away or the tab is hidden, and with
// reduced motion it draws one frame and stops there.

import { CHART, changeLine, istStamp, plot, randomWalk, windowStats } from '../lib/ascii-chart';
import { prefersReducedMotion, pageSignal } from './motion';

// Each step waits somewhere between these two, so it doesn't tick like a metronome.
const MIN_STEP_MS = 1800;
const MAX_STEP_MS = 3200;

/** Small helper for the coloured bits of text inside the <pre>. */
function span(className: string, text: string) {
  const element = document.createElement('span');
  element.className = className;
  element.textContent = text;
  return element;
}

/** Redraws the whole chart, header to footer, from the prices on screen. */
function drawChart(pre: HTMLElement, whyLink: HTMLElement | null, prices: number[], seedStamp: string) {
  const rows = plot(prices);
  const lastPrice = prices[prices.length - 1];
  const stats = windowStats(prices);
  const frame = document.createDocumentFragment();

  frame.append(span('ascii__head', `PRJ · fair random walk · seed ${seedStamp} IST`), '\n');
  for (const row of rows) {
    // Labelled rows get a tick mark on the axis, the rest a plain line.
    frame.append(`${row.label} ${row.label.trim() ? '┤' : '│'}${row.cells}`);
    if (row.last) frame.append(span('ascii__last', ` ${lastPrice.toFixed(2)}`));
    frame.append('\n');
  }

  // The footer starts where the chart's cells do, past the labels and the axis.
  const indent = ' '.repeat(rows[0].label.length + 2);
  frame.append(span('ascii__head', `${indent}${changeLine(stats)}`), '\n');
  frame.append(span('ascii__head', `${indent}${stats.line2}`));
  pre.replaceChildren(frame);

  // The "why" link sits under the <pre>, so it needs the same indent to line up.
  if (whyLink) whyLink.style.paddingLeft = `${indent.length}ch`;
}

export function initAsciiChart() {
  const figure = document.querySelector<HTMLElement>('[data-ascii]');
  const pre = figure?.querySelector<HTMLElement>('[data-ascii-pre]');
  if (!figure || !pre) return;
  const whyLink = figure.querySelector<HTMLElement>('[data-ascii-why]');

  // The new seed mixes the build's seed (from the first frame's header) with the
  // time in India right now, so everyone who visits gets their own walk.
  const seedStamp = istStamp();
  const buildSeed = pre.querySelector('.ascii__head')?.textContent?.match(/seed (\S+)/)?.[1] ?? '';
  const { series: prices, walker } = randomWalk(`PRJ|${buildSeed}|${seedStamp} IST`, CHART.points);
  drawChart(pre, whyLink, prices, seedStamp);

  if (prefersReducedMotion()) return;

  let timer = 0;
  let onScreen = true;
  const signal = pageSignal(); // fires when the router swaps this page out

  const scheduleNextStep = () => {
    window.clearTimeout(timer);
    if (!onScreen || document.hidden || signal.aborted) return;
    timer = window.setTimeout(takeStep, MIN_STEP_MS + Math.random() * (MAX_STEP_MS - MIN_STEP_MS));
  };

  // One new price on the right, the oldest one drops off the left.
  const takeStep = () => {
    if (!pre.isConnected) return;
    prices.push(walker.step());
    prices.shift();
    drawChart(pre, whyLink, prices, seedStamp);
    scheduleNextStep();
  };

  // This also fires once straight away, which schedules the first step.
  const visibility = new IntersectionObserver(([entry]) => {
    onScreen = entry.isIntersecting;
    scheduleNextStep();
  });
  visibility.observe(figure);
  document.addEventListener('visibilitychange', scheduleNextStep, { signal });
  signal.addEventListener('abort', () => {
    window.clearTimeout(timer);
    visibility.disconnect();
  });
}
