// Screens 4-6: Hub, Worksheet, Practice, Export

// ─────────────── Hub ───────────────
function HubScreen({ name, style, opts, variant, go, onBack }) {
  return (
    <div className="screen wrap" style={{ paddingTop: 24 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 20 }}>
        <div>
          <div className="eyebrow" style={{ marginBottom: 12 }}>Your signature · ready</div>
          <h1 className="display" style={{ fontSize: 44, margin: 0 }}>What's next?</h1>
        </div>
        <button className="btn ghost" onClick={onBack}>
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"><path d="M11 7H3M7 3L3 7l4 4"/></svg>
          Tweak
        </button>
      </div>

      {/* Hero strip */}
      <div className="card" style={{ padding: 32, marginBottom: 24, display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 180 }}>
        <div style={{ height: 140, width: '100%' }}>
          <SignatureSVG name={name} style={style} opts={opts} variant={variant} renderMode="ink" strokeW={2.8} height={140} />
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 16 }}>
        <HubCard
          icon={<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"><path d="M3 18h18M3 12h18M3 6h18"/><path d="M7 6v12M11 6v12M15 6v12M19 6v12" strokeDasharray="2 2"/></svg>}
          title="Practice on tablet"
          desc="Use your stylus — get stroke order, ghost overlay, and live accuracy feedback."
          cta="Start practicing"
          onClick={() => go('practice')}
          primary
        />
        <HubCard
          icon={<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"><rect x="4" y="3" width="16" height="18" rx="2"/><path d="M8 7h8M8 11h8M8 15h5"/></svg>}
          title="Print worksheet"
          desc="8 rows that fade from full guide → blank. Trace by hand with any pen."
          cta="Open worksheet"
          onClick={() => go('worksheet')}
        />
        <HubCard
          icon={<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"><path d="M12 3v12M7 10l5 5 5-5M5 21h14"/></svg>}
          title="Export signature"
          desc="SVG, PNG, a practice workbook PDF, or a shareable link."
          cta="Open export"
          onClick={() => go('export')}
        />
      </div>
    </div>
  );
}

function HubCard({ icon, title, desc, cta, onClick, primary }) {
  return (
    <div className="card" style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 10, cursor: 'pointer' }} onClick={onClick}>
      <div style={{ width: 44, height: 44, borderRadius: 12, background: primary ? 'var(--ink)' : 'rgba(20,17,13,0.06)', color: primary ? '#f6f1e6' : 'var(--ink)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        {icon}
      </div>
      <h3 style={{ margin: '8px 0 0', fontSize: 18, fontFamily: 'var(--serif)', fontWeight: 500, letterSpacing: '-0.01em' }}>{title}</h3>
      <p className="muted" style={{ margin: 0, fontSize: 13, lineHeight: 1.45 }}>{desc}</p>
      <div style={{ marginTop: 'auto', paddingTop: 12 }}>
        <span className={`btn ${primary ? 'primary' : ''} sm`} style={{ pointerEvents: 'none' }}>
          {cta}
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"><path d="M3 7h8M7 3l4 4-4 4"/></svg>
        </span>
      </div>
    </div>
  );
}

// ─────────────── Worksheet ───────────────
function WorksheetScreen({ name, style, opts, variant, onBack }) {
  const [downloading, setDownloading] = React.useState(false);
  const downloadPdf = async () => {
    setDownloading(true);
    try {
      await window.makeWorkbook(name, style, opts, variant, 'a4');
    } catch (err) {
      console.error('workbook export failed', err);
      window.alert('Could not build the PDF: ' + (err?.message || err));
    } finally {
      setDownloading(false);
    }
  };
  const rows = [
    { stage: 'guide', arrows: true, label: 'Full · arrows' },
    { stage: 'guide', arrows: true, label: 'Full · arrows' },
    { stage: 'guide', arrows: false, label: 'Full trace' },
    { stage: 'guide', arrows: false, label: 'Full trace' },
    { stage: 'fade50', arrows: false, label: '50% fade' },
    { stage: 'fade50', arrows: false, label: '50% fade' },
    { stage: 'fade20', arrows: false, label: '20% fade' },
    { stage: 'blank', arrows: false, label: 'Blank' },
  ];
  return (
    <div className="screen wrap" style={{ paddingTop: 24 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <div>
          <div className="eyebrow" style={{ marginBottom: 10 }}>Practice worksheet</div>
          <h1 className="display" style={{ fontSize: 36, margin: 0 }}>Trace <span style={{ fontStyle: 'italic' }}>{name}</span></h1>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <button className="btn" onClick={onBack}>
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"><path d="M11 7H3M7 3L3 7l4 4"/></svg>
            Hub
          </button>
          <button className="btn" onClick={() => window.print()}>
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"><path d="M4 6V2h8v4M4 10H2v-4h12v4h-2M4 10h8v4H4z"/></svg>
            Print
          </button>
          <button className="btn primary" onClick={downloadPdf} disabled={downloading}>
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"><path d="M8 2v9M4 7l4 4 4-4M3 14h10"/></svg>
            {downloading ? 'Building…' : 'Download PDF'}
          </button>
        </div>
      </div>

      {/* Worksheet paper */}
      <div className="card worksheet-paper" style={{ padding: 0, overflow: 'hidden', background: '#fefdfa' }}>
        <div style={{ padding: '24px 32px 18px', borderBottom: '1px solid rgba(20,17,13,0.06)', display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
          <div>
            <div style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.12em', color: 'var(--ink-3)' }}>SignatureTutor · Worksheet</div>
            <div className="display" style={{ fontSize: 22, marginTop: 6 }}>{name}</div>
          </div>
          <div style={{ fontSize: 11, color: 'var(--ink-3)', letterSpacing: '0.08em', textTransform: 'uppercase' }}>
            {STYLE_LIST.find(s => s.key === style)?.name} · 8 rows
          </div>
        </div>
        {rows.map((r, i) => (
          <div key={i} className="ws-row">
            <span className="num">{String(i + 1).padStart(2, '0')}</span>
            <span className="stage-badge">{r.label}</span>
            <div style={{ width: '100%', height: 58 }}>
              {r.stage !== 'blank' && (
                <SignatureSVG
                  name={name}
                  style={style}
                  opts={opts}
                  variant={variant}
                  renderMode="line"
                  strokeColor="#14110d"
                  strokeW={2.2}
                  opacity={r.stage === 'guide' ? 1 : r.stage === 'fade50' ? 0.35 : 0.14}
                  showArrows={r.arrows}
                  height={58}
                />
              )}
            </div>
          </div>
        ))}
        <div style={{ padding: '14px 32px', fontSize: 10, color: 'var(--ink-3)', textAlign: 'center', letterSpacing: '0.05em' }}>
          Tip: start from row 1 and move down. Row 1-2 show stroke order · rows 5-7 fade · row 8 is blank.
        </div>
      </div>
    </div>
  );
}

// The ghost overlay is a `position:absolute; inset: GHOST_INSET` box around
// a SignatureSVG using preserveAspectRatio="xMidYMid meet" — accuracy
// scoring maps the reference signature into canvas space with the exact
// same box-fit math so the two never drift apart.
const GHOST_INSET = 30;
const GHOST_HEIGHT = 280;
const GHOST_WIDTH = 720;

function sigToCanvasMapper(canvasW, canvasH) {
  const boxW = canvasW - GHOST_INSET * 2;
  const boxH = canvasH - GHOST_INSET * 2;
  const scale = Math.min(boxW / GHOST_WIDTH, boxH / GHOST_HEIGHT);
  const offsetX = GHOST_INSET + (boxW - GHOST_WIDTH * scale) / 2;
  const offsetY = GHOST_INSET + (boxH - GHOST_HEIGHT * scale) / 2;
  return { scale, map: (x, y) => [offsetX + x * scale, offsetY + y * scale] };
}

function resamplePts(pts, spacing) {
  if (pts.length < 2) return pts.slice();
  const out = [pts[0]];
  let carry = 0;
  for (let i = 1; i < pts.length; i++) {
    const a = pts[i - 1], b = pts[i];
    const segLen = Math.hypot(b[0] - a[0], b[1] - a[1]);
    if (segLen < 1e-6) continue;
    let t = carry;
    while (t < segLen) {
      const f = t / segLen;
      out.push([a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f]);
      t += spacing;
    }
    carry = t - segLen;
  }
  return out;
}

function gridBucket(pts, cellSize) {
  const grid = new Map();
  pts.forEach((p, i) => {
    const key = Math.floor(p[0] / cellSize) + ',' + Math.floor(p[1] / cellSize);
    if (!grid.has(key)) grid.set(key, []);
    grid.get(key).push(p);
  });
  return {
    hasNeighborWithin(p, tol) {
      const cx = Math.floor(p[0] / cellSize), cy = Math.floor(p[1] / cellSize);
      for (let dx = -1; dx <= 1; dx++) {
        for (let dy = -1; dy <= 1; dy++) {
          const bucket = grid.get((cx + dx) + ',' + (cy + dy));
          if (!bucket) continue;
          for (const q of bucket) if (Math.hypot(q[0] - p[0], q[1] - p[1]) <= tol) return true;
        }
      }
      return false;
    },
  };
}

function computeAccuracy(userPtsFlat, name, style, opts, variant, canvasW, canvasH) {
  const sig = window.buildSignature(name || 'Your Name', style, { ...opts, width: GHOST_WIDTH, height: GHOST_HEIGHT, variant });
  const { scale, map } = sigToCanvasMapper(canvasW, canvasH);
  const refFlat = [];
  sig.strokes.forEach(s => {
    if (s.kind !== 'body' && s.kind !== 'extra') return;
    s.pts.forEach(([x, y]) => refFlat.push(map(x, y)));
  });
  if (!refFlat.length || !userPtsFlat.length) return { score: 0, verdict: 'Keep tracing' };

  const tol = 14 * scale;
  const refSamples = resamplePts(refFlat, 4);
  const userSamples = resamplePts(userPtsFlat, 4);
  const refGrid = gridBucket(refSamples, tol);
  const userGrid = gridBucket(userSamples, tol);

  const covered = refSamples.filter(p => userGrid.hasNeighborWithin(p, tol)).length;
  const precise = userSamples.filter(p => refGrid.hasNeighborWithin(p, tol)).length;
  const coverage = covered / refSamples.length;
  const precision = precise / userSamples.length;
  const score = Math.round(100 * (0.6 * coverage + 0.4 * precision));
  const verdict = score >= 85 ? 'Excellent' : score >= 65 ? 'Close' : 'Keep tracing';
  return { score, verdict };
}

function PracticeScreen({ name, style, opts, variant, onBack }) {
  const [row, setRow] = React.useState(0);
  const [penColor, setPenColor] = React.useState('#14110d');
  const [result, setResult] = React.useState(null);
  const [strokeCount, setStrokeCount] = React.useState(0);
  const [showGhost, setShowGhost] = React.useState(true);
  const canvasRef = React.useRef(null);
  const dprRef = React.useRef(window.devicePixelRatio || 1);
  const drawingRef = React.useRef(null);
  const strokesRef = React.useRef([]); // CSS-pixel-space points, one array per stroke

  const stages = [
    { stage: 'guide',  label: 'Full guide',    arrows: true,  opacity: 1 },
    { stage: 'guide',  label: 'Full guide',    arrows: false, opacity: 1 },
    { stage: 'fade50', label: '50% fade',      arrows: false, opacity: 0.35 },
    { stage: 'fade50', label: '50% fade',      arrows: false, opacity: 0.35 },
    { stage: 'fade20', label: '20% fade',      arrows: false, opacity: 0.14 },
    { stage: 'fade20', label: '20% fade',      arrows: false, opacity: 0.14 },
    { stage: 'blank',  label: 'Freehand',      arrows: false, opacity: 0 },
    { stage: 'blank',  label: 'Freehand · last', arrows: false, opacity: 0 },
  ];
  const cur = stages[row];
  const progress = ((row + 1) / stages.length) * 100;

  const redraw = () => {
    const c = canvasRef.current; if (!c) return;
    const ctx = c.getContext('2d');
    ctx.clearRect(0, 0, c.width, c.height);
    ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    for (const strokePts of strokesRef.current) {
      for (let i = 1; i < strokePts.length; i++) {
        const a = strokePts[i - 1], b = strokePts[i];
        ctx.strokeStyle = a.color;
        ctx.lineWidth = 1.5 + b.p * 3.2;
        ctx.beginPath();
        ctx.moveTo(a.x, a.y);
        ctx.lineTo(b.x, b.y);
        ctx.stroke();
      }
    }
  };

  // Canvas drawing — CSS-pixel space throughout; the backing store's dpr
  // scale is applied once via ctx.setTransform in the resize effect, so
  // pointer coordinates need no further scaling (the old bug double- and
  // triple-counted the dpr/backing-store factor here).
  const onPointerDown = (e) => {
    const c = canvasRef.current; if (!c) return;
    c.setPointerCapture(e.pointerId);
    const rect = c.getBoundingClientRect();
    const x = e.clientX - rect.left, y = e.clientY - rect.top;
    const pressure = e.pressure || 0.5;
    drawingRef.current = [{ x, y, p: pressure, color: penColor }];
  };
  const onPointerMove = (e) => {
    if (!drawingRef.current) return;
    const c = canvasRef.current;
    const rect = c.getBoundingClientRect();
    const x = e.clientX - rect.left, y = e.clientY - rect.top;
    const pressure = e.pressure || 0.5;
    const pts = drawingRef.current;
    const last = pts[pts.length - 1];
    pts.push({ x, y, p: pressure, color: penColor });
    const ctx = c.getContext('2d');
    ctx.strokeStyle = penColor;
    ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    ctx.lineWidth = 1.5 + pressure * 3.2;
    ctx.beginPath();
    ctx.moveTo(last.x, last.y);
    ctx.lineTo(x, y);
    ctx.stroke();
  };
  const onPointerUp = () => {
    if (!drawingRef.current) return;
    strokesRef.current.push(drawingRef.current);
    drawingRef.current = null;
    setStrokeCount(strokesRef.current.length);
  };

  const clearCanvas = () => {
    strokesRef.current = [];
    redraw();
    setStrokeCount(0);
    setResult(null);
  };
  const undo = () => {
    strokesRef.current.pop();
    redraw();
    setStrokeCount(strokesRef.current.length);
    setResult(null);
  };

  const checkAccuracy = () => {
    const c = canvasRef.current; if (!c) return;
    const rect = c.getBoundingClientRect();
    const userPtsFlat = [];
    for (const strokePts of strokesRef.current) for (const p of strokePts) userPtsFlat.push([p.x, p.y]);
    setResult(computeAccuracy(userPtsFlat, name, style, opts, variant, rect.width, rect.height));
  };

  const nextRow = () => {
    clearCanvas();
    setRow(r => Math.min(stages.length - 1, r + 1));
  };
  const prevRow = () => {
    clearCanvas();
    setRow(r => Math.max(0, r - 1));
  };

  // Resize canvas to its container (CSS-pixel space, dpr backing store).
  React.useEffect(() => {
    const c = canvasRef.current; if (!c) return;
    const resize = () => {
      const rect = c.getBoundingClientRect();
      const dpr = dprRef.current;
      c.width = Math.round(rect.width * dpr);
      c.height = Math.round(rect.height * dpr);
      const ctx = c.getContext('2d');
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      redraw();
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(c);
    return () => ro.disconnect();
  }, []);

  return (
    <div className="screen wrap" style={{ paddingTop: 20, paddingBottom: 20 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <button className="btn ghost sm" onClick={onBack}>
            <svg width="12" height="12" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"><path d="M11 7H3M7 3L3 7l4 4"/></svg>
            Exit
          </button>
          <div>
            <div className="eyebrow" style={{ marginBottom: 4 }}>Practice · row {row + 1} of {stages.length}</div>
            <div className="display" style={{ fontSize: 22 }}>{name}</div>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <span className="faint" style={{ fontSize: 12, display: 'inline-flex', alignItems: 'center', gap: 6 }}>
            <span className="live-dot"></span> Live · pressure on
          </span>
          <div style={{ width: 160, height: 4, background: 'rgba(20,17,13,0.08)', borderRadius: 999, overflow: 'hidden' }}>
            <div style={{ width: `${progress}%`, height: '100%', background: 'var(--ink)', transition: 'width 0.3s' }}></div>
          </div>
        </div>
      </div>

      {/* Coach card */}
      <div className="card" style={{ padding: '14px 20px', marginBottom: 14, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <div style={{ width: 32, height: 32, borderRadius: 10, background: 'var(--accent)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14 }}>★</div>
          <div>
            <div style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--ink-3)' }}>Coach · {cur.label}</div>
            <div style={{ fontSize: 14, marginTop: 2 }}>
              {row === 0 && 'Follow the numbered strokes. Keep your pen down through each word.'}
              {row === 1 && 'Trace the full guide. Try to match the slant and spacing.'}
              {(row === 2 || row === 3) && 'Guide is lighter now — use it as a hint, not a cage.'}
              {(row === 4 || row === 5) && 'Almost gone. Trust your muscle memory.'}
              {row >= 6 && 'Freehand. Do it three times without looking back.'}
            </div>
          </div>
        </div>
        {result !== null && (
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: 11, color: 'var(--ink-3)', textTransform: 'uppercase', letterSpacing: '0.1em' }}>{result.verdict}</div>
            <div className="display" style={{ fontSize: 28, color: result.score >= 85 ? 'var(--green)' : result.score >= 65 ? 'var(--accent)' : 'var(--ink-2)' }}>{result.score}%</div>
          </div>
        )}
      </div>

      {/* Canvas */}
      <div className="card" style={{ padding: 0, overflow: 'hidden', position: 'relative', minHeight: 340 }}>
        {/* Ghost layer */}
        {showGhost && cur.opacity > 0 && (
          <div style={{ position: 'absolute', inset: 30, pointerEvents: 'none' }}>
            <SignatureSVG name={name} style={style} opts={opts} variant={variant} renderMode="line" strokeColor="#14110d" strokeW={2.6} opacity={cur.opacity} showArrows={cur.arrows} height={280} />
          </div>
        )}
        {/* Drawing canvas */}
        <canvas
          ref={canvasRef}
          style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', touchAction: 'none', cursor: 'crosshair' }}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
        />
        {/* Baseline */}
        <div style={{ position: 'absolute', left: 30, right: 30, top: '62%', height: 1, background: 'rgba(20,17,13,0.08)', pointerEvents: 'none' }}></div>
      </div>

      {/* Dock */}
      <div className="card" style={{ padding: '12px 18px', marginTop: 14, display: 'flex', alignItems: 'center', gap: 12 }}>
        <div style={{ display: 'flex', gap: 6 }}>
          {['#14110d', '#2c4f78', '#c6522b', '#4a7a4f'].map(c => (
            <button key={c} className="iconbtn" style={{ background: c, border: penColor === c ? '2px solid var(--ink)' : '0.5px solid rgba(20,17,13,0.1)' }} onClick={() => setPenColor(c)}></button>
          ))}
        </div>
        <div style={{ width: 1, height: 24, background: 'rgba(20,17,13,0.1)' }}></div>
        <button className="iconbtn" title="Undo" onClick={undo} disabled={strokeCount === 0}>
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"><path d="M3 8a5 5 0 1 1 5 5H6M3 5v3h3"/></svg>
        </button>
        <button className="iconbtn" title="Clear" onClick={clearCanvas} disabled={strokeCount === 0}>
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"><path d="M3 3l10 10M13 3L3 13"/></svg>
        </button>
        <button className={`iconbtn ${showGhost ? 'active' : ''}`} title="Toggle ghost" onClick={() => setShowGhost(g => !g)}>
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"><path d="M2 8a6 6 0 0 1 12 0v6l-2-1.5L10 14l-2-1.5L6 14l-2-1.5L2 14z"/></svg>
        </button>
        <div style={{ flex: 1 }}></div>
        <button className="btn sm" onClick={prevRow} disabled={row === 0}>◀ Prev</button>
        <button className="btn sm" onClick={checkAccuracy} disabled={strokeCount === 0}>
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M2 7l3 3 7-7"/></svg>
          Check
        </button>
        <button className="btn primary sm" onClick={nextRow} disabled={row === stages.length - 1}>Next row ▶</button>
      </div>
    </div>
  );
}

// ─────────────── Export modal ───────────────
function ExportModal({ name, style, opts, variant, onClose }) {
  const [copied, setCopied] = React.useState(false);
  const [busy, setBusy] = React.useState(null);
  const [replayKey, setReplayKey] = React.useState(0);
  const copyLink = () => {
    const params = new URLSearchParams({ name, style, f: opts.flourish, s: opts.slant, w: opts.weight });
    navigator.clipboard?.writeText(`https://signature-tutor.app/s/${btoa(params.toString()).slice(0, 10)}`);
    setCopied(true);
    setTimeout(() => setCopied(false), 1600);
  };
  const runExport = async (key) => {
    setBusy(key);
    try {
      if (key === 'svg') window.exportSvg(name, style, opts, variant);
      else if (key === 'png') await window.exportPng(name, style, opts, variant);
      else if (key === 'pdf') await window.makeWorkbook(name, style, opts, variant, 'a4');
      else if (key === 'replay') setReplayKey(k => k + 1);
    } catch (err) {
      console.error('export failed', err);
      window.alert('Export failed: ' + (err?.message || err));
    } finally {
      setBusy(null);
    }
  };
  return (
    <div className="backdrop" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 520 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 }}>
          <div>
            <div className="eyebrow" style={{ marginBottom: 6 }}>Export</div>
            <h2 className="display" style={{ fontSize: 28, margin: 0 }}>Take it with you</h2>
          </div>
          <button className="iconbtn" onClick={onClose}>
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><path d="M3 3l8 8M11 3l-8 8"/></svg>
          </button>
        </div>

        <div style={{ padding: '20px 24px', background: '#fefdfa', border: '0.5px solid rgba(20,17,13,0.08)', borderRadius: 12, marginBottom: 18, height: 110 }}>
          <SignatureSVG key={replayKey} name={name} style={style} opts={opts} variant={variant} renderMode="ink" height={80} strokeW={2.4} animate={true} />
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          {[
            { k: 'svg', t: 'SVG', d: 'Vector, infinite resolution' },
            { k: 'png', t: 'PNG', d: 'Transparent raster' },
            { k: 'pdf', t: 'Worksheet PDF', d: '4-page practice workbook' },
            { k: 'replay', t: 'Replay animation', d: 'Watch the stroke-by-stroke reveal' },
          ].map(o => (
            <button
              key={o.k}
              className="glass"
              disabled={busy !== null}
              style={{ padding: 14, textAlign: 'left', border: '0.5px solid rgba(20,17,13,0.1)', background: 'rgba(255,255,255,0.6)', cursor: busy ? 'wait' : 'pointer', borderRadius: 12, fontFamily: 'inherit', opacity: busy && busy !== o.k ? 0.5 : 1 }}
              onClick={() => runExport(o.k)}
            >
              <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 2 }}>{busy === o.k ? 'Working…' : o.t}</div>
              <div style={{ fontSize: 11, color: 'var(--ink-3)' }}>{o.d}</div>
            </button>
          ))}
        </div>

        <div style={{ marginTop: 16, padding: 14, background: 'rgba(20,17,13,0.04)', borderRadius: 12, display: 'flex', alignItems: 'center', gap: 10 }}>
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"><path d="M7 10l-2 2a3 3 0 1 1-4-4l2-2M9 6l2-2a3 3 0 1 1 4 4l-2 2M6 10l4-4"/></svg>
          <div style={{ flex: 1, fontSize: 12, fontFamily: 'ui-monospace, Menlo, monospace', color: 'var(--ink-2)' }}>
            signature-tutor.app/s/{btoa(name).slice(0, 10)}
          </div>
          <button className="btn sm" onClick={copyLink}>{copied ? '✓ Copied' : 'Copy link'}</button>
        </div>
      </div>
    </div>
  );
}

Object.assign(window, { HubScreen, WorksheetScreen, PracticeScreen, ExportModal });
