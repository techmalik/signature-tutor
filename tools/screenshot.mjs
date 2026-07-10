#!/usr/bin/env node
// Playwright visual verification for SignatureTutor.html.
//
// Serves the repo over http (file:// blocks localStorage/fetch in some
// engines) at 127.0.0.1 (routing quirks were observed with `localhost` in
// this environment), seeds localStorage['sigtutor:v2'] per test name/style,
// screenshots the StyleScreen grid + PreviewScreen hero, and asserts zero
// console/page errors. Also does a byte-for-byte file:// smoke test.
//
// Run with: node --input-type=module tools/screenshot.mjs, or point this
// environment's global playwright install at it, e.g.:
//   NODE_PATH=/opt/node22/lib/node_modules node tools/screenshot.mjs

import path from 'node:path';
import http from 'node:http';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');
const OUT = path.join(__dirname, 'screens');
fs.mkdirSync(OUT, { recursive: true });

// This sandbox's outbound network doesn't let Chromium fetch third-party
// CDN scripts directly (works fine for real users; only a test-harness
// workaround). tools/cdn-cache/ holds pre-fetched copies fulfilled via
// page.route() below — see the environment notes in the task briefing.
const CDN_CACHE = path.join(__dirname, 'cdn-cache');
const CDN_MAP = {
  'https://unpkg.com/react@18.3.1/umd/react.development.js': 'react.js',
  'https://unpkg.com/react-dom@18.3.1/umd/react-dom.development.js': 'react-dom.js',
  'https://unpkg.com/@babel/standalone@7.29.0/babel.min.js': 'babel.min.js',
};
async function routeCdn(page) {
  for (const [url, file] of Object.entries(CDN_MAP)) {
    await page.route(url, (route) => route.fulfill({ path: path.join(CDN_CACHE, file), contentType: 'text/javascript' }));
  }
  // Google Fonts CSS is decorative; let it fail fast instead of hanging.
  await page.route('https://fonts.googleapis.com/**', (route) => route.abort());
}

const TEST_NAMES = ['Alex Morgan', 'Al', "J. K. Rowling-Smythe", 'Alexandra Konstantinopoulos'];
const STYLES = ['flow', 'executive', 'flourished', 'scrawl', 'minimal', 'monogram'];

function serve(root, port) {
  const mime = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml' };
  const server = http.createServer((req, res) => {
    let p = decodeURIComponent(req.url.split('?')[0]);
    if (p === '/') p = '/SignatureTutor.html';
    const fp = path.join(root, p);
    fs.readFile(fp, (err, data) => {
      if (err) { res.writeHead(404); res.end('not found'); return; }
      res.writeHead(200, { 'Content-Type': mime[path.extname(fp)] || 'application/octet-stream' });
      res.end(data);
    });
  });
  return new Promise((resolve) => server.listen(port, '127.0.0.1', () => resolve(server)));
}

async function main() {
  const port = 8123;
  const server = await serve(ROOT, port);
  const browser = await chromium.launch();
  let totalErrors = 0;

  try {
    for (const name of TEST_NAMES) {
      for (const style of STYLES) {
        const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
        await routeCdn(page);
        const errors = [];
        page.on('pageerror', (e) => errors.push(String(e)));
        // Google Fonts is deliberately aborted above (decorative, offline in
        // this sandbox) — its resource-load failure is expected, not a bug.
        page.on('console', (msg) => { if (msg.type() === 'error' && !msg.text().includes('Failed to load resource')) errors.push(msg.text()); });

        await page.goto(`http://127.0.0.1:${port}/SignatureTutor.html`);
        await page.evaluate(({ name, style }) => {
          localStorage.setItem('sigtutor:v2', JSON.stringify({ screen: 'style', name, style, opts: {}, variant: 0 }));
        }, { name, style });
        await page.reload();
        await page.waitForSelector('.style-card', { timeout: 5000 });
        await page.waitForTimeout(150);

        const slug = name.replace(/[^a-z0-9]+/gi, '-').toLowerCase();
        await page.screenshot({ path: path.join(OUT, `${slug}__${style}__style-grid.png`) });

        // Jump straight to the preview screen for the hero shot.
        await page.evaluate(({ name, style }) => {
          localStorage.setItem('sigtutor:v2', JSON.stringify({ screen: 'preview', name, style, opts: {}, variant: 0 }));
        }, { name, style });
        await page.reload();
        await page.waitForSelector('.display', { timeout: 5000 });
        await page.waitForTimeout(4200); // let the draw-in animation settle (max duration is 3800ms)
        await page.screenshot({ path: path.join(OUT, `${slug}__${style}__preview-hero.png`) });

        if (errors.length) {
          console.error(`ERRORS for ${name} / ${style}:`, errors);
          totalErrors += errors.length;
        } else {
          console.log(`ok   - ${name} / ${style}`);
        }
        await page.close();
      }
    }

    // Determinism across fresh loads: svg.innerHTML string-equal.
    {
      const page1 = await browser.newPage();
      await routeCdn(page1);
      await page1.goto(`http://127.0.0.1:${port}/SignatureTutor.html`);
      await page1.evaluate(() => localStorage.setItem('sigtutor:v2', JSON.stringify({ screen: 'preview', name: 'Alex Morgan', style: 'flow', opts: {}, variant: 0 })));
      await page1.reload();
      await page1.waitForSelector('svg');
      await page1.waitForTimeout(4200);
      const html1 = await page1.$eval('svg', (el) => el.innerHTML);
      await page1.close();

      const page2 = await browser.newPage();
      await routeCdn(page2);
      await page2.goto(`http://127.0.0.1:${port}/SignatureTutor.html`);
      await page2.evaluate(() => localStorage.setItem('sigtutor:v2', JSON.stringify({ screen: 'preview', name: 'Alex Morgan', style: 'flow', opts: {}, variant: 0 })));
      await page2.reload();
      await page2.waitForSelector('svg');
      await page2.waitForTimeout(4200);
      const html2 = await page2.$eval('svg', (el) => el.innerHTML);
      await page2.close();

      console.log(html1 === html2 ? 'ok   - determinism across fresh loads (svg.innerHTML equal)' : 'FAIL - svg.innerHTML differs across fresh loads');
      if (html1 !== html2) totalErrors++;
    }

    // file:// smoke test.
    {
      const page = await browser.newPage();
      await routeCdn(page);
      const errors = [];
      page.on('pageerror', (e) => errors.push(String(e)));
      await page.goto(`file://${path.join(ROOT, 'SignatureTutor.html')}`);
      await page.waitForSelector('#root', { timeout: 5000 });
      await page.waitForTimeout(500);
      const hasContent = await page.evaluate(() => document.getElementById('root').children.length > 0);
      console.log(hasContent && !errors.length ? 'ok   - file:// smoke test (root rendered, no errors)' : `FAIL - file:// smoke test (rendered=${hasContent}, errors=${JSON.stringify(errors)})`);
      if (!hasContent || errors.length) totalErrors++;
      await page.close();
    }
  } finally {
    await browser.close();
    server.close();
  }

  console.log(totalErrors ? `\n${totalErrors} problem(s) found` : '\nAll screenshots captured, zero console/page errors.');
  process.exit(totalErrors ? 1 : 0);
}

main();
