// Checks that run at the start of every build and print warnings (anything
// that should actually fail the build lives in the content schemas instead):
//  - the status pill and the "currently" list carry a date; warn once it's over 90 days old
//  - list every entry that's still marked `placeholder: true`

import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const MAX_AGE_DAYS = 90;

/** Every file under `directory`, however deep. */
function allFilesIn(directory) {
  return readdirSync(directory).flatMap((name) => {
    const path = join(directory, name);
    return statSync(path).isDirectory() ? allFilesIn(path) : [path];
  });
}

function daysSince(isoDate) {
  return Math.floor((Date.now() - new Date(isoDate).valueOf()) / 86_400_000);
}

/** @returns {import('astro').AstroIntegration} */
export function siteChecks() {
  return {
    name: 'site-checks',
    hooks: {
      'astro:build:start': ({ logger }) => {
        const projectRoot = fileURLToPath(new URL('../../', import.meta.url));

        // The dates live in TypeScript files, so read them with a regex
        // rather than importing TypeScript from here.
        const datedContent = [
          { file: 'src/data/site.ts', what: 'status pill (site.status.updated)', pattern: /status:\s*{[^}]*updated:\s*'([\d-]+)'/s },
          { file: 'src/data/about.ts', what: '"currently" list (currently.updated)', pattern: /currently\s*=\s*{\s*updated:\s*'([\d-]+)'/s },
        ];
        for (const { file, what, pattern } of datedContent) {
          const match = readFileSync(join(projectRoot, file), 'utf8').match(pattern);
          if (!match) {
            logger.warn(`Could not find the date for the ${what} in ${file}.`);
            continue;
          }
          const age = daysSince(match[1]);
          if (age > MAX_AGE_DAYS) {
            logger.warn(`The ${what} was last updated ${age} days ago (${match[1]}). Refresh it in ${file}.`);
          }
        }

        const placeholders = [];
        for (const file of allFilesIn(join(projectRoot, 'src/content'))) {
          const text = readFileSync(file, 'utf8');
          if (file.endsWith('.yaml') || file.endsWith('.yml')) {
            // A YAML list (like the courses): report each placeholder entry by its id.
            const ids = [...text.matchAll(/-\s+id:\s*(\S+)[\s\S]*?(?=\n-\s+id:|$)/g)]
              .filter((entry) => /placeholder:\s*true/.test(entry[0]))
              .map((entry) => entry[1]);
            ids.forEach((id) => placeholders.push(`${relative(projectRoot, file)}#${id}`));
          } else if (/^---[\s\S]*?placeholder:\s*true[\s\S]*?---/m.test(text)) {
            placeholders.push(relative(projectRoot, file));
          }
        }
        for (const file of ['src/data/about.ts']) {
          const count = (readFileSync(join(projectRoot, file), 'utf8').match(/placeholder:\s*true/g) ?? []).length;
          if (count) placeholders.push(`${file} (${count} item${count > 1 ? 's' : ''})`);
        }
        const homeAbout = readFileSync(join(projectRoot, 'src/components/home/HomeAbout.astro'), 'utf8');
        if (/photoIsPlaceholder = true/.test(homeAbout)) placeholders.push('portrait photo (src/assets/portrait-placeholder.png)');

        if (placeholders.length) {
          const list = placeholders.map((path) => path.replaceAll('\\', '/')).join('\n  - ');
          logger.warn(
            `${placeholders.length} placeholder entr${placeholders.length === 1 ? 'y' : 'ies'} still in the site. Replace or delete before launch:\n  - ${list}`,
          );
        }
      },
    },
  };
}
