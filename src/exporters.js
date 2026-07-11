// exporters.js — workbook PDF, SVG/PNG downloads, and shareable-link copy.
// Plain JS (no JSX): builds raw SVG DOM nodes directly from
// window.buildSignature() output, since jsPDF/svg2pdf need real DOM nodes
// to render from and this must also run from non-React call sites
// (WorksheetScreen's "Download PDF" button calls makeWorkbook directly).

(function () {
  'use strict';

  var JSPDF_URL = 'https://cdn.jsdelivr.net/npm/jspdf@3.0.3/dist/jspdf.umd.min.js';
  var SVG2PDF_URL = 'https://cdn.jsdelivr.net/npm/svg2pdf.js@2.7.0/dist/svg2pdf.umd.min.js';
  var SVG_NS = 'http://www.w3.org/2000/svg';

  function injectScript(src) {
    return new Promise(function (resolve, reject) {
      var s = document.createElement('script');
      s.src = src;
      s.onload = function () { resolve(); };
      s.onerror = function () { reject(new Error('exporters: failed to load ' + src)); };
      document.head.appendChild(s);
    });
  }

  var pdfLibsPromise = null;
  function loadPdfLibs() {
    if (pdfLibsPromise) return pdfLibsPromise;
    pdfLibsPromise = (async function () {
      if (!window.jspdf) await injectScript(JSPDF_URL);
      if (!window.jspdf.jsPDF.API.svg) await injectScript(SVG2PDF_URL);
      return window.jspdf.jsPDF;
    })();
    return pdfLibsPromise;
  }

  function slug(name) {
    var s = String(name || 'signature').toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
    return s || 'signature';
  }

  function downloadBlob(blob, filename) {
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(function () { URL.revokeObjectURL(url); }, 4000);
  }

  // ---- color blend toward white (fade that survives print/rasterization) ----
  function hexToRgb(hex) {
    var m = /^#?([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(hex);
    if (!m) return [20, 17, 13];
    return [parseInt(m[1], 16), parseInt(m[2], 16), parseInt(m[3], 16)];
  }
  function blendToWhite(hex, amount) {
    // amount: 1 = full ink color, 0 = white
    var rgb = hexToRgb(hex);
    var r = Math.round(rgb[0] + (255 - rgb[0]) * (1 - amount));
    var g = Math.round(rgb[1] + (255 - rgb[1]) * (1 - amount));
    var b = Math.round(rgb[2] + (255 - rgb[2]) * (1 - amount));
    return 'rgb(' + r + ',' + g + ',' + b + ')';
  }

  // ---- Build a standalone <svg> DOM node for one signature render ----
  // opts.mode: 'ink' | 'line'. opts.fade: 0..1 blend-to-white amount (line mode only).
  // opts.arrows: number stroke order (line mode only). opts.color: base ink hex.
  function buildSignatureSvgNode(name, styleKey, sigOpts, variant, renderOpts) {
    renderOpts = renderOpts || {};
    var width = renderOpts.width || 720;
    var height = renderOpts.height || 160;
    var mode = renderOpts.mode || 'ink';
    var fade = renderOpts.fade != null ? renderOpts.fade : 1;
    var color = renderOpts.color || '#14110d';
    var sig = window.buildSignature(name || 'Your Name', styleKey, Object.assign({}, sigOpts, { width: width, height: height, variant: variant || 0 }));

    var svg = document.createElementNS(SVG_NS, 'svg');
    svg.setAttribute('xmlns', SVG_NS);
    svg.setAttribute('viewBox', sig.viewBox);
    svg.setAttribute('width', String(width));
    svg.setAttribute('height', String(height));

    var strokeColor = mode === 'line' ? blendToWhite(color, fade) : color;
    var arrowN = 0;
    for (var i = 0; i < sig.strokes.length; i++) {
      var s = sig.strokes[i];
      if (mode === 'ink' && s.inkD) {
        var p = document.createElementNS(SVG_NS, 'path');
        p.setAttribute('d', s.inkD);
        p.setAttribute('fill', color);
        p.setAttribute('stroke', 'none');
        svg.appendChild(p);
        continue;
      }
      var line = document.createElementNS(SVG_NS, 'path');
      line.setAttribute('d', s.d);
      line.setAttribute('fill', 'none');
      line.setAttribute('stroke', strokeColor);
      line.setAttribute('stroke-width', String(renderOpts.strokeW || 2.2));
      line.setAttribute('stroke-linecap', 'round');
      line.setAttribute('stroke-linejoin', 'round');
      svg.appendChild(line);

      if (renderOpts.arrows && s.kind !== 'flourish' && s.kind !== 'underline') {
        arrowN += 1;
        var m = s.d.match(/M\s*([-\d.]+)\s+([-\d.]+)/);
        if (m) {
          var ax = Math.max(10, Math.min(width - 10, parseFloat(m[1]) - 8));
          var ay = Math.max(10, Math.min(height - 10, parseFloat(m[2]) - 12));
          var circ = document.createElementNS(SVG_NS, 'circle');
          circ.setAttribute('cx', String(ax)); circ.setAttribute('cy', String(ay)); circ.setAttribute('r', '9');
          circ.setAttribute('fill', '#c6522b');
          svg.appendChild(circ);
          var txt = document.createElementNS(SVG_NS, 'text');
          txt.setAttribute('x', String(ax)); txt.setAttribute('y', String(ay + 3));
          txt.setAttribute('text-anchor', 'middle'); txt.setAttribute('font-size', '11');
          txt.setAttribute('font-weight', '700'); txt.setAttribute('font-family', 'Inter, sans-serif');
          txt.setAttribute('fill', '#fff');
          txt.textContent = String(arrowN);
          svg.appendChild(txt);
        }
      }
    }
    return svg;
  }

  // ---- Hidden live-DOM staging area (svg2pdf needs real, attached nodes) ----
  function withStagedNode(node, fn) {
    var host = document.createElement('div');
    host.style.cssText = 'position:fixed;left:-9999px;top:-9999px;';
    host.appendChild(node);
    document.body.appendChild(host);
    return Promise.resolve()
      .then(function () { return fn(); })
      .finally(function () { host.remove(); });
  }

  // ---- SVG export ----
  function exportSvg(name, styleKey, opts, variant) {
    var node = buildSignatureSvgNode(name, styleKey, opts, variant, { width: 1440, height: 360, mode: 'ink' });
    var xml = new XMLSerializer().serializeToString(node);
    if (!xml.match(/^<svg[^>]+xmlns=/)) xml = xml.replace('<svg', '<svg xmlns="' + SVG_NS + '"');
    var blob = new Blob([xml], { type: 'image/svg+xml' });
    downloadBlob(blob, slug(name) + '-signature.svg');
  }

  // ---- PNG export ----
  function exportPng(name, styleKey, opts, variant) {
    var node = buildSignatureSvgNode(name, styleKey, opts, variant, { width: 2160, height: 540, mode: 'ink' });
    var xml = new XMLSerializer().serializeToString(node);
    var svgBlob = new Blob([xml], { type: 'image/svg+xml;charset=utf-8' });
    var url = URL.createObjectURL(svgBlob);
    return new Promise(function (resolve, reject) {
      var img = new Image();
      img.onload = function () {
        var canvas = document.createElement('canvas');
        canvas.width = 2160; canvas.height = 540;
        var ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        URL.revokeObjectURL(url);
        canvas.toBlob(function (blob) {
          downloadBlob(blob, slug(name) + '-signature.png');
          resolve();
        }, 'image/png');
      };
      img.onerror = function () { URL.revokeObjectURL(url); reject(new Error('exporters: PNG rasterization failed')); };
      img.src = url;
    });
  }

  // ---- Workbook PDF ----
  var PAGE_SIZES = { a4: { w: 210, h: 297 }, letter: { w: 215.9, h: 279.4 } };
  var MARGIN = 18;

  async function renderRowIntoPdf(doc, name, styleKey, opts, variant, x, y, w, h, rowOpts) {
    var pxW = 900, pxH = Math.round(900 * (h / w));
    var node = buildSignatureSvgNode(name, styleKey, opts, variant, {
      width: pxW, height: pxH, mode: rowOpts.mode, fade: rowOpts.fade, arrows: rowOpts.arrows,
      strokeW: rowOpts.strokeW,
    });
    try {
      await withStagedNode(node, function () { return doc.svg(node, { x: x, y: y, width: w, height: h }); });
    } catch (err) {
      // Fallback: rasterize to canvas at ~300dpi and place as an image.
      var dpi = 300;
      var canvas = document.createElement('canvas');
      canvas.width = Math.round((w / 25.4) * dpi);
      canvas.height = Math.round((h / 25.4) * dpi);
      var xml = new XMLSerializer().serializeToString(node);
      var svgBlob = new Blob([xml], { type: 'image/svg+xml;charset=utf-8' });
      var url = URL.createObjectURL(svgBlob);
      await new Promise(function (resolve, reject) {
        var img = new Image();
        img.onload = function () {
          var ctx = canvas.getContext('2d');
          ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
          URL.revokeObjectURL(url);
          doc.addImage(canvas.toDataURL('image/png'), 'PNG', x, y, w, h);
          resolve();
        };
        img.onerror = function () { URL.revokeObjectURL(url); reject(new Error('exporters: row rasterization fallback failed')); };
        img.src = url;
      });
    }
  }

  function addRuleLines(doc, x, y, w, h) {
    var baselineY = y + h * 0.68;
    var xHeightY = y + h * 0.68 - h * 0.32;
    doc.setDrawColor(210, 205, 195);
    doc.setLineWidth(0.2);
    doc.line(x, baselineY, x + w, baselineY);
    doc.setLineDashPattern([0.8, 0.8], 0);
    doc.line(x, xHeightY, x + w, xHeightY);
    doc.setLineDashPattern([], 0);
  }

  async function makeWorkbook(name, styleKey, opts, variant, paper) {
    paper = paper === 'letter' ? 'letter' : 'a4';
    variant = variant || 0;
    var jsPDF = await loadPdfLibs();
    var size = PAGE_SIZES[paper];
    var doc = new jsPDF({ unit: 'mm', format: [size.w, size.h] });
    var cw = size.w - MARGIN * 2;
    var styleLabel = (window.SIG_STYLES[styleKey] || {}).label || styleKey;

    // Page 1: hero + stroke-order figure.
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(140, 130, 115);
    doc.text('SIGNATURETUTOR · WORKBOOK', MARGIN, MARGIN);
    doc.setFontSize(20);
    doc.setTextColor(20, 17, 13);
    doc.text(name, MARGIN, MARGIN + 10);
    doc.setFontSize(10);
    doc.setTextColor(140, 130, 115);
    var dateStr = new Date().toISOString().slice(0, 10);
    doc.text(styleLabel + ' · ' + dateStr, MARGIN, MARGIN + 16);

    var heroH = cw * 0.25;
    await renderRowIntoPdf(doc, name, styleKey, opts, variant, MARGIN, MARGIN + 22, cw, heroH, { mode: 'ink', arrows: false });
    addRuleLines(doc, MARGIN, MARGIN + 22, cw, heroH);

    var figY = MARGIN + 22 + heroH + 10;
    doc.setFontSize(9);
    doc.setTextColor(140, 130, 115);
    doc.text('STROKE ORDER', MARGIN, figY);
    var figH = cw * 0.2;
    await renderRowIntoPdf(doc, name, styleKey, opts, variant, MARGIN, figY + 4, cw, figH, { mode: 'line', fade: 1, arrows: true, strokeW: 1.8 });
    addRuleLines(doc, MARGIN, figY + 4, cw, figH);

    doc.setFontSize(9);
    doc.setTextColor(140, 130, 115);
    doc.text('Tip: practice from the numbered strokes, then trace the fading rows on the next pages.', MARGIN, size.h - MARGIN);

    // Pages 2-3: trace ladder, 8 rows/page, fading per an opacity ladder
    // implemented as a color blend toward white (not SVG opacity — more
    // reliable through svg2pdf/print pipelines).
    var LADDERS = [
      [1, 1, 0.8, 0.8, 0.6, 0.6, 0.45, 0.45],
      [0.3, 0.3, 0.15, 0.15, 0, 0, 0, 0],
    ];
    var rowH = 27;
    for (var page = 0; page < LADDERS.length; page++) {
      doc.addPage([size.w, size.h]);
      var ladder = LADDERS[page];
      var top = MARGIN;
      for (var r = 0; r < ladder.length; r++) {
        var fade = ladder[r];
        var y2 = top + r * rowH;
        if (fade > 0) {
          await renderRowIntoPdf(doc, name, styleKey, opts, variant, MARGIN, y2, cw, rowH - 4, { mode: 'line', fade: fade, arrows: r < 2, strokeW: 1.6 });
        }
        addRuleLines(doc, MARGIN, y2, cw, rowH - 4);
      }
    }

    // Page 4: blank rule rows.
    doc.addPage([size.w, size.h]);
    var blankRowH = (size.h - MARGIN * 2) / 10;
    for (var b = 0; b < 10; b++) {
      addRuleLines(doc, MARGIN, MARGIN + b * blankRowH, cw, blankRowH - 3);
    }

    doc.save(slug(name) + '-workbook.pdf');
  }

  Object.assign(window, { makeWorkbook, exportSvg, exportPng, slug });
})();
