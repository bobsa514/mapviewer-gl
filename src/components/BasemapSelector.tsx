/** Basemap picker dropdown — shows available free basemap styles (Carto, OSM). */

import React, { useState } from 'react';
import type { BasemapStyle } from '../types';
import { basemapOptions } from '../types';

interface BasemapSelectorProps {
  mapStyle: BasemapStyle;
  onSelect: (style: BasemapStyle) => void;
}

export const BasemapSelector: React.FC<BasemapSelectorProps> = ({ mapStyle, onSelect }) => {
  const [showSelector, setShowSelector] = useState(false);

  return (
    <div className="absolute bottom-16 right-4 z-[60]">
      <button
        onClick={() => setShowSelector(!showSelector)}
        className="bg-white px-3 py-2 rounded-lg shadow-lg text-sm text-gray-700 hover:bg-gray-50 flex items-center space-x-2"
      >
        <span>Base Map</span>
        <svg
          className={`h-4 w-4 transform transition-transform ${showSelector ? 'rotate-180' : ''}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>
      {showSelector && (
        <div className="absolute bottom-12 right-0 bg-white rounded-lg shadow-lg py-2 min-w-[120px] z-[70]">
          {Object.entries(basemapOptions).map(([name, url]) => (
            <button
              key={name}
              onClick={() => {
                onSelect(url);
                setShowSelector(false);
              }}
              className={`block w-full text-left px-4 py-2 text-sm hover:bg-gray-100 ${
                mapStyle === url ? 'bg-blue-50 text-blue-700' : 'text-gray-700'
              }`}
            >
              {name}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};
