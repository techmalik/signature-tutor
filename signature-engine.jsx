// Signature rendering — deterministic procedural signatures from a name.
// Given (name, styleKey), produce an SVG path and stroke data so the same
// signature can be drawn as trace, ghost, or animated stroke-by-stroke.
//
// This isn't a real handwriting model — it's a set of style-specific
// templates that use the letters of the name to vary baseline, slant,
// amplitude. Good enough for a design-layer MVP.

// Lightweight hash → seeded RNG so the same name always gives the same shape.
function hash(str) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}
function mulberry32(seed) {
  return function() {
    seed |= 0; seed = seed + 0x6D2B79F5 | 0;
    let t = Math.imul(seed ^ seed >>> 15, 1 | seed);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}

// Build per-letter stroke segments. Each style returns array of
// {d, len} segments, so we can show stroke numbering.
function buildSignature(name, style, opts = {}) {
  const { width = 720, height = 180, slant = 0.12, flourish = 0.6, weight = 1 } = opts;
  const rng = mulberry32(hash(name + '|' + style));
  const rand = (a, b) => a + rng() * (b - a);

  const letters = name.replace(/\s+/g, ' ').trim().split('');
  if (!letters.length) return { strokes: [], viewBox: `0 0 ${width} ${height}` };

  // Horizontal layout: each char gets a slot proportional to its weight.
  const charWeights = letters.map(c => {
    if (c === ' ') return 0.6;
    if ('ijltI'.includes(c)) return 0.6;
    if ('mwMW'.includes(c)) return 1.4;
    return 1.0;
  });
  const totalWeight = charWeights.reduce((a,b)=>a+b, 0);
  const marginX = 30, marginY = 30;
  const usableW = width - marginX * 2;
  const baseY = height * 0.62;
  const amp = height * 0.32 * (0.6 + flourish * 0.5);

  // Position each char's centerX
  const positions = [];
  let x = marginX;
  for (let i = 0; i < letters.length; i++) {
    const w = (charWeights[i] / totalWeight) * usableW;
    positions.push({ cx: x + w / 2, w, char: letters[i] });
    x += w;
  }

  const segments = [];

  if (style === 'cursive' || style === 'loopy') {
    // Continuous flowing path per word — one stroke per word, plus dots on i/j
    const amplitudeBoost = style === 'loopy' ? 1.4 : 1.0;
    const words = [];
    let curWord = [];
    positions.forEach((p, i) => {
      if (p.char === ' ') { if (curWord.length) words.push(curWord); curWord = []; }
      else curWord.push({ ...p, idx: i });
    });
    if (curWord.length) words.push(curWord);

    words.forEach((word, wi) => {
      const pts = [];
      word.forEach((p, i) => {
        const isUpper = p.char.match(/[A-Z]/);
        const hasDescender = 'gjpqy'.includes(p.char);
        const hasAscender = 'bdfhklt'.includes(p.char);
        const topY = baseY - amp * (isUpper ? 0.95 : hasAscender ? 0.8 : 0.4) * amplitudeBoost;
        const bottomY = baseY + (hasDescender ? amp * 0.4 : 0);

        // lead-in loop
        pts.push({ x: p.cx - p.w * 0.4, y: baseY });
        pts.push({ x: p.cx - p.w * 0.15 + rand(-3, 3), y: topY + rand(-4, 4) });
        // letter body
        if (style === 'loopy' && rng() > 0.4) {
          // extra loop
          pts.push({ x: p.cx - p.w * 0.05, y: baseY + rand(-3, 8) });
          pts.push({ x: p.cx + p.w * 0.05, y: topY + rand(-3, 3) });
        } else {
          pts.push({ x: p.cx, y: (topY + baseY) / 2 + rand(-4, 4) });
        }
        pts.push({ x: p.cx + p.w * 0.15, y: baseY + rand(-2, 4) });
        if (hasDescender) pts.push({ x: p.cx + p.w * 0.2, y: bottomY });
        pts.push({ x: p.cx + p.w * 0.35, y: baseY - 3 + rand(-2, 2) });
      });
      // Apply slant
      const slanted = pts.map(pt => ({ x: pt.x + (baseY - pt.y) * slant, y: pt.y }));
      const d = smoothPath(slanted);
      segments.push({ d, kind: 'body', wordIndex: wi, length: approxLen(slanted) });

      // Dots for i, j
      word.forEach(p => {
        if (p.char === 'i' || p.char === 'j') {
          const dx = (baseY - (baseY - amp * 0.55)) * slant;
          segments.push({
            d: `M ${p.cx + dx - 1} ${baseY - amp * 0.55} l 2 0`,
            kind: 'dot', length: 3,
          });
        }
      });

      // Flourish tail on last word
      if (wi === words.length - 1 && flourish > 0.3) {
        const last = word[word.length - 1];
        const startX = last.cx + last.w * 0.35;
        const startY = baseY - 3;
        const tail = `M ${startX} ${startY} q ${30 + flourish*40} ${-flourish*25} ${50 + flourish*60} ${flourish*5} t ${40} ${-flourish*8}`;
        segments.push({ d: tail, kind: 'flourish', length: 60 + flourish * 60 });
      }
    });
  } else if (style === 'executive') {
    // Sharp, angular — one stroke per letter, straighter lines
    positions.forEach((p, i) => {
      if (p.char === ' ') return;
      const isUpper = p.char.match(/[A-Z]/);
      const topY = baseY - amp * (isUpper ? 0.95 : 0.6);
      const pts = [];
      pts.push({ x: p.cx - p.w * 0.35, y: baseY + 2 });
      pts.push({ x: p.cx - p.w * 0.1, y: topY });
      pts.push({ x: p.cx + p.w * 0.1, y: baseY });
      pts.push({ x: p.cx + p.w * 0.3, y: topY + amp * 0.3 });
      pts.push({ x: p.cx + p.w * 0.4, y: baseY });
      const slanted = pts.map(pt => ({ x: pt.x + (baseY - pt.y) * (slant + 0.08), y: pt.y }));
      const d = slanted.reduce((acc, pt, j) => acc + (j === 0 ? 'M ' : ' L ') + pt.x.toFixed(1) + ' ' + pt.y.toFixed(1), '');
      segments.push({ d, kind: 'body', length: approxLen(slanted) });
    });
    // Underline flourish
    if (flourish > 0.2) {
      const startX = positions[positions.length-1].cx;
      const endX = positions[0].cx;
      segments.push({
        d: `M ${startX + 20} ${baseY + 20} Q ${(startX + endX)/2} ${baseY + 30 + flourish*10} ${endX - 20} ${baseY + 18}`,
        kind: 'flourish', length: Math.abs(startX - endX),
      });
    }
  } else if (style === 'scrawl') {
    // Quick, messy — single chaotic path
    const pts = [];
    pts.push({ x: marginX, y: baseY });
    positions.forEach(p => {
      if (p.char === ' ') { pts.push({ x: p.cx, y: baseY + rand(-4, 4) }); return; }
      pts.push({ x: p.cx - p.w * 0.3, y: baseY + rand(-8, 8) });
      pts.push({ x: p.cx, y: baseY - amp * rand(0.3, 0.8) });
      pts.push({ x: p.cx + p.w * 0.15, y: baseY + rand(-6, 10) });
    });
    pts.push({ x: width - marginX, y: baseY - 4 });
    const slanted = pts.map(pt => ({ x: pt.x + (baseY - pt.y) * slant * 0.5, y: pt.y }));
    segments.push({ d: smoothPath(slanted), kind: 'body', length: approxLen(slanted) });
  } else if (style === 'sans') {
    // Printed-feel — one segment per letter stroke, plain
    positions.forEach(p => {
      if (p.char === ' ') return;
      const topY = baseY - amp * 0.7;
      segments.push({ d: `M ${p.cx - p.w*0.3} ${baseY} L ${p.cx - p.w*0.3} ${topY} L ${p.cx + p.w*0.3} ${topY} L ${p.cx + p.w*0.3} ${baseY}`, kind: 'body', length: amp*2 + p.w });
    });
  } else if (style === 'monogram') {
    // Two big letters (initials)
    const initials = name.split(' ').filter(Boolean).map(w => w[0]).slice(0, 2).join('');
    const cx = width / 2, cy = height / 2;
    const R = Math.min(width, height) * 0.28;
    segments.push({ d: `M ${cx - R} ${cy} A ${R} ${R} 0 1 1 ${cx + R} ${cy} A ${R} ${R} 0 1 1 ${cx - R} ${cy}`, kind: 'frame', length: 2 * Math.PI * R });
    // Letters rendered as text — returned separately
    return { strokes: segments, viewBox: `0 0 ${width} ${height}`, monogram: initials, width, height };
  }

  return { strokes: segments, viewBox: `0 0 ${width} ${height}`, width, height };
}

// Catmull-Rom through points → smooth cubic bezier path
function smoothPath(pts) {
  if (pts.length < 2) return '';
  let d = `M ${pts[0].x.toFixed(1)} ${pts[0].y.toFixed(1)}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[i - 1] || pts[i];
    const p1 = pts[i];
    const p2 = pts[i + 1];
    const p3 = pts[i + 2] || p2;
    const c1x = p1.x + (p2.x - p0.x) / 6;
    const c1y = p1.y + (p2.y - p0.y) / 6;
    const c2x = p2.x - (p3.x - p1.x) / 6;
    const c2y = p2.y - (p3.y - p1.y) / 6;
    d += ` C ${c1x.toFixed(1)} ${c1y.toFixed(1)}, ${c2x.toFixed(1)} ${c2y.toFixed(1)}, ${p2.x.toFixed(1)} ${p2.y.toFixed(1)}`;
  }
  return d;
}

function approxLen(pts) {
  let L = 0;
  for (let i = 1; i < pts.length; i++) {
    const dx = pts[i].x - pts[i-1].x, dy = pts[i].y - pts[i-1].y;
    L += Math.hypot(dx, dy);
  }
  return L;
}

// React component — render a signature at given opacity/state.
function SignatureSVG({ name, style, opts = {}, opacity = 1, strokeColor = 'var(--ink)', strokeW = 2.4, width = 720, height = 180, showArrows = false, animate = false, className = '', extraTop = null, extraBottom = null }) {
  const sig = React.useMemo(() => buildSignature(name || 'Your Name', style, { ...opts, width, height }), [name, style, opts.slant, opts.flourish, opts.weight, width, height]);
  const [drawProgress, setDrawProgress] = React.useState(animate ? 0 : 1);
  React.useEffect(() => {
    if (!animate) { setDrawProgress(1); return; }
    let raf, start;
    const step = (t) => {
      if (!start) start = t;
      const p = Math.min(1, (t - start) / 1800);
      setDrawProgress(p);
      if (p < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [animate, name, style]);

  return (
    <svg viewBox={sig.viewBox} className={className} style={{ width: '100%', height: '100%', display: 'block', opacity }} preserveAspectRatio="xMidYMid meet">
      {extraTop}
      {sig.monogram && (
        <text x={sig.width/2} y={sig.height/2 + 24} textAnchor="middle" fontFamily="Fraunces, serif" fontSize="72" fontStyle="italic" fontWeight="500" fill={strokeColor}>
          {sig.monogram}
        </text>
      )}
      {sig.strokes.map((s, i) => {
        const len = s.length || 300;
        const dashArray = animate ? len : undefined;
        const dashOffset = animate ? len * (1 - drawProgress) : 0;
        return (
          <g key={i}>
            <path
              d={s.d}
              fill="none"
              stroke={strokeColor}
              strokeWidth={strokeW * (opts.weight || 1)}
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeDasharray={dashArray}
              strokeDashoffset={dashOffset}
            />
            {showArrows && s.kind === 'body' && i < 3 && (
              <StrokeArrow d={s.d} index={i + 1} />
            )}
          </g>
        );
      })}
      {extraBottom}
    </svg>
  );
}

function StrokeArrow({ d, index }) {
  // Place a numbered circle at the start of each stroke
  const m = d.match(/M\s*([-\d.]+)\s+([-\d.]+)/);
  if (!m) return null;
  const x = parseFloat(m[1]);
  const y = parseFloat(m[2]);
  return (
    <g>
      <circle cx={x - 8} cy={y - 12} r="9" fill="#c6522b" />
      <text x={x - 8} y={y - 9} textAnchor="middle" fontSize="11" fontWeight="700" fontFamily="Inter, sans-serif" fill="#fff">{index}</text>
    </g>
  );
}

Object.assign(window, { buildSignature, SignatureSVG });
