// Date and text formatting used across the site. Dates are read in UTC, so a
// date from frontmatter like 2026-09-29 never slips back a day in another
// time zone.

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** "Sep 2026" */
export const monthYear = (date: Date) => `${MONTHS[date.getUTCMonth()]} ${date.getUTCFullYear()}`;

/** "29 Sep 2026" */
export const fullDate = (date: Date) => `${date.getUTCDate()} ${MONTHS[date.getUTCMonth()]} ${date.getUTCFullYear()}`;

/** "2026-09-29", for datetime attributes. */
export const isoDate = (date: Date) => date.toISOString().slice(0, 10);

/** The date of an award or result: "Dec 2026", or just "2026" when the month doesn't matter. */
export const awardDate = (date: Date, precision: 'month' | 'year' = 'month') =>
  precision === 'year' ? String(date.getUTCFullYear()) : monthYear(date);

/** "Sep 2026 – Present" while it's still going (end is null). */
export const dateRange = (start: Date, end: Date | null) => `${monthYear(start)} – ${end ? monthYear(end) : 'Present'}`;

/** "2026 – 2030", from dates written like "2026-08". */
export const yearRange = (start: string, end: string | null) => `${start.slice(0, 4)} – ${end ? end.slice(0, 4) : 'Present'}`;

/** Minutes to read a post, at about 230 words a minute, not counting code blocks, maths or HTML tags. */
export function readingTime(text: string) {
  const wordCount = text
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/\$\$[\s\S]*?\$\$/g, ' ')
    .replace(/<[^>]+>/g, ' ')
    .split(/\s+/)
    .filter(Boolean).length;
  return Math.max(1, Math.round(wordCount / 230));
}
