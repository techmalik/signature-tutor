#!/usr/bin/env node
// Extracts cursive letterform skeletons from the three Hershey/EMS SVG fonts
// into src/glyph-data.js — a plain-JS data file consumed by src/engine-core.js.
//
// Run at dev time only (`node tools/extract-glyphs.mjs`); the output is
// committed. Re-run and commit the result whenever tools/fonts/*.svg change.
//
// Font sources (SVG font format, one <glyph> per character):
//   EMSAllure.svg       — EMS Allure, derivative of Allura. SIL OFL.
//   HersheyScript1.svg  — Hershey Script 1-stroke. Public domain (US federal, NBS/AMES).
//   HersheyScriptMed.svg— Hershey Script medium. Public domain.
// All from https://cdn.jsdelivr.net/npm/hersheytext@2.0.0/svg_fonts/
//
// Each glyph's path data is absolute-coordinate M/L/C only (verified against
// the actual font files — no other path commands occur within the charset we
// extract). Coordinates are Y-up, baseline 0, units-per-em 1000. We flip Y so
// ascenders end up negative (canvas/SVG "up is negative" convention used by
// the rest of the engine), divide by unitsPerEm, and round to 4 decimals.
//
// Subpath order/direction in these fonts is plotter-optimized, not writing
// order (e.g. EMSAllure's "a" starts at its right edge) — we normalize by
// reversing any subpath whose first point sits well to the right of its last.

import fs from 'node:fs';
import path from 'node:path';
import https from 'node:https';
import http from 'node:http';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');
const FONTS_DIR = path.join(__dirname, 'fonts');
const OUT_PATH = path.join(ROOT, 'src', 'glyph-data.js');

const FONTS = [
  { key: 'allure', file: 'EMSAllure.svg', url: 'https://cdn.jsdelivr.net/npm/hersheytext@2.0.0/svg_fonts/EMSAllure.svg' },
  { key: 'script1', file: 'HersheyScript1.svg', url: 'https://cdn.jsdelivr.net/npm/hersheytext@2.0.0/svg_fonts/HersheyScript1.svg' },
  { key: 'scriptmed', file: 'HersheyScriptMed.svg', url: 'https://cdn.jsdelivr.net/npm/hersheytext@2.0.0/svg_fonts/HersheyScriptMed.svg' },
];

// Keep only the characters the engine ever renders.
const CHARSET = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789 .'-".split('');

const CUBIC_STEPS = 8; // sample t = 1/8 .. 8/8 per cubic segment

function fetchUrl(url) {
  return new Promise((resolve, reject) => {
    const proxy = process.env.HTTPS_PROXY || process.env.https_proxy;
    const u = new URL(url);
    if (proxy) {
      const p = new URL(proxy);
      const req = http.request({ host: p.hostname, port: p.port, method: 'CONNECT', path: `${u.hostname}:443` });
      req.on('connect', (res, socket) => {
        if (res.statusCode !== 200) { reject(new Error(`proxy CONNECT failed: ${res.statusCode}`)); return; }
        const opts = { host: u.hostname, path: u.pathname + u.search, socket, agent: false, headers: { Host: u.hostname } };
        https.get(opts, handleResponse(resolve, reject, url)).on('error', reject);
      });
      req.on('error', reject);
      req.end();
    } else {
      https.get(url, handleResponse(resolve, reject, url)).on('error', reject);
    }
  });
}
function handleResponse(resolve, reject, url) {
  return (res) => {
    if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
      fetchUrl(res.headers.location).then(resolve, reject);
      return;
    }
    if (res.statusCode !== 200) { reject(new Error(`GET ${url} → ${res.statusCode}`)); return; }
    const chunks = [];
    res.on('data', (c) => chunks.push(c));
    res.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    res.on('error', reject);
  };
}

async function ensureFont(font) {
  const dest = path.join(FONTS_DIR, font.file);
  if (fs.existsSync(dest)) return fs.readFileSync(dest, 'utf8');
  console.log(`extract-glyphs: fetching ${font.url}`);
  const body = await fetchUrl(font.url);
  fs.mkdirSync(FONTS_DIR, { recursive: true });
  fs.writeFileSync(dest, body);
  return body;
}

// ---- XML entity decoding (named + numeric refs) ----
const NAMED_ENTITIES = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'" };
function decodeEntities(s) {
  return s.replace(/&(#x?[0-9a-fA-F]+|[a-zA-Z]+);/g, (m, body) => {
    if (body[0] === '#') {
      const code = body[1] === 'x' || body[1] === 'X' ? parseInt(body.slice(2), 16) : parseInt(body.slice(1), 10);
      return String.fromCodePoint(code);
    }
    return NAMED_ENTITIES[body] !== undefined ? NAMED_ENTITIES[body] : m;
  });
}

// ---- <font-face> + default horiz-adv-x ----
function parseFontFace(svg) {
  const m = svg.match(/<font-face\b([^>]*)\/?>/);
  if (!m) throw new Error('extract-glyphs: no <font-face> found');
  const attrs = parseAttrs(m[1]);
  const unitsPerEm = parseFloat(attrs['units-per-em']);
  if (!unitsPerEm) throw new Error('extract-glyphs: missing units-per-em');
  return {
    unitsPerEm,
    ascent: parseFloat(attrs['ascent']),
    descent: parseFloat(attrs['descent']),
    capHeight: parseFloat(attrs['cap-height']),
    xHeight: parseFloat(attrs['x-height']),
  };
}
function parseDefaultAdvance(svg) {
  const m = svg.match(/<font\s+id="[^"]*"\s+horiz-adv-x="([^"]*)"/);
  return m ? parseFloat(m[1]) : 0;
}

function parseAttrs(attrStr) {
  const out = {};
  const re = /([a-zA-Z-]+)="([^"]*)"/g;
  let m;
  while ((m = re.exec(attrStr))) out[m[1]] = decodeEntities(m[2]);
  return out;
}

// ---- <glyph> extraction (regex-based; attribute order not assumed) ----
function extractGlyphs(svg) {
  const glyphs = [];
  const re = /<glyph\b([^>]*?)\/?>/g;
  let m;
  while ((m = re.exec(svg))) {
    const attrs = parseAttrs(m[1]);
    if (attrs.unicode === undefined) continue; // e.g. <missing-glyph>, already excluded by tag name anyway
    glyphs.push(attrs);
  }
  return glyphs;
}

// ---- Path data → array of polyline subpaths, each an array of [x,y] (raw font units) ----
function parsePathToSubpaths(d) {
  const tokens = d.match(/[MLCmlc]|-?[0-9]*\.?[0-9]+(?:[eE][-+]?[0-9]+)?/g) || [];
  const subpaths = [];
  let cur = null;
  let pen = { x: 0, y: 0 };
  let i = 0;
  function readNums(n) {
    const out = [];
    for (let k = 0; k < n; k++) {
      if (i >= tokens.length || /^[MLCmlc]$/.test(tokens[i])) throw new Error(`extract-glyphs: malformed path near token ${i}: ${d}`);
      out.push(parseFloat(tokens[i++]));
    }
    return out;
  }
  while (i < tokens.length) {
    const cmd = tokens[i++];
    if (cmd === 'M' || cmd === 'm') {
      const [x, y] = readNums(2);
      pen = cmd === 'm' && cur ? { x: pen.x + x, y: pen.y + y } : { x, y };
      cur = [{ x: pen.x, y: pen.y }];
      subpaths.push(cur);
    } else if (cmd === 'L' || cmd === 'l') {
      const [x, y] = readNums(2);
      pen = cmd === 'l' ? { x: pen.x + x, y: pen.y + y } : { x, y };
      if (!cur) { cur = [{ x: pen.x, y: pen.y }]; subpaths.push(cur); } else cur.push({ x: pen.x, y: pen.y });
    } else if (cmd === 'C' || cmd === 'c') {
      const [x1, y1, x2, y2, x3, y3] = readNums(6);
      const p0 = pen;
      const c1 = cmd === 'c' ? { x: pen.x + x1, y: pen.y + y1 } : { x: x1, y: y1 };
      const c2 = cmd === 'c' ? { x: pen.x + x2, y: pen.y + y2 } : { x: x2, y: y2 };
      const p3 = cmd === 'c' ? { x: pen.x + x3, y: pen.y + y3 } : { x: x3, y: y3 };
      for (let k = 1; k <= CUBIC_STEPS; k++) {
        const t = k / CUBIC_STEPS;
        const mt = 1 - t;
        const x = mt * mt * mt * p0.x + 3 * mt * mt * t * c1.x + 3 * mt * t * t * c2.x + t * t * t * p3.x;
        const y = mt * mt * mt * p0.y + 3 * mt * mt * t * c1.y + 3 * mt * t * t * c2.y + t * t * t * p3.y;
        cur.push({ x, y });
      }
      pen = p3;
    } else {
      throw new Error(`extract-glyphs: unsupported path command "${cmd}" in "${d}"`);
    }
  }
  return subpaths.filter((sp) => sp.length >= 2);
}

function round4(n) {
  return Math.round(n * 10000) / 10000;
}
function normalizePt(pt, unitsPerEm) {
  return [round4(pt.x / unitsPerEm), round4(-pt.y / unitsPerEm)];
}
function arcLength(pts) {
  let L = 0;
  for (let i = 1; i < pts.length; i++) L += Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]);
  return L;
}
function bbox(pts) {
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
  for (const [x, y] of pts) { if (x < minX) minX = x; if (x > maxX) maxX = x; if (y < minY) minY = y; if (y > maxY) maxY = y; }
  return { minX, maxX, minY, maxY, w: maxX - minX, h: maxY - minY, cx: (minX + maxX) / 2, cy: (minY + maxY) / 2 };
}
function unitTangent(a, b) {
  const dx = b[0] - a[0], dy = b[1] - a[1];
  const len = Math.hypot(dx, dy);
  return len < 1e-6 ? [1, 0] : [round4(dx / len), round4(dy / len)];
}

function buildGlyph(attrs, unitsPerEm, defaultAdv) {
  const adv = round4((attrs['horiz-adv-x'] !== undefined ? parseFloat(attrs['horiz-adv-x']) : defaultAdv) / unitsPerEm);
  if (attrs.d === undefined) return { adv, main: [], extras: [], entry: [0, 0], exit: [0, 0], entryDir: [1, 0], exitDir: [1, 0] };

  const rawSubpaths = parsePathToSubpaths(attrs.d);
  let subpaths = rawSubpaths.map((sp) => sp.map((pt) => normalizePt(pt, unitsPerEm)));

  // Hershey/EMS glyphs are digitized as several subpaths per letter: some
  // are genuine separate marks (dots on i/j, crossbars on t/f, the second
  // diagonal of an x), but most — especially in the "medium"-weight fonts,
  // which double every stroke to simulate nib width, and multi-hump
  // letters like m/w — are just sequential pieces of the SAME continuous
  // pen stroke the font's digitizer had to lift and restart partway
  // through. Pulling every non-dot/non-cross subpath out as its own
  // "extra" (as an earlier version of this script did) scattered those
  // pieces into separately-jittered strokes and visibly broke letterforms
  // with 3+ subpaths. Instead: classify dot/cross by their own geometry
  // first, then concatenate everything else, in the document's original
  // stroke order, into one continuous main polyline — matching how the
  // font's own digitizer intended the pen to move.
  const dotCrossExtras = [];
  const mainSubpaths = [];
  for (const pts of subpaths) {
    const bb = bbox(pts);
    const diag = Math.hypot(bb.w, bb.h);
    if (diag < 0.08) dotCrossExtras.push({ kind: 'dot', pts });
    else if (bb.w > 2 * bb.h && bb.cy < -0.25) dotCrossExtras.push({ kind: 'cross', pts });
    else mainSubpaths.push(pts);
  }
  let main = mainSubpaths.length ? mainSubpaths.reduce((acc, sp) => acc.concat(sp)) : subpaths[0];
  const extras = dotCrossExtras;

  // Plotter output orders/directs subpaths arbitrarily; normalize to
  // left-to-right writing order.
  if (main[0][0] > main[main.length - 1][0] + 0.05) main = main.slice().reverse();

  const entry = main[0];
  const exit = main[main.length - 1];
  const entryDir = unitTangent(main[0], main[Math.min(1, main.length - 1)]);
  const exitDir = unitTangent(main[Math.max(0, main.length - 2)], main[main.length - 1]);

  return { adv, main, extras, entry, exit, entryDir, exitDir };
}

async function buildFont(font) {
  const svg = await ensureFont(font);
  const face = parseFontFace(svg);
  const defaultAdv = parseDefaultAdvance(svg);
  const glyphAttrs = extractGlyphs(svg);
  const byChar = new Map();
  for (const attrs of glyphAttrs) {
    if (attrs.unicode.length !== 1 || !CHARSET.includes(attrs.unicode)) continue;
    byChar.set(attrs.unicode, attrs); // last one wins if dupes (shouldn't happen)
  }

  const missing = CHARSET.filter((ch) => !byChar.has(ch));
  if (missing.length) throw new Error(`extract-glyphs: ${font.key} missing glyphs: ${JSON.stringify(missing)}`);

  const glyphs = {};
  for (const ch of CHARSET) {
    const g = buildGlyph(byChar.get(ch), face.unitsPerEm, defaultAdv);
    if (ch !== ' ' && g.main.length < 2) throw new Error(`extract-glyphs: ${font.key} glyph "${ch}" has degenerate main (${g.main.length} pts)`);
    for (const [x, y] of g.main) if (!Number.isFinite(x) || !Number.isFinite(y)) throw new Error(`extract-glyphs: NaN/Inf in ${font.key} "${ch}"`);
    glyphs[ch] = g;
  }

  const norm = (v) => round4(-v / face.unitsPerEm);
  return {
    meta: { xh: norm(face.xHeight), cap: norm(face.capHeight), asc: norm(face.ascent), desc: norm(face.descent) },
    glyphs,
  };
}

async function main() {
  const out = {};
  for (const font of FONTS) {
    console.log(`extract-glyphs: processing ${font.key} (${font.file})`);
    out[font.key] = await buildFont(font);
  }

  const header = `// AUTO-GENERATED by tools/extract-glyphs.mjs — do not hand-edit.
// Re-run \`node tools/extract-glyphs.mjs\` after changing tools/fonts/*.svg.
//
// Cursive letterform skeletons extracted from three SVG fonts:
//   allure     — EMS Allure (derivative of Allura). SIL Open Font License
//                (https://scripts.sil.org/OFL). (c) Sheldon B. Michaels /
//                Rob Leuschke; SVG conversion by Windell H. Oskay.
//   script1    — Hershey Script 1-stroke. Public domain (US federal
//                government work, originally produced at NBS by A. V. Hershey).
//   scriptmed  — Hershey Script medium. Public domain, same origin.
//
// Coordinate convention: baseline y=0, one em unit wide, Y-DOWN (ascenders
// are negative, descenders positive) — the opposite of the raw SVG font
// data, which is Y-up; extraction flips this. main/extras points are
// [x,y] pairs already divided by unitsPerEm and rounded to 4 decimals.
`;
  const body = `window.SIG_GLYPHS = ${JSON.stringify(out)};\n`;
  const src = header + body;
  fs.mkdirSync(path.dirname(OUT_PATH), { recursive: true });
  fs.writeFileSync(OUT_PATH, src);

  const kb = Buffer.byteLength(src, 'utf8') / 1024;
  console.log(`extract-glyphs: wrote ${path.relative(ROOT, OUT_PATH)} (${kb.toFixed(1)} KB)`);
  if (kb > 150) console.warn(`extract-glyphs: WARNING — over the 150 KB budget (${kb.toFixed(1)} KB)`);
}

main().catch((err) => { console.error(err); process.exit(1); });
