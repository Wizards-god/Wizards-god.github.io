// Checks every link in the built site (dist/). It fails on a broken internal
// link, a missing file, a #fragment with nothing to jump to, or a missing
// /resume.pdf. External links are only listed, not fetched, so CI stays fast
// and works offline.
//
// Run it after `astro build`: node scripts/check-links.mjs

import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative, dirname, posix } from 'node:path';
import { fileURLToPath } from 'node:url';

const projectRoot = join(dirname(fileURLToPath(import.meta.url)), '..');
const dist = join(projectRoot, 'dist');
const SITE = 'https://parjanya.me';

if (!existsSync(dist)) {
  console.error('dist/ not found. Run `npm run build` first.');
  process.exit(1);
}

/** Every file under `directory`, however deep. */
function allFilesIn(directory) {
  return readdirSync(directory).flatMap((name) => {
    const path = join(directory, name);
    return statSync(path).isDirectory() ? allFilesIn(path) : [path];
  });
}

const htmlFiles = allFilesIn(dist).filter((file) => file.endsWith('.html'));

/** The file a static host would serve for this path, or null if there isn't one. */
function fileForPath(pathname) {
  const path = decodeURIComponent(pathname.split('?')[0]);
  const candidates = path.endsWith('/')
    ? [join(dist, path, 'index.html')]
    : [join(dist, path), join(dist, path, 'index.html'), join(dist, `${path}.html`)];
  return candidates.find((candidate) => existsSync(candidate) && statSync(candidate).isFile()) ?? null;
}

/** Turns a link on `pagePath` into a full path from the root of the site. */
function sitePath(link, pagePath) {
  if (link === '') return pagePath; // a bare "#fragment" on the same page
  if (link.startsWith('/')) return link;
  return posix.join(posix.dirname(pagePath + 'x'), link); // relative to the page's folder
}

// The ids in each page, for checking #fragments.
const idsByFile = new Map();
function idsIn(file) {
  if (!idsByFile.has(file)) {
    const html = readFileSync(file, 'utf8');
    idsByFile.set(file, new Set([...html.matchAll(/\sid=["']([^"']+)["']/g)].map((match) => match[1])));
  }
  return idsByFile.get(file);
}

const problems = [];
const externalLinks = new Set();
let checkedCount = 0;

for (const file of htmlFiles) {
  // Code samples and inline scripts or styles can contain things that look like links.
  const html = readFileSync(file, 'utf8')
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<pre[\s\S]*?<\/pre>/gi, '');
  const pagePath = '/' + relative(dist, file).replaceAll('\\', '/').replace(/index\.html$/, '');

  const links = [];
  for (const match of html.matchAll(/\s(href|src)=["']([^"']+)["']/g)) links.push(match[2]);
  for (const match of html.matchAll(/\ssrcset=["']([^"']+)["']/g)) {
    match[1].split(',').forEach((candidate) => links.push(candidate.trim().split(/\s+/)[0]));
  }

  for (let link of links) {
    link = link.replaceAll('&amp;', '&');
    if (!link || /^(mailto:|tel:|data:|javascript:)/i.test(link)) continue;
    if (link.startsWith(SITE)) link = link.slice(SITE.length) || '/';
    if (/^https?:\/\//i.test(link) || link.startsWith('//')) {
      externalLinks.add(link);
      continue;
    }

    checkedCount++;
    const [pathPart, fragment] = link.split('#');
    const target = fileForPath(sitePath(pathPart, pagePath));
    if (!target) {
      problems.push(`${relative(dist, file)} → ${link} (not found)`);
      continue;
    }
    if (fragment && target.endsWith('.html') && !idsIn(target).has(decodeURIComponent(fragment))) {
      problems.push(`${relative(dist, file)} → ${link} (no element with id="${fragment}")`);
    }
  }
}

// The README and older links point at /resume.pdf, so it has to exist.
if (!existsSync(join(dist, 'resume.pdf'))) problems.push('dist/resume.pdf is missing (public/resume.pdf)');
if (!existsSync(join(dist, 'CNAME'))) problems.push('dist/CNAME is missing (public/CNAME)');

console.log(`[links] ${htmlFiles.length} pages, ${checkedCount} internal references checked, ${externalLinks.size} external links not fetched.`);
if (problems.length) {
  console.error(`[links] ${problems.length} problem(s):\n  - ${problems.join('\n  - ')}`);
  process.exit(1);
}
console.log('[links] OK');
