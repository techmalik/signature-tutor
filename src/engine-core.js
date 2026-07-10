// engine-core.js — deterministic centerline stroke engine.
//
// Replaces the old signature-engine.jsx "generic seeded wiggle" approach.
// Real cursive letterform skeletons (src/glyph-data.js, extracted from
// Hershey/EMS SVG fonts) are laid out per the typed name, chained into
// continuous per-word pen strokes, decorated with lead-ins/tails/underlines,
// optionally degraded toward a scrawl, sheared for slant, fit to the
// viewBox, and finally given variable-width "ink" via perfect-freehand.
//
// Pure JS, no JSX/DOM — must run under bare node (tools/test-engine.mjs
// loads it directly) as well as inside the page as a plain <script>.
//
// DETERMINISM DISCIPLINE (read before touching the pipeline):
// Exactly one RNG stream is ever created per call: `rng = mulberry32(hash(
// name+'|'+styleKey+'|'+variant))`. Immediately after seeding we draw a
// FIXED schedule and never touch the RNG again: `J[i]` is 8 draws for
// every character in the normalized name (unconditionally — spaces get a
// row too, so indices always line up with the original string), then one
// final block `F` of 8 draws for flourish/underline/monogram decisions.
// Every later step reads only from `J`/`F` (by index), never calls `rng()`
// again. This is what makes the sliders (slant/flourish/weight/legibility)
// deform the *same* underlying signature instead of re-rolling it — only
// `variant` (an integer, bumped by the "Shuffle" button) reseeds anything.

(function () {
  'use strict';

  var SIG_GLYPHS = (typeof window !== 'undefined' && window.SIG_GLYPHS) || (typeof global !== 'undefined' && global.SIG_GLYPHS);
  var PerfectFreehand = (typeof window !== 'undefined' && window.PerfectFreehand) || (typeof global !== 'undefined' && global.PerfectFreehand);

  // ---------------------------------------------------------------------
  // RNG (verbatim from the old engine — same hash/mulberry32 contract)
  // ---------------------------------------------------------------------
  function hash(str) {
    var h = 2166136261;
    for (var i = 0; i < str.length; i++) {
      h ^= str.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    return h >>> 0;
  }
  function mulberry32(seed) {
    return function () {
      seed |= 0; seed = seed + 0x6D2B79F5 | 0;
      var t = Math.imul(seed ^ seed >>> 15, 1 | seed);
      t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
      return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };
  }

  // ---------------------------------------------------------------------
  // Vector / geometry helpers ([x,y] tuples throughout)
  // ---------------------------------------------------------------------
  function v(x, y) { return [x, y]; }
  function vsub(a, b) { return [a[0] - b[0], a[1] - b[1]]; }
  function vadd(a, b) { return [a[0] + b[0], a[1] + b[1]]; }
  function vscale(a, s) { return [a[0] * s, a[1] * s]; }
  function vlen(a) { return Math.hypot(a[0], a[1]); }
  function vnorm(a) { var L = vlen(a); return L < 1e-9 ? [1, 0] : [a[0] / L, a[1] / L]; }
  function dist(a, b) { return Math.hypot(a[0] - b[0], a[1] - b[1]); }
  function lerp(a, b, t) { return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]; }
  function rotatePt(p, center, theta) {
    var dx = p[0] - center[0], dy = p[1] - center[1];
    var c = Math.cos(theta), s = Math.sin(theta);
    return [center[0] + dx * c - dy * s, center[1] + dx * s + dy * c];
  }
  function rotateVec(vec, theta) {
    var c = Math.cos(theta), s = Math.sin(theta);
    return [vec[0] * c - vec[1] * s, vec[0] * s + vec[1] * c];
  }
  function deg2rad(d) { return d * Math.PI / 180; }
  function clamp(x, lo, hi) { return Math.max(lo, Math.min(hi, x)); }
  function median(arr) {
    if (!arr.length) return 0;
    var s = arr.slice().sort(function (a, b) { return a - b; });
    var mid = Math.floor(s.length / 2);
    return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
  }
  function cubicPoint(p0, c1, c2, p3, t) {
    var mt = 1 - t;
    var x = mt * mt * mt * p0[0] + 3 * mt * mt * t * c1[0] + 3 * mt * t * t * c2[0] + t * t * t * p3[0];
    var y = mt * mt * mt * p0[1] + 3 * mt * mt * t * c1[1] + 3 * mt * t * t * c2[1] + t * t * t * p3[1];
    return [x, y];
  }
  function quadPoint(p0, c1, p2, t) {
    var mt = 1 - t;
    var x = mt * mt * p0[0] + 2 * mt * t * c1[0] + t * t * p2[0];
    var y = mt * mt * p0[1] + 2 * mt * t * c1[1] + t * t * p2[1];
    return [x, y];
  }

  // ---------------------------------------------------------------------
  // Style recipes (replaces the old STYLE_LIST)
  // ---------------------------------------------------------------------
  var SIG_STYLES = {
    flow: {
      label: 'Classic Flow', font: 'allure', tracking: 0.97, capScale: 1.25,
      joinCapital: true, leadin: false, tail: true, underline: false, paraph: false,
      legibility: 1.0, weight: 1.0, slant: 0.12, flourish: 0.65, dotScatter: 1.0,
    },
    executive: {
      label: 'Executive Bold', font: 'scriptmed', tracking: 0.90, capScale: 1.40,
      joinCapital: false, leadin: false, tail: false, underline: true, paraph: true,
      legibility: 1.0, weight: 1.3, slant: 0.22, flourish: 0.6, dotScatter: 1.0,
    },
    flourished: {
      label: 'Flourished', font: 'allure', tracking: 0.97, capScale: 1.45,
      joinCapital: true, leadin: true, tail: true, tailLoop: true, underline: true, paraph: false,
      legibility: 1.0, weight: 1.0, slant: 0.12, flourish: 0.75, dotScatter: 1.5,
    },
    scrawl: {
      label: 'Quick Scrawl', font: 'script1', tracking: 0.95, capScale: 1.15,
      joinCapital: true, leadin: false, tail: false, underline: true, underlineShort: true, paraph: false,
      legibility: 0.30, weight: 1.0, slant: 0.10, flourish: 0.5, dotScatter: 0.6,
    },
    minimal: {
      label: 'Modern Minimal', font: 'script1', tracking: 1.0, capScale: 1.0,
      joinCapital: true, leadin: false, tail: false, underline: false, paraph: false,
      legibility: 0.65, weight: 0.9, slant: 0.05, flourish: 0.3, dotScatter: 0.8,
    },
    monogram: {
      label: 'Monogram', font: 'allure', monogram: true, frame: true,
      legibility: 1.0, weight: 1.1, slant: 0.08, flourish: 0.5, dotScatter: 1.0,
    },
  };

  // ---------------------------------------------------------------------
  // Input normalization
  // ---------------------------------------------------------------------
  var PUNCT_RE = /[!-\/:-@\[-`{-~]/; // ASCII punctuation, excludes letters/digits/space
  function normalizeName(name) {
    return String(name || '').replace(/\s+/g, ' ').trim().normalize('NFD').replace(/[̀-ͯ]/g, '');
  }
  function glyphFor(font, ch) {
    var f = SIG_GLYPHS && SIG_GLYPHS[font];
    return (f && f.glyphs[ch]) || null;
  }

  // A character "plan": which glyph to draw (or none), word grouping, capital flag.
  function buildCharPlan(name, font) {
    var chars = name.split('');
    var plan = [];
    var wordIdx = 0, atWordStart = true;
    for (var i = 0; i < chars.length; i++) {
      var ch = chars[i];
      if (ch === ' ') {
        plan.push({ ch: ch, isSpace: true, isCapital: false, isWordInitial: false, wordIdx: -1, glyph: null, fallback: null });
        atWordStart = true;
        wordIdx++;
        continue;
      }
      var isCapital = /[A-Z]/.test(ch);
      var g = glyphFor(font, ch);
      var fallback = null;
      if (!g) {
        if (PUNCT_RE.test(ch)) fallback = 'hyphen';
        else fallback = 'gap';
      }
      plan.push({ ch: ch, isSpace: false, isCapital: isCapital, isWordInitial: atWordStart, wordIdx: wordIdx, glyph: g, fallback: fallback });
      atWordStart = false;
    }
    return plan;
  }

  // ---------------------------------------------------------------------
  // Per-glyph placement transform: rotate about the glyph's own local
  // entry point, scale about the local origin, then translate the local
  // origin (the font's advance-box left edge) to a world position.
  // ---------------------------------------------------------------------
  function placeGlyph(g, s, theta, tx, ty) {
    var about = g.entry;
    function tf(p) {
      var r = rotatePt(p, about, theta);
      return [r[0] * s + tx, r[1] * s + ty];
    }
    return {
      main: g.main.map(tf),
      extras: g.extras.map(function (e) { return { kind: e.kind, pts: e.pts.map(tf) }; }),
      entry: tf(g.entry),
      exit: tf(g.exit),
      entryDir: rotateVec(g.entryDir, theta),
      exitDir: rotateVec(g.exitDir, theta),
      adv: g.adv,
    };
  }

  // ---------------------------------------------------------------------
  // Layout + chaining pass — steps 3 & 4. Runs per word, produces 'body'
  // strokes plus a queue of dot/cross/extra strokes appended after each
  // word's body (real writing order: cross the t's after, not during).
  // ---------------------------------------------------------------------
  var ROT_MAX = deg2rad(2.5);
  var DRIFT_STEP = 0.03, DRIFT_CLAMP = 0.06;
  var GAP_CONCAT = 0.02, GAP_LIFT = 0.45;
  var CONNECTOR_SPACING = 0.02, CONNECTOR_MIN_PTS = 4;
  var SPACE_ADV = 0.75, GAP_ADV = 0.4;

  function connectorPoints(exit, exitDir, entry, entryDir) {
    var d = dist(exit, entry);
    var p1 = vadd(exit, vscale(exitDir, 0.4 * d));
    var p2 = vsub(entry, vscale(entryDir, 0.4 * d));
    var n = Math.max(CONNECTOR_MIN_PTS, Math.ceil(d / CONNECTOR_SPACING));
    var pts = [];
    for (var k = 1; k <= n; k++) pts.push(cubicPoint(exit, p1, p2, entry, k / n));
    return pts;
  }

  function layoutAndChain(plan, recipe, J, tracking, capScale, font) {
    var strokes = [];
    var firstGlyphEnd = null;
    var b = 0; // baseline drift accumulator, continuous across the whole name
    var penX = 0;
    var wordExtrasQueue = [];
    var cur = null; // current in-progress body stroke pts

    function flushWordExtras() {
      for (var i = 0; i < wordExtrasQueue.length; i++) {
        strokes.push({ pts: wordExtrasQueue[i].pts, kind: wordExtrasQueue[i].kind });
      }
      wordExtrasQueue = [];
    }
    function finishStroke() {
      if (cur && cur.length) strokes.push({ pts: cur, kind: 'body' });
      cur = null;
    }

    var prevExit = null, prevExitDir = null, prevWasCapital = false, prevWordIdx = -1;

    for (var i = 0; i < plan.length; i++) {
      var item = plan[i];
      var Ji = J[i];

      if (item.isSpace) {
        penX += SPACE_ADV * (glyphFor(font, ' ') ? glyphFor(font, ' ').adv : 0.378);
        finishStroke();
        flushWordExtras();
        prevExit = null; prevExitDir = null; prevWasCapital = false;
        continue;
      }
      if (item.wordIdx !== prevWordIdx && prevWordIdx !== -1) {
        // Defensive: word boundary without an explicit space token shouldn't
        // happen (spaces always separate wordIdx), but keep state sane.
      }
      prevWordIdx = item.wordIdx;

      var b_i = clamp(b + DRIFT_STEP * (2 * Ji[1] - 1), -DRIFT_CLAMP, DRIFT_CLAMP);
      b = b_i;

      if (!item.glyph) {
        if (item.fallback === 'hyphen') {
          var hy = glyphFor(font, '-');
          if (hy) {
            var sH = 1 + 0.12 * (2 * Ji[0] - 1);
            var thetaH = ROT_MAX * (2 * Ji[2] - 1);
            var placedH = placeGlyph(hy, sH, thetaH, penX, b_i);
            if (!cur) cur = [];
            appendChained(cur, placedH.main, prevExit, prevExitDir, placedH.entry, placedH.entryDir);
            prevExit = placedH.exit; prevExitDir = placedH.exitDir; prevWasCapital = false;
            penX += hy.adv * sH * tracking;
          }
        } else {
          penX += GAP_ADV;
          finishStroke();
          prevExit = null; prevExitDir = null; prevWasCapital = false;
        }
        continue;
      }

      var base = (item.isWordInitial && item.isCapital) ? capScale : 1;
      var s_i = base * (1 + 0.12 * (2 * Ji[0] - 1));
      var theta_i = ROT_MAX * (2 * Ji[2] - 1);
      var placed = placeGlyph(item.glyph, s_i, theta_i, penX, b_i);

      if (!cur) cur = [];
      var gap = prevExit ? dist(prevExit, placed.entry) : null;
      var shouldLift = prevExit && (gap > GAP_LIFT || (prevWasCapital && !recipe.joinCapital));
      if (shouldLift) {
        finishStroke();
        flushWordExtras();
        cur = placed.main.slice();
      } else if (!prevExit) {
        cur = placed.main.slice();
        if (firstGlyphEnd === null) firstGlyphEnd = { strokeRef: cur, pointIndex: cur.length - 1 };
      } else if (gap < GAP_CONCAT) {
        appendPts(cur, placed.main);
      } else {
        var conn = connectorPoints(prevExit, prevExitDir, placed.entry, placed.entryDir);
        appendPts(cur, conn);
        appendPts(cur, placed.main.slice(1));
      }
      if (firstGlyphEnd === null) firstGlyphEnd = { strokeRef: cur, pointIndex: cur.length - 1 };

      // Queue this letter's dot/cross/extra marks — drawn after the word's body.
      for (var e = 0; e < placed.extras.length; e++) {
        var extra = placed.extras[e];
        var dx = (2 * Ji[3] - 1) * 0.05 * recipe.dotScatter * (recipe.flourishVal != null ? recipe.flourishVal : 1);
        var dy = (2 * Ji[4] - 1) * 0.04 * recipe.dotScatter * (recipe.flourishVal != null ? recipe.flourishVal : 1);
        var pts = extra.pts.map(function (p) { return [p[0] + dx, p[1] + dy]; });
        if (extra.kind === 'cross') {
          var cx = (Math.min.apply(null, pts.map(function (p) { return p[0]; })) + Math.max.apply(null, pts.map(function (p) { return p[0]; }))) / 2;
          var stretch = 1 + 0.5 * (recipe.flourishVal != null ? recipe.flourishVal : 1);
          pts = pts.map(function (p) { return [cx + (p[0] - cx) * stretch, p[1]]; });
        }
        wordExtrasQueue.push({ kind: extra.kind, pts: pts });
      }

      prevExit = placed.exit; prevExitDir = placed.exitDir; prevWasCapital = item.isCapital;
      penX += item.glyph.adv * s_i * tracking;
    }
    finishStroke();
    flushWordExtras();

    return { strokes: strokes, firstGlyphEnd: firstGlyphEnd };
  }

  function appendPts(target, pts) { for (var i = 0; i < pts.length; i++) target.push(pts[i]); }
  function appendChained(target, mainPts, prevExit, prevExitDir, entry, entryDir) {
    if (!prevExit) { appendPts(target, mainPts); return; }
    var gap = dist(prevExit, entry);
    if (gap < GAP_CONCAT) { appendPts(target, mainPts); return; }
    var conn = connectorPoints(prevExit, prevExitDir, entry, entryDir);
    appendPts(target, conn);
    appendPts(target, mainPts.slice(1));
  }

  // ---------------------------------------------------------------------
  // Signature-izer pass — step 5: lead-in, terminal tail, underline+paraph
  // ---------------------------------------------------------------------
  function bboxOfPoints(pts) {
    var minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
    for (var i = 0; i < pts.length; i++) {
      var p = pts[i];
      if (p[0] < minX) minX = p[0]; if (p[0] > maxX) maxX = p[0];
      if (p[1] < minY) minY = p[1]; if (p[1] > maxY) maxY = p[1];
    }
    return { minX: minX, maxX: maxX, minY: minY, maxY: maxY, w: maxX - minX, h: maxY - minY };
  }

  function applySignatureIzer(strokes, recipe, flourish, F) {
    var bodyIdx = [];
    for (var i = 0; i < strokes.length; i++) if (strokes[i].kind === 'body') bodyIdx.push(i);
    if (!bodyIdx.length) return;

    var allPts = [];
    for (var i2 = 0; i2 < strokes.length; i2++) allPts = allPts.concat(strokes[i2].pts);
    var bb = bboxOfPoints(allPts);
    var W = Math.max(bb.w, 0.2);

    // Lead-in: quadratic prepended into the first body stroke.
    if (recipe.leadin && flourish > 0.45) {
      var first = strokes[bodyIdx[0]];
      var S = first.pts[0];
      var dir0 = vnorm(vsub(first.pts[Math.min(2, first.pts.length - 1)], S));
      var back = vscale(dir0, -0.22 * W * flourish);
      var lift = [-back[1], back[0]]; // perpendicular, swings the lead-in up and away
      var start = vadd(S, vadd(back, vscale(lift, 0.5)));
      var ctrl = vadd(S, vscale(back, 0.45));
      var n = 10, pre = [];
      for (var k = 0; k <= n; k++) pre.push(quadPoint(start, ctrl, S, k / n));
      first.pts = pre.slice(0, -1).concat(first.pts);
    }

    // Terminal tail: cubic extending from the exit of the last body stroke.
    if (recipe.tail) {
      var last = strokes[bodyIdx[bodyIdx.length - 1]];
      var E = last.pts[last.pts.length - 1];
      var exitDir = vnorm(vsub(E, last.pts[Math.max(0, last.pts.length - 2)]));
      var p1 = vadd(E, vscale(exitDir, 0.18 * W * flourish));
      var p2 = [E[0] + 0.28 * W * flourish, -0.12 - 0.1 * (2 * F[0] - 1)];
      var p3 = [E[0] + 0.36 * W * flourish, 0.02];
      var tailPts = [];
      for (var k2 = 1; k2 <= 12; k2++) tailPts.push(cubicPoint(E, p1, p2, p3, k2 / 12));
      if (recipe.tailLoop && flourish > 0.75) {
        var loopC1 = [p3[0] + 0.06 * W * flourish, p3[1] - 0.16 * W * flourish];
        var loopC2 = [p3[0] - 0.06 * W * flourish, p3[1] - 0.24 * W * flourish];
        var loopEnd = [p3[0] - 0.02 * W * flourish, p3[1] - 0.06 * W * flourish];
        for (var k3 = 1; k3 <= 12; k3++) tailPts.push(cubicPoint(p3, loopC1, loopC2, loopEnd, k3 / 12));
      }
      last.pts = last.pts.concat(tailPts);
    }

    // Underline (+ executive paraph return stroke), drawn right-to-left.
    if (recipe.underline && flourish > 0.3) {
      var short = !!recipe.underlineShort;
      var pad = short ? 0.06 : 0.03;
      var x0 = bb.maxX + pad * W, x1 = bb.minX - pad * W;
      if (short) { var mid = (bb.maxX + bb.minX) / 2; x1 = Math.max(x1, mid); }
      var yBase = bb.maxY + 0.06 * W;
      var dip = (short ? 0.05 : 0.12) * W * flourish;
      var c1 = [x0 - 0.3 * (x0 - x1), yBase + dip];
      var c2 = [x1 + 0.3 * (x0 - x1), yBase + dip];
      var upts = [];
      var un = short ? 12 : 22;
      for (var k4 = 0; k4 <= un; k4++) upts.push(cubicPoint([x0, yBase], c1, c2, [x1, yBase], k4 / un));
      strokes.push({ pts: upts, kind: 'underline' });

      if (recipe.paraph) {
        var midX = (x0 + x1) / 2;
        var pStart = [midX + 0.08 * W, yBase + dip * 0.6];
        var pCtrl = [midX - 0.02 * W, yBase + dip * 1.6 + 0.06 * W * (2 * F[1] - 1)];
        var pEnd = [midX - 0.14 * W, yBase + dip * 0.4];
        var ppts = [];
        for (var k5 = 0; k5 <= 10; k5++) ppts.push(quadPoint(pStart, pCtrl, pEnd, k5 / 10));
        strokes.push({ pts: ppts, kind: 'flourish' });
      }
    }
  }

  // ---------------------------------------------------------------------
  // Scrawl / legibility pass — step 6
  // ---------------------------------------------------------------------
  function polylineLength(pts) {
    var L = 0;
    for (var i = 1; i < pts.length; i++) L += dist(pts[i], pts[i - 1]);
    return L;
  }
  function resamplePolyline(pts, spacing) {
    if (pts.length < 2) return pts.slice();
    var out = [pts[0]];
    var carry = 0;
    for (var i = 1; i < pts.length; i++) {
      var a = pts[i - 1], b = pts[i];
      var segLen = dist(a, b);
      if (segLen < 1e-9) continue;
      var t = carry;
      while (t < segLen) {
        out.push(lerp(a, b, t / segLen));
        t += spacing;
      }
      carry = t - segLen;
    }
    var lastOut = out[out.length - 1], lastPt = pts[pts.length - 1];
    if (dist(lastOut, lastPt) > 1e-6) out.push(lastPt);
    return out;
  }
  function rdp(pts, eps) {
    if (pts.length < 3) return pts.slice();
    function perpDist(p, a, b) {
      var dx = b[0] - a[0], dy = b[1] - a[1];
      var len = Math.hypot(dx, dy);
      if (len < 1e-9) return dist(p, a);
      var t = ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / (len * len);
      var proj = [a[0] + t * dx, a[1] + t * dy];
      return dist(p, proj);
    }
    function go(arr) {
      if (arr.length < 3) return arr;
      var a = arr[0], b = arr[arr.length - 1];
      var maxD = -1, idx = -1;
      for (var i = 1; i < arr.length - 1; i++) {
        var d = perpDist(arr[i], a, b);
        if (d > maxD) { maxD = d; idx = i; }
      }
      if (maxD > eps) {
        var left = go(arr.slice(0, idx + 1));
        var right = go(arr.slice(idx));
        return left.slice(0, -1).concat(right);
      }
      return [a, b];
    }
    return go(pts);
  }

  function applyScrawlPass(strokes, legibility, firstGlyphEnd) {
    if (legibility >= 1) return;
    var bodyIdx = [];
    for (var i = 0; i < strokes.length; i++) if (strokes[i].kind === 'body') bodyIdx.push(i);
    if (!bodyIdx.length) return;

    if (legibility < 0.5 && bodyIdx.length > 1) {
      var merged = [];
      for (var j = 0; j < bodyIdx.length; j++) merged = merged.concat(strokes[bodyIdx[j]].pts);
      var kept = [];
      for (var k = 0; k < strokes.length; k++) if (strokes[k].kind !== 'body') kept.push(strokes[k]);
      strokes.length = 0;
      strokes.push({ pts: merged, kind: 'body' });
      for (var m = 0; m < kept.length; m++) strokes.push(kept[m]);
      bodyIdx = [0];
    }

    // Establish a running arc-length reference shared across all body
    // strokes (in signature order) so "u" measures distance traveled since
    // the end of the very first glyph, even across separate word strokes.
    var firstEndTotalLen = null;
    var running = 0;
    var perStrokeInfo = [];
    for (var b = 0; b < bodyIdx.length; b++) {
      var pts = strokes[bodyIdx[b]].pts;
      var cum = [0];
      for (var p = 1; p < pts.length; p++) cum.push(cum[p - 1] + dist(pts[p], pts[p - 1]));
      if (firstEndTotalLen === null && firstGlyphEnd && firstGlyphEnd.strokeRef === pts) {
        firstEndTotalLen = running + cum[Math.min(firstGlyphEnd.pointIndex, cum.length - 1)];
      }
      perStrokeInfo.push({ idx: bodyIdx[b], pts: pts, cum: cum, base: running });
      running += cum[cum.length - 1] || 0;
    }
    if (firstEndTotalLen === null) firstEndTotalLen = 0;
    var totalLen = running;
    var denom = Math.max(1e-6, totalLen - firstEndTotalLen);
    var anchorX = null;

    for (var s = 0; s < perStrokeInfo.length; s++) {
      var info = perStrokeInfo[s];
      var resampled = resamplePolyline(info.pts, 0.015);
      // Re-measure cumulative length + global position on the resampled points.
      var rcum = [0];
      for (var r = 1; r < resampled.length; r++) rcum.push(rcum[r - 1] + dist(resampled[r], resampled[r - 1]));
      var us = resampled.map(function (_, idx) {
        var globalLen = info.base + rcum[idx];
        return clamp((globalLen - firstEndTotalLen) / denom, 0, 1);
      });
      if (anchorX === null) {
        var refIdx = 0;
        for (var q = 0; q < us.length; q++) if (us[q] <= 0) refIdx = q;
        anchorX = resampled[refIdx][0];
      }

      // Moving-average smoothing with a per-point window derived from u.
      var smoothed = resampled.map(function (p, idx) {
        var win = 1 + Math.round(4 * us[idx] * (1 - legibility));
        var half = Math.floor(win / 2);
        if (half <= 0) return p;
        var sx = 0, sy = 0, n = 0;
        for (var o = -half; o <= half; o++) {
          var jx = idx + o;
          if (jx < 0 || jx >= resampled.length) continue;
          sx += resampled[jx][0]; sy += resampled[jx][1]; n++;
        }
        return [sx / n, sy / n];
      });

      // Amplitude decay + horizontal compression toward the first-glyph end.
      var shaped = smoothed.map(function (p, idx) {
        var u = us[idx];
        var y = p[1] * (1 - 0.45 * u * (1 - legibility));
        var x = anchorX + (p[0] - anchorX) * (1 - 0.25 * u * (1 - legibility));
        return [x, y];
      });

      strokes[info.idx].pts = rdp(shaped, 0.004);
    }
  }

  // ---------------------------------------------------------------------
  // Slant (step 7) + fit-to-viewBox (step 8)
  // ---------------------------------------------------------------------
  function applySlant(strokes, slant) {
    for (var i = 0; i < strokes.length; i++) {
      strokes[i].pts = strokes[i].pts.map(function (p) { return [p[0] - p[1] * slant, p[1]]; });
    }
  }

  function fitToViewBox(strokes, width, height) {
    var all = [];
    for (var i = 0; i < strokes.length; i++) all = all.concat(strokes[i].pts);
    if (!all.length) return;
    var bb = bboxOfPoints(all);
    var marginX = 30, marginY = 18;
    var availW = width - marginX * 2;
    var baselineY = height * 0.62;
    var aboveAvail = baselineY - marginY;
    var belowAvail = height - baselineY - marginY;
    var topExtent = Math.max(-bb.minY, 0.001);
    var bottomExtent = Math.max(bb.maxY, 0.001);
    var scaleH = availW / Math.max(bb.w, 0.001);
    var scaleAbove = aboveAvail / topExtent;
    var scaleBelow = belowAvail / bottomExtent;
    var scale = Math.min(scaleH, scaleAbove, scaleBelow);
    var cx = (bb.minX + bb.maxX) / 2;
    for (var s = 0; s < strokes.length; s++) {
      strokes[s].pts = strokes[s].pts.map(function (p) {
        return [width / 2 + (p[0] - cx) * scale, baselineY + p[1] * scale];
      });
    }
  }

  // ---------------------------------------------------------------------
  // Catmull-Rom smoothing (verbatim math from the old engine, [x,y] tuples)
  // ---------------------------------------------------------------------
  function smoothPath(pts) {
    if (pts.length < 2) return '';
    var d = 'M ' + pts[0][0].toFixed(1) + ' ' + pts[0][1].toFixed(1);
    for (var i = 0; i < pts.length - 1; i++) {
      var p0 = pts[i - 1] || pts[i];
      var p1 = pts[i];
      var p2 = pts[i + 1];
      var p3 = pts[i + 2] || p2;
      var c1x = p1[0] + (p2[0] - p0[0]) / 6;
      var c1y = p1[1] + (p2[1] - p0[1]) / 6;
      var c2x = p2[0] - (p3[0] - p1[0]) / 6;
      var c2y = p2[1] - (p3[1] - p1[1]) / 6;
      d += ' C ' + c1x.toFixed(1) + ' ' + c1y.toFixed(1) + ', ' + c2x.toFixed(1) + ' ' + c2y.toFixed(1) + ', ' + p2[0].toFixed(1) + ' ' + p2[1].toFixed(1);
    }
    return d;
  }

  // ---------------------------------------------------------------------
  // Ink pass (step 10) — perfect-freehand variable-width outline
  // ---------------------------------------------------------------------
  function getSvgPathFromStroke(points) {
    var len = points.length;
    if (len < 4) return '';
    function avg(a, b) { return (a + b) / 2; }
    var a = points[0], b = points[1], c = points[2];
    var result = 'M' + a[0].toFixed(2) + ',' + a[1].toFixed(2) +
      ' Q' + b[0].toFixed(2) + ',' + b[1].toFixed(2) + ' ' +
      avg(b[0], c[0]).toFixed(2) + ',' + avg(b[1], c[1]).toFixed(2) + ' T';
    for (var i = 2, max = len - 1; i < max; i++) {
      a = points[i]; b = points[i + 1];
      result += avg(a[0], b[0]).toFixed(2) + ',' + avg(a[1], b[1]).toFixed(2) + ' ';
    }
    result += 'Z';
    return result;
  }

  function buildInk(pts, weight, legibility, kind, J) {
    if (!PerfectFreehand || pts.length < 3) return null;
    try {
      var n = J.length || 1;
      var speeds = [0];
      for (var i = 1; i < pts.length; i++) speeds.push(dist(pts[i], pts[i - 1]));
      var med = median(speeds.slice(1)) || 1;
      var rawPressure = pts.map(function (_, i) {
        var jrow = J[i % n];
        var p = 0.78 - 0.35 * (speeds[i] / med - 1) + 0.06 * (2 * jrow[5] - 1);
        return clamp(p, 0.3, 1.0);
      });
      var pressure = rawPressure.map(function (_, i) {
        var a = rawPressure[Math.max(0, i - 1)], b = rawPressure[i], c = rawPressure[Math.min(rawPressure.length - 1, i + 1)];
        return (a + b + c) / 3;
      });
      var pts3 = pts.map(function (p, i) { return [p[0], p[1], pressure[i]]; });
      var outline = PerfectFreehand.getStroke(pts3, {
        size: 2.4 * weight * 2.0,
        thinning: 0.55 + 0.15 * (1 - legibility),
        smoothing: 0.5,
        streamline: 0.35,
        simulatePressure: false,
        last: true,
        start: { taper: 15 },
        end: { taper: kind === 'flourish' ? 60 : 15 },
      });
      if (!outline || outline.length < 4) return null;
      return getSvgPathFromStroke(outline);
    } catch (err) {
      return null;
    }
  }

  // ---------------------------------------------------------------------
  // Monogram special case (no full-name layout; two overlapped initials)
  // ---------------------------------------------------------------------
  function buildMonogram(name, recipe, J, F) {
    var words = name.split(' ').filter(Boolean);
    var initials = words.slice(0, 2).map(function (w) { return w[0].toUpperCase(); });
    var idxs = [];
    var seen = 0;
    for (var i = 0; i < name.length; i++) {
      if (name[i] === ' ') continue;
      if (seen === 0 && name[i].toUpperCase() === initials[0]) { idxs.push(i); seen = 1; continue; }
      if (initials[1] && seen === 1 && name[i].toUpperCase() === initials[1] && (i === 0 || name[i - 1] === ' ')) { idxs.push(i); seen = 2; }
    }
    while (idxs.length < 2) idxs.push(idxs.length ? idxs[0] : 0);

    var strokes = [];
    var S1 = 2.6;
    var g1 = glyphFor(recipe.font, initials[0]) || glyphFor(recipe.font, 'A');
    var J1 = J[idxs[0]] || J[0];
    var s1 = S1 * (1 + 0.1 * (2 * J1[0] - 1));
    var theta1 = ROT_MAX * (2 * J1[2] - 1);
    var p1 = placeGlyph(g1, s1, theta1, 0, 0);
    strokes.push({ pts: p1.main, kind: 'body' });

    var bboxPts = p1.main.slice();
    if (initials[1]) {
      var g2 = glyphFor(recipe.font, initials[1]) || glyphFor(recipe.font, 'B');
      var J2 = J[idxs[1]] || J[Math.min(1, J.length - 1)];
      var s2 = s1 * 0.85 * (1 + 0.1 * (2 * J2[0] - 1));
      var theta2 = ROT_MAX * (2 * J2[2] - 1);
      var tx2 = 0.55 * S1, ty2 = 0.04 * S1 * (2 * J2[1] - 1);
      var p2 = placeGlyph(g2, s2, theta2, tx2, ty2);
      strokes.push({ pts: p2.main, kind: 'body' });
      bboxPts = bboxPts.concat(p2.main);
    }

    if (recipe.frame) {
      var bb = bboxOfPoints(bboxPts);
      var cx = (bb.minX + bb.maxX) / 2, cy = (bb.minY + bb.maxY) / 2;
      var rx = bb.w / 2 + 0.28 * S1, ry = bb.h / 2 + 0.3 * S1;
      var frame = [];
      var n = 56;
      for (var k = 0; k <= n; k++) {
        var t = (k / n) * Math.PI * 2 + 0.15 * (2 * F[2] - 1);
        frame.push([cx + rx * Math.cos(t), cy + ry * Math.sin(t)]);
      }
      strokes.push({ pts: frame, kind: 'flourish' });
    }

    return strokes;
  }

  // ---------------------------------------------------------------------
  // Public API
  // ---------------------------------------------------------------------
  function buildSignature(name, styleKey, opts) {
    opts = opts || {};
    var width = opts.width || 720, height = opts.height || 180;
    var variant = opts.variant || 0;
    var recipe = SIG_STYLES[styleKey] || SIG_STYLES.flow;

    var normalized = normalizeName(name);
    var emptyResult = { strokes: [], viewBox: '0 0 ' + width + ' ' + height, width: width, height: height, totalLen: 0 };
    if (!normalized) return emptyResult;

    var rng = mulberry32(hash(normalized + '|' + styleKey + '|' + variant));
    var J = [];
    for (var i = 0; i < normalized.length; i++) {
      var row = [];
      for (var k = 0; k < 8; k++) row.push(rng());
      J.push(row);
    }
    var F = [];
    for (var k2 = 0; k2 < 8; k2++) F.push(rng());

    var slant = opts.slant != null ? opts.slant : recipe.slant;
    var flourish = opts.flourish != null ? opts.flourish : recipe.flourish;
    var weight = opts.weight != null ? opts.weight : recipe.weight;
    var legibility = opts.legibility != null ? opts.legibility : recipe.legibility;
    recipe = Object.assign({}, recipe, { flourishVal: flourish });

    var strokes;
    if (recipe.monogram) {
      strokes = buildMonogram(normalized, recipe, J, F);
    } else {
      var plan = buildCharPlan(normalized, recipe.font);
      var result = layoutAndChain(plan, recipe, J, recipe.tracking, recipe.capScale, recipe.font);
      strokes = result.strokes;
      applySignatureIzer(strokes, recipe, flourish, F);
      applyScrawlPass(strokes, legibility, result.firstGlyphEnd);
    }

    applySlant(strokes, slant);
    fitToViewBox(strokes, width, height);

    var totalLen = 0;
    for (var s = 0; s < strokes.length; s++) {
      var st = strokes[s];
      st.length = polylineLength(st.pts);
      st.d = smoothPath(st.pts);
      st.inkD = buildInk(st.pts, weight, legibility, st.kind, J);
      totalLen += st.length;
    }

    return { strokes: strokes, viewBox: '0 0 ' + width + ' ' + height, width: width, height: height, totalLen: totalLen };
  }

  var exportsObj = { buildSignature: buildSignature, SIG_STYLES: SIG_STYLES, smoothPath: smoothPath, hash: hash, mulberry32: mulberry32 };
  if (typeof window !== 'undefined') Object.assign(window, exportsObj);
  if (typeof module !== 'undefined' && module.exports) module.exports = exportsObj;
})();
