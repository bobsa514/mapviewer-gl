/** Feature properties panel — shows attributes of a clicked/selected map feature. */

import React, { useState } from 'react';
import type { Feature } from 'geojson';

interface FeaturePropertiesPanelProps {
  selectedFeature: Feature;
  isLocked: boolean;
  selectedColumns: string[];
  allAvailableColumns: string[];
  onClose: () => void;
  onColumnToggle: (column: string) => void;
}

export const FeaturePropertiesPanel: React.FC<FeaturePropertiesPanelProps> = ({
  selectedFeature,
  isLocked,
  selectedColumns,
  allAvailableColumns,
  onClose,
  onColumnToggle,
}) => {
  const [showColumnSelector, setShowColumnSelector] = useState(false);

  return (
    <div className="absolute top-4 right-4 z-[80] bg-white rounded-lg shadow-lg p-4 max-w-md">
      <div className="flex justify-between items-center mb-2">
        <h3 className="text-sm font-medium text-gray-900">
          Feature Properties {isLocked && "(Locked)"}
        </h3>
        <div className="flex items-center space-x-2">
          <button
            onClick={() => setShowColumnSelector(!showColumnSelector)}
            className="text-gray-500 hover:text-gray-700"
            title="Select columns to display"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M11.49 3.17c-.38-1.56-2.6-1.56-2.98 0a1.532 1.532 0 01-2.286.948c-1.372-.836-2.942.734-2.106 2.106.54.886.061 2.042-.947 2.287-1.561.379-1.561 2.6 0 2.978a1.532 1.532 0 01.947 2.287c-.836 1.372.734 2.942 2.106 2.106a1.532 1.532 0 012.287.947c.379 1.561 2.6 1.561 2.978 0a1.533 1.533 0 012.287-.947c1.372.836 2.942-.734 2.106-2.106a1.533 1.533 0 01.947-2.287c1.561-.379 1.561-2.6 0-2.978a1.532 1.532 0 01-.947-2.287c.836-1.372-.734-2.942-2.106-2.106a1.532 1.532 0 01-2.287-.947zM10 13a3 3 0 100-6 3 3 0 000 6z" clipRule="evenodd" />
            </svg>
          </button>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-700">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
            </svg>
          </button>
        </div>
      </div>
      {showColumnSelector && (
        <div className="mb-4 p-2 bg-gray-50 rounded">
          <h4 className="text-xs font-medium text-gray-700 mb-2">Select columns to display:</h4>
          <div className="space-y-1 max-h-40 overflow-y-auto">
            {allAvailableColumns.map(column => (
              <label key={column} className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  checked={selectedColumns.includes(column)}
                  onChange={() => onColumnToggle(column)}
                  className="h-3 w-3 text-blue-600 rounded border-gray-300"
                />
                <span className="text-xs text-gray-600">{column}</span>
              </label>
            ))}
          </div>
        </div>
      )}
      <div className="text-sm text-gray-600 text-left">
        {Object.entries(selectedFeature.properties || {})
          .filter(([key]) => selectedColumns.includes(key))
          .map(([key, value]) => (
            <div key={key} className="mb-1">
              <span className="font-medium">{key}:</span> {String(value)}
            </div>
          ))}
      </div>
    </div>
  );
};
