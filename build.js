#!/usr/bin/env node
'use strict';

// Regenerates SignatureTutor.html's inline <style>/<script> blocks from the
// canonical sources in src/*. SignatureTutor.html must stay a single,
// double-click-runnable file (no bundler, no build step for end users), so
// this script's only job is keeping that file in sync with src/ instead of
// letting them drift into two copies of the same code.
//
// Usage: node build.js
//
// How it works: each MANIFEST entry owns a pair of marker comments inside
// SignatureTutor.html (`@inline:<id>:start` / `@inline:<id>:end`). Everything
// between those two marker lines is replaced with the current contents of
// the entry's file. If an entry's markers don't exist yet (a later phase
// adding a new source file), a whole new tagged block is inserted right
// before the next manifest entry's block, so new phases only ever need to
// append a manifest line — see PLAN.md.
//
// MANIFEST order matters: this is the order the blocks are inlined into the
// page, and later blocks may reference globals earlier blocks attach to
// `window`. Do not reorder existing entries without checking that.
const MANIFEST = [
  { id: 'app-css', file: 'src/app.css', type: 'css' },
  { id: 'signature-engine', file: 'src/signature-engine.jsx', type: 'babel' },
  { id: 'screens-1-3', file: 'src/screens-1-3.jsx', type: 'babel' },
  { id: 'screens-4-6', file: 'src/screens-4-6.jsx', type: 'babel' },
  { id: 'app', file: 'src/app.jsx', type: 'babel' },
];

const fs = require('fs');
const path = require('path');

const ROOT = __dirname;
const HTML_PATH = path.join(ROOT, 'SignatureTutor.html');

function startMarker(entry) {
  return entry.type === 'css' ? `/* @inline:${entry.id}:start */` : `// @inline:${entry.id}:start`;
}
function endMarker(entry) {
  return entry.type === 'css' ? `/* @inline:${entry.id}:end */` : `// @inline:${entry.id}:end`;
}
function openTag(entry) {
  if (entry.type === 'css') return null; // css block reuses the page's single <style>, never opens its own tag
  if (entry.type === 'babel') return '<script type="text/babel" data-presets="react">';
  if (entry.type === 'plain') return '<script>';
  throw new Error(`build.js: unknown type "${entry.type}" for entry "${entry.id}"`);
}
function closeTag(entry) {
  return entry.type === 'css' ? null : '</script>';
}

function readSource(entry) {
  const p = path.join(ROOT, entry.file);
  if (!fs.existsSync(p)) {
    throw new Error(`build.js: source file missing for "${entry.id}": ${entry.file}`);
  }
  // Normalize trailing whitespace so re-running the build is idempotent
  // regardless of how the editor left the file's last line(s).
  return fs.readFileSync(p, 'utf8').replace(/\s+$/, '') + '\n';
}

function countLineMatches(lines, needle) {
  let n = 0;
  for (const l of lines) if (l.trim() === needle) n++;
  return n;
}

function findLineIndex(lines, needle) {
  return lines.findIndex((l) => l.trim() === needle);
}

function replaceBlock(lines, entry, content) {
  const sMark = startMarker(entry);
  const eMark = endMarker(entry);
  const sIdx = findLineIndex(lines, sMark);
  const eIdx = findLineIndex(lines, eMark);
  if (sIdx === -1 || eIdx === -1 || eIdx <= sIdx) {
    throw new Error(`build.js: could not locate a valid marker span for "${entry.id}"`);
  }
  const before = lines.slice(0, sIdx + 1);
  const after = lines.slice(eIdx);
  const body = content.replace(/\n$/, '').split('\n');
  return [...before, ...body, ...after];
}

function insertBlock(lines, entry, content) {
  // Find the first later manifest entry whose markers already exist in the
  // file, and insert this entry's whole block immediately before it. If no
  // later entry exists yet either, insert before </body>.
  const idx = MANIFEST.findIndex((e) => e.id === entry.id);
  let anchorLineIdx = -1;
  for (let i = idx + 1; i < MANIFEST.length; i++) {
    const later = MANIFEST[i];
    const laterStart = findLineIndex(lines, startMarker(later));
    if (laterStart !== -1) {
      // The line immediately above the later block's start marker is
      // assumed to be its opening tag (guaranteed by how this script writes
      // blocks) — insert before that line.
      anchorLineIdx = laterStart - 1;
      break;
    }
  }
  if (anchorLineIdx === -1) {
    anchorLineIdx = lines.findIndex((l) => l.trim() === '</body>');
    if (anchorLineIdx === -1) throw new Error('build.js: could not find </body> to anchor a new block');
  }

  const body = content.replace(/\n$/, '').split('\n');
  const block = [openTag(entry), startMarker(entry), ...body, endMarker(entry), closeTag(entry)];
  return [...lines.slice(0, anchorLineIdx), ...block, ...lines.slice(anchorLineIdx)];
}

function main() {
  let lines = fs.readFileSync(HTML_PATH, 'utf8').split('\n');

  for (const entry of MANIFEST) {
    const content = readSource(entry);
    const sMark = startMarker(entry);
    const eMark = endMarker(entry);
    const sCount = countLineMatches(lines, sMark);
    const eCount = countLineMatches(lines, eMark);

    if (sCount === 0 && eCount === 0) {
      lines = insertBlock(lines, entry, content);
    } else if (sCount === 1 && eCount === 1) {
      lines = replaceBlock(lines, entry, content);
    } else {
      throw new Error(
        `build.js: marker for "${entry.id}" appears ${sCount} start / ${eCount} end times (expected exactly 1 of each, or 0 of each to insert a new block)`
      );
    }
  }

  fs.writeFileSync(HTML_PATH, lines.join('\n'));
  console.log(`build.js: regenerated ${path.relative(ROOT, HTML_PATH)} from ${MANIFEST.length} source file(s).`);
}

main();
