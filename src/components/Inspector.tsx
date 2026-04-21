import React from 'react';
import type { Feature } from 'geojson';
import { PinIcon, PinSlashIcon, CloseIcon } from './icons';

interface InspectorProps {
  feature: Feature | null;
  isPinned: boolean;
  layerName?: string;
  onTogglePin: () => void;
  onClear: () => void;
}

const formatCoordinate = (geom: Feature['geometry']): string | null => {
  if (!geom) return null;
  if (geom.type === 'Point') {
    const [lng, lat] = geom.coordinates as [number, number];
    const latStr = `${Math.abs(lat).toFixed(2)}°${lat >= 0 ? 'N' : 'S'}`;
    const lngStr = `${Math.abs(lng).toFixed(2)}°${lng >= 0 ? 'E' : 'W'}`;
    return `${latStr}, ${lngStr}`;
  }
  return null;
};

const primaryLabel = (props: Record<string, unknown>): string | null => {
  for (const key of ['name', 'NAME', 'title', 'id']) {
    if (props[key] != null && props[key] !== '') return String(props[key]);
  }
  return null;
};

export const Inspector: React.FC<InspectorProps> = ({ feature, isPinned, layerName, onTogglePin, onClear }) => {
  if (!feature) {
    return (
      <div className="panel-section">
        <div className="panel-head">
          <div>
            <div className="panel-title">Inspect<em>.</em></div>
            <div className="panel-desc">Hover a feature — or click to pin</div>
          </div>
        </div>
        <div
          style={{
            marginTop: 10,
            padding: '20px 16px',
            background: 'var(--bg-sunken)',
            border: '1px dashed var(--line)',
            borderRadius: 10,
            textAlign: 'center',
            color: 'var(--ink-3)',
            fontSize: 12,
          }}
        >
          <div
            style={{
              fontFamily: 'var(--font-display)',
              fontSize: 18,
              color: 'var(--ink-2)',
              fontStyle: 'italic',
              marginBottom: 6,
            }}
          >
            Nothing selected
          </div>
          Move your cursor over the map — feature attributes will appear here.
        </div>
      </div>
    );
  }

  const props = (feature.properties as Record<string, unknown>) || {};
  const label = primaryLabel(props);
  const coords = formatCoordinate(feature.geometry);

  return (
    <div className="panel-section">
      <div className="panel-head">
        <div>
          <div className="panel-title">Inspect<em>.</em></div>
          <div className="panel-desc">
            {isPinned ? 'Pinned' : 'Live hover'}
            {layerName ? ` · ${layerName}` : ''}
          </div>
        </div>
        <div className="row" style={{ gap: 2 }}>
          <button className="icon-btn" title={isPinned ? 'Unpin' : 'Pin'} aria-label={isPinned ? 'Unpin feature' : 'Pin feature'} onClick={onTogglePin}>
            {isPinned ? <PinSlashIcon size={14} /> : <PinIcon size={14} />}
          </button>
          <button className="icon-btn" title="Close" aria-label="Clear selection" onClick={onClear}>
            <CloseIcon size={13} />
          </button>
        </div>
      </div>

      {(label || coords) && (
        <div style={{ marginTop: 4 }}>
          {label && (
            <div style={{ fontFamily: 'var(--font-display)', fontSize: 22, lineHeight: 1.15, letterSpacing: '-0.01em' }}>
              {label}
            </div>
          )}
          {coords && (
            <div className="mono" style={{ color: 'var(--ink-3)', fontSize: 11, marginTop: 3 }}>
              {coords}
            </div>
          )}
        </div>
      )}

      <div style={{ marginTop: 14 }}>
        {Object.entries(props).map(([k, v]) => {
          const display = v == null ? '—' : typeof v === 'object' ? JSON.stringify(v) : String(v);
          const isNum = typeof v === 'number';
          return (
            <div key={k} className="kv-row">
              <div className="kv-key">{k}</div>
              <div className={`kv-val ${isNum ? 'num' : ''}`}>
                {isNum ? (v as number).toLocaleString() : display}
              </div>
            </div>
          );
        })}
        {Object.keys(props).length === 0 && (
          <div className="muted" style={{ fontSize: 12, padding: '4px 2px' }}>
            This feature has no attributes.
          </div>
        )}
      </div>
    </div>
  );
};
