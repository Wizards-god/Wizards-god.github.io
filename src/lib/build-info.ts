import { execSync } from 'node:child_process';

// "Last updated" comes from the latest git commit, falling back to build time.
function lastCommitDate(): Date {
  try {
    const iso = execSync('git log -1 --format=%cI', { stdio: ['ignore', 'pipe', 'ignore'] })
      .toString()
      .trim();
    const d = new Date(iso);
    if (!Number.isNaN(d.valueOf())) return d;
  } catch {
    /* not a git checkout */
  }
  return new Date();
}

export const lastUpdated = lastCommitDate();
export const buildDate = new Date();
