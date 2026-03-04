/** GeoJSON preview modal — property selection grid showing sample feature values. */

import React from 'react';
import { XMarkIcon } from '@heroicons/react/24/outline';
import type { GeoJSONPreviewData } from '../types';

interface GeoJSONPreviewModalProps {
  geoJSONPreview: GeoJSONPreviewData;
  onClose: () => void;
  onToggleProperty: (property: string) => void;
  onSelectAll: () => void;
  onDeselectAll: () => void;
  onProceed: () => void;
}

export const GeoJSONPreviewModal: React.FC<GeoJSONPreviewModalProps> = ({
  geoJSONPreview,
  onClose,
  onToggleProperty,
  onSelectAll,
  onDeselectAll,
  onProceed,
}) => {
  return (
    <div className="absolute inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 max-w-[90vw] w-[1000px] max-h-[90vh] overflow-hidden flex flex-col">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-semibold text-gray-900">Preview GeoJSON Data</h2>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-700">
            <XMarkIcon className="h-6 w-6" />
          </button>
        </div>
        <div className="mb-4 flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <button onClick={onSelectAll} className="px-3 py-1.5 text-sm bg-gray-100 hover:bg-gray-200 text-gray-700 rounded">
              Select All
            </button>
            <button onClick={onDeselectAll} className="px-3 py-1.5 text-sm bg-gray-100 hover:bg-gray-200 text-gray-700 rounded">
              Deselect All
            </button>
          </div>
          <div className="text-sm text-gray-500">
            {geoJSONPreview.selectedProperties.size} of {geoJSONPreview.properties.length} properties selected
          </div>
        </div>
        <div className="flex-1 overflow-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50 sticky top-0">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-10">Property</th>
                {geoJSONPreview.features.slice(0, 5).map((_, i) => (
                  <th key={i} className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Feature {i + 1}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {geoJSONPreview.properties.map((property, i) => (
                <tr key={i} className={i % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center space-x-2">
                      <input
                        type="checkbox"
                        checked={geoJSONPreview.selectedProperties.has(property)}
                        onChange={() => onToggleProperty(property)}
                        className="h-4 w-4 rounded border-gray-300 text-blue-600"
                      />
                      <span className="text-sm text-gray-900">{property}</span>
                    </div>
                  </td>
                  {geoJSONPreview.features.slice(0, 5).map((feature, j) => (
                    <td key={j} className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {feature.properties?.[property]}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="mt-4 flex justify-end space-x-3">
          <button onClick={onClose} className="px-4 py-2 text-gray-700 hover:text-gray-900 font-medium">Cancel</button>
          <button
            onClick={onProceed}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700"
            disabled={geoJSONPreview.selectedProperties.size === 0}
          >
            Proceed with Selected Properties
          </button>
        </div>
      </div>
    </div>
  );
};
