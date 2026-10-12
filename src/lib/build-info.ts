import { execSync } from 'node:child_process';

// Dates the build needs to know about itself.

/** When the latest commit was made, or the build time if this isn't a git checkout. */
function lastCommitDate(): Date {
  try {
    const isoDate = execSync('git log -1 --format=%cI', { stdio: ['ignore', 'pipe', 'ignore'] })
      .toString()
      .trim();
    const date = new Date(isoDate);
    if (!Number.isNaN(date.valueOf())) return date;
  } catch {
    // Not a git checkout (or no git installed): fall through to now.
  }
  return new Date();
}

/** Shown in the footer as "Last updated". */
export const lastUpdated = lastCommitDate();
/** Seeds the chart's first frame, so it changes with each day's build. */
export const buildDate = new Date();
