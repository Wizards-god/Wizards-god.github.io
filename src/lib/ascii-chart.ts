// The little ASCII price chart on the home page. Nothing in here touches the
// page, so the build (which draws the first frame) and the browser (which
// keeps it moving) both use this file.
//
// The price is a fair random walk. Every tick multiplies it by e^(σz), where z
// is a random number from a standard normal distribution, so up and down are
// equally likely and there's no drift. Under the chart, windowStats() counts
// how many ticks finished above the first price on screen, and says how
// unusual that is for a fair walk (the discrete arcsine law). The post at
// /writing/fair-coin goes through the maths.

export const CHART = {
  points: 34, // prices on screen, which makes 33 ticks
  rows: 7,
  start: 100,
  sigma: 0.01, // each tick moves the price by about 1%
} as const;

// ---- Random numbers ------------------------------------------------------

/** mulberry32, a tiny seeded random number generator. Gives numbers in [0, 1). */
function mulberry32(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** FNV-1a: turns the seed text into the 32-bit number mulberry32 wants. */
function hashString(text: string) {
  let hash = 2166136261;
  for (let i = 0; i < text.length; i++) hash = Math.imul(hash ^ text.charCodeAt(i), 16777619);
  return hash >>> 0;
}

/** A number from a standard normal distribution, made from two uniform ones (Box–Muller). */
function standardNormal(random: () => number) {
  const u = 1 - random(); // in (0, 1], so the log below never sees a zero
  const v = random();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

// ---- The walk ------------------------------------------------------------

/** A seeded fair random walk that can keep going: each step() returns the next price. */
export function walker(seed: string, start: number = CHART.start) {
  const random = mulberry32(hashString(seed));
  let price = start;
  return {
    step() {
      price *= Math.exp(CHART.sigma * standardNormal(random));
      return price;
    },
  };
}

/** The first `n` prices of the walk for `seed`, plus the walker, to keep it going. */
export function randomWalk(seed: string, n: number = CHART.points) {
  const walk = walker(seed);
  const prices = [CHART.start as number];
  for (let i = 1; i < n; i++) prices.push(walk.step());
  return { series: prices, walker: walk };
}

// ---- How lopsided is it? -------------------------------------------------

/**
 * Exact chances for N, the number of steps out of n that end above where the
 * walk started, for any fair walk whose steps are continuous and symmetric:
 *
 *   P(N = k) = u(k) · u(n − k),   u(m) = C(2m, m) / 4^m
 *
 * u is built up one step at a time, u(0) = 1 and u(m) = u(m − 1) · (2m − 1) / (2m),
 * which avoids the huge numbers in C(2m, m). Index k of the result is P(N = k).
 */
export function arcsineTable(n: number) {
  const u = [1];
  for (let m = 1; m <= n; m++) u.push((u[m - 1] * (2 * m - 1)) / (2 * m));
  return Array.from({ length: n + 1 }, (_, k) => u[k] * u[n - k]);
}

const TICKS = CHART.points - 1;
const TICKS_TABLE = arcsineTable(TICKS); // the chart always asks about 33 ticks, so work this out once
const tableFor = (n: number) => (n === TICKS ? TICKS_TABLE : arcsineTable(n));

/** How often a fair walk is at least as one-sided as this one: P(|N − n/2| ≥ |above − n/2|). */
export function probAtLeastAsOneSided(above: number, n: number = TICKS) {
  const distanceFromMiddle = Math.abs(above - n / 2);
  return tableFor(n).reduce((total, chance, k) => (Math.abs(k - n / 2) >= distanceFromMiddle ? total + chance : total), 0);
}

/** How often a fair walk is at most as one-sided as this one: P(|N − n/2| ≤ |above − n/2|). */
export function probAtMostAsOneSided(above: number, n: number = TICKS) {
  const distanceFromMiddle = Math.abs(above - n / 2);
  return tableFor(n).reduce((total, chance, k) => (Math.abs(k - n / 2) <= distanceFromMiddle ? total + chance : total), 0);
}

export interface WindowStats {
  /** How many of series[1..n] finished above series[0] (the open). */
  above: number;
  n: number;
  /** The last price compared with the open, in per cent. */
  changePct: number;
  /** The second footer line: how unusual that count is for a fair walk. */
  line2: string;
}

/**
 * The numbers under the chart, for the prices currently on screen. The open is
 * the first price on screen, so all of this changes as the chart scrolls.
 */
export function windowStats(series: number[]): WindowStats {
  const n = series.length - 1;
  const open = series[0];

  let above = 0;
  for (let i = 1; i <= n; i++) if (series[i] > open) above++;

  const changePct = ((series[n] - open) / open) * 100;

  // Near the middle (14 to 19 of 33) the rare thing is being that balanced,
  // so the sentence flips around to say that instead.
  const distanceFromMiddle = Math.abs(above - n / 2);
  const line2 =
    distanceFromMiddle <= 2.5
      ? `only ${Math.round(100 * probAtMostAsOneSided(above, n))}% of fair walks are this balanced`
      : `${Math.round(100 * probAtLeastAsOneSided(above, n))}% of fair walks are at least this one-sided`;

  return { above, n, changePct, line2 };
}

/** The first footer line, e.g. "+1.32% since open · above it 31/33 ticks". */
export function changeLine({ changePct, above, n }: WindowStats) {
  const sign = changePct >= 0 ? '+' : '';
  return `${sign}${changePct.toFixed(2)}% since open · above it ${above}/${n} ticks`;
}

// ---- Drawing -------------------------------------------------------------

export interface ChartRow {
  label: string;
  cells: string;
  /** True for the row the last price ends on (that's where the price tag goes). */
  last: boolean;
}

/** Draws `series` as box-drawing characters on `height` rows. Returns the rows top to bottom. */
export function plot(series: number[], height: number = CHART.rows): ChartRow[] {
  const lowest = Math.min(...series);
  const highest = Math.max(...series);
  const span = highest - lowest || 1; // a perfectly flat line would divide by zero
  const topRow = height - 1;
  // Which row a price lands on, counting up from 0 at the bottom.
  const rowFor = (price: number) => Math.round(((price - lowest) / span) * topRow);

  const width = series.length;
  const grid: string[][] = Array.from({ length: height }, () => Array(width).fill(' '));

  // Each column draws the move from one price to the next: a dash if it stays
  // on the same row, otherwise two corners joined by a vertical line.
  for (let column = 0; column < width - 1; column++) {
    const fromRow = rowFor(series[column]);
    const toRow = rowFor(series[column + 1]);
    if (fromRow === toRow) {
      grid[topRow - fromRow][column] = '─';
      continue;
    }
    const goingDown = fromRow > toRow;
    grid[topRow - toRow][column] = goingDown ? '╰' : '╭';
    grid[topRow - fromRow][column] = goingDown ? '╮' : '╯';
    for (let row = Math.min(fromRow, toRow) + 1; row < Math.max(fromRow, toRow); row++) grid[topRow - row][column] = '│';
  }
  const lastPriceRow = topRow - rowFor(series[width - 1]);
  grid[lastPriceRow][width - 1] = '─';

  // Price labels on every other row, padded to the same width so the axis lines up.
  const labelWidth = Math.max(highest.toFixed(1).length, lowest.toFixed(1).length);
  return grid.map((cells, row) => {
    const price = highest - (row / topRow) * span;
    const label = row % 2 === 0 ? price.toFixed(1).padStart(labelWidth) : ' '.repeat(labelWidth);
    return { label, cells: cells.join(''), last: row === lastPriceRow };
  });
}

// ---- The seed stamp ------------------------------------------------------

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** The time in India, like "30 Sep 14:05:32". The browser uses it as part of the seed. */
export function istStamp(date = new Date()) {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat('en-GB', {
      timeZone: 'Asia/Kolkata',
      day: '2-digit',
      month: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hourCycle: 'h23',
    })
      .formatToParts(date)
      .map((part) => [part.type, part.value]),
  );
  const month = MONTHS[Number(parts.month) - 1];
  return `${parts.day} ${month} ${parts.hour}:${parts.minute}:${parts.second}`;
}
