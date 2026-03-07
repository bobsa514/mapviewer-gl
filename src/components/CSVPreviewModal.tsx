/** CSV preview modal — table view of parsed CSV rows with column selection checkboxes. */

import React from 'react';
import { XMarkIcon } from '@heroicons/react/24/outline';
import type { CSVPreviewData } from '../types';

interface CSVPreviewModalProps {
  csvPreview: CSVPreviewData;
  onClose: () => void;
  onToggleColumn: (header: string) => void;
  onSelectAll: () => void;
  onDeselectAll: () => void;
  onProceed: () => void;
}

export const CSVPreviewModal: React.FC<CSVPreviewModalProps> = ({
  csvPreview,
  onClose,
  onToggleColumn,
  onSelectAll,
  onDeselectAll,
  onProceed,
}) => {
  const isDuckDBOnly = csvPreview.mode === 'duckdb_only';

  return (
    <div className="absolute inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50" role="dialog" aria-modal="true">
      <div className="bg-white rounded-lg p-6 w-full max-w-[1000px] mx-4 max-h-[90vh] overflow-hidden flex flex-col">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-semibold text-gray-900">
            {isDuckDBOnly ? 'Register as SQL Table' : 'Preview CSV Data'}
          </h2>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-700" aria-label="Close">
            <XMarkIcon className="h-6 w-6" />
          </button>
        </div>
        {isDuckDBOnly && (
          <div className="mb-4 px-4 py-3 bg-purple-50 border border-purple-200 rounded-lg text-sm text-purple-800">
            No coordinate or H3 columns detected. This file will be registered as a SQL-only table for use in queries and JOINs.
          </div>
        )}
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
            {csvPreview.selectedColumns.size} of {csvPreview.headers.length} columns selected
          </div>
        </div>
        <div className="flex-1 overflow-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50 sticky top-0">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-10">Row</th>
                {csvPreview.headers.map((header, i) => (
                  <th key={i} className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    <div className="flex flex-col space-y-2">
                      <span>{header}</span>
                      <label className="flex items-center space-x-2">
                        <input
                          type="checkbox"
                          checked={csvPreview.selectedColumns.has(header)}
                          onChange={() => onToggleColumn(header)}
                          disabled={!isDuckDBOnly && csvPreview.coordinateColumns.has(header)}
                          className={`h-4 w-4 rounded border-gray-300 ${
                            csvPreview.coordinateColumns.has(header) ? 'bg-blue-100 text-blue-600 cursor-not-allowed' : 'text-blue-600'
                          }`}
                        />
                        <span className="text-xs font-normal">
                          {csvPreview.coordinateColumns.has(header) && "(Required)"}
                        </span>
                      </label>
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {csvPreview.rows.map((row, i) => (
                <tr key={i} className={i % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{i + 1}</td>
                  {row.map((cell, j) => (
                    <td key={j} className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{cell}</td>
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
            disabled={csvPreview.selectedColumns.size === 0}
          >
            {isDuckDBOnly ? 'Register as SQL Table' : 'Proceed with Selected Columns'}
          </button>
        </div>
      </div>
    </div>
  );
};
