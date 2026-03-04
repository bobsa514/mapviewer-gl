/**
 * Legend display — renders color and size legends for visible layers
 * that have active classified symbology (color-by-column, size-by-column).
 */

import React from 'react';
import type { LayerInfo } from '../types';
import { colorScales } from '../types';

/** Vertical color ramp legend with break values for a single layer. */
const ColorLegend: React.FC<{ layer: LayerInfo }> = ({ layer }) => {
  if (!layer.colorMapping?.breaks.length) return null;

  const getColorForLegend = (index: number): string => {
    if (!layer.colorMapping) return '';
    return colorScales[layer.colorMapping.colorScale][index];
  };

  return (
    <div className="bg-white rounded-lg shadow-lg p-2 mb-2">
      <div className="text-xs font-medium mb-2">{layer.colorMapping.column}</div>
      <div className="flex space-x-2">
        <div className="w-6 h-32">
          <div className="h-full flex flex-col">
            {Array.from({ length: layer.colorMapping.numClasses }).map((_, i) => (
              <div key={i} className="flex-1" style={{ backgroundColor: getColorForLegend(i) }} />
            ))}
          </div>
        </div>
        <div className="flex flex-col justify-between py-1 text-xs">
          <span>{layer.colorMapping.breaks[layer.colorMapping.breaks.length - 1]?.toFixed(1)}</span>
          <span>{layer.colorMapping.breaks[Math.floor(layer.colorMapping.breaks.length / 2)]?.toFixed(1)}</span>
          <span>{layer.colorMapping.breaks[0]?.toFixed(1)}</span>
        </div>
      </div>
    </div>
  );
};

/** Graduated circle legend with break values for point layers using size mapping. */
const SizeLegend: React.FC<{ layer: LayerInfo }> = ({ layer }) => {
  if (!layer.sizeMapping?.breaks.length) return null;

  const getSizeForLegend = (index: number): number => {
    if (!layer.sizeMapping) return 0;
    const fraction = index / (layer.sizeMapping.numClasses - 1);
    return layer.sizeMapping.minSize + (layer.sizeMapping.maxSize - layer.sizeMapping.minSize) * fraction;
  };

  return (
    <div className="bg-white rounded-lg shadow-lg p-2 mb-2">
      <div className="text-xs font-medium mb-2">{layer.sizeMapping.column}</div>
      <div className="flex space-x-2">
        <div className="w-6 h-32 relative">
          {Array.from({ length: layer.sizeMapping.numClasses }).map((_, i) => {
            const size = getSizeForLegend(i);
            return (
              <div
                key={i}
                className="absolute left-1/2 transform -translate-x-1/2"
                style={{
                  bottom: `${(i / (layer.sizeMapping!.numClasses - 1)) * 100}%`,
                  width: `${size * 2}px`,
                  height: `${size * 2}px`,
                  borderRadius: '50%',
                  backgroundColor: layer.color,
                  opacity: layer.opacity
                }}
              />
            );
          })}
        </div>
        <div className="flex flex-col justify-between py-1 text-xs">
          <span>{layer.sizeMapping.breaks[layer.sizeMapping.breaks.length - 1]?.toFixed(1)}</span>
          <span>{layer.sizeMapping.breaks[Math.floor(layer.sizeMapping.breaks.length / 2)]?.toFixed(1)}</span>
          <span>{layer.sizeMapping.breaks[0]?.toFixed(1)}</span>
        </div>
      </div>
    </div>
  );
};

interface LegendDisplayProps {
  layers: LayerInfo[];
}

export const LegendDisplay: React.FC<LegendDisplayProps> = ({ layers }) => {
  return (
    <div className="absolute bottom-28 right-4 space-y-4 z-[30]">
      {layers.map(layer => {
        if (!layer.visible) return null;
        return (
          <React.Fragment key={layer.id}>
            {layer.colorMapping?.column && <ColorLegend layer={layer} />}
            {layer.type === 'point' && layer.sizeMapping?.column && <SizeLegend layer={layer} />}
          </React.Fragment>
        );
      })}
    </div>
  );
};
