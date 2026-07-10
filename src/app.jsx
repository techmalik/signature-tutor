    const TWEAK_DEFAULTS = {
      "sampleName": "Alex Morgan",
      "accentColor": "#c6522b",
      "background": "warm",
      "startScreen": "name"
    };

    function App() {
      const [tweaks, setTweaks] = React.useState(TWEAK_DEFAULTS);
      const [editMode, setEditMode] = React.useState(false);

      const initial = React.useMemo(() => {
        try {
          const saved = JSON.parse(localStorage.getItem('sigtutor:v1') || '{}');
          return {
            screen: saved.screen || tweaks.startScreen || 'name',
            name: saved.name || tweaks.sampleName,
            style: saved.style || 'cursive',
            opts: saved.opts || { flourish: 0.7, slant: 0.14, weight: 1.0 },
          };
        } catch { return null; }
      }, []);

      const [screen, setScreen] = React.useState(initial?.screen || 'name');
      const [name, setName] = React.useState(initial?.name || tweaks.sampleName);
      const [style, setStyle] = React.useState(initial?.style || 'cursive');
      const [opts, setOpts] = React.useState(initial?.opts || { flourish: 0.7, slant: 0.14, weight: 1.0 });
      const [showExport, setShowExport] = React.useState(false);

      React.useEffect(() => {
        localStorage.setItem('sigtutor:v1', JSON.stringify({ screen, name, style, opts }));
      }, [screen, name, style, opts]);

      React.useEffect(() => {
        document.documentElement.style.setProperty('--accent', tweaks.accentColor);
      }, [tweaks.accentColor]);

      React.useEffect(() => {
        const stage = document.querySelector('.stage');
        if (!stage) return;
        stage.dataset.bg = tweaks.background;
        const css = {
          warm: `radial-gradient(900px 700px at 10% 5%, rgba(230, 195, 160, 0.55), transparent 60%),
                 radial-gradient(800px 600px at 92% 15%, rgba(198, 82, 43, 0.18), transparent 60%),
                 radial-gradient(1000px 800px at 85% 95%, rgba(136, 175, 198, 0.35), transparent 60%),
                 radial-gradient(700px 500px at 20% 90%, rgba(224, 183, 120, 0.35), transparent 55%),
                 linear-gradient(180deg, #f7f3ec 0%, #ede8de 100%)`,
          cool: `radial-gradient(900px 700px at 10% 5%, rgba(160, 195, 230, 0.55), transparent 60%),
                 radial-gradient(800px 600px at 92% 15%, rgba(120, 150, 220, 0.22), transparent 60%),
                 radial-gradient(1000px 800px at 85% 95%, rgba(180, 200, 220, 0.45), transparent 60%),
                 linear-gradient(180deg, #f1f4f8 0%, #e2e8ef 100%)`,
          plain: `linear-gradient(180deg, #f4f2ee 0%, #ebe8e1 100%)`,
        }[tweaks.background] || '';
        let s = document.getElementById('bg-override');
        if (!s) { s = document.createElement('style'); s.id = 'bg-override'; document.head.appendChild(s); }
        s.textContent = `.stage::before { background: ${css} !important; }`;
      }, [tweaks.background]);

      React.useEffect(() => {
        const onMsg = (e) => {
          if (e.data?.type === '__activate_edit_mode') setEditMode(true);
          if (e.data?.type === '__deactivate_edit_mode') setEditMode(false);
        };
        window.addEventListener('message', onMsg);
        window.parent.postMessage({ type: '__edit_mode_available' }, '*');
        return () => window.removeEventListener('message', onMsg);
      }, []);

      const patch = (p) => {
        const next = { ...tweaks, ...p };
        setTweaks(next);
        window.parent.postMessage({ type: '__edit_mode_set_keys', edits: p }, '*');
      };

      const go = (s) => {
        if (s === 'export') setShowExport(true);
        else setScreen(s);
      };

      let content = null;
      if (screen === 'name') content = <NameScreen name={name} setName={setName} onNext={() => setScreen('style')} />;
      else if (screen === 'style') content = <StyleScreen name={name} selected={style} setSelected={setStyle} onNext={() => setScreen('preview')} onBack={() => setScreen('name')} />;
      else if (screen === 'preview') content = <PreviewScreen name={name} style={style} opts={opts} setOpts={setOpts} onHub={() => setScreen('hub')} onBack={() => setScreen('style')} />;
      else if (screen === 'hub') content = <HubScreen name={name} style={style} opts={opts} go={go} onBack={() => setScreen('preview')} />;
      else if (screen === 'worksheet') content = <WorksheetScreen name={name} style={style} opts={opts} onBack={() => setScreen('hub')} onExport={() => setShowExport(true)} />;
      else if (screen === 'practice') content = <PracticeScreen name={name} style={style} opts={opts} onBack={() => setScreen('hub')} />;

      const crumbs = [
        { k: 'name', l: 'Name' },
        { k: 'style', l: 'Style' },
        { k: 'preview', l: 'Preview' },
        { k: 'hub', l: 'Hub' },
      ];
      const showCrumbs = !['practice', 'worksheet'].includes(screen);

      return (
        <div className="shell" data-screen-label={screen}>
          <div className="topbar">
            <Logo />
            {showCrumbs && (
              <div className="seg">
                {crumbs.map(c => (
                  <button key={c.k} className={screen === c.k ? 'on' : ''} onClick={() => setScreen(c.k)}>{c.l}</button>
                ))}
              </div>
            )}
            <div style={{ display: 'flex', gap: 10 }}>
              <button className="btn sm" onClick={() => setShowExport(true)}>
                <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"><path d="M8 2v9M4 7l4 4 4-4M3 14h10"/></svg>
                Export
              </button>
              <button className="btn sm" onClick={() => { localStorage.removeItem('sigtutor:v1'); setScreen('name'); setName(tweaks.sampleName); setStyle('cursive'); setOpts({ flourish: 0.7, slant: 0.14, weight: 1.0 }); }}>
                Restart
              </button>
            </div>
          </div>
          <div className="content">{content}</div>

          {showExport && <ExportModal name={name} style={style} opts={opts} onClose={() => setShowExport(false)} />}

          {editMode && (
            <div className="tweaks">
              <h4>Tweaks</h4>
              <div className="t-row">
                <span className="t-label">Sample name</span>
                <input type="text" value={tweaks.sampleName} onChange={e => { patch({ sampleName: e.target.value }); setName(e.target.value); }} />
              </div>
              <div className="t-row">
                <span className="t-label">Accent</span>
                <div style={{ display: 'flex', gap: 5 }}>
                  {['#c6522b', '#2c4f78', '#4a7a4f', '#7a4aa0', '#14110d'].map(c => (
                    <button key={c} onClick={() => patch({ accentColor: c })} style={{ width: 20, height: 20, borderRadius: 10, background: c, border: tweaks.accentColor === c ? '2px solid #14110d' : '0.5px solid rgba(20,17,13,0.15)', cursor: 'pointer', padding: 0 }}></button>
                  ))}
                </div>
              </div>
              <div className="t-row">
                <span className="t-label">Background</span>
                <select value={tweaks.background} onChange={e => patch({ background: e.target.value })}>
                  <option value="warm">Warm</option>
                  <option value="cool">Cool</option>
                  <option value="plain">Plain</option>
                </select>
              </div>
              <div className="t-row">
                <span className="t-label">Jump to</span>
                <select value={screen} onChange={e => setScreen(e.target.value)}>
                  <option value="name">Name</option>
                  <option value="style">Style picker</option>
                  <option value="preview">Preview</option>
                  <option value="hub">Hub</option>
                  <option value="worksheet">Worksheet</option>
                  <option value="practice">Practice canvas</option>
                </select>
              </div>
            </div>
          )}
        </div>
      );
    }

    ReactDOM.createRoot(document.getElementById('root')).render(<App/>);
