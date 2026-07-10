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
          desc="SVG, PNG, or a shareable link — plus an animated stroke-order GIF."
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
function WorksheetScreen({ name, style, opts, variant, onBack, onExport }) {
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
          <button className="btn primary" onClick={onExport}>
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"><path d="M8 2v9M4 7l4 4 4-4M3 14h10"/></svg>
            Download PDF
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

// ─────────────── Practice canvas ───────────────
function PracticeScreen({ name, style, opts, variant, onBack }) {
  const [row, setRow] = React.useState(0);
  const [penColor, setPenColor] = React.useState('#14110d');
  const [score, setScore] = React.useState(null);
  const [strokes, setStrokes] = React.useState([]);
  const [showGhost, setShowGhost] = React.useState(true);
  const canvasRef = React.useRef(null);
  const overlayRef = React.useRef(null);
  const drawingRef = React.useRef(null);

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

  // Canvas drawing
  const onPointerDown = (e) => {
    const c = canvasRef.current; if (!c) return;
    c.setPointerCapture(e.pointerId);
    const rect = c.getBoundingClientRect();
    const x = (e.clientX - rect.left) * (c.width / rect.width);
    const y = (e.clientY - rect.top)  * (c.height / rect.height);
    const pressure = e.pressure || 0.5;
    drawingRef.current = { points: [{ x, y, p: pressure, t: performance.now() }] };
    const ctx = c.getContext('2d');
    ctx.strokeStyle = penColor;
    ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  };
  const onPointerMove = (e) => {
    if (!drawingRef.current) return;
    const c = canvasRef.current;
    const rect = c.getBoundingClientRect();
    const x = (e.clientX - rect.left) * (c.width / rect.width);
    const y = (e.clientY - rect.top)  * (c.height / rect.height);
    const pressure = e.pressure || 0.5;
    const pts = drawingRef.current.points;
    const last = pts[pts.length - 1];
    pts.push({ x, y, p: pressure, t: performance.now() });
    const ctx = c.getContext('2d');
    ctx.beginPath();
    ctx.lineWidth = 1.5 + pressure * 3.2;
    ctx.moveTo(last.x, last.y);
    ctx.lineTo(x, y);
    ctx.stroke();
  };
  const onPointerUp = () => {
    if (!drawingRef.current) return;
    setStrokes(s => [...s, drawingRef.current]);
    drawingRef.current = null;
  };

  const clearCanvas = () => {
    const c = canvasRef.current;
    if (!c) return;
    c.getContext('2d').clearRect(0, 0, c.width, c.height);
    setStrokes([]);
    setScore(null);
  };

  const checkAccuracy = () => {
    // Fake-but-plausible score: weight by # strokes + a seeded noise
    const n = strokes.length + 1;
    const s = Math.min(98, 60 + n * 4 + Math.floor(Math.random() * 20));
    setScore(s);
  };

  const nextRow = () => {
    clearCanvas();
    setRow(r => Math.min(stages.length - 1, r + 1));
  };
  const prevRow = () => {
    clearCanvas();
    setRow(r => Math.max(0, r - 1));
  };

  // Resize canvas to its container
  React.useEffect(() => {
    const c = canvasRef.current; if (!c) return;
    const resize = () => {
      const rect = c.getBoundingClientRect();
      c.width = rect.width * 2;
      c.height = rect.height * 2;
      const ctx = c.getContext('2d');
      ctx.scale(2, 2);
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
        {score !== null && (
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: 11, color: 'var(--ink-3)', textTransform: 'uppercase', letterSpacing: '0.1em' }}>Accuracy</div>
            <div className="display" style={{ fontSize: 28, color: score > 80 ? 'var(--green)' : score > 60 ? 'var(--accent)' : 'var(--ink-2)' }}>{score}%</div>
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
        <button className="iconbtn" title="Undo" onClick={() => { clearCanvas(); }}>
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"><path d="M3 8a5 5 0 1 1 5 5H6M3 5v3h3"/></svg>
        </button>
        <button className={`iconbtn ${showGhost ? 'active' : ''}`} title="Toggle ghost" onClick={() => setShowGhost(g => !g)}>
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"><path d="M2 8a6 6 0 0 1 12 0v6l-2-1.5L10 14l-2-1.5L6 14l-2-1.5L2 14z"/></svg>
        </button>
        <div style={{ flex: 1 }}></div>
        <button className="btn sm" onClick={prevRow} disabled={row === 0}>◀ Prev</button>
        <button className="btn sm" onClick={checkAccuracy}>
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
  const copyLink = () => {
    const params = new URLSearchParams({ name, style, f: opts.flourish, s: opts.slant, w: opts.weight });
    navigator.clipboard?.writeText(`https://signature-tutor.app/s/${btoa(params.toString()).slice(0, 10)}`);
    setCopied(true);
    setTimeout(() => setCopied(false), 1600);
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
          <SignatureSVG name={name} style={style} opts={opts} variant={variant} renderMode="ink" height={80} strokeW={2.4} />
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          {[
            { k: 'svg', t: 'SVG', d: 'Vector, infinite resolution' },
            { k: 'png', t: 'PNG', d: 'Transparent raster' },
            { k: 'pdf', t: 'Worksheet PDF', d: '8-row practice sheet' },
            { k: 'gif', t: 'Stroke-order GIF', d: 'Animated reveal' },
          ].map(o => (
            <button key={o.k} className="glass" style={{ padding: 14, textAlign: 'left', border: '0.5px solid rgba(20,17,13,0.1)', background: 'rgba(255,255,255,0.6)', cursor: 'pointer', borderRadius: 12, fontFamily: 'inherit' }}>
              <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 2 }}>{o.t}</div>
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
