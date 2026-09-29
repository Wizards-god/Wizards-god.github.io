// Build-time content checks (warnings; hard failures live in the Zod schemas):
//  - the status pill and the "currently" list are dated; warn after 90 days
//  - list every entry still marked `placeholder: true`

import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const MAX_AGE_DAYS = 90;

function walk(dir) {
  return readdirSync(dir).flatMap((name) => {
    const p = join(dir, name);
    return statSync(p).isDirectory() ? walk(p) : [p];
  });
}

function ageInDays(iso) {
  return Math.floor((Date.now() - new Date(iso).valueOf()) / 86_400_000);
}

/** @returns {import('astro').AstroIntegration} */
export function siteChecks() {
  return {
    name: 'site-checks',
    hooks: {
      'astro:build:start': ({ logger }) => {
        const root = fileURLToPath(new URL('../../', import.meta.url));

        // Dated content lives in TS files; read the dates with a regex to avoid importing TS here.
        const dated = [
          { file: 'src/data/site.ts', what: 'status pill (site.status.updated)', re: /status:\s*{[^}]*updated:\s*'([\d-]+)'/s },
          { file: 'src/data/about.ts', what: '"currently" list (currently.updated)', re: /currently\s*=\s*{\s*updated:\s*'([\d-]+)'/s },
        ];
        for (const d of dated) {
          const m = readFileSync(join(root, d.file), 'utf8').match(d.re);
          if (!m) {
            logger.warn(`Could not find the date for the ${d.what} in ${d.file}.`);
            continue;
          }
          const age = ageInDays(m[1]);
          if (age > MAX_AGE_DAYS) {
            logger.warn(`The ${d.what} was last updated ${age} days ago (${m[1]}). Refresh it in ${d.file}.`);
          }
        }

        const placeholders = [];
        const contentDir = join(root, 'src/content');
        for (const file of walk(contentDir)) {
          const text = readFileSync(file, 'utf8');
          if (file.endsWith('.yaml') || file.endsWith('.yml')) {
            const ids = [...text.matchAll(/-\s+id:\s*(\S+)[\s\S]*?(?=\n-\s+id:|$)/g)]
              .filter((m) => /placeholder:\s*true/.test(m[0]))
              .map((m) => m[1]);
            ids.forEach((id) => placeholders.push(`${relative(root, file)}#${id}`));
          } else if (/^---[\s\S]*?placeholder:\s*true[\s\S]*?---/m.test(text)) {
            placeholders.push(relative(root, file));
          }
        }
        for (const file of ['src/data/about.ts']) {
          const n = (readFileSync(join(root, file), 'utf8').match(/placeholder:\s*true/g) ?? []).length;
          if (n) placeholders.push(`${file} (${n} item${n > 1 ? 's' : ''})`);
        }
        const portrait = readFileSync(join(root, 'src/components/home/HomeAbout.astro'), 'utf8');
        if (/photoIsPlaceholder = true/.test(portrait)) placeholders.push('portrait photo (src/assets/portrait-placeholder.png)');

        if (placeholders.length) {
          logger.warn(
            `${placeholders.length} placeholder entr${placeholders.length === 1 ? 'y' : 'ies'} still in the site. Replace or delete before launch:\n  - ${placeholders
              .map((p) => p.replaceAll('\\', '/'))
              .join('\n  - ')}`,
          );
        }
      },
    },
  };
}
