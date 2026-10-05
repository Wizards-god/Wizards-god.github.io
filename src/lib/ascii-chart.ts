// ASCII line chart of a seeded fair random walk (box-drawing characters, in
// the style of asciichart). Shared by the build (first paint) and the browser,
// which re-seeds with the time in India and keeps the walk moving.
//
// The walk has no drift: each tick multiplies the price by exp(sigma * z) with
// z a standard normal, so up and down are equally likely. Under the chart,
// windowStats() counts how many ticks finished above the first point on screen
// and says how often a fair walk is that one-sided (the discrete arcsine law).

function mulberry32(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function hash(s: string) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return h >>> 0;
}

export const CHART = { points: 34, rows: 7, start: 100, sigma: 0.01 } as const;

/** A seeded fair random walk that can keep stepping: step() returns the next value. */
export function walker(seed: string, start: number = CHART.start) {
  const rand = mulberry32(hash(seed));
  let value = start;
  return {
    step() {
      const u = 1 - rand();
      const v = rand();
      const z = Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
      value *= Math.exp(CHART.sigma * z);
      return value;
    },
  };
}

/** The first `n` points of the walk for `seed`. */
export function randomWalk(seed: string, n: number = CHART.points) {
  const w = walker(seed);
  const out = [CHART.start as number];
  for (let i = 1; i < n; i++) out.push(w.step());
  return { series: out, walker: w };
}

/**
 * Exact distribution of N, the number of steps (out of n) that end above the
 * starting point, for any fair walk with continuous, symmetric steps:
 * P(N = k) = u(k) · u(n − k), where u(m) = C(2m, m) / 4^m is built up as
 * u(0) = 1, u(m) = u(m − 1) · (2m − 1) / (2m). Index k of the result is P(N = k).
 */
export function arcsineTable(n: number) {
  const u = [1];
  for (let m = 1; m <= n; m++) u.push((u[m - 1] * (2 * m - 1)) / (2 * m));
  return Array.from({ length: n + 1 }, (_, k) => u[k] * u[n - k]);
}

const STEPS = CHART.points - 1;
const TABLE = arcsineTable(STEPS);
const tableFor = (n: number) => (n === STEPS ? TABLE : arcsineTable(n));

/** P(|N − n/2| ≥ |above − n/2|): how often a fair walk is at least this one-sided. */
export function probAtLeastAsOneSided(above: number, n: number = STEPS) {
  const d = Math.abs(above - n / 2);
  return tableFor(n).reduce((sum, p, k) => (Math.abs(k - n / 2) >= d ? sum + p : sum), 0);
}

/** P(|N − n/2| ≤ |above − n/2|): how often a fair walk is at most this one-sided. */
export function probAtMostAsOneSided(above: number, n: number = STEPS) {
  const d = Math.abs(above - n / 2);
  return tableFor(n).reduce((sum, p, k) => (Math.abs(k - n / 2) <= d ? sum + p : sum), 0);
}

export interface WindowStats {
  /** How many of series[1..n] finished above series[0] (the open). */
  above: number;
  n: number;
  /** Last point relative to the open, in per cent. */
  changePct: number;
  /** Second footer line: how unusual that count is for a fair walk. */
  line2: string;
}

/** Stats for the window on screen. The open is its first point, so they change as it scrolls. */
export function windowStats(series: number[]): WindowStats {
  const n = series.length - 1;
  const open = series[0];
  let above = 0;
  for (let i = 1; i <= n; i++) if (series[i] > open) above++;
  const changePct = ((series[n] - open) / open) * 100;
  const d = Math.abs(above - n / 2);
  const line2 =
    d <= 2.5
      ? `only ${Math.round(100 * probAtMostAsOneSided(above, n))}% of fair walks are this balanced`
      : `${Math.round(100 * probAtLeastAsOneSided(above, n))}% of fair walks are at least this one-sided`;
  return { above, n, changePct, line2 };
}

/** First footer line, e.g. "+1.32% since open · above it 31/33 ticks". */
export function changeLine({ changePct, above, n }: WindowStats) {
  return `${changePct >= 0 ? '+' : ''}${changePct.toFixed(2)}% since open · above it ${above}/${n} ticks`;
}

export interface ChartRow {
  label: string;
  cells: string;
  /** Marks the row that ends at the last point (gets the price tag). */
  last: boolean;
}

/** Plot `series` into `height` rows. Returns rows top to bottom. */
export function plot(series: number[], height: number = CHART.rows): ChartRow[] {
  const min = Math.min(...series);
  const max = Math.max(...series);
  const range = max - min || 1;
  const rows = height - 1;
  const toRow = (v: number) => Math.round(((v - min) / range) * rows); // 0 = bottom
  const width = series.length;
  const grid: string[][] = Array.from({ length: height }, () => Array(width).fill(' '));

  for (let x = 0; x < width - 1; x++) {
    const y0 = toRow(series[x]);
    const y1 = toRow(series[x + 1]);
    if (y0 === y1) {
      grid[rows - y0][x] = '─';
      continue;
    }
    grid[rows - y1][x] = y0 > y1 ? '╰' : '╭';
    grid[rows - y0][x] = y0 > y1 ? '╮' : '╯';
    for (let y = Math.min(y0, y1) + 1; y < Math.max(y0, y1); y++) grid[rows - y][x] = '│';
  }
  const lastRow = rows - toRow(series[width - 1]);
  grid[lastRow][width - 1] = '─';

  const labelW = Math.max(max.toFixed(1).length, min.toFixed(1).length);
  return grid.map((cells, r) => {
    const value = max - (r / rows) * range;
    const label = r % 2 === 0 ? value.toFixed(1).padStart(labelW) : ' '.repeat(labelW);
    return { label, cells: cells.join(''), last: r === lastRow };
  });
}

/** "30 Sep 14:05:32" in India Standard Time. */
export function istStamp(d = new Date()) {
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
      .formatToParts(d)
      .map((p) => [p.type, p.value]),
  );
  const month = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][Number(parts.month) - 1];
  return `${parts.day} ${month} ${parts.hour}:${parts.minute}:${parts.second}`;
}
