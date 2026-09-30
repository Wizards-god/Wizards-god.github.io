// ASCII line chart of a seeded random walk (box-drawing characters, in the
// style of asciichart). Shared by the build (first paint) and the browser,
// which re-seeds with the time in India and keeps the walk moving.

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

export const CHART = { points: 34, rows: 7, start: 100, vol: 0.9, drift: 0.03 } as const;

/** A seeded random walk that can keep stepping: step() returns the next value. */
export function walker(seed: string, start: number = CHART.start) {
  const rand = mulberry32(hash(seed));
  let value = start;
  return {
    step() {
      const u = 1 - rand();
      const v = rand();
      const z = Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
      value += z * CHART.vol + CHART.drift;
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
