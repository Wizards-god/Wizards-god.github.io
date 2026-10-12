// Prints the HTML resume to public/resume.pdf with headless Chrome or Edge.
// The resume route (src/pages/resume-print/) only exists when RESUME_PRINT=1,
// so this does its own build into a temporary folder, prints /resume-print/
// and cleans up after itself. Run it after changing anything on the resume:
//
//   npm run resume:pdf
//
// Set CHROME_PATH if your browser is installed somewhere unusual.

import { execFile, execFileSync } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, rmSync, statSync } from 'node:fs';
import { createServer } from 'node:http';
import { tmpdir } from 'node:os';
import { join, dirname, extname, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';

const projectRoot = join(dirname(fileURLToPath(import.meta.url)), '..');
const outputFile = join(projectRoot, 'public', 'resume.pdf');
const PORT = 4399;

const browserPaths = [
  process.env.CHROME_PATH,
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  'C:/Program Files/Microsoft/Edge/Application/msedge.exe',
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge',
  '/usr/bin/google-chrome',
  '/usr/bin/chromium',
  '/usr/bin/chromium-browser',
].filter(Boolean);

const browser = browserPaths.find((path) => existsSync(path));
if (!browser) {
  console.error('[resume] No Chrome/Edge found. Set CHROME_PATH to a Chromium-based browser.');
  process.exit(1);
}

// Build the site, private print route included, into a scratch folder inside
// the project. (Astro moves files around with rename, which can't cross drives.)
const buildDir = join(projectRoot, 'node_modules', '.cache', 'resume-print');
rmSync(buildDir, { recursive: true, force: true });
execFileSync(process.execPath, [join(projectRoot, 'node_modules/astro/bin/astro.mjs'), 'build', '--outDir', buildDir], {
  cwd: projectRoot,
  env: { ...process.env, RESUME_PRINT: '1' },
  stdio: 'ignore',
});
if (!existsSync(join(buildDir, 'resume-print', 'index.html'))) {
  console.error('[resume] the print build did not produce /resume-print/.');
  process.exit(1);
}

// Serve that build with a tiny static server of its own, so it doesn't
// depend on a dev or preview server being up.
const CONTENT_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css',
  '.js': 'text/javascript',
  '.json': 'application/json',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.webp': 'image/webp',
  '.avif': 'image/avif',
  '.woff2': 'font/woff2',
  '.pdf': 'application/pdf',
  '.xml': 'application/xml',
  '.txt': 'text/plain',
};
const server = createServer((request, response) => {
  const pathname = decodeURIComponent(new URL(request.url ?? '/', 'http://x').pathname);
  const relativePath = normalize(pathname).replace(/^[/\\]+/, '');
  const candidates = [join(buildDir, relativePath), join(buildDir, relativePath, 'index.html'), join(buildDir, `${relativePath}.html`)];
  // startsWith(buildDir) keeps requests like /../../secret from leaving the folder.
  const file = candidates.find((candidate) => candidate.startsWith(buildDir) && existsSync(candidate) && statSync(candidate).isFile());
  if (!file) {
    response.writeHead(404).end('not found');
    return;
  }
  response.writeHead(200, { 'Content-Type': CONTENT_TYPES[extname(file)] ?? 'application/octet-stream' });
  response.end(readFileSync(file));
});
await new Promise((resolve) => server.listen(PORT, '127.0.0.1', resolve));

const browserProfile = mkdtempSync(join(tmpdir(), 'resume-pdf-'));
try {
  const url = `http://127.0.0.1:${PORT}/resume-print/?intro=0`;
  // This has to be async: a sync call would block the very server that's serving the page.
  await promisify(execFile)(
    browser,
    [
      '--headless=new',
      `--user-data-dir=${browserProfile}`,
      '--disable-gpu',
      '--no-first-run',
      '--no-pdf-header-footer',
      '--run-all-compositor-stages-before-draw',
      '--virtual-time-budget=4000',
      `--print-to-pdf=${outputFile}`,
      url,
    ],
    { timeout: 60000 },
  );
  console.log(`[resume] wrote public/resume.pdf (${Math.round(statSync(outputFile).size / 1024)} KB) with ${browser}`);
} finally {
  server.close();
  rmSync(browserProfile, { recursive: true, force: true });
  rmSync(buildDir, { recursive: true, force: true });
}
