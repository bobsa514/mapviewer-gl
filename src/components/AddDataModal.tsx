/**
 * Add Data modal — centered overlay with tabs for each supported format.
 * Supports GeoJSON, CSV, Shapefile (ZIP), and map config import/export.
 * Each tab provides a drag-and-drop zone plus click-to-browse file input.
 */

import React, { useState, useRef, useCallback } from 'react';
import { XMarkIcon } from '@heroicons/react/24/outline';

type TabId = 'geojson' | 'csv' | 'shapefile' | 'parquet' | 'config';

interface AddDataModalProps {
  isOpen: boolean;
  onClose: () => void;
  onGeoJSONFile: (file: File) => void;
  onCSVFile: (file: File) => void;
  onShapefileFile: (file: File) => void;
  onParquetFile: (file: File) => void;
  onConfigFile: (file: File) => void;
  onExport: () => void;
  isLoading: boolean;
  hasLayers: boolean;
}

const tabs: { id: TabId; label: string; accept: string; description: string }[] = [
  { id: 'geojson', label: 'GeoJSON', accept: '.json,.geojson', description: 'Upload a GeoJSON file (.json, .geojson)' },
  { id: 'csv', label: 'CSV', accept: '.csv', description: 'Upload a CSV with coordinates or H3 indexes' },
  { id: 'shapefile', label: 'Shapefile', accept: '.zip', description: 'Upload a zipped shapefile (.zip)' },
  { id: 'parquet', label: 'Parquet', accept: '.parquet', description: 'Upload a Parquet or GeoParquet file' },
  { id: 'config', label: 'Config', accept: '.json', description: 'Import a previously exported map configuration' },
];

export const AddDataModal: React.FC<AddDataModalProps> = ({
  isOpen,
  onClose,
  onGeoJSONFile,
  onCSVFile,
  onShapefileFile,
  onParquetFile,
  onConfigFile,
  onExport,
  isLoading,
  hasLayers,
}) => {
  const [activeTab, setActiveTab] = useState<TabId>('geojson');
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFile = useCallback((file: File) => {
    switch (activeTab) {
      case 'geojson': onGeoJSONFile(file); break;
      case 'csv': onCSVFile(file); break;
      case 'shapefile': onShapefileFile(file); break;
      case 'parquet': onParquetFile(file); break;
      case 'config': onConfigFile(file); break;
    }
  }, [activeTab, onGeoJSONFile, onCSVFile, onShapefileFile, onParquetFile, onConfigFile]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  }, [handleFile]);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback(() => setIsDragging(false), []);

  const handleInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
    if (e.target) e.target.value = '';
  }, [handleFile]);

  const currentTab = tabs.find(t => t.id === activeTab)!;

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl shadow-2xl w-[560px] max-h-[80vh] overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900">Add Data</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition-colors">
            <XMarkIcon className="h-5 w-5" />
          </button>
        </div>

        <div className="flex border-b border-gray-200">
          {tabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex-1 px-4 py-3 text-sm font-medium transition-colors ${
                activeTab === tab.id
                  ? 'text-blue-600 border-b-2 border-blue-600 bg-blue-50/50'
                  : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div className="p-6">
          <p className="text-sm text-gray-500 mb-4">{currentTab.description}</p>

          <div
            onDrop={handleDrop}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onClick={() => !isLoading && fileInputRef.current?.click()}
            className={`border-2 border-dashed rounded-lg p-10 text-center cursor-pointer transition-colors ${
              isDragging
                ? 'border-blue-400 bg-blue-50'
                : 'border-gray-300 hover:border-gray-400 hover:bg-gray-50'
            } ${isLoading ? 'opacity-50 cursor-not-allowed' : ''}`}
          >
            <svg
              className="mx-auto h-10 w-10 text-gray-400 mb-3"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
            </svg>
            <p className="text-sm text-gray-600">
              Drop file here or <span className="text-blue-600 font-medium">click to browse</span>
            </p>
          </div>

          <input
            ref={fileInputRef}
            type="file"
            accept={currentTab.accept}
            onChange={handleInputChange}
            className="hidden"
          />

          {activeTab === 'config' && (
            <button
              onClick={onExport}
              disabled={!hasLayers}
              className="mt-4 w-full px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              Export Current Configuration
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
