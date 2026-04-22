/**
 * Basemap picker — segmented pill-style control anchored bottom-right of the map.
 * Shows the three built-in basemaps (Carto Light / Carto Dark / OSM) as inline
 * buttons. Redesigned in v2.3 — no dropdown menu.
 */

import React from 'react';
import type { BasemapStyle } from '../types';
import { basemapOptions } from '../types';

interface BasemapSelectorProps {
  mapStyle: BasemapStyle;
  onSelect: (style: BasemapStyle) => void;
}

const SHORT_LABEL: Record<string, string> = {
  'Carto Light': 'light',
  'Carto Dark': 'dark',
  'OpenStreetMap': 'osm',
};

export const BasemapSelector: React.FC<BasemapSelectorProps> = ({ mapStyle, onSelect }) => {
  return (
    <div className="basemap-switcher" role="group" aria-label="Basemap selector">
      {Object.entries(basemapOptions).map(([name, style]) => {
        const active = mapStyle === style;
        return (
          <button
            key={name}
            className={active ? 'active' : ''}
            onClick={() => onSelect(style)}
            aria-pressed={active}
            aria-label={`Use ${name} basemap`}
          >
            {SHORT_LABEL[name] ?? name}
          </button>
        );
      })}
    </div>
  );
};
