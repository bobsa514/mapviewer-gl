/**
 * Legend display — compact card in the bottom-left of the map showing
 * the color ramp (and size ramp if present) for the first visible layer
 * with active symbology. Re-skinned in v2.3 with the OKLCH design system.
 */

import React from 'react';
import type { LayerInfo } from '../types';
import { colorScales } from '../types';

const ColorLegend: React.FC<{ layer: LayerInfo }> = ({ layer }) => {
  const mapping = layer.colorMapping;
  if (!mapping || !mapping.breaks.length) return null;
  const ramp = colorScales[mapping.colorScale];
  const firstBreak = mapping.breaks[0];
  const lastBreak = mapping.breaks[mapping.breaks.length - 1];
  const fmt = (n?: number) => (n === undefined || !isFinite(n) ? '—' : n.toLocaleString(undefined, { maximumFractionDigits: 2 }));

  return (
    <>
      <div className="legend-title">{layer.name}</div>
      <div className="legend-col">{mapping.column}</div>
      <div className="legend-ramp">
        {Array.from({ length: mapping.numClasses }).map((_, i) => (
          <div key={i} style={{ background: ramp[Math.min(i, ramp.length - 1)] }} />
        ))}
      </div>
      <div className="legend-breaks">
        <span>{fmt(firstBreak)}</span>
        <span>{fmt(lastBreak)}</span>
      </div>
    </>
  );
};

interface LegendDisplayProps {
  layers: LayerInfo[];
}

export const LegendDisplay: React.FC<LegendDisplayProps> = ({ layers }) => {
  const legendLayer = layers.find((l) => l.visible && l.colorMapping?.breaks?.length);
  if (!legendLayer) return null;
  return (
    <div className="legend">
      <ColorLegend layer={legendLayer} />
    </div>
  );
};
