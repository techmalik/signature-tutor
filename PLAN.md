# SignatureTutor — Rebuild the Signature Generation Engine (+ finish the workbook pipeline)

> **Status: Phases 0, A, and C are done and merged into this branch.** Phase B (optional neural "AI · beta" handwriting styles) was deliberately **not implemented** — a product decision, not a time-cut: Phase A + C already deliver realistic, non-font, hand-drawn signatures reliably and deterministically, which was the actual ask, and Phase B's costs (a 14.4 MB per-user model download, meaningfully slower generation, and pretrained weights trained on IAM-OnDB — a non-commercial-research-only dataset) were judged not worth it against an already-solved problem. If Phase B is wanted later, the "Ground truths" and "Phase B" sections below are still accurate and were verified against the live reference source (`X-rayLaser/pytorch-handwriting-synthesis-toolkit`'s `my-app/src/utils.js`) including exact tensor layouts, the sampling algorithm, and the coordinate convention (confirmed Y-down, no flip needed, by cross-referencing the reference app's own canvas renderer).
>
> **How to execute this plan:** work phase by phase in the order **0 → A → C → B**, committing at each phase's shippable checkpoint before starting the next. Every claim marked "verified" below was confirmed against the live sources/CDNs at planning time — trust them over intuition, but re-verify a URL before relying on it if it fails. Run the verification steps for a phase before considering it done; visual tuning of style-recipe constants against the screenshots is an expected iteration loop, not a failure. If scope must be cut, cut from the bottom of the phase order (B first, then C).

## Context

**The product promise:** user types their name → app generates several realistic, professional, *hand-drawn-looking* signatures (the kind executives scribble: flowing connected strokes, flourishes, underlines, scrawls — explicitly **not** font-rendered text) → user picks one → app produces a practice workbook (printable sheets + on-screen tablet practice) to learn it.

**Why signatures "don't come out correctly" — root cause:** the current engine (`signature-engine.jsx`, inlined in `SignatureTutor.html:487–750`) never draws the letters of the name. `buildSignature()` places each character in a horizontal slot and draws a *generic seeded wiggle* through it. The typed name only influences slot widths and the RNG seed — "James" and "Sarah" produce near-identical squiggles. Its own header admits: *"This isn't a real handwriting model."* No parameter tweak can fix this; the engine must be replaced with one that encodes real letterforms as pen strokes.

**Secondary defects (verified):** 7 handwriting Google Fonts loaded but never used (dead `.fam-*` classes); "stroke-by-stroke" animation is fake (one global progress, under-measured path lengths); stroke-order arrows only number 3 strokes and clip at margins; practice canvas has a coordinate double-scaling bug (ink lands ~2× from the stylus), a fake random accuracy score, and Undo wipes everything; all export buttons (PDF/SVG/PNG/GIF) are dead stubs; the loose `*.jsx`/`app.css` files are **orphaned copies** of code inlined in the HTML — editing them does nothing.

**Framework research conclusion (verified with live fetches):** the only real product with non-font signature output (calligrapher.ai) uses in-browser neural handwriting synthesis; everything else ("signature maker" sites, Docusign/Canva) is script fonts — what the owner rejects. Two viable client-side foundations, both outputting **pen-stroke sequences** (exactly what tracing/animation/accuracy need, unlike font outlines):
1. **Centerline stroke engine** — single-line cursive letterform skeletons (Hershey = public domain, EMS Allure = SIL OFL, via `hersheytext@2.0.0`) chained into continuous pen paths + seeded procedural transforms + variable-width ink via `perfect-freehand` (MIT). Instant, deterministic, offline.
2. **Neural handwriting synthesis** — `X-rayLaser/pytorch-handwriting-synthesis-toolkit` (MIT): pretrained ONNX checkpoint (14.4 MB, on jsDelivr) + reference in-browser sampling loop via `onnxruntime-web`. Most realistic; ~1–3 s per generation. ⚠️ Weights trained on IAM-OnDB (non-commercial research dataset) — fine for a free/personal app; revisit before commercializing.

## Decisions (defaults — the interactive Q&A UI failed in this session; veto at review)

1. **Engine = phased hybrid.** Phase A: deterministic stroke engine as primary/default. Phase B: neural "AI · beta" styles layered on top with automatic fallback. Each phase independently shippable.
2. **Scope = full product path** — also fix workbook PDF/exports and the practice screen (Phase C).
3. **Licensing = conservative** — stroke engine is default; neural add-on isolated/removable; IAM-OnDB flag documented.
4. **Architecture = keep `SignatureTutor.html` self-contained and double-click runnable.** Loose files become canonical sources; a dependency-free `build.js` regenerates the HTML's inline blocks via marker comments.

**Recommended execution order: Phase 0 → A → C → B.** (0+A alone is a dramatic upgrade; 0+A+C is the complete product promise; B is premium polish.)

---

## Verified ground truths (trust these; discovered by fetching/reading the actual sources)

- The HTML has **four** inline `text/babel` blocks: engine (478–751), screens 1–3 (753–963), screens 4–6 (965–1356), **App (1358–1520 — no loose-file counterpart exists; must be extracted)**.
- **perfect-freehand@1.2.3 has no UMD build** — do not `<script src>` it. Vendor its CJS source (4.5 KB) wrapped as `(function(){ const module={exports:{}}; /* cjs */ ; window.PerfectFreehand = module.exports; })();` with MIT header → `src/vendor/perfect-freehand.js`.
- Fonts at `https://cdn.jsdelivr.net/npm/hersheytext@2.0.0/svg_fonts/`: `EMSAllure.svg`, `HersheyScript1.svg`, `HersheyScriptMed.svg`. Full ASCII incl. lowercase, digits, `. - '`. Path data ≈ absolute/relative `M L C` only. **Y-up** coordinates, `units-per-em=1000`, ascent 800, descent −200, x-height 300, cap 500. Subpath order/direction is plotter-optimized, not writing order (EMSAllure `a` starts at its right edge) — must normalize.
- Neural reference (`my-app/src/utils.js` in the toolkit): charset `" !\"#%'()+,-./0123456789:;?ABCDEFGHIJKLMNOPQRSTUVWXYZ[abcdefghijklmnopqrstuvwxyz"` (tokens 1..80, unknown→0, one-hot 81); tensors `x[1,1,3]`, `c[1,len,81]`, `w.1[1,1,80]`, `k.1[1,10]`, `h1.1/c1.1/h2.1/c2.1/h3.1/c3.1[1,400]`, `bias[1]`; outputs `pi,mu,sd,ro,eos,phi,w,k,h1..c3`; denorm `mu=[8.217162132263184, 0.1212363988161087, 0]`, `sd=[42.34926223754883, 37.07347869873047, 1]`; stop when `len>=6 && (phi[len-1]>0.8 || (argmax(phi)==len-1 && eos))`; step budget `35*text.length`. No priming samples bundled → Phase B ships unprimed (bias = neatness, seed = variant).
- Pinned CDN URLs verified reachable: `jspdf@3.0.3/dist/jspdf.umd.min.js` (**jspdf@4 does not exist**), `svg2pdf.js@2.7.0/dist/svg2pdf.umd.min.js`, `onnxruntime-web@1.17.0/dist/ort.min.js` (+ `ort-wasm-simd.wasm`), model `https://cdn.jsdelivr.net/gh/X-rayLaser/pytorch-handwriting-synthesis-toolkit@main/my-app/synthesis_network_52.onnx`.
- Env: node v22, python 3.11, Playwright CLI 1.56.1 — but **no browsers installed**; run `npx playwright install chromium` before screenshot verification.
- `file://` constraints: localStorage and Blob-URL workers OK; `fetch()` of relative files and CacheStorage NOT. Phase A assets must be inline; Phase B caching feature-detected.

---

## Phase 0 — Kill the orphan-file trap; `build.js` (½–1 session)

**Goal:** loose files become canonical sources; `SignatureTutor.html` becomes a regenerated build artifact, pixel-identical to today.

File plan:
```
src/app.css            (git mv app.css)
src/signature-engine.jsx, src/screens-1-3.jsx, src/screens-4-6.jsx  (git mv)
src/app.jsx            (NEW — extracted verbatim from HTML lines ~1359–1519)
build.js               (NEW, repo root, node ≥18, zero deps)
README.md              (NEW: "edit src/*, run node build.js, commit both" + licenses)
SignatureTutor.html    (rewritten with markers)
```

`build.js`: a `MANIFEST` array defines inline order (load-bearing — `Object.assign(window,…)` globals must precede consumers):
```js
const MANIFEST = [
  { id:'app-css',         file:'src/app.css' },                                  // inside <style>
  { id:'vendor-freehand', file:'src/vendor/perfect-freehand.js', type:'plain' }, // Phase A
  { id:'glyph-data',      file:'src/glyph-data.js',              type:'plain' }, // Phase A
  { id:'engine-core',     file:'src/engine-core.js',             type:'plain' }, // Phase A
  { id:'signature-react', file:'src/signature-react.jsx',        type:'babel' }, // Phase A
  { id:'neural',          file:'src/neural.js',                  type:'plain' }, // Phase B
  { id:'exporters',       file:'src/exporters.js',               type:'plain' }, // Phase C
  { id:'screens-1-3',     file:'src/screens-1-3.jsx',            type:'babel' },
  { id:'screens-4-6',     file:'src/screens-4-6.jsx',            type:'babel' },
  { id:'app',             file:'src/app.jsx',                    type:'babel' },
];
```
- Markers are JS/CSS comments (they sit inside `<style>`/`<script>`): `/* @inline:app-css:start */ … end` and `// @inline:<id>:start … end`. Replace content between marker lines by splitting on the unique marker lines. Fail loudly if a marker count ≠ 1 or a file is missing. If a manifest id's marker is absent, **insert** a new `<script>` block (with markers) before the next existing id's block — so later phases just add manifest lines.
- `type:'plain'` → `<script>` (raw JS — glyph data + engine must NOT go through Babel-standalone; 100 KB of data through Babel adds seconds to load). `type:'babel'` → `<script type="text/babel" data-presets="react">`.
- Migration: hand-insert markers around the four existing blocks + `<style>` body, extract `src/app.jsx`, run `node build.js`, confirm `git diff` shows only marker additions. Build must be idempotent (second run byte-identical).

**Checkpoint 0:** app renders pixel-identical (screenshot diff). Commit.

---

## Phase A — Deterministic centerline stroke engine (4.5–5.5 sessions; CORE)

### A1. Glyph extraction — `tools/extract-glyphs.mjs` (node, zero deps; committed, run at dev time)

- Vendor the 3 SVG fonts into `tools/fonts/` (download from jsDelivr if missing).
- Parse `<glyph …/>` tags via regex (don't assume attribute order); decode XML entities; read `<font-face>` metrics and default `horiz-adv-x`.
- Charset filter: keep only `[A-Za-z0-9 .'\-]` (~65 glyphs/font).
- Path→polylines: minimal parser for absolute/relative `M m L l C c` (covers all three fonts; abort loudly on anything else). Split subpaths on `M`; sample cubics at `t=k/8`.
- Normalize: flip Y (baseline 0, ascenders negative), divide by unitsPerEm, round 4 decimals.
- Per glyph: `main` = longest subpath; **reverse `main` if it runs right→left** (`main[0].x > main[last].x + 0.05`); classify other subpaths `dot` (bbox diag < 0.08 em) / `cross` (width > 2×height, center above −0.25 em) / `extra`; store `entry`, `exit`, `entryDir`, `exitDir` (unit tangents).
- Emit `src/glyph-data.js` (plain script; **OFL notice for EMSAllure + public-domain notice for Hershey in header**):
  `window.SIG_GLYPHS = { allure:{meta:{xh,cap,asc,desc}, glyphs:{ "a":{adv, main:[[x,y]…], extras:[{kind,pts}], entry, exit, entryDir, exitDir} …}}, script1:{…}, scriptmed:{…} }`.
- Budget ≤150 KB total (print size; if over: drop digits, or cubic sampling → 6). Self-check: every char of `A-Za-z .'-` present in all fonts, no NaN, every `main` ≥ 2 points.

### A2. Engine core — `src/engine-core.js` (pure JS, no JSX/DOM — must run under bare node for tests)

Public API (superset of old contract — existing call sites keep working):
```js
buildSignature(name, styleKey, opts /* {width=720,height=180,slant,flourish,weight,legibility,variant=0} */)
// → { strokes, viewBox, width, height, totalLen }
// strokes[i] = { pts:[[x,y]…],  // dense final centerline (viewBox space)
//                d,             // Catmull-Rom smoothed centerline path (reuse existing smoothPath verbatim)
//                inkD,          // filled variable-width ink outline (perfect-freehand), null on failure
//                kind,          // 'body'|'dot'|'cross'|'flourish'|'underline'|'leadin'|'extra'
//                length }       // exact polyline length
```

**Determinism discipline (document at top of file):** one stream `rng = mulberry32(hash(name+'|'+styleKey+'|'+variant))`. Immediately after seeding, draw a fixed schedule: `J[i] = 8 values per input char` (unconditionally, spaces included), then one block `F = 8 values` for flourish/underline/monogram decisions. All later math uses only `J`/`F` — so the sliders (`slant/flourish/weight/legibility`) deform the *same* signature rather than re-rolling it. `variant` (new integer, "Shuffle" button) is the only reseed.

**Pipeline (exact order):**
1. **Normalize input:** collapse whitespace; NFD-strip diacritics; unmapped chars → hyphen glyph if punctuation, else 0.4 em advance + pen lift (never crash).
2. **Style recipe** from `SIG_STYLES[styleKey]` (table below): font, tracking, capScale, joinCapital, legibility default, flourish kit flags.
3. **Layout pass (em space, baseline y=0).** Per char: space → advance ×0.75, pen lift, new word. Else per-letter transforms from `J[i]`: scale `s_i = base·(1+0.12·(2J[i][0]−1))` (base = capScale for word-initial capital, else 1); baseline drift random-walk `b_i = clamp(b_{i−1}+0.03·(2J[i][1]−1), ±0.06)`; rotation `2.5°·(2J[i][2]−1)` about entry. Advance `penX += adv·s_i·tracking`.
4. **Chaining pass (per word → one continuous body stroke).** Between prev glyph `exit`(+`exitDir`) and next `entry`(−`entryDir`): gap < 0.02 em → concatenate; gap > 0.45 em or (prev is capital && !joinCapital) → pen lift (new stroke); else insert cubic connector `P0=exit, P1=exit+exitDir·0.4·dist, P2=entry−entryDir·0.4·dist, P3=entry`, sampled `max(4, ceil(dist/0.02))` pts. **This is what turns disjoint glyphs into a flowing hand.** Queue `dot`/`cross` extras per word, append after the word's body (real writing order) displaced by `(2J[i][3]−1)·0.05·flourish` em x / `(2J[i][4]−1)·0.04` em y; `cross` length ×`(1+0.5·flourish)`.
5. **Signature-izer pass** (em units; `W` = bbox width):
   - *Lead-in* (recipe.leadin && flourish>0.45): quadratic prepended into first stroke.
   - *Terminal tail* (recipe.tail): extend final stroke from exit `E` along exit tangent: cubic `E, E+t·0.18W·flourish, (E.x+0.28W·flourish, −0.12−0.1(2F[0]−1)), (E.x+0.36W·flourish, 0.02)`; flourish>0.75 adds a return-loop cubic. Sampled ×12/cubic, same stroke.
   - *Underline* (recipe.underline && flourish>0.3): separate stroke drawn **right→left**, dipping cubic under the bbox; executive gets a second short return stroke (paraph). `kind:'underline'`.
6. **Scrawl/legibility pass** (when `legibility<1`; `u` = arc-length position from the END of the first glyph — first letter always survives): merge all body strokes into one when `legibility<0.5`; resample to 0.015 em; moving-average smoothing window `1+round(4u(1−legibility))`; amplitude decay `y·(1−0.45u(1−legibility))`; horizontal compression toward first-glyph-end ×`(1−0.25u(1−legibility))`; one RDP pass `eps=0.004` em.
7. **Slant shear LAST** (pure slider): `x += −y·slant`.
8. **Fit-to-viewBox:** uniform scale to `(width−60)×(height−36)`, centered, baseline at 62% height — *guarantees* long names fit (old slot layout is gone).
9. **Finalize:** `length` = exact polyline sum (points are dense, ≤2 px spacing — this IS the curve length; fixes the old `approxLen` bug by construction); `d = smoothPath(pts)`.
10. **Ink pass (perfect-freehand):** speed-based pressure per point: `v_i=|p_i−p_{i−1}|`, `pressure = clamp(0.30,1.0, 0.78 − 0.35(v_i/median(v) − 1) + 0.06(2J[i mod n][5]−1))`, 3-tap smoothed. `PerfectFreehand.getStroke(pts3, { size: 2.4·weight·2.0, thinning: 0.55+0.15(1−legibility), smoothing:0.5, streamline:0.35, simulatePressure:false, last:true, start:{taper:15}, end:{taper: kind==='flourish'?60:15} })` → outline → path via the README's midpoint-quadratic `getSvgPathFromStroke` (~12 lines). try/catch → `inkD=null` (renderer falls back to stroked centerline).

**`SIG_STYLES`** (replaces STYLE_LIST semantics):

| key | label | font | recipe highlights |
|---|---|---|---|
| `flow` | Classic Flow | allure | tracking .97, capScale 1.25, joinCapital, tail |
| `executive` | Executive Bold | scriptmed | tracking .90, capScale 1.40, no joinCapital, underline+paraph, default weight 1.3, slant .22 |
| `flourished` | Flourished | allure | capScale 1.45, leadin, tail loop, underline, dot scatter ×1.5 |
| `scrawl` | Quick Scrawl | script1 | legibility default .30, single merged stroke, high thinning, short slash underline |
| `minimal` | Modern Minimal | script1 | initial full-size, rest legibility .65, no flourish kit, slant .05 |
| `monogram` | Monogram | allure | first two initials overlapped (+0.55 em, ×0.85), optional polyline-sampled ellipse frame — **no `<text>` element anywhere** |

### A3. React layer — `src/signature-react.jsx` (replaces `src/signature-engine.jsx`, which is deleted)

- `SignatureSVG` gains `renderMode` (`'ink'` default for hero/preview/export; `'line'` for worksheet/ghost/trace) and `variant`. `useMemo` deps must include `opts.legibility` and `variant`.
- `line` mode: `<path d={s.d} stroke…/>` as now. `ink` mode: `<path d={s.inkD} fill={color}/>`, per-stroke fallback to line when `inkD` null.
- **True sequential animation** (both modes): `totalT = Σlength_i + 30·(nStrokes−1)` (virtual pen-lift pauses); stroke i occupies `[cum_i, cum_i+len_i]/totalT`; one rAF, `duration = clamp(1200, totalT·2.0, 3800)` ms, easeInOut; per-stroke `local = clamp((p−start)/span, 0, 1)`. Line mode: per-stroke dash. Ink mode: wrap ink paths in `<g mask="url(#reveal-<useId>)">` where the mask strokes the *centerlines* white at `strokeWidth = size·2+4` with the same dash animation (**mask, not clipPath** — clipPaths ignore strokes).
- **StrokeArrow fix:** number ALL strokes except flourish/underline; clamp position into the viewBox; render only in `line` mode.

### A4. UI wiring

- `src/screens-1-3.jsx`: rebuild `STYLE_LIST` from `SIG_STYLES`; PreviewScreen keeps flourish/slant/weight sliders, **adds Legibility (0.2–1)**; "Randomize" → **"Shuffle variant"** (`setVariant(v=>v+1)`). Style cards render `renderMode="ink"`.
- `src/app.jsx`: state gains `variant`, `opts.legibility`; **localStorage → `sigtutor:v2`** with one-way v1 migration (`cursive→flow, loopy→flourished, sans→minimal`; fill legibility from style default). Preserve the edit-mode/postMessage code verbatim.
- `src/app.css` + HTML head: drop the 7 unused handwriting families from the Google Fonts `@import` (keep Inter + Fraunces); delete dead `.fam-*` rules.

**Checkpoint A:** six styles render realistic connected-script signatures, deterministic per (name, style, variant), sequentially animated, ink-rendered. Commit after verification.

---

## Phase C — Workbook PDF, exports, practice fixes (2–2.5 sessions; do BEFORE Phase B)

New `src/exporters.js` (plain JS; lazy script-inject `jspdf@3.0.3` → `window.jspdf.jsPDF`, then `svg2pdf.js@2.7.0` which registers `doc.svg()`).

1. **Workbook PDF** `makeWorkbook(name, styleKey, opts, paper)` — paper `'a4'`|`'letter'` (toggle in ExportModal), margins 18 mm, content width `cw`:
   - *Page 1 hero:* header (name, style, date), ink-mode signature at `cw × cw·0.25`, below it line-mode with stroke numbers (stroke-order figure), footer tip.
   - *Pages 2–3 trace ladder:* 8 rows/page (row 27 mm): baseline rule + dotted x-height rule; line-mode guide (strokeW 1.6) with opacity ladder p2 `[1,1,.8,.8,.6,.6,.45,.45]`, p3 `[.3,.3,.15,.15,0,0,0,0]` — implement fade as **color blend toward white**, not SVG opacity (svg2pdf/print reliability).
   - *Page 4:* 10 blank rule rows.
   - Mechanics: build each row's SVG offscreen in a hidden live DOM node (svg2pdf needs real nodes), `await doc.svg(node,{x,y,width,height})`, remove; `doc.save(slug(name)+'-workbook.pdf')`. Fallback if `doc.svg` misrenders: rasterize rows to canvas 300 dpi → `doc.addImage`.
2. **SVG export:** serialize standalone ink-mode SVG (inject xmlns, explicit size) → Blob download. **PNG:** same string → Image → 2160×540 canvas → `toBlob`. **GIF button removed** (replaced with "Replay animation" in the modal — honest). Wire all ExportModal `onClick`s; WorksheetScreen "Download PDF" calls `makeWorkbook` directly.
3. **Practice canvas fix (one convention: CSS-pixel space, dpr backing store):** resize → `c.width=rect.width·dpr; c.height=rect.height·dpr; ctx.setTransform(dpr,0,0,dpr,0,0)`; pointer → `clientX−rect.left` **with no extra scaling** (the bug was triple-counting). Strokes stored (CSS px) in a ref; `redraw()` replays all; **Undo = pop + redraw**; Clear = empty + redraw; ResizeObserver → resize + redraw.
4. **Real accuracy score:** reference = concatenated `pts` of body/extra strokes mapped viewBox→canvas with the same `xMidYMid meet` math as the ghost overlay (factor the inset into ONE shared constant); resample both polylines to 4 px; tolerance `tol = 14·scale`; grid-bucket reference for O(n) lookups; `coverage` = ref samples with a user sample within tol, `precision` = user samples within tol of ref; `score = round(100·(0.6·coverage + 0.4·precision))` + verdict (≥85 Excellent / ≥65 Close / else Keep tracing). Delete the fake score.

**Checkpoint C:** PDF opens with 4 vector pages; SVG/PNG download; ink lands under the pointer; Undo removes one stroke; score reflects actual tracing.

---

## Phase B — Neural "AI · beta" styles (2–3 sessions; optional premium, feature-flagged)

New `src/neural.js` (plain JS).
1. **Loader:** on first AI-style use, inject `onnxruntime-web@1.17.0/dist/ort.min.js`; `ort.env.wasm.wasmPaths='https://cdn.jsdelivr.net/npm/onnxruntime-web@1.17.0/dist/'`, `numThreads=1`, `proxy=false`. Fetch model (14.4 MB) with streaming progress; cache: CacheStorage → IndexedDB → memory (feature-detect; file:// lacks CacheStorage). 30 s stall timeout → banner "AI styles unavailable — using classic engine" → render `flow`.
2. **Worker:** sampling loop lives in a plain-JS template string → Blob-URL `Worker` (Babel constraint); worker `importScripts(ORT_URL)`, receives `{modelBuffer,text,bias,seed}`, posts progress every 20 steps, then `{points}`. If Worker creation throws → chunked main-thread loop (`setTimeout(0)` every 5 steps).
3. **Sampling loop:** port the verified reference (tensor names/dims/denorm/stop rule in Ground Truths) with two changes: single `InferenceSession` per worker lifetime; determinism — `Math.random` → `mulberry32(hash(name+'|'+aiStyle+'|'+variant))`, Box-Muller bivariate normal (with `ro` correlation), inverse-CDF mixture pick.
4. **Charset guard:** filter name through the exact charset; unknown → token 0.
5. **Post-processing:** `{x,y,eos}` → strokes split at `eos`, drop <3-point strokes → feed into the SAME Phase A pipeline from step 6 (slant, fit, lengths, smoothPath, ink) — renderer reused unchanged.
6. **Product surface:** two new cards `ai-neat` (bias 1.5) and `ai-natural` (bias 0.6), "AI · beta" badge, spinner+progress; results memoized per (name,bias,variant). `buildSignature` stays sync; add async hook `useSignature(...)` in signature-react.jsx that shows Phase A output instantly and swaps in neural output when ready.
7. **Licensing note** in README + neural.js header: IAM-OnDB non-commercial training data.

**Checkpoint B:** AI cards produce model-generated signatures; with CDN blocked (Playwright route abort), classic engine + banner appear and nothing else breaks.

---

## Verification (per phase; no test framework exists — create `tools/`)

Setup once: `npx playwright install chromium` (if blocked: `apt-get install chromium`, or node-only checks + tell the user screenshots were skipped).

- **`tools/test-engine.mjs`** (bare node; Phases A/B — engine files are plain JS by design): (1) determinism — two identical `buildSignature('J. K. Rowling-Smythe','flow',…)` calls → identical JSON; (2) different variants differ; (3) glyph coverage `A-Za-z .'-` in all 3 fonts; (4) names `['Al','J. K. Rowling-Smythe','Alexandra Konstantinopoulos']` × all styles: no NaN, all points inside viewBox, `length` matches recomputed polyline sum; (5) slider purity — changing `slant` only shears (same point count).
- **`tools/screenshot.mjs`** (Playwright): serve via `python3 -m http.server 8123`; for each test name × style, seed `localStorage['sigtutor:v2']`, screenshot StyleScreen grid + PreviewScreen hero to `tools/screens/` (gitignored); assert zero console/page errors; determinism = `svg.innerHTML` string-equal across two fresh loads; **file:// smoke test** — open `file:///…/SignatureTutor.html`, assert root rendered. **The executor must LOOK at the screenshots** (letterforms legible? joins smooth? flourishes tasteful?) — visual tuning of recipe constants is an expected iteration loop, not a failure.
- **Phase 0 parity:** before/after screenshot pixel-diff.
- **Phase C:** `page.emulateMedia({media:'print'})` + `page.pdf()` for the print worksheet; for the jsPDF workbook, capture Playwright's download event, assert `%PDF` magic, size >20 KB, ≥4 `/Type /Page` occurrences; screenshot the PDF rendered in Chromium.
- **Phase B:** generate for "Alex Morgan": ≥150 points, ≥1 eos, wall-time logged; offline-fallback test with `page.route('**/cdn.jsdelivr.net/**', abort)`.
- **Every phase:** `node build.js && git status` — only intended sources + regenerated HTML dirty; second build run byte-identical.

## Risks & mitigations

1. **Glyph join quality** (entry/exit heights differ; capitals exit high): connector cubics absorb arbitrary gaps; >0.45 em → realistic pen lift; add `?debug=alphabet` URL param rendering a chained pangram per font for visual audit.
2. **Plotter stroke order/direction:** normalized at extraction; per-font override table in the extraction script for stubborn glyphs.
3. **Data size / Babel cost:** glyph data + engine are `plain` blocks (never Babel-parsed); 150 KB hard budget.
4. **CDN availability:** Phase A needs zero runtime CDN beyond existing React/Babel; B/C libs lazy-load with timeouts + visible fallbacks; versions pinned.
5. **jsPDF/svg2pdf pairing:** jspdf@3.0.3 + svg2pdf.js@2.7.0 (peer-verified); raster fallback path specified.
6. **EMS Allure is OFL** (not public domain): license header in glyph-data.js + README attribution. Hershey data is public domain.
7. **IAM-OnDB non-commercial weights:** documented; Phase B is additive and removable.
8. **file:// regressions:** every checkpoint includes the file:// smoke test; no relative `fetch` anywhere; CacheStorage feature-detected.
9. **localStorage schema:** v2 with one-way migration; keep existing corrupted-JSON try/catch.

## Effort & scope-cut order

| Phase | Focused sessions | Cut priority |
|---|---|---|
| 0 restructure + build.js | 0.5–1 | never cut |
| A stroke engine | 4.5–5.5 | core — ship first |
| C workbook/export/practice | 2–2.5 | ship second (delivers the workbook promise) |
| B neural styles | 2–3 | ship last / optional |

## Critical files

- `SignatureTutor.html` — becomes build artifact; four inline blocks at ~478–751, 753–963, 965–1356, 1358–1520
- `signature-engine.jsx` → replaced by `src/engine-core.js` + `src/signature-react.jsx` (preserve `smoothPath`, `mulberry32`, `hash`, and the `{d,kind,length}` contract)
- `screens-1-3.jsx` → `src/screens-1-3.jsx` (STYLE_LIST, sliders)
- `screens-4-6.jsx` → `src/screens-4-6.jsx` (worksheet, practice canvas, export modal)
- `app.css` → `src/app.css` (dead font imports/.fam-* removal)
- NEW: `build.js`, `README.md`, `tools/extract-glyphs.mjs`, `tools/fonts/*.svg`, `tools/test-engine.mjs`, `tools/screenshot.mjs`, `src/glyph-data.js` (generated), `src/engine-core.js`, `src/signature-react.jsx`, `src/vendor/perfect-freehand.js`, `src/app.jsx`, `src/exporters.js` (C), `src/neural.js` (B)

## Git

Work on branch `claude/signature-generation-quality-6nzixa`; commit at each phase checkpoint; push with `git push -u origin claude/signature-generation-quality-6nzixa`; open a draft PR after the first push if none exists.
