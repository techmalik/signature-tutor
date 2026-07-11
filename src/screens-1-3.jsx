// Individual screen components — hi-fi.
// Exported globally so main app can compose them.

const STYLE_DESCRIPTIONS = {
  flow: 'Flowing, readable',
  executive: 'Sharp, confident',
  flourished: 'Romantic loops',
  scrawl: 'Fast, practiced',
  minimal: 'Clean, legible',
  monogram: 'Just initials',
};
const STYLE_LIST = Object.keys(SIG_STYLES).map(key => ({
  key,
  name: SIG_STYLES[key].label,
  desc: STYLE_DESCRIPTIONS[key] || '',
}));

function Logo() {
  return (
    <span className="brand">
      <span className="mark">S</span>
      <span>SignatureTutor</span>
    </span>
  );
}

function StepProgress({ step, total = 3 }) {
  const pct = (step / total) * 100;
  return (
    <div className="progress">
      <span style={{ fontVariantNumeric: 'tabular-nums' }}>Step {step} of {total}</span>
      <div className="track"><div className="fill" style={{ width: `${pct}%` }} /></div>
    </div>
  );
}

// ─────────────── Screen 1: Name ───────────────
function NameScreen({ name, setName, onNext }) {
  const [focused, setFocused] = React.useState(false);
  const initials = name.split(' ').filter(Boolean).map(w => w[0]?.toUpperCase()).join('');
  return (
    <div className="screen wrap-narrow" style={{ paddingTop: 40 }}>
      <div style={{ textAlign: 'center', marginBottom: 36 }}>
        <div className="eyebrow" style={{ marginBottom: 14 }}>Step 1 · Your name</div>
        <h1 className="display" style={{ fontSize: 56, margin: 0 }}>
          Who are we <span style={{ fontStyle: 'italic' }}>signing</span> for?
        </h1>
        <p className="muted" style={{ fontSize: 16, marginTop: 14, maxWidth: 420, marginInline: 'auto' }}>
          Type the name you'd actually sign — not necessarily your legal full name.
        </p>
      </div>

      <div className="card" style={{ padding: 32 }}>
        <div className="eyebrow" style={{ marginBottom: 10 }}>Full name</div>
        <input
          className="input big"
          value={name}
          placeholder="e.g. Alex Morgan"
          autoFocus
          onChange={e => setName(e.target.value)}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          onKeyDown={e => { if (e.key === 'Enter' && name.trim()) onNext(); }}
        />
        {name && (
          <div className="screen" style={{ display: 'flex', gap: 20, marginTop: 22, alignItems: 'center', flexWrap: 'wrap' }}>
            <div>
              <div className="eyebrow" style={{ marginBottom: 4 }}>Initials</div>
              <div style={{ fontFamily: 'var(--serif)', fontSize: 22, fontStyle: 'italic' }}>{initials}</div>
            </div>
            <div style={{ flex: 1, minWidth: 200 }}>
              <div className="eyebrow" style={{ marginBottom: 4 }}>Preview</div>
              <div style={{ height: 60 }}>
                <SignatureSVG name={name} style="flow" opts={{ flourish: 0.7, slant: 0.14, weight: 1 }} renderMode="ink" height={60} />
              </div>
            </div>
          </div>
        )}
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 28 }}>
        <span className="faint" style={{ fontSize: 13 }}>↵ Press Enter to continue</span>
        <button className="btn primary lg" disabled={!name.trim()} onClick={onNext} style={{ opacity: name.trim() ? 1 : 0.4 }}>
          Next: pick a style
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"><path d="M3 8h10M9 4l4 4-4 4"/></svg>
        </button>
      </div>
    </div>
  );
}

// ─────────────── Screen 2: Style picker ───────────────
function StyleScreen({ name, selected, setSelected, onNext, onBack }) {
  return (
    <div className="screen wrap" style={{ paddingTop: 24 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 28 }}>
        <div>
          <div className="eyebrow" style={{ marginBottom: 12 }}>Step 2 · Style</div>
          <h1 className="display" style={{ fontSize: 44, margin: 0 }}>
            Six takes on <span style={{ fontStyle: 'italic' }}>{name || 'your name'}</span>
          </h1>
          <p className="muted" style={{ fontSize: 15, marginTop: 10 }}>Tap a style to preview it at full size below. Pick one to continue.</p>
        </div>
        <StepProgress step={2} />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16, marginBottom: 28 }}>
        {STYLE_LIST.map(s => (
          <div key={s.key} className={`style-card ${selected === s.key ? 'selected' : ''}`} onClick={() => setSelected(s.key)}>
            <div className="label">
              <span>{s.name}</span>
              {selected === s.key && (
                <svg width="18" height="18" viewBox="0 0 18 18" fill="none"><circle cx="9" cy="9" r="8" fill="#14110d"/><path d="M5 9.5l2.5 2.5L13 6.5" stroke="#f6f1e6" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg>
              )}
            </div>
            <div className="preview">
              <SignatureSVG name={name || 'Your Name'} style={s.key} opts={{ flourish: 0.6, slant: 0.12 }} renderMode="ink" height={80} />
            </div>
            <div style={{ fontSize: 12, color: 'var(--ink-3)', marginTop: 8 }}>{s.desc}</div>
          </div>
        ))}
      </div>

      <div className="card" style={{ padding: '32px 40px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
          <div className="eyebrow">Full preview · {STYLE_LIST.find(s => s.key === selected)?.name}</div>
          <div className="faint" style={{ fontSize: 12 }}>{name || 'Your Name'}</div>
        </div>
        <div style={{ height: 150 }}>
          <SignatureSVG name={name || 'Your Name'} style={selected} opts={{ flourish: 0.7, slant: 0.14 }} renderMode="ink" strokeW={2.8} height={150} />
        </div>
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 28 }}>
        <button className="btn ghost" onClick={onBack}>
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"><path d="M11 7H3M7 3L3 7l4 4"/></svg>
          Back
        </button>
        <button className="btn primary lg" onClick={onNext}>
          Generate signature
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"><path d="M3 8h10M9 4l4 4-4 4"/></svg>
        </button>
      </div>
    </div>
  );
}

// ─────────────── Screen 3: Preview / tweak ───────────────
function PreviewScreen({ name, style, opts, setOpts, variant, setVariant, onHub, onBack }) {
  const [replayKey, setReplayKey] = React.useState(0);
  return (
    <div className="screen wrap" style={{ paddingTop: 24 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 24 }}>
        <div>
          <div className="eyebrow" style={{ marginBottom: 12 }}>Step 3 · Preview</div>
          <h1 className="display" style={{ fontSize: 44, margin: 0 }}>Here's your signature.</h1>
          <p className="muted" style={{ fontSize: 15, marginTop: 10 }}>Fine-tune the feel, then head to practice or export.</p>
        </div>
        <StepProgress step={3} />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 320px', gap: 20 }}>
        {/* Hero preview */}
        <div className="card" style={{ padding: 40, display: 'flex', flexDirection: 'column', justifyContent: 'center', minHeight: 320, position: 'relative' }}>
          <div style={{ position: 'absolute', top: 20, left: 24, display: 'flex', gap: 8 }}>
            <span className="chip">{STYLE_LIST.find(s => s.key === style)?.name}</span>
            <span className="chip" style={{ background: 'transparent' }}>{name}</span>
          </div>
          <div style={{ position: 'absolute', top: 20, right: 24 }}>
            <button className="iconbtn" title="Replay" onClick={() => setReplayKey(k => k + 1)}>
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"><path d="M2 8a6 6 0 1 0 2-4.5M2 2v3h3"/></svg>
            </button>
          </div>
          <div style={{ height: 220, marginTop: 20 }}>
            <SignatureSVG key={replayKey} name={name} style={style} opts={opts} variant={variant} strokeW={3} height={220} animate={true} />
          </div>
        </div>

        {/* Tweak panel */}
        <div className="card" style={{ padding: 24 }}>
          <div className="eyebrow" style={{ marginBottom: 14 }}>Fine-tune</div>
          {[
            { key: 'flourish', label: 'Flourish', min: 0, max: 1, step: 0.01 },
            { key: 'slant', label: 'Slant', min: -0.1, max: 0.3, step: 0.01 },
            { key: 'weight', label: 'Weight', min: 0.7, max: 1.8, step: 0.05 },
            { key: 'legibility', label: 'Legibility', min: 0.2, max: 1, step: 0.01 },
          ].map(s => (
            <div key={s.key} className="slider-row">
              <span className="lbl">{s.label}</span>
              <input type="range" className="slider" min={s.min} max={s.max} step={s.step} value={opts[s.key]} onChange={e => setOpts({ ...opts, [s.key]: parseFloat(e.target.value) })} />
              <span className="val">{(opts[s.key]).toFixed(2)}</span>
            </div>
          ))}
          <button className="btn" style={{ width: '100%', marginTop: 14, justifyContent: 'center' }} onClick={() => setVariant(v => v + 1)}>
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"><circle cx="8" cy="8" r="6"/><circle cx="5.5" cy="6.5" r="0.6" fill="currentColor"/><circle cx="10.5" cy="6.5" r="0.6" fill="currentColor"/><circle cx="5.5" cy="10" r="0.6" fill="currentColor"/><circle cx="10.5" cy="10" r="0.6" fill="currentColor"/><circle cx="8" cy="8" r="0.6" fill="currentColor"/></svg>
            Shuffle variant
          </button>
        </div>
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 28 }}>
        <button className="btn ghost" onClick={onBack}>
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"><path d="M11 7H3M7 3L3 7l4 4"/></svg>
          Back
        </button>
        <button className="btn primary lg" onClick={onHub}>
          Continue
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"><path d="M3 8h10M9 4l4 4-4 4"/></svg>
        </button>
      </div>
    </div>
  );
}

Object.assign(window, { STYLE_LIST, Logo, StepProgress, NameScreen, StyleScreen, PreviewScreen });
