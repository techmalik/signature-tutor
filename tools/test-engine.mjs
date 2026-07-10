#!/usr/bin/env node
// Bare-node checks for src/engine-core.js — determinism, glyph coverage,
// numerical sanity, and slider purity. No screenshots here (see
// tools/screenshot.mjs for the visual pass); this only needs Node.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');
const require = createRequire(import.meta.url);

global.window = {};
require(path.join(ROOT, 'src/vendor/perfect-freehand.js'));
require(path.join(ROOT, 'src/glyph-data.js'));
const { buildSignature, SIG_STYLES } = require(path.join(ROOT, 'src/engine-core.js'));

let failures = 0;
function check(name, cond) {
  if (cond) { console.log(`  ok  - ${name}`); }
  else { console.log(`FAIL  - ${name}`); failures++; }
}

// 1. Determinism: identical inputs → byte-identical JSON output.
{
  const a = buildSignature('J. K. Rowling-Smythe', 'flow', {});
  const b = buildSignature('J. K. Rowling-Smythe', 'flow', {});
  check('determinism: identical calls produce identical JSON', JSON.stringify(a) === JSON.stringify(b));
}

// 2. Variants differ.
{
  const a = buildSignature('Alex Morgan', 'flow', { variant: 0 });
  const b = buildSignature('Alex Morgan', 'flow', { variant: 1 });
  check('variant: different variants produce different output', JSON.stringify(a) !== JSON.stringify(b));
}

// 3. Glyph coverage — every char of A-Za-z0-9 .'- present in all 3 fonts, no NaN, main >= 2 pts.
{
  const CHARSET = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789 .'-".split('');
  const G = window.SIG_GLYPHS;
  for (const font of ['allure', 'script1', 'scriptmed']) {
    let ok = true;
    for (const ch of CHARSET) {
      const g = G[font] && G[font].glyphs[ch];
      if (!g) { ok = false; continue; }
      if (ch !== ' ' && g.main.length < 2) ok = false;
      for (const [x, y] of g.main) if (!Number.isFinite(x) || !Number.isFinite(y)) ok = false;
    }
    check(`glyph coverage: ${font} has all charset glyphs, no NaN, main>=2pts`, ok);
  }
}

// 4. Cross-name/style sanity: no NaN, all points inside viewBox, length matches recomputed sum.
{
  const names = ['Al', 'J. K. Rowling-Smythe', 'Alexandra Konstantinopoulos'];
  let allOk = true;
  for (const name of names) {
    for (const styleKey of Object.keys(SIG_STYLES)) {
      const r = buildSignature(name, styleKey, {});
      for (const s of r.strokes) {
        for (const [x, y] of s.pts) {
          if (!Number.isFinite(x) || !Number.isFinite(y)) allOk = false;
          if (x < -1 || x > r.width + 1 || y < -1 || y > r.height + 1) allOk = false;
        }
        let recomputed = 0;
        for (let i = 1; i < s.pts.length; i++) {
          recomputed += Math.hypot(s.pts[i][0] - s.pts[i - 1][0], s.pts[i][1] - s.pts[i - 1][1]);
        }
        if (Math.abs(recomputed - s.length) > 0.01) allOk = false;
      }
    }
  }
  check('names x styles: no NaN, all points in viewBox, length matches recomputed sum', allOk);
}

// 5. Slider purity — changing slant only shears (same point count per stroke).
{
  const a = buildSignature('Alex Morgan', 'flow', { slant: 0.1 });
  const b = buildSignature('Alex Morgan', 'flow', { slant: 0.3 });
  let samePointCounts = a.strokes.length === b.strokes.length;
  if (samePointCounts) {
    for (let i = 0; i < a.strokes.length; i++) {
      if (a.strokes[i].pts.length !== b.strokes[i].pts.length) samePointCounts = false;
    }
  }
  check('slider purity: slant changes point positions only, not counts', samePointCounts);
}

// 6. Weight/flourish/legibility sliders also preserve stroke identity (same seed schedule).
{
  const a = buildSignature('Alex Morgan', 'flow', { weight: 0.8 });
  const b = buildSignature('Alex Morgan', 'flow', { weight: 1.6 });
  check('slider purity: weight changes do not alter stroke/point count', a.strokes.length === b.strokes.length &&
    a.strokes.every((s, i) => s.pts.length === b.strokes[i].pts.length));
}

console.log(failures ? `\n${failures} check(s) FAILED` : '\nAll checks passed.');
process.exit(failures ? 1 : 0);
