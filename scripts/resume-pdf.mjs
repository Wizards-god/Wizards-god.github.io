// Prints the HTML resume (/resume) to public/resume.pdf with headless Chrome
// or Edge, so the PDF always matches the page. Run after editing resume content:
//
//   npm run build && npm run resume:pdf && npm run build
//
// Set CHROME_PATH if your browser lives somewhere unusual.

import { execFile } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { promisify } from 'node:util';
import { createServer } from 'node:http';
import { existsSync, statSync, readFileSync } from 'node:fs';
import { join, dirname, extname, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const out = join(root, 'public', 'resume.pdf');
const PORT = 4399;

const candidates = [
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

const browser = candidates.find((p) => existsSync(p));
if (!browser) {
  console.error('[resume] No Chrome/Edge found. Set CHROME_PATH to a Chromium-based browser.');
  process.exit(1);
}
if (!existsSync(join(root, 'dist', 'resume', 'index.html'))) {
  console.error('[resume] dist/ is missing the resume page. Run `npm run build` first.');
  process.exit(1);
}

// Serve dist/ with a minimal static server (independent of any running dev/preview server).
const dist = join(root, 'dist');
const TYPES = {
  '.html': 'text/html; charset=utf-8', '.css': 'text/css', '.js': 'text/javascript', '.json': 'application/json',
  '.svg': 'image/svg+xml', '.png': 'image/png', '.webp': 'image/webp', '.avif': 'image/avif',
  '.woff2': 'font/woff2', '.pdf': 'application/pdf', '.xml': 'application/xml', '.txt': 'text/plain',
};
const server = createServer((req, res) => {
  const pathname = decodeURIComponent(new URL(req.url ?? '/', 'http://x').pathname);
  const safe = normalize(pathname).replace(/^[/\\]+/, '');
  const candidates = [join(dist, safe), join(dist, safe, 'index.html'), join(dist, `${safe}.html`)];
  const file = candidates.find((c) => c.startsWith(dist) && existsSync(c) && statSync(c).isFile());
  if (!file) {
    res.writeHead(404).end('not found');
    return;
  }
  res.writeHead(200, { 'Content-Type': TYPES[extname(file)] ?? 'application/octet-stream' });
  res.end(readFileSync(file));
});
await new Promise((r) => server.listen(PORT, '127.0.0.1', r));

const profile = mkdtempSync(join(tmpdir(), 'resume-pdf-'));
try {
  const url = `http://127.0.0.1:${PORT}/resume/?intro=0`;
  // Async on purpose: a sync call would block the event loop serving the page.
  await promisify(execFile)(
    browser,
    [
      '--headless=new',
      `--user-data-dir=${profile}`,
      '--disable-gpu',
      '--no-first-run',
      '--no-pdf-header-footer',
      '--run-all-compositor-stages-before-draw',
      '--virtual-time-budget=4000',
      `--print-to-pdf=${out}`,
      url,
    ],
    { timeout: 60000 },
  );
  console.log(`[resume] wrote public/resume.pdf (${Math.round(statSync(out).size / 1024)} KB) with ${browser}`);
} finally {
  server.close();
  rmSync(profile, { recursive: true, force: true });
}
