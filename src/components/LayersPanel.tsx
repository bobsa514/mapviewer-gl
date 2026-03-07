/**
 * Layers panel — collapsible list of map layers with per-layer controls:
 * visibility toggle, remove, symbology (color/size mapping, opacity, point size),
 * and filter access. Each layer card expands to show detailed style options.
 */

import React, { useState, useRef, useEffect } from 'react';
import {
  XMarkIcon,
  PaintBrushIcon,
  FunnelIcon
} from '@heroicons/react/24/outline';
import type { LayerInfo, ColorScaleName } from '../types';
import { colorScales } from '../types';
import { getNumericColumns } from '../utils/layers';

const ColorScalePreview: React.FC<{ scale: ColorScaleName }> = ({ scale }) => {
  const colors = colorScales[scale];
  return (
    <div className="flex h-4">
      {colors.map((color, i) => (
        <div key={i} className="flex-1" style={{ backgroundColor: color }} />
      ))}
    </div>
  );
};

interface LayersPanelProps {
  layers: LayerInfo[];
  onToggle: (layerId: number) => void;
  onRemove: (layerId: number) => void;
  onToggleExpanded: (layerId: number) => void;
  onUpdateColor: (layerId: number, color: string) => void;
  onUpdateOpacity: (layerId: number, opacity: number) => void;
  onUpdatePointSize: (layerId: number, size: number) => void;
  onUpdateColorMapping: (layerId: number, colorMapping: NonNullable<LayerInfo['colorMapping']>) => void;
  onClearColorMapping: (layerId: number) => void;
  onUpdateSizeMapping: (layerId: number, sizeMapping: NonNullable<LayerInfo['sizeMapping']>) => void;
  onClearSizeMapping: (layerId: number) => void;
  onOpenFilter: (layerId: number) => void;
  onRename: (layerId: number, newName: string) => void;
  onReorder: (fromIndex: number, toIndex: number) => void;
  activeFilterCounts: Record<number, number>;
}

export const LayersPanel: React.FC<LayersPanelProps> = ({
  layers,
  onToggle,
  onRemove,
  onToggleExpanded,
  onUpdateColor,
  onUpdateOpacity,
  onUpdatePointSize,
  onUpdateColorMapping,
  onClearColorMapping,
  onUpdateSizeMapping,
  onClearSizeMapping,
  onOpenFilter,
  onRename,
  onReorder,
  activeFilterCounts,
}) => {
  const [editingLayerId, setEditingLayerId] = useState<number | null>(null);
  const [editingName, setEditingName] = useState('');
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);
  const editInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editingLayerId !== null) editInputRef.current?.focus();
  }, [editingLayerId]);

  const startEditing = (layer: LayerInfo) => {
    setEditingLayerId(layer.id);
    setEditingName(layer.name);
  };

  const commitRename = () => {
    if (editingLayerId !== null && editingName.trim()) {
      onRename(editingLayerId, editingName.trim());
    }
    setEditingLayerId(null);
  };
  const renderColorScaleDropdown = (layer: LayerInfo) => (
    <div>
      <span className="text-xs text-gray-500">Color Scale</span>
      <div className="relative">
        <select
          className="mt-1 block w-full rounded-md border-gray-300 py-1 pl-2 pr-8 text-xs"
          value={layer.colorMapping?.colorScale || 'YlOrRd'}
          onChange={(e) => {
            const colorScale = e.target.value as ColorScaleName;
            const column = layer.colorMapping?.column || '';
            if (column) {
              onUpdateColorMapping(layer.id, {
                column,
                numClasses: layer.colorMapping?.numClasses || 5,
                breaks: [],
                colorScale
              });
            }
          }}
        >
          <optgroup label="Single-hue">
            {(['Reds', 'Blues', 'Greens', 'Greys'] as const).map(scale => (
              <option key={scale} value={scale}>{scale}</option>
            ))}
          </optgroup>
          <optgroup label="Multi-hue">
            {(['YlGnBu', 'YlOrRd', 'PuBuGn', 'RdPu'] as const).map(scale => (
              <option key={scale} value={scale}>{scale}</option>
            ))}
          </optgroup>
        </select>
        {layer.colorMapping && (
          <div className="absolute left-0 right-0 top-full mt-1 bg-white border rounded-md shadow-lg z-10">
            <ColorScalePreview scale={layer.colorMapping.colorScale} />
          </div>
        )}
      </div>
    </div>
  );

  return (
    <div className="space-y-4">
      {layers.map((layer, index) => (
        <div
          key={layer.id}
          className={`bg-white rounded-md border border-gray-200 overflow-hidden ${dragOverIndex === index ? 'border-t-2 border-blue-500' : ''} ${dragIndex === index ? 'opacity-50' : ''}`}
          draggable
          onDragStart={(e) => {
            setDragIndex(index);
            e.dataTransfer.effectAllowed = 'move';
          }}
          onDragOver={(e) => {
            e.preventDefault();
            e.dataTransfer.dropEffect = 'move';
            setDragOverIndex(index);
          }}
          onDragLeave={() => setDragOverIndex(null)}
          onDrop={(e) => {
            e.preventDefault();
            if (dragIndex !== null && dragIndex !== index) {
              onReorder(dragIndex, index);
            }
            setDragIndex(null);
            setDragOverIndex(null);
          }}
          onDragEnd={() => {
            setDragIndex(null);
            setDragOverIndex(null);
          }}
        >
          <div className="flex items-center justify-between p-2">
            <div className="flex items-center space-x-2">
              {/* Drag handle */}
              <svg className="h-4 w-4 text-gray-300 cursor-grab active:cursor-grabbing flex-shrink-0" viewBox="0 0 16 16" fill="currentColor">
                <circle cx="5" cy="3" r="1.5"/><circle cx="11" cy="3" r="1.5"/>
                <circle cx="5" cy="8" r="1.5"/><circle cx="11" cy="8" r="1.5"/>
                <circle cx="5" cy="13" r="1.5"/><circle cx="11" cy="13" r="1.5"/>
              </svg>
              <input
                type="checkbox"
                checked={layer.visible}
                onChange={() => onToggle(layer.id)}
                className="h-4 w-4 text-blue-600 rounded border-gray-300"
                aria-label="Toggle layer visibility"
              />
              {editingLayerId === layer.id ? (
                <input
                  ref={editInputRef}
                  type="text"
                  value={editingName}
                  onChange={(e) => setEditingName(e.target.value)}
                  onBlur={commitRename}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') commitRename();
                    if (e.key === 'Escape') setEditingLayerId(null);
                  }}
                  className="text-sm text-gray-700 border border-blue-400 rounded px-1 py-0 outline-none max-w-[220px]"
                />
              ) : (
                <span
                  className="text-sm text-gray-700 truncate max-w-[220px] cursor-pointer hover:text-blue-600"
                  title="Click to rename"
                  onClick={() => startEditing(layer)}
                >
                  {layer.name}
                </span>
              )}
            </div>
            <div className="flex items-center space-x-2">
              <button onClick={() => onToggleExpanded(layer.id)} className="text-gray-500 hover:text-gray-700" title="Symbology" aria-label="Layer settings">
                <PaintBrushIcon className="h-5 w-5" />
              </button>
              <button
                onClick={() => onOpenFilter(layer.id)}
                className="relative p-1 text-gray-400 hover:text-gray-600"
                title="Filter data"
                aria-label="Filter data"
              >
                <FunnelIcon className="h-4 w-4" />
                {activeFilterCounts[layer.id] > 0 && (
                  <span className="absolute -top-1 -right-1 bg-blue-600 text-white text-[9px] font-bold rounded-full h-3.5 w-3.5 flex items-center justify-center leading-none">
                    {activeFilterCounts[layer.id]}
                  </span>
                )}
              </button>
              <button onClick={() => onRemove(layer.id)} className="text-red-600 hover:text-red-800" title="Remove Layer" aria-label="Remove layer">
                <XMarkIcon className="h-5 w-5" />
              </button>
            </div>
          </div>
          {layer.isExpanded && (
            <div className="border-t border-gray-200 p-2 space-y-2 bg-gray-50">
              <div className="flex items-center justify-between space-x-2">
                <span className="text-xs text-gray-500">Color</span>
                <input
                  type="color"
                  value={layer.color}
                  onChange={(e) => onUpdateColor(layer.id, e.target.value)}
                  className="h-6 w-6 rounded cursor-pointer"
                />
              </div>
              <div className="space-y-1">
                <span className="text-xs text-gray-500">Color Based On</span>
                <select
                  className="mt-1 block w-full rounded-md border-gray-300 py-1 pl-2 pr-8 text-xs"
                  value={layer.colorMapping?.column || ''}
                  onChange={(e) => {
                    const column = e.target.value;
                    if (column) {
                      onUpdateColorMapping(layer.id, {
                        column,
                        numClasses: layer.colorMapping?.numClasses || 5,
                        breaks: [],
                        colorScale: 'YlOrRd'
                      });
                    } else {
                      onClearColorMapping(layer.id);
                    }
                  }}
                >
                  <option value="">None</option>
                  {getNumericColumns(layer).map(column => (
                    <option key={column} value={column}>{column}</option>
                  ))}
                </select>
                {layer.colorMapping && (
                  <div className="space-y-2 mt-2">
                    <div>{renderColorScaleDropdown(layer)}</div>
                    <div className="space-y-1">
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-gray-500">Number of Classes</span>
                        <span className="text-xs text-gray-600">{layer.colorMapping.numClasses}</span>
                      </div>
                      <input
                        type="range"
                        min="3"
                        max="10"
                        step="1"
                        value={layer.colorMapping.numClasses}
                        onChange={(e) => {
                          const numClasses = parseInt(e.target.value);
                          onUpdateColorMapping(layer.id, {
                            ...layer.colorMapping!,
                            numClasses,
                            breaks: []
                          });
                        }}
                        className="w-full"
                      />
                    </div>
                  </div>
                )}
              </div>
              <div className="space-y-1">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-gray-500">Opacity</span>
                  <span className="text-xs text-gray-600">{Math.round(layer.opacity * 100)}%</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.1"
                  value={layer.opacity}
                  onChange={(e) => onUpdateOpacity(layer.id, parseFloat(e.target.value))}
                  className="w-full"
                />
              </div>
              {(layer.type === 'point' || layer.type === 'geojson') && (
                <div className="space-y-2">
                  <div className="space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-gray-500">Point Size</span>
                      <span className="text-xs text-gray-600">{layer.pointSize || 5}px</span>
                    </div>
                    <input
                      type="range"
                      min="1"
                      max="20"
                      step="1"
                      value={layer.pointSize || 5}
                      onChange={(e) => onUpdatePointSize(layer.id, parseInt(e.target.value))}
                      className="w-full"
                      disabled={!!layer.sizeMapping}
                    />
                  </div>
                  <div className="space-y-1">
                    <span className="text-xs text-gray-500">Size Based On</span>
                    <select
                      className="mt-1 block w-full rounded-md border-gray-300 py-1 pl-2 pr-8 text-xs"
                      value={layer.sizeMapping?.column || ''}
                      onChange={(e) => {
                        const column = e.target.value;
                        if (column) {
                          onUpdateSizeMapping(layer.id, {
                            column,
                            numClasses: layer.sizeMapping?.numClasses || 5,
                            breaks: [],
                            minSize: 2,
                            maxSize: 10
                          });
                        } else {
                          onClearSizeMapping(layer.id);
                        }
                      }}
                    >
                      <option value="">None</option>
                      {getNumericColumns(layer).map(column => (
                        <option key={column} value={column}>{column}</option>
                      ))}
                    </select>
                    {layer.sizeMapping && (
                      <div className="space-y-2 mt-2">
                        <div className="space-y-1">
                          <div className="flex items-center justify-between">
                            <span className="text-xs text-gray-500">Number of Classes</span>
                            <span className="text-xs text-gray-600">{layer.sizeMapping.numClasses}</span>
                          </div>
                          <input
                            type="range"
                            min="3"
                            max="10"
                            step="1"
                            value={layer.sizeMapping.numClasses}
                            onChange={(e) => {
                              const numClasses = parseInt(e.target.value);
                              onUpdateSizeMapping(layer.id, {
                                ...layer.sizeMapping!,
                                numClasses,
                                breaks: []
                              });
                            }}
                            className="w-full"
                          />
                        </div>
                        <div className="space-y-1">
                          <div className="flex items-center justify-between">
                            <span className="text-xs text-gray-500">Size Range (px)</span>
                            <span className="text-xs text-gray-600">{layer.sizeMapping.minSize}-{layer.sizeMapping.maxSize}px</span>
                          </div>
                          <div className="relative">
                            <div className="h-1 bg-gray-200 rounded-full">
                              <div
                                className="absolute h-1 bg-blue-500 rounded-full"
                                style={{
                                  left: `${(layer.sizeMapping.minSize - 1) / 24 * 100}%`,
                                  width: `${((layer.sizeMapping.maxSize - layer.sizeMapping.minSize) / 24) * 100}%`
                                }}
                              />
                            </div>
                            <input
                              type="range"
                              min="1"
                              max="25"
                              step="1"
                              value={layer.sizeMapping.minSize}
                              onChange={(e) => {
                                const minSize = parseInt(e.target.value);
                                if (minSize <= layer.sizeMapping!.maxSize) {
                                  onUpdateSizeMapping(layer.id, {
                                    ...layer.sizeMapping!,
                                    minSize,
                                    breaks: []
                                  });
                                }
                              }}
                              className="absolute top-0 left-0 w-full h-1 appearance-none bg-transparent [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-white [&::-webkit-slider-thumb]:border-2 [&::-webkit-slider-thumb]:border-blue-500 [&::-webkit-slider-thumb]:cursor-pointer [&::-webkit-slider-thumb]:relative [&::-webkit-slider-thumb]:z-20 [&::-moz-range-thumb]:appearance-none [&::-moz-range-thumb]:h-4 [&::-moz-range-thumb]:w-4 [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:bg-white [&::-moz-range-thumb]:border-2 [&::-moz-range-thumb]:border-blue-500 [&::-moz-range-thumb]:cursor-pointer [&::-moz-range-thumb]:relative [&::-moz-range-thumb]:z-20"
                            />
                            <input
                              type="range"
                              min="1"
                              max="25"
                              step="1"
                              value={layer.sizeMapping.maxSize}
                              onChange={(e) => {
                                const maxSize = parseInt(e.target.value);
                                if (maxSize >= layer.sizeMapping!.minSize) {
                                  onUpdateSizeMapping(layer.id, {
                                    ...layer.sizeMapping!,
                                    maxSize,
                                    breaks: []
                                  });
                                }
                              }}
                              className="absolute top-0 left-0 w-full h-1 appearance-none bg-transparent [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-white [&::-webkit-slider-thumb]:border-2 [&::-webkit-slider-thumb]:border-blue-500 [&::-webkit-slider-thumb]:cursor-pointer [&::-webkit-slider-thumb]:relative [&::-webkit-slider-thumb]:z-20 [&::-moz-range-thumb]:appearance-none [&::-moz-range-thumb]:h-4 [&::-moz-range-thumb]:w-4 [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:bg-white [&::-moz-range-thumb]:border-2 [&::-moz-range-thumb]:border-blue-500 [&::-moz-range-thumb]:cursor-pointer [&::-moz-range-thumb]:relative [&::-moz-range-thumb]:z-20"
                            />
                          </div>
                          <div className="flex justify-between text-xs text-gray-500 mt-1">
                            <span>1px</span>
                            <span>25px</span>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      ))}
    </div>
  );
};
