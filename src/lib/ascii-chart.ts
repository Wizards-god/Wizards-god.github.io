// Build-time ASCII line chart of a seeded random walk (box-drawing
// characters, in the style of asciichart). A new walk is drawn on every build.

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

export function randomWalk(seed: string, n: number, start = 100, vol = 0.9) {
  const rand = mulberry32(hash(seed));
  const out: number[] = [start];
  for (let i = 1; i < n; i++) {
    const u = 1 - rand();
    const v = rand();
    const z = Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
    out.push(out[i - 1] + z * vol + 0.03);
  }
  return out;
}

export interface ChartRow {
  label: string;
  cells: string;
  /** Marks the row that ends at the last point (gets the price tag). */
  last: boolean;
}

/** Plot `series` into `height` rows. Returns rows top to bottom. */
export function plot(series: number[], height: number): ChartRow[] {
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
