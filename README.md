# SignatureTutor

A single-file web app: type your name, get a set of realistic hand-drawn
signature styles to choose from, then practice the one you like with a
printable workbook and an on-screen tracing mode.

See `PLAN.md` for the in-progress rework of the signature engine and why it
was needed.

## Running it

`SignatureTutor.html` is fully self-contained — open it directly in a
browser (double-click, or `file://...`) and it works. It loads React,
ReactDOM, and Babel Standalone from a CDN at runtime and transpiles its own
JSX in-browser, so there is no build step for *using* the app.

## Editing the app

`SignatureTutor.html` is a **generated file** — do not hand-edit the code
inside its `<style>`/`<script>` blocks. The real sources live in `src/`:

| Source | Contents |
|---|---|
| `src/app.css` | All styling, inlined into the page's single `<style>` tag |
| `src/signature-engine.jsx` | Signature generation (`buildSignature`, `SignatureSVG`) |
| `src/screens-1-3.jsx` | Name / Style / Preview screens |
| `src/screens-4-6.jsx` | Hub / Worksheet / Practice / Export screens |
| `src/app.jsx` | Top-level `App` component, routing, state, persistence |

After editing anything under `src/`, regenerate the HTML:

```sh
node build.js
```

and commit both the `src/` change and the updated `SignatureTutor.html`.
`build.js` has no dependencies (plain Node, no npm install needed) and is
idempotent — running it twice in a row produces no further diff. It works by
replacing the content between matching marker comments
(`// @inline:<id>:start` / `:end`, or `/* @inline:<id>:start */` for CSS) in
the HTML with the current contents of the corresponding `src/` file; see the
comment at the top of `build.js` for how new source files get their own
block added automatically.

## Licensing notes for vendored/generated assets

As the signature engine is rebuilt (see `PLAN.md`), it incorporates:
- Public-domain Hershey stroke font data and SIL Open Font License (OFL)
  EMS Allure font data, extracted by `tools/extract-glyphs.mjs` into
  `src/glyph-data.js` (license notice carried in that generated file's
  header).
- Optionally, a pretrained neural handwriting-synthesis model trained on
  IAM-OnDB, a dataset licensed for non-commercial research use. That engine
  is an additive, removable feature — see `PLAN.md` Phase B — and should be
  reconsidered before any commercial use of this app.
