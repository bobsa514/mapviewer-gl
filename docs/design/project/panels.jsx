// Left rail: Layers panel + Symbology + Filters
// Right rail: Inspector

function LayerRow({ layer, selected, onSelect, onToggle, onRename, onRemove, onStyleClick, onFilterClick }) {
  const [editing, setEditing] = React.useState(false);
  const [val, setVal] = React.useState(layer.name);
  const commit = () => { setEditing(false); if (val.trim()) onRename(val.trim()); else setVal(layer.name); };
  const swatchStyle = layer.colorBy
    ? { "--grad-a": PALETTES[layer.colorBy.palette][0], "--grad-b": PALETTES[layer.colorBy.palette][PALETTES[layer.colorBy.palette].length-1] }
    : { background: layer.color || "oklch(0.7 0.01 270)" };
  const filterCount = (layer.filters || []).length;

  return (
    <div className={`layer-row ${selected ? "selected" : ""} ${!layer.visible ? "hidden" : ""} ${layer.sqlOnly ? "sql-only" : ""}`}
         onClick={() => onSelect(layer.id)}>
      <span className="layer-drag" onClick={e => e.stopPropagation()}><DragIcon size={12}/></span>
      <div className={`layer-swatch ${layer.colorBy ? "gradient" : ""} ${layer.geom === "hex" ? "hex" : ""}`} style={swatchStyle}/>
      <div style={{ minWidth: 0 }}>
        {editing ? (
          <input className="input" style={{ height: 22, fontSize: 12.5 }}
                 value={val} autoFocus
                 onClick={e => e.stopPropagation()}
                 onChange={e => setVal(e.target.value)}
                 onBlur={commit}
                 onKeyDown={e => { if (e.key === "Enter") commit(); if (e.key === "Escape") { setEditing(false); setVal(layer.name); } }}/>
        ) : (
          <div className="layer-name" onDoubleClick={(e) => { e.stopPropagation(); setEditing(true); }}>{layer.name}</div>
        )}
        <div className="layer-meta">
          {layer.sqlOnly ? "sql-only" : layer.source}
          {" · "}
          {layer.rowCount?.toLocaleString()} {layer.geom === "point" ? "pts" : layer.geom === "polygon" ? "polys" : "rows"}
          {filterCount > 0 && <span style={{ color: "var(--accent-ink)", marginLeft: 6 }}>· <span className="badge-dot"/>{filterCount} filter{filterCount>1?"s":""}</span>}
        </div>
      </div>
      <div className="layer-actions" onClick={e => e.stopPropagation()}>
        {!layer.sqlOnly && (
          <button className="icon-btn" title="Style" onClick={onStyleClick}><PaletteIcon size={13}/></button>
        )}
        {!layer.sqlOnly && (
          <button className="icon-btn" title="Filter" onClick={onFilterClick}><FilterIcon size={13}/></button>
        )}
        {!layer.sqlOnly && (
          <button className="icon-btn" title={layer.visible ? "Hide" : "Show"} onClick={() => onToggle()}>
            {layer.visible ? <EyeIcon size={13}/> : <EyeOffIcon size={13}/>}
          </button>
        )}
        <button className="icon-btn" title="Rename" onClick={() => setEditing(true)}><EditIcon size={13}/></button>
        <button className="icon-btn" title="Remove" onClick={onRemove}><TrashIcon size={13}/></button>
      </div>
    </div>
  );
}

function LayersPanel({ layers, selectedId, onSelect, onUpdate, onRemove, onAddMore, onReorder, onEditTarget }) {
  const mapLayers = layers.filter(l => !l.sqlOnly);
  const sqlOnly = layers.filter(l => l.sqlOnly);

  return (
    <div className="panel-section">
      <div className="panel-head">
        <div>
          <div className="panel-title">Layers<em>.</em></div>
          <div className="panel-desc">{mapLayers.length} map · {sqlOnly.length} sql-only</div>
        </div>
        <button className="btn sm" onClick={onAddMore}><PlusIcon size={11}/> Add</button>
      </div>

      <div>
        {mapLayers.map(l => (
          <LayerRow key={l.id} layer={l}
            selected={selectedId === l.id}
            onSelect={onSelect}
            onToggle={() => onUpdate(l.id, { visible: !l.visible })}
            onRename={(name) => onUpdate(l.id, { name })}
            onRemove={() => onRemove(l.id)}
            onStyleClick={() => onEditTarget(l.id, "style")}
            onFilterClick={() => onEditTarget(l.id, "filter")}
          />
        ))}
      </div>

      {sqlOnly.length > 0 && (
        <div style={{ marginTop: 14 }}>
          <div className="panel-sub" style={{ marginBottom: 8, paddingLeft: 6 }}>SQL-only tables</div>
          {sqlOnly.map(l => (
            <LayerRow key={l.id} layer={l}
              selected={selectedId === l.id}
              onSelect={onSelect}
              onToggle={() => {}}
              onRename={(name) => onUpdate(l.id, { name })}
              onRemove={() => onRemove(l.id)}
              onStyleClick={() => {}}
              onFilterClick={() => {}}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// -------- Symbology --------
function PalettePicker({ value, onChange }) {
  return (
    <div className="palettes">
      {Object.entries(PALETTES).map(([name, ramp]) => (
        <button key={name} className={`palette ${value === name ? "selected" : ""}`} onClick={() => onChange(name)}>
          <div className="palette-ramp">{ramp.map((c, i) => <div key={i} style={{ background: c }}/>)}</div>
          <span className="palette-name">{name}</span>
        </button>
      ))}
    </div>
  );
}

function SymbologyPanel({ layer, onUpdate }) {
  if (!layer || layer.sqlOnly) return null;
  const numericCols = (layer.cols || []).filter(c => ["population","density","pop_2020","area_sqmi","median_income","households"].includes(c));

  return (
    <div className="panel-section">
      <div className="panel-head">
        <div>
          <div className="panel-title">Symbology<em>.</em></div>
          <div className="panel-desc">{layer.name}</div>
        </div>
      </div>

      <div className="stack-md">
        <div className="row" style={{ gap: 10 }}>
          <label className="field" style={{ flex: 1 }}>
            <span className="field-label">Base color</span>
            <div className="row" style={{ gap: 6 }}>
              <input type="color" value={layer.color} onChange={e => onUpdate({ color: e.target.value })}
                     style={{ width: 30, height: 28, border: "1px solid var(--line)", borderRadius: 6, padding: 0, background: "none" }}/>
              <input className="input mono" style={{ flex: 1 }} value={layer.color} onChange={e => onUpdate({ color: e.target.value })}/>
            </div>
          </label>
        </div>

        <div className="field">
          <span className="field-label">Opacity · {Math.round((layer.opacity ?? 1) * 100)}%</span>
          <input className="range" type="range" min="0" max="100" value={Math.round((layer.opacity ?? 1) * 100)}
                 onChange={e => onUpdate({ opacity: e.target.value / 100 })}/>
        </div>

        {layer.geom === "point" && (
          <div className="field">
            <span className="field-label">Point size · {layer.pointSize}px</span>
            <input className="range" type="range" min="2" max="16" value={layer.pointSize}
                   onChange={e => onUpdate({ pointSize: +e.target.value })}/>
          </div>
        )}

        <div className="field">
          <div className="row">
            <span className="field-label" style={{ flex: 1 }}>Color by column</span>
            <span className={`switch ${layer.colorBy ? "on" : ""}`}
                  onClick={() => onUpdate({ colorBy: layer.colorBy ? null : { column: numericCols[0], palette: "PuBuGn", classes: 5 } })}/>
          </div>
          {layer.colorBy && (
            <div className="stack-sm" style={{ marginTop: 8 }}>
              <select className="select" value={layer.colorBy.column}
                      onChange={e => onUpdate({ colorBy: { ...layer.colorBy, column: e.target.value } })}>
                {numericCols.map(c => <option key={c}>{c}</option>)}
              </select>
              <PalettePicker value={layer.colorBy.palette} onChange={(p) => onUpdate({ colorBy: { ...layer.colorBy, palette: p } })}/>
              <div className="row">
                <span className="field-label" style={{ flex: 1 }}>Classes · {layer.colorBy.classes}</span>
              </div>
              <input className="range" type="range" min="3" max="10" value={layer.colorBy.classes}
                     onChange={e => onUpdate({ colorBy: { ...layer.colorBy, classes: +e.target.value } })}/>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// -------- Filter builder --------
function FilterPanel({ layer, onUpdate }) {
  if (!layer || layer.sqlOnly) return null;
  const [col, setCol] = React.useState(layer.cols?.[0] || "");
  const [op, setOp] = React.useState("=");
  const [val, setVal] = React.useState("");

  const addFilter = () => {
    if (!col || !val) return;
    const filters = [...(layer.filters || []), { col, op, val: op === "=" ? [val] : val }];
    onUpdate({ filters });
    setVal("");
  };
  const remove = (i) => onUpdate({ filters: layer.filters.filter((_, idx) => idx !== i) });

  return (
    <div className="panel-section">
      <div className="panel-head">
        <div>
          <div className="panel-title">Filters<em>.</em></div>
          <div className="panel-desc">{(layer.filters || []).length} active · AND</div>
        </div>
      </div>

      <div className="stack-sm">
        {(layer.filters || []).map((f, i) => (
          <div key={i} className="filter-row">
            <code>{f.col}</code>
            <span className="muted">{f.op}</span>
            <code>{Array.isArray(f.val) ? f.val.join(", ") : f.val}</code>
            <span className="space"/>
            <button className="icon-btn" onClick={() => remove(i)}><CloseIcon size={11}/></button>
          </div>
        ))}
        {(layer.filters || []).length === 0 && (
          <div className="muted" style={{ fontSize: 12, padding: "4px 2px" }}>No filters yet. Add one below to hide rows from the map.</div>
        )}
      </div>

      <div className="stack-sm" style={{ marginTop: 12, padding: 10, background: "var(--bg-sunken)", borderRadius: 8, border: "1px solid var(--line-2)" }}>
        <div className="row" style={{ gap: 6 }}>
          <select className="select" style={{ flex: 2 }} value={col} onChange={e => setCol(e.target.value)}>
            {(layer.cols || []).map(c => <option key={c}>{c}</option>)}
          </select>
          <select className="select" style={{ width: 70 }} value={op} onChange={e => setOp(e.target.value)}>
            {["=", "<", "<=", ">", ">="].map(o => <option key={o}>{o}</option>)}
          </select>
        </div>
        <div className="row" style={{ gap: 6 }}>
          <input className="input" style={{ flex: 1 }} placeholder="value" value={val} onChange={e => setVal(e.target.value)}
                 onKeyDown={e => { if (e.key === "Enter") addFilter(); }}/>
          <button className="btn sm accent" onClick={addFilter}>Add</button>
        </div>
      </div>
    </div>
  );
}

// -------- Inspector --------
function Inspector({ feature, pinned, onTogglePin, onClear, layerName }) {
  if (!feature) {
    return (
      <div className="panel-section">
        <div className="panel-head">
          <div>
            <div className="panel-title">Inspect<em>.</em></div>
            <div className="panel-desc">Hover a feature — or click to pin</div>
          </div>
        </div>
        <div style={{
          marginTop: 10, padding: "20px 16px",
          background: "var(--bg-sunken)", border: "1px dashed var(--line)", borderRadius: 10,
          textAlign: "center", color: "var(--ink-3)", fontSize: 12
        }}>
          <div style={{ fontFamily: "var(--font-display)", fontSize: 18, color: "var(--ink-2)", fontStyle: "italic", marginBottom: 6 }}>
            Nothing selected
          </div>
          Move your cursor over the map — feature attributes will appear here.
        </div>
      </div>
    );
  }
  return (
    <div className="panel-section">
      <div className="panel-head">
        <div>
          <div className="panel-title">Inspect<em>.</em></div>
          <div className="panel-desc">{pinned ? "Pinned" : "Live hover"} · {layerName}</div>
        </div>
        <div className="row" style={{ gap: 2 }}>
          <button className="icon-btn" title={pinned ? "Unpin" : "Pin"} onClick={onTogglePin}>
            {pinned ? <PinSlashIcon size={14}/> : <PinIcon size={14}/>}
          </button>
          <button className="icon-btn" title="Close" onClick={onClear}><CloseIcon size={13}/></button>
        </div>
      </div>

      <div style={{ marginTop: 4 }}>
        <div style={{ fontFamily: "var(--font-display)", fontSize: 22, lineHeight: 1.15, letterSpacing: "-0.01em" }}>
          {feature.name}
        </div>
        <div className="mono" style={{ color: "var(--ink-3)", fontSize: 11, marginTop: 3 }}>
          {feature.lat}°N, {Math.abs(feature.lng)}°W
        </div>
      </div>

      <div style={{ marginTop: 14 }}>
        {Object.entries(feature)
          .filter(([k]) => !["id","x","y"].includes(k))
          .map(([k, v]) => (
            <div key={k} className="kv-row">
              <div className="kv-key">{k}</div>
              <div className={`kv-val ${typeof v === "number" ? "num" : ""}`}>
                {typeof v === "number" ? v.toLocaleString() : v}
              </div>
            </div>
          ))}
      </div>
    </div>
  );
}

// -------- Legend --------
function Legend({ layer }) {
  if (!layer || !layer.visible || !layer.colorBy) return null;
  const ramp = PALETTES[layer.colorBy.palette];
  const breaks = Array.from({ length: layer.colorBy.classes + 1 }, (_, i) => {
    // mock quantile breaks for display
    const step = 8_000_000 / layer.colorBy.classes;
    return Math.round(i * step);
  });
  return (
    <div className="legend">
      <div className="legend-title">{layer.name}</div>
      <div className="legend-col">{layer.colorBy.column}</div>
      <div className="legend-ramp">
        {ramp.slice(0, layer.colorBy.classes).map((c, i) => <div key={i} style={{ background: c }}/>)}
      </div>
      <div className="legend-breaks">
        <span>{breaks[0].toLocaleString()}</span>
        <span>{breaks[breaks.length-1].toLocaleString()}</span>
      </div>
    </div>
  );
}

Object.assign(window, { LayersPanel, SymbologyPanel, FilterPanel, Inspector, Legend, PalettePicker });
