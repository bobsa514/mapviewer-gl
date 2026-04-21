// Main app: orchestrates state, wires everything together

const { useState, useEffect, useRef, useMemo, useCallback } = React;

function EmptyState({ onLoadSample, onUpload }) {
  return (
    <div className="empty">
      <div className="empty-inner">
        <div className="empty-eyebrow">MapViewer-GL · client-side geospatial workspace</div>
        <h1>A quiet place to load, <em>style</em>, and query your spatial data.</h1>
        <p className="lede">
          GeoJSON, CSV, Shapefile, GeoParquet — drop anything here and see it on a map in seconds.
          Every layer becomes a SQL table. Nothing leaves your browser.
        </p>
        <div className="empty-actions">
          <button className="btn primary" onClick={onUpload}><UploadIcon size={14}/> Add data</button>
          <button className="btn"><DownloadIcon size={14}/> Import session</button>
        </div>

        <div className="empty-samples">
          <div className="empty-samples-title">or — try with sample data</div>
          <div className="sample-grid">
            {SAMPLES.map(s => (
              <button key={s.id} className="sample-card" onClick={() => onLoadSample(s.id)}>
                <div className="sample-thumb">
                  {s.type === "points" ? <PointsIcon size={20}/> : <PolyIcon size={20}/>}
                </div>
                <div>
                  <div className="sample-name">{s.title}</div>
                  <div className="sample-desc">{s.desc}</div>
                </div>
              </button>
            ))}
          </div>
        </div>

        <div className="empty-promise">
          <LockIcon size={14}/>
          <span>All parsing, SQL and rendering runs in your browser. No uploads. Closing the tab discards everything.</span>
        </div>
      </div>
    </div>
  );
}

function ConfirmModal({ title, body, onConfirm, onCancel, danger }) {
  return (
    <div className="modal-backdrop" onClick={onCancel}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <h3>{title}</h3>
        <p>{body}</p>
        <div className="actions">
          <button className="btn" onClick={onCancel}>Cancel</button>
          <button className={`btn ${danger ? "primary" : "accent"}`} onClick={onConfirm}>Confirm</button>
        </div>
      </div>
    </div>
  );
}

function App() {
  const [tweaks, setTweaks] = useState(window.__TWEAKS__);
  const [tweaksOpen, setTweaksOpen] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [layers, setLayers] = useState(INITIAL_LAYERS);
  const [selectedId, setSelectedId] = useState("cities");
  const [basemap, setBasemap] = useState(tweaks.basemap || "light");
  const [editTarget, setEditTarget] = useState("style"); // "style" | "filter"
  const [sqlOpen, setSqlOpen] = useState(false);
  const [hoverFeat, setHoverFeat] = useState(null); // { feat, pos }
  const [pinnedFeat, setPinnedFeat] = useState(null);
  const [toasts, setToasts] = useState([]);
  const [confirm, setConfirm] = useState(null);
  const [dragOver, setDragOver] = useState(false);

  const mapWrapRef = useRef(null);
  const mapSize = useRef({ w: 960, h: 600 });

  // Apply tweaks to :root
  useEffect(() => {
    const root = document.documentElement;
    root.style.setProperty("--accent-h", tweaks.accentHue);
    root.style.setProperty("--accent-c", tweaks.accentChroma);
    root.setAttribute("data-density", tweaks.density);
  }, [tweaks]);

  // Tweak-mode IPC
  useEffect(() => {
    const handler = (e) => {
      if (e.data?.type === "__activate_edit_mode") setTweaksOpen(true);
      if (e.data?.type === "__deactivate_edit_mode") setTweaksOpen(false);
    };
    window.addEventListener("message", handler);
    window.parent.postMessage({ type: "__edit_mode_available" }, "*");
    return () => window.removeEventListener("message", handler);
  }, []);

  const updateTweaks = (patch) => {
    setTweaks(t => {
      const next = { ...t, ...patch };
      window.parent.postMessage({ type: "__edit_mode_set_keys", edits: patch }, "*");
      return next;
    });
  };

  const pushToast = useCallback((msg) => {
    const id = Math.random();
    setToasts(t => [...t, { id, msg }]);
    setTimeout(() => setToasts(t => t.filter(x => x.id !== id)), 2600);
  }, []);

  // Derived data
  const points = useMemo(() => makeCityPoints(960, 600), []);

  // Filtered features for cities (mock: state filter on layer)
  const citiesLayer = layers.find(l => l.id === "cities");
  const filteredPoints = useMemo(() => {
    if (!citiesLayer) return [];
    let pts = points;
    for (const f of citiesLayer.filters || []) {
      pts = pts.filter(p => {
        const v = p[f.col];
        if (f.op === "=") return Array.isArray(f.val) ? f.val.includes(String(v)) : String(v) === String(f.val);
        const n = parseFloat(f.val);
        if (f.op === "<")  return v <  n;
        if (f.op === "<=") return v <= n;
        if (f.op === ">")  return v >  n;
        if (f.op === ">=") return v >= n;
        return true;
      });
    }
    return pts;
  }, [points, citiesLayer]);

  const updateLayer = (id, patch) => setLayers(ls => ls.map(l => l.id === id ? { ...l, ...patch } : l));

  const removeLayer = (id) => {
    const l = layers.find(x => x.id === id);
    setConfirm({
      title: `Remove "${l.name}"?`,
      body: "This layer (and all its styling and filters) will be removed from the session. You can undo by reloading a saved configuration.",
      danger: true,
      onConfirm: () => { setLayers(ls => ls.filter(x => x.id !== id)); if (selectedId === id) setSelectedId(layers[0]?.id); pushToast(`Removed "${l.name}"`); setConfirm(null); },
    });
  };

  const loadSample = (id) => {
    setLoaded(true);
    pushToast(`Loaded sample · ${SAMPLES.find(s => s.id === id).title}`);
  };

  const addQueryAsLayer = () => {
    const newLayer = {
      id: `query_${Date.now()}`, name: "Query · CA cities", source: "SQL", geom: "point",
      visible: true, color: "oklch(0.55 0.14 50)", opacity: 0.9, pointSize: 7, colorBy: null,
      filters: [], rowCount: 16, cols: ["city","state","population","region"],
    };
    setLayers(ls => [newLayer, ...ls]);
    setSqlOpen(false);
  };

  // Drag-drop
  useEffect(() => {
    const over = (e) => { e.preventDefault(); setDragOver(true); };
    const leave = (e) => { if (e.target === document || !e.relatedTarget) setDragOver(false); };
    const drop = (e) => {
      e.preventDefault();
      setDragOver(false);
      if (!loaded) setLoaded(true);
      pushToast("File loaded · auto-zoomed to extent");
    };
    window.addEventListener("dragover", over);
    window.addEventListener("dragleave", leave);
    window.addEventListener("drop", drop);
    return () => {
      window.removeEventListener("dragover", over);
      window.removeEventListener("dragleave", leave);
      window.removeEventListener("drop", drop);
    };
  }, [loaded, pushToast]);

  const selected = layers.find(l => l.id === selectedId);

  // ---------- Render ----------
  return (
    <div className={`app ${dragOver ? "drag-over" : ""}`} data-layout={tweaks.layout}>
      {/* Topbar */}
      <header className="topbar">
        <div className="brand">
          <span className="brand-dot"/>
          <span className="brand-wordmark">MapViewer</span><em>gl</em>
        </div>
        <div className="topbar-sep"/>
        <div className="topbar-meta">
          <span>{loaded ? `${layers.length} layer${layers.length>1?"s":""}` : "no session"}</span>
          {loaded && <>
            <span>·</span>
            <span className="mono">37.8°N, −96.3°W</span>
            <span>·</span>
            <span className="mono">z 4.2</span>
          </>}
        </div>
        <div className="topbar-right">
          {loaded && <button className="btn sm ghost" onClick={() => setSqlOpen(v => !v)}>
            <SqlIcon size={13}/> SQL
            <kbd style={{ marginLeft: 4, fontFamily: "var(--font-mono)", background: "var(--bg-sunken)", border: "1px solid var(--line)", borderRadius: 3, padding: "0 4px", fontSize: 10, color: "var(--ink-3)" }}>⌘K</kbd>
          </button>}
          {loaded && <button className="btn sm ghost" onClick={() => { navigator.clipboard?.writeText(window.location.href); pushToast("View URL copied"); }}>
            <LinkIcon size={13}/> Share view
          </button>}
          {loaded && <button className="btn sm ghost" onClick={() => pushToast("Session exported as mapviewer-session.json")}>
            <DownloadIcon size={13}/> Export
          </button>}
          <button className="btn sm" onClick={() => { if(!loaded) setLoaded(true); else pushToast("Opened data import"); }}>
            <PlusIcon size={13}/> Add data
          </button>
        </div>
      </header>

      {!loaded ? (
        <>
          <aside className="rail-left">
            <div className="panel-section">
              <div className="panel-title">Session<em>.</em></div>
              <div className="panel-desc" style={{ marginTop: 6 }}>No data loaded yet. Pick a sample or drag a file anywhere on this window to begin.</div>
              <div className="stack-sm" style={{ marginTop: 18 }}>
                {SAMPLES.map(s => (
                  <button key={s.id} className="btn" style={{ width: "100%", justifyContent: "flex-start" }} onClick={() => loadSample(s.id)}>
                    {s.type === "points" ? <PointsIcon size={13}/> : <PolyIcon size={13}/>}
                    <span style={{ marginLeft: 4 }}>{s.title}</span>
                  </button>
                ))}
              </div>
            </div>
            <div className="panel-section">
              <div className="panel-sub">Supported formats</div>
              <div className="stack-sm" style={{ marginTop: 10, fontSize: 12, color: "var(--ink-2)" }}>
                {[
                  ["GeoJSON", ".geojson, .json"],
                  ["CSV",     "with lat/lng or H3"],
                  ["Shapefile",".zip (shp/dbf/prj)"],
                  ["Parquet", ".parquet, geo or tabular"],
                ].map(([k, v]) => (
                  <div key={k} className="row" style={{ justifyContent: "space-between" }}>
                    <span style={{ color: "var(--ink)" }}>{k}</span>
                    <span className="mono" style={{ color: "var(--ink-3)", fontSize: 11 }}>{v}</span>
                  </div>
                ))}
              </div>
            </div>
          </aside>
          <div className="map-wrap" ref={mapWrapRef}>
            <EmptyState onLoadSample={loadSample} onUpload={() => loadSample("cities")}/>
          </div>
          <aside className="rail-right">
            <Inspector feature={null}/>
          </aside>
        </>
      ) : (
        <>
          {/* Left rail */}
          <aside className="rail-left scroll">
            <LayersPanel
              layers={layers}
              selectedId={selectedId}
              onSelect={setSelectedId}
              onUpdate={updateLayer}
              onRemove={removeLayer}
              onAddMore={() => pushToast("Data import flow opened")}
              onEditTarget={(id, target) => { setSelectedId(id); setEditTarget(target); }}
            />
            {editTarget === "style" && selected && <SymbologyPanel layer={selected} onUpdate={(p) => updateLayer(selected.id, p)}/>}
            {editTarget === "filter" && selected && <FilterPanel layer={selected} onUpdate={(p) => updateLayer(selected.id, p)}/>}
            {!selected && <div className="panel-section muted">Select a layer to edit.</div>}
            <div className="panel-section">
              <div className="tweaks-segmented">
                <button className={editTarget === "style" ? "active" : ""} onClick={() => setEditTarget("style")}>Style</button>
                <button className={editTarget === "filter" ? "active" : ""} onClick={() => setEditTarget("filter")}>Filter</button>
              </div>
            </div>
          </aside>

          {/* Map */}
          <div className="map-wrap" ref={mapWrapRef}
               onClick={() => setPinnedFeat(null)}>
            <MapSurface basemap={basemap}>
              {layers.filter(l => l.geom === "polygon").map(l => <PolygonsLayer key={l.id} layer={l}/>)}
              {layers.filter(l => l.geom === "point").map(l => (
                <PointsLayer key={l.id} layer={l} points={l.id === "cities" ? filteredPoints : points}
                  hoveredId={hoverFeat?.feat.id} pinnedId={pinnedFeat?.feat.id}
                  onHover={(p, e) => {
                    const rect = mapWrapRef.current?.getBoundingClientRect();
                    setHoverFeat({ feat: p, pos: { x: e.clientX - (rect?.left||0), y: e.clientY - (rect?.top||0) }, layerId: l.id });
                  }}
                  onLeave={() => setHoverFeat(null)}
                  onClick={(p) => setPinnedFeat({ feat: p, layerId: l.id })}
                />
              ))}
            </MapSurface>

            {/* Hover peek card (only when NOT pinned) */}
            {hoverFeat && !pinnedFeat && (
              <div className="hover-card" style={{ left: hoverFeat.pos.x, top: hoverFeat.pos.y, maxWidth: 220 }}>
                <div className="hover-card-head">
                  <span className="dot" style={{ background: layers.find(l => l.id === hoverFeat.layerId)?.color }}/>
                  <span>{layers.find(l => l.id === hoverFeat.layerId)?.name}</span>
                </div>
                <div style={{ fontFamily: "var(--font-display)", fontSize: 17, lineHeight: 1.2, marginBottom: 6 }}>{hoverFeat.feat.name}</div>
                <div className="kv-row" style={{ padding: "3px 0" }}>
                  <div className="kv-key">population</div><div className="kv-val num">{hoverFeat.feat.population.toLocaleString()}</div>
                </div>
                <div className="kv-row" style={{ padding: "3px 0", borderBottom: "none" }}>
                  <div className="kv-key">density</div><div className="kv-val num">{hoverFeat.feat.density.toLocaleString()}/mi²</div>
                </div>
              </div>
            )}

            {/* Map controls */}
            <div className="map-ctrls">
              <button className="map-ctrl" title="Zoom in"><ZoomInIcon size={14}/></button>
              <button className="map-ctrl" title="Zoom out"><ZoomOutIcon size={14}/></button>
              <button className="map-ctrl" title="Recenter"><TargetIcon size={14}/></button>
            </div>

            {/* Legend */}
            <Legend layer={layers.find(l => l.visible && l.colorBy)}/>

            {/* Basemap switcher */}
            <div className="basemap-switcher">
              {["light","dark","osm"].map(b => (
                <button key={b} className={basemap === b ? "active" : ""} onClick={() => setBasemap(b)}>{b}</button>
              ))}
            </div>

            {/* SQL overlay */}
            <SqlEditor layers={layers} open={sqlOpen} onClose={() => setSqlOpen(false)}
                       onAddLayer={addQueryAsLayer} pushToast={pushToast}/>
          </div>

          {/* Right rail: Inspector */}
          <aside className="rail-right scroll">
            <Inspector feature={pinnedFeat?.feat || hoverFeat?.feat}
                       pinned={!!pinnedFeat}
                       layerName={layers.find(l => l.id === (pinnedFeat?.layerId || hoverFeat?.layerId))?.name}
                       onTogglePin={() => {
                         if (pinnedFeat) setPinnedFeat(null);
                         else if (hoverFeat) setPinnedFeat(hoverFeat);
                       }}
                       onClear={() => { setPinnedFeat(null); setHoverFeat(null); }}/>
          </aside>
        </>
      )}

      {/* Toasts */}
      <div className="toasts">
        {toasts.map(t => (
          <div key={t.id} className="toast"><InfoIcon size={13}/> {t.msg}</div>
        ))}
      </div>

      {/* Tweaks */}
      {tweaksOpen && <TweaksPanel tweaks={tweaks} onChange={updateTweaks} onClose={() => setTweaksOpen(false)}/>}

      {/* Confirm modal */}
      {confirm && <ConfirmModal {...confirm} onCancel={() => setConfirm(null)}/>}

      {/* Global ⌘K shortcut for SQL */}
      <KeyboardShortcuts onToggleSql={() => setSqlOpen(v => !v)} loaded={loaded}/>
    </div>
  );
}

function KeyboardShortcuts({ onToggleSql, loaded }) {
  useEffect(() => {
    const h = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k" && loaded) {
        e.preventDefault(); onToggleSql();
      }
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [loaded, onToggleSql]);
  return null;
}

ReactDOM.createRoot(document.getElementById("root")).render(<App/>);
