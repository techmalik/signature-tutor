// signature-react.jsx — React rendering layer for the centerline stroke
// engine (src/engine-core.js). Replaces src/signature-engine.jsx (deleted):
// buildSignature/SIG_STYLES now live in engine-core.js as plain data/logic,
// this file is purely the SVG/animation presentation on top of it.

function easeInOut(t) {
  return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
}

// React README recipe is already baked into engine-core.js's ink pass; here
// we only ever consume the resulting `inkD`/`d` strings.

function SignatureSVG({
  name, style, opts = {}, variant = 0, opacity = 1, strokeColor = 'var(--ink)', strokeW = 2.4,
  width = 720, height = 180, showArrows = false, animate = false, renderMode = 'ink',
  className = '', extraTop = null, extraBottom = null,
}) {
  const sig = React.useMemo(
    () => window.buildSignature(name || 'Your Name', style, { ...opts, width, height, variant }),
    [name, style, opts.slant, opts.flourish, opts.weight, opts.legibility, variant, width, height]
  );
  const maskId = React.useId().replace(/:/g, '');

  const [t, setT] = React.useState(animate ? 0 : 1);
  React.useEffect(() => {
    if (!animate) { setT(1); return; }
    setT(0);
    const totalT = sig.strokes.reduce((a, s) => a + (s.length || 0), 0) + 30 * Math.max(0, sig.strokes.length - 1);
    const duration = Math.max(1200, Math.min(3800, totalT * 2.0));
    let raf, start;
    const step = (now) => {
      if (!start) start = now;
      const p = Math.min(1, (now - start) / duration);
      setT(easeInOut(p));
      if (p < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [animate, name, style, variant]);

  const totalT = sig.strokes.reduce((a, s) => a + (s.length || 0), 0) + 30 * Math.max(0, sig.strokes.length - 1);
  let cum = 0;
  const spans = sig.strokes.map((s) => {
    const start = cum;
    cum += (s.length || 0) + 30;
    return { start, span: s.length || 0 };
  });
  const p = t * totalT;

  let arrowN = 0;

  return (
    <svg viewBox={sig.viewBox} className={className} style={{ width: '100%', height: '100%', display: 'block', opacity }} preserveAspectRatio="xMidYMid meet">
      {extraTop}
      {renderMode === 'ink' && (
        <defs>
          <mask id={`reveal-${maskId}`} maskUnits="userSpaceOnUse" x="0" y="0" width={width} height={height}>
            <rect x="0" y="0" width={width} height={height} fill={animate ? 'black' : 'white'} />
            {sig.strokes.map((s, i) => {
              const local = animate ? clamp01((p - spans[i].start) / Math.max(1, spans[i].span)) : 1;
              const len = spans[i].span || 1;
              const size = (2.4 * (opts.weight || 1) * 2.0) * 2 + 4;
              return (
                <path
                  key={i}
                  d={s.d}
                  fill="none"
                  stroke="white"
                  strokeWidth={size}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeDasharray={animate ? len : undefined}
                  strokeDashoffset={animate ? len * (1 - local) : 0}
                />
              );
            })}
          </mask>
        </defs>
      )}

      <g mask={renderMode === 'ink' ? `url(#reveal-${maskId})` : undefined}>
        {sig.strokes.map((s, i) => {
          const local = animate ? clamp01((p - spans[i].start) / Math.max(1, spans[i].span)) : 1;
          const len = spans[i].span || 1;
          const numbered = showArrows && renderMode === 'line' && s.kind !== 'flourish' && s.kind !== 'underline';
          if (numbered) arrowN += 1;

          if (renderMode === 'ink' && s.inkD) {
            return <path key={i} d={s.inkD} fill={strokeColor} stroke="none" />;
          }
          return (
            <g key={i}>
              <path
                d={s.d}
                fill="none"
                stroke={strokeColor}
                strokeWidth={strokeW * (opts.weight || 1)}
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeDasharray={renderMode === 'line' && animate ? len : undefined}
                strokeDashoffset={renderMode === 'line' && animate ? len * (1 - local) : 0}
              />
              {numbered && <StrokeArrow d={s.d} index={arrowN} width={width} height={height} />}
            </g>
          );
        })}
      </g>
      {extraBottom}
    </svg>
  );
}

function clamp01(x) { return Math.max(0, Math.min(1, x)); }

function StrokeArrow({ d, index, width, height }) {
  const m = d.match(/M\s*([-\d.]+)\s+([-\d.]+)/);
  if (!m) return null;
  const x = clamp(parseFloat(m[1]) - 8, 10, width - 10);
  const y = clamp(parseFloat(m[2]) - 12, 10, height - 10);
  return (
    <g>
      <circle cx={x} cy={y} r="9" fill="#c6522b" />
      <text x={x} y={y + 3} textAnchor="middle" fontSize="11" fontWeight="700" fontFamily="Inter, sans-serif" fill="#fff">{index}</text>
    </g>
  );
}
function clamp(x, lo, hi) { return Math.max(lo, Math.min(hi, x)); }

Object.assign(window, { SignatureSVG });
