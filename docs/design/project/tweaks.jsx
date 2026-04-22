// Tweaks panel — toggled by host via __activate_edit_mode

function TweaksPanel({ tweaks, onChange, onClose }) {
  return (
    <div className="tweaks-panel" onClick={e => e.stopPropagation()}>
      <div className="row" style={{ marginBottom: 12 }}>
        <h3 className="tweaks-title" style={{ flex: 1 }}>Tweaks<em>.</em></h3>
        <button className="icon-btn" onClick={onClose}><CloseIcon size={13}/></button>
      </div>

      <div className="tweaks-row">
        <span className="field-label">Accent hue · {tweaks.accentHue}°</span>
        <div className="tweaks-hue-track"
             onMouseDown={(e) => {
               const track = e.currentTarget;
               const move = (evt) => {
                 const rect = track.getBoundingClientRect();
                 const x = Math.max(0, Math.min(1, (evt.clientX - rect.left) / rect.width));
                 onChange({ accentHue: Math.round(x * 360) });
               };
               move(e);
               const up = () => { window.removeEventListener("mousemove", move); window.removeEventListener("mouseup", up); };
               window.addEventListener("mousemove", move);
               window.addEventListener("mouseup", up);
             }}>
          <div className="tweaks-hue-thumb" style={{ left: `${(tweaks.accentHue/360)*100}%`, background: `oklch(0.62 ${tweaks.accentChroma} ${tweaks.accentHue})` }}/>
        </div>
      </div>

      <div className="tweaks-row">
        <span className="field-label">Accent saturation</span>
        <div className="tweaks-segmented">
          {[["muted", 0.05], ["soft", 0.08], ["medium", 0.12], ["vivid", 0.18]].map(([name, c]) => (
            <button key={name} className={tweaks.accentChroma === c ? "active" : ""} onClick={() => onChange({ accentChroma: c })}>{name}</button>
          ))}
        </div>
      </div>

      <div className="tweaks-row">
        <span className="field-label">Density</span>
        <div className="tweaks-segmented">
          {["compact","comfortable","airy"].map(d => (
            <button key={d} className={tweaks.density === d ? "active" : ""} onClick={() => onChange({ density: d })}>{d}</button>
          ))}
        </div>
      </div>

      <div className="tweaks-row">
        <span className="field-label">Layout</span>
        <div className="tweaks-segmented">
          {[["dual-sidebar","dual"],["single-sidebar","left only"],["floating","floating"]].map(([v,label]) => (
            <button key={v} className={tweaks.layout === v ? "active" : ""} onClick={() => onChange({ layout: v })}>{label}</button>
          ))}
        </div>
      </div>

      <div className="tweaks-row">
        <span className="field-label">Default basemap</span>
        <div className="tweaks-segmented">
          {["light","dark","osm"].map(b => (
            <button key={b} className={tweaks.basemap === b ? "active" : ""} onClick={() => onChange({ basemap: b })}>{b}</button>
          ))}
        </div>
      </div>
    </div>
  );
}

Object.assign(window, { TweaksPanel });
