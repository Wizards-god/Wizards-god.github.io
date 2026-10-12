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

const TICKS = CHART.points - 1; // 33 ticks in a window

const assertClose = (actual: number, expected: number, tolerance: number, what: string) =>
  assert.ok(Math.abs(actual - expected) <= tolerance, `${what}: got ${actual}, expected ${expected} ± ${tolerance}`);

/** A window whose open is 100 and where exactly `above` of the 33 ticks finish above it. */
function windowWithAbove(above: number) {
  return [100, ...Array.from({ length: TICKS }, (_, i) => (i < above ? 101 : 99))];
}

test('arcsineTable(33) is a symmetric probability distribution', () => {
  const table = arcsineTable(TICKS);
  assert.equal(table.length, TICKS + 1);
  const total = table.reduce((sum, chance) => sum + chance, 0);
  assertClose(total, 1, 1e-12, 'sum');
  for (let k = 0; k <= TICKS; k++) assertClose(table[k], table[TICKS - k], 1e-15, `P(N=${k}) vs P(N=${TICKS - k})`);
  assertClose(table[33], 0.09784, 1e-5, 'P(N = 33)');
});

test('tail probabilities match the exact values', () => {
  assertClose(probAtLeastAsOneSided(30), 0.43483, 1e-5, 'at least as one-sided as 30/33');
  assertClose(probAtMostAsOneSided(17), 0.03802, 1e-5, 'at most as one-sided as 17/33');
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
    assert.equal(stats.n, TICKS);
    assert.equal(stats.line2, message, `above = ${above}`);
  }
});

test('Monte Carlo: the real walker follows the arcsine law and has no drift', () => {
  const WINDOWS = 20_000;
  const table = arcsineTable(TICKS);
  const counts = new Array(TICKS + 1).fill(0);
  let sumOfReturns = 0;
  let sumOfSquares = 0;
  let steps = 0;
  for (let i = 0; i < WINDOWS; i++) {
    const { series: prices } = randomWalk(`test-window-${i}`, CHART.points);
    counts[windowStats(prices).above]++;
    for (let j = 1; j < prices.length; j++) {
      const logReturn = Math.log(prices[j] / prices[j - 1]);
      sumOfReturns += logReturn;
      sumOfSquares += logReturn * logReturn;
      steps++;
    }
  }
  for (let k = 0; k <= TICKS; k++) assertClose(counts[k] / WINDOWS, table[k], 0.01, `share of windows with above = ${k}`);

  // No drift: the average log-return should sit within 3 standard errors of zero.
  const mean = sumOfReturns / steps;
  const standardDeviation = Math.sqrt(sumOfSquares / steps - mean * mean);
  const standardError = standardDeviation / Math.sqrt(steps);
  assert.ok(Math.abs(mean) <= 3 * standardError, `mean log-return ${mean} is more than 3 standard errors (${standardError}) from 0`);
});
