// Dates for the sitemap's <lastmod>: roughly when each page last changed.
//
//   Posts and projects: the later of the date in their frontmatter (a post's
//   `updated` date if it has one) and the last commit that touched the file,
//   so an edit counts even if I forget to set `updated`.
//
//   Every other page: the date of the latest commit, the same "Last updated"
//   date as the footer.
//
// This runs from astro.config.mjs, before the content collections exist, so it
// reads the files directly.

import { execFileSync } from 'node:child_process';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { lastUpdated } from './build-info';

const CONTENT_FOLDERS = [
  { folder: 'src/content/writing', urlPath: '/writing/' },
  { folder: 'src/content/projects', urlPath: '/projects/' },
];

/** A date field from a Markdown file's frontmatter, such as `date: 2026-09-29`. */
function frontmatterDate(text: string, field: string) {
  const frontmatter = text.split('---')[1] ?? '';
  const value = frontmatter.match(new RegExp(`^${field}:\\s*(\\S+)`, 'm'))?.[1];
  return value ? new Date(value) : undefined;
}

/** When git last saw the file change, or undefined outside a git checkout. */
function lastCommitTouching(file: string) {
  try {
    const isoDate = execFileSync('git', ['log', '-1', '--format=%cI', '--', file], { stdio: ['ignore', 'pipe', 'ignore'] })
      .toString()
      .trim();
    return isoDate ? new Date(isoDate) : undefined;
  } catch {
    return undefined;
  }
}

/** Maps a page's path (like /writing/fair-coin/) to when it last changed. */
function contentDates() {
  const dates = new Map<string, Date>();
  for (const { folder, urlPath } of CONTENT_FOLDERS) {
    for (const file of readdirSync(folder)) {
      const path = join(folder, file);
      const text = readFileSync(path, 'utf8');
      const candidates = [frontmatterDate(text, 'updated') ?? frontmatterDate(text, 'date'), lastCommitTouching(path)];
      const latest = Math.max(...candidates.filter((date) => date !== undefined).map((date) => date.valueOf()));
      if (Number.isFinite(latest)) dates.set(`${urlPath}${file.replace(/\.mdx?$/, '')}/`, new Date(latest));
    }
  }
  return dates;
}

const datesByPath = contentDates();

/** The <lastmod> for one URL in the sitemap. */
export function lastModified(url: string) {
  return (datesByPath.get(new URL(url).pathname) ?? lastUpdated).toISOString();
}
