// Link checker for the built site (dist/). Fails on any broken internal link,
// missing asset, missing #fragment target, or a missing /resume.pdf.
// External links are listed but not fetched (keeps CI fast and offline-safe).
//
// Run after `astro build`: node scripts/check-links.mjs

import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative, dirname, posix } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const dist = join(root, 'dist');
const SITE = 'https://parjanya.me';

if (!existsSync(dist)) {
  console.error('dist/ not found. Run `npm run build` first.');
  process.exit(1);
}

function walk(dir) {
  return readdirSync(dir).flatMap((name) => {
    const p = join(dir, name);
    return statSync(p).isDirectory() ? walk(p) : [p];
  });
}

const files = walk(dist);
const htmlFiles = files.filter((f) => f.endsWith('.html'));

/** Map a site path to the file that would serve it on a static host. */
function resolve(pathname) {
  const clean = decodeURIComponent(pathname.split('?')[0]);
  const candidates = clean.endsWith('/')
    ? [join(dist, clean, 'index.html')]
    : [join(dist, clean), join(dist, clean, 'index.html'), join(dist, `${clean}.html`)];
  return candidates.find((c) => existsSync(c) && statSync(c).isFile()) ?? null;
}

const idCache = new Map();
function idsIn(file) {
  if (!idCache.has(file)) {
    const html = readFileSync(file, 'utf8');
    const ids = new Set([...html.matchAll(/\sid=["']([^"']+)["']/g)].map((m) => m[1]));
    idCache.set(file, ids);
  }
  return idCache.get(file);
}

const problems = [];
const external = new Set();
let checked = 0;

for (const file of htmlFiles) {
  const html = readFileSync(file, 'utf8')
    // Ignore code samples and inline scripts/styles.
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<pre[\s\S]*?<\/pre>/gi, '');
  const pagePath = '/' + relative(dist, file).replaceAll('\\', '/').replace(/index\.html$/, '');

  const refs = [];
  for (const m of html.matchAll(/\s(href|src)=["']([^"']+)["']/g)) refs.push(m[2]);
  for (const m of html.matchAll(/\ssrcset=["']([^"']+)["']/g)) {
    m[1].split(',').forEach((part) => refs.push(part.trim().split(/\s+/)[0]));
  }

  for (let ref of refs) {
    ref = ref.replaceAll('&amp;', '&');
    if (!ref || /^(mailto:|tel:|data:|javascript:)/i.test(ref)) continue;
    if (ref.startsWith(SITE)) ref = ref.slice(SITE.length) || '/';
    if (/^https?:\/\//i.test(ref) || ref.startsWith('//')) {
      external.add(ref);
      continue;
    }
    checked++;
    const [pathPart, hash] = ref.split('#');
    const abs = pathPart === '' ? pagePath : pathPart.startsWith('/') ? pathPart : posix.join(posix.dirname(pagePath + 'x'), pathPart);
    const target = resolve(abs);
    if (!target) {
      problems.push(`${relative(dist, file)} → ${ref} (not found)`);
      continue;
    }
    if (hash && target.endsWith('.html') && !idsIn(target).has(decodeURIComponent(hash))) {
      problems.push(`${relative(dist, file)} → ${ref} (no element with id="${hash}")`);
    }
  }
}

// The resume must always resolve: it is linked from the header on every page.
if (!existsSync(join(dist, 'resume.pdf'))) problems.push('dist/resume.pdf is missing (public/resume.pdf)');
if (!existsSync(join(dist, 'CNAME'))) problems.push('dist/CNAME is missing (public/CNAME)');

console.log(`[links] ${htmlFiles.length} pages, ${checked} internal references checked, ${external.size} external links not fetched.`);
if (problems.length) {
  console.error(`[links] ${problems.length} problem(s):\n  - ${problems.join('\n  - ')}`);
  process.exit(1);
}
console.log('[links] OK');
