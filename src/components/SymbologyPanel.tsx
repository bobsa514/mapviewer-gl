import React from 'react';
import type { LayerInfo, ColorScaleName } from '../types';
import { colorScales } from '../types';
import { getNumericColumns } from '../utils/layers';

const PALETTE_NAMES: ColorScaleName[] = ['Reds', 'Blues', 'Greens', 'Greys', 'YlGnBu', 'YlOrRd', 'PuBuGn', 'RdPu'];

interface SymbologyPanelProps {
  layer: LayerInfo;
  onUpdateColor: (layerId: number, color: string) => void;
  onUpdateOpacity: (layerId: number, opacity: number) => void;
  onUpdatePointSize: (layerId: number, size: number) => void;
  onUpdateColorMapping: (layerId: number, mapping: NonNullable<LayerInfo['colorMapping']>) => void;
  onClearColorMapping: (layerId: number) => void;
}

export const SymbologyPanel: React.FC<SymbologyPanelProps> = ({
  layer,
  onUpdateColor,
  onUpdateOpacity,
  onUpdatePointSize,
  onUpdateColorMapping,
  onClearColorMapping,
}) => {
  const numericCols = getNumericColumns(layer);
  const showPointSize = layer.type === 'point' || layer.type === 'geojson';
  const colorBy = layer.colorMapping;

  return (
    <div className="panel-section">
      <div className="panel-head">
        <div>
          <div className="panel-title">Symbology<em>.</em></div>
          <div className="panel-desc" title={layer.name}>{layer.name}</div>
        </div>
      </div>

      <div className="stack-md">
        <div className="field">
          <span className="field-label">Base color</span>
          <div className="row" style={{ gap: 6 }}>
            <input
              type="color"
              value={layer.color}
              onChange={(e) => onUpdateColor(layer.id, e.target.value)}
              aria-label="Base color"
              style={{ width: 30, height: 28, border: '1px solid var(--line)', borderRadius: 6, padding: 0, background: 'none' }}
            />
            <input
              className="input mono"
              style={{ flex: 1 }}
              value={layer.color}
              onChange={(e) => onUpdateColor(layer.id, e.target.value)}
              aria-label="Base color hex"
            />
          </div>
        </div>

        <div className="field">
          <span className="field-label">Opacity · {Math.round(layer.opacity * 100)}%</span>
          <input
            className="range"
            type="range"
            min={0}
            max={100}
            value={Math.round(layer.opacity * 100)}
            onChange={(e) => onUpdateOpacity(layer.id, Number(e.target.value) / 100)}
            aria-label="Layer opacity"
          />
        </div>

        {showPointSize && (
          <div className="field">
            <span className="field-label">Point size · {layer.pointSize ?? 5}px</span>
            <input
              className="range"
              type="range"
              min={1}
              max={20}
              value={layer.pointSize ?? 5}
              onChange={(e) => onUpdatePointSize(layer.id, Number(e.target.value))}
              aria-label="Point size"
            />
          </div>
        )}

        <div className="field">
          <div className="row">
            <span className="field-label" style={{ flex: 1 }}>Color by column</span>
            <button
              type="button"
              className={`switch ${colorBy ? 'on' : ''}`}
              onClick={() => {
                if (colorBy) {
                  onClearColorMapping(layer.id);
                } else if (numericCols.length > 0) {
                  onUpdateColorMapping(layer.id, {
                    column: numericCols[0],
                    numClasses: 5,
                    breaks: [],
                    colorScale: 'PuBuGn',
                  });
                }
              }}
              aria-label={colorBy ? 'Disable color-by-column' : 'Enable color-by-column'}
              disabled={!colorBy && numericCols.length === 0}
            />
          </div>
          {!colorBy && numericCols.length === 0 && (
            <div className="muted" style={{ fontSize: 11, marginTop: 4 }}>
              No numeric columns detected on this layer.
            </div>
          )}

          {colorBy && (
            <div className="stack-sm" style={{ marginTop: 8 }}>
              <select
                className="select"
                value={colorBy.column}
                onChange={(e) =>
                  onUpdateColorMapping(layer.id, {
                    ...colorBy,
                    column: e.target.value,
                    breaks: [],
                  })
                }
                aria-label="Color-by column"
              >
                {numericCols.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>

              <div className="palettes">
                {PALETTE_NAMES.map((name) => (
                  <button
                    key={name}
                    type="button"
                    className={`palette ${colorBy.colorScale === name ? 'selected' : ''}`}
                    onClick={() =>
                      onUpdateColorMapping(layer.id, {
                        ...colorBy,
                        colorScale: name,
                      })
                    }
                  >
                    <div className="palette-ramp">
                      {colorScales[name].map((c, i) => (
                        <div key={i} style={{ background: c }} />
                      ))}
                    </div>
                    <span className="palette-name">{name}</span>
                  </button>
                ))}
              </div>

              <div className="row">
                <span className="field-label" style={{ flex: 1 }}>Classes · {colorBy.numClasses}</span>
              </div>
              <input
                className="range"
                type="range"
                min={3}
                max={10}
                value={colorBy.numClasses}
                onChange={(e) =>
                  onUpdateColorMapping(layer.id, {
                    ...colorBy,
                    numClasses: Number(e.target.value),
                    breaks: [],
                  })
                }
                aria-label="Number of color classes"
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
