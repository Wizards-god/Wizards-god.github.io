const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** "Sep 2026" (UTC, so dates from frontmatter never shift a day). */
export const monthYear = (d: Date) => `${MONTHS[d.getUTCMonth()]} ${d.getUTCFullYear()}`;

/** "Sep 29, 2026" */
export const fullDate = (d: Date) => `${MONTHS[d.getUTCMonth()]} ${d.getUTCDate()}, ${d.getUTCFullYear()}`;

/** "2026-09-29" */
export const isoDate = (d: Date) => d.toISOString().slice(0, 10);

/** "Sep 2026 – Present" when end is null. */
export const dateRange = (start: Date, end: Date | null) => `${monthYear(start)} – ${end ? monthYear(end) : 'Present'}`;

/** "2026 – 2030" style year range. */
export const yearRange = (start: string, end: string | null) =>
  `${start.slice(0, 4)} – ${end ? end.slice(0, 4) : 'Present'}`;

export function readingTime(text: string) {
  const words = text
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/\$\$[\s\S]*?\$\$/g, ' ')
    .replace(/<[^>]+>/g, ' ')
    .split(/\s+/)
    .filter(Boolean).length;
  return Math.max(1, Math.round(words / 230));
}

export const slugify = (s: string) =>
  s
    .toLowerCase()
    .replace(/\+\+/g, 'pp')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
