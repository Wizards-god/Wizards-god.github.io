// Tests for the home page chart's walk and the numbers printed under it.
// Run with `npm test` (Node's built-in test runner; no extra dependencies).

import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  CHART,
  arcsineTable,
  probAtLeastAsOneSided,
  probAtMostAsOneSided,
  randomWalk,
  windowStats,
} from '../src/lib/ascii-chart.ts';

const N = CHART.points - 1; // 33 steps in a window

const near = (actual: number, expected: number, tol: number, what: string) =>
  assert.ok(Math.abs(actual - expected) <= tol, `${what}: got ${actual}, expected ${expected} ± ${tol}`);

/** A window whose open is 100 and where exactly `above` of the 33 ticks finish above it. */
function windowWithAbove(above: number) {
  return [100, ...Array.from({ length: N }, (_, i) => (i < above ? 101 : 99))];
}

test('arcsineTable(33) is a symmetric probability distribution', () => {
  const t = arcsineTable(N);
  assert.equal(t.length, N + 1);
  near(
    t.reduce((a, b) => a + b, 0),
    1,
    1e-12,
    'sum',
  );
  for (let k = 0; k <= N; k++) near(t[k], t[N - k], 1e-15, `P(N=${k}) vs P(N=${N - k})`);
  near(t[33], 0.09784, 1e-5, 'P(N = 33)');
});

test('tail probabilities match the exact values', () => {
  near(probAtLeastAsOneSided(30), 0.43483, 1e-5, 'at least as one-sided as 30/33');
  near(probAtMostAsOneSided(17), 0.03802, 1e-5, 'at most as one-sided as 17/33');
});

test('footer messages', () => {
  const cases: [number, string][] = [
    [33, '20% of fair walks are at least this one-sided'],
    [31, '37% of fair walks are at least this one-sided'],
    [17, 'only 4% of fair walks are this balanced'],
    [14, 'only 11% of fair walks are this balanced'],
    [0, '20% of fair walks are at least this one-sided'],
  ];
  for (const [above, message] of cases) {
    const stats = windowStats(windowWithAbove(above));
    assert.equal(stats.above, above);
    assert.equal(stats.n, N);
    assert.equal(stats.line2, message, `above = ${above}`);
  }
});

test('Monte Carlo: the real walker follows the arcsine law and has no drift', () => {
  const WINDOWS = 20_000;
  const table = arcsineTable(N);
  const counts = new Array(N + 1).fill(0);
  let sum = 0;
  let sumSq = 0;
  let steps = 0;
  for (let i = 0; i < WINDOWS; i++) {
    const { series } = randomWalk(`test-window-${i}`, CHART.points);
    counts[windowStats(series).above]++;
    for (let j = 1; j < series.length; j++) {
      const r = Math.log(series[j] / series[j - 1]);
      sum += r;
      sumSq += r * r;
      steps++;
    }
  }
  for (let k = 0; k <= N; k++) near(counts[k] / WINDOWS, table[k], 0.01, `share of windows with above = ${k}`);

  const mean = sum / steps;
  const sd = Math.sqrt(sumSq / steps - mean * mean);
  const se = sd / Math.sqrt(steps);
  assert.ok(Math.abs(mean) <= 3 * se, `mean log-return ${mean} is more than 3 standard errors (${se}) from 0`);
});
