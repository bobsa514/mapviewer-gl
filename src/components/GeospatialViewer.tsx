import React, { useState, useCallback } from 'react';
import DeckGL from '@deck.gl/react';
import { GeoJsonLayer, ScatterplotLayer } from '@deck.gl/layers';
import { Map } from 'react-map-gl';
import type { MapViewState } from '@deck.gl/core';
import type { FeatureCollection, Feature, Geometry } from 'geojson';
import 'mapbox-gl/dist/mapbox-gl.css';
import { 
  PlusIcon, 
  TrashIcon, 
  EyeIcon, 
  EyeSlashIcon,
  PencilIcon,
  XMarkIcon,
  PaintBrushIcon,
  FunnelIcon
} from '@heroicons/react/24/outline';
import { FilterModal, FilterInfo } from './FilterModal';

// Initial viewport state (USA view)
const INITIAL_VIEW_STATE: MapViewState = {
  latitude: 39.8283,
  longitude: -98.5795,
  zoom: 3,
};

interface LayerInfo {
  id: number;
  name: string;
  visible: boolean;
  data: FeatureCollection | any; // Allow any for CSV data
  color: string;
  opacity: number;
  type: 'geojson' | 'csv';
  columns?: {
    lat: string;
    lng: string;
  };
  pointSize?: number; // Now represents pixel size
  isExpanded?: boolean; // Add expanded state for symbology controls
}

const GeospatialViewer: React.FC = () => {
  const [layers, setLayers] = useState<LayerInfo[]>([]);
  const [viewState, setViewState] = useState<MapViewState>(INITIAL_VIEW_STATE);
  const [hoveredFeature, setHoveredFeature] = useState<Feature | null>(null);
  const [activeColorPicker, setActiveColorPicker] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [showAllProperties, setShowAllProperties] = useState(false);
  const [selectedFeature, setSelectedFeature] = useState<Feature | null>(null);
  const [showColumnSelector, setShowColumnSelector] = useState(false);
  const [selectedColumns, setSelectedColumns] = useState<string[]>([]);
  const [allAvailableColumns, setAllAvailableColumns] = useState<string[]>([]);
  const [showAddData, setShowAddData] = useState(false);
  const [mapStyle, setMapStyle] = useState("https://basemaps.cartocdn.com/gl/positron-gl-style/style.json");
  const [showBasemapSelector, setShowBasemapSelector] = useState(false);
  const [showSymbologyModal, setShowSymbologyModal] = useState(false);
  const [showFilterModal, setShowFilterModal] = useState<number | null>(null);
  const [activeFilters, setActiveFilters] = useState<{[layerId: number]: { fn: (item: any) => boolean, info: FilterInfo }[]}>({});
  const [showLayers, setShowLayers] = useState(true);

  const basemapOptions = {
    "Light": "https://basemaps.cartocdn.com/gl/positron-gl-style/style.json",
    "Dark": "https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json",
    "City": "mapbox://styles/mapbox/streets-v12",
    "Satellite": "mapbox://styles/mapbox/satellite-streets-v12"
  };

  // Update allAvailableColumns when a new feature is selected
  React.useEffect(() => {
    if (selectedFeature?.properties) {
      const columns = Object.keys(selectedFeature.properties);
      setAllAvailableColumns(columns);
      
      // Reset columns when switching between different feature types
      // or when no columns are selected
      if (selectedColumns.length === 0 || 
          !selectedColumns.some(col => columns.includes(col))) {
        setSelectedColumns(columns.slice(0, 5));
      }
    }
  }, [selectedFeature]);

  const handleColumnToggle = (column: string) => {
    setSelectedColumns(prev => 
      prev.includes(column) 
        ? prev.filter(c => c !== column)
        : [...prev, column]
    );
  };

  const extractCoordinates = useCallback((geometry: Geometry): number[][] => {
    switch (geometry.type) {
      case 'Point':
        return [geometry.coordinates];
      case 'LineString':
        return geometry.coordinates;
      case 'Polygon':
        return geometry.coordinates.flat();
      case 'MultiPoint':
        return geometry.coordinates;
      case 'MultiLineString':
        return geometry.coordinates.flat();
      case 'MultiPolygon':
        return geometry.coordinates.flat(2);
      case 'GeometryCollection':
        return geometry.geometries.flatMap(extractCoordinates);
      default:
        return [];
    }
  }, []);

  const calculateBounds = useCallback((geojson: FeatureCollection) => {
    const coordinates = geojson.features.flatMap(feature => 
      extractCoordinates(feature.geometry)
    );

    if (coordinates.length === 0) return null;

    const lats = coordinates.map(coord => coord[1]);
    const lngs = coordinates.map(coord => coord[0]);

    return {
      minLat: Math.min(...lats),
      maxLat: Math.max(...lats),
      minLng: Math.min(...lngs),
      maxLng: Math.max(...lngs),
    };
  }, [extractCoordinates]);

  const detectCoordinateColumns = (headers: string[]): { lat: string; lng: string } | null => {
    const possibleLatColumns = ['latitude', 'lat', 'y'];
    const possibleLngColumns = ['longitude', 'lng', 'long', 'lon', 'x'];

    // Convert headers to lowercase for case-insensitive matching
    const headersLower = headers.map(h => h.toLowerCase().trim());

    // Try exact matches first
    const latColumn = headers.find(h => 
      possibleLatColumns.map(col => col.toLowerCase()).includes(h.toLowerCase().trim())
    );
    const lngColumn = headers.find(h => 
      possibleLngColumns.map(col => col.toLowerCase()).includes(h.toLowerCase().trim())
    );

    console.log('Found columns:', { 
      latColumn, 
      lngColumn, 
      headersLower,
      possibleLatColumns,
      possibleLngColumns
    });

    if (latColumn && lngColumn) {
      return { lat: latColumn, lng: lngColumn };
    }
    return null;
  };

  const handleCSVUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setIsLoading(true);
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const csvText = e.target?.result as string;
        console.log('Processing CSV file:', file.name);

        // Split by newlines and remove empty lines and trim whitespace
        const lines = csvText
          .split(/\r?\n/)
          .map(line => line.trim())
          .filter(line => line.length > 0);

        if (lines.length < 2) {
          throw new Error('CSV file is empty or has no data rows');
        }

        // Parse headers and clean them
        const headers = lines[0]
          .split(',')
          .map(h => h.trim());

        console.log('Number of columns:', headers.length);

        const columns = detectCoordinateColumns(headers);
        if (!columns) {
          throw new Error('Could not detect latitude and longitude columns');
        }

        // Find column indices
        const latIndex = headers.indexOf(columns.lat);
        const lngIndex = headers.indexOf(columns.lng);

        // Process data in chunks to avoid memory issues
        const CHUNK_SIZE = 1000;
        const data = [];
        let validPoints = 0;
        let invalidPoints = 0;
        let invalidRows: { row: number; lat: number; lng: number }[] = [];

        for (let i = 1; i < lines.length; i++) {
          const line = lines[i];
          const values = line.split(',').map(v => v.trim());
          
          // Parse coordinates
          const lat = parseFloat(values[latIndex]);
          const lng = parseFloat(values[lngIndex]);
          
          // Validate coordinates
          if (isNaN(lat) || isNaN(lng)) {
            invalidPoints++;
            continue;
          }

          // Check if coordinates are within valid ranges
          if (lat < -90 || lat > 90) {
            invalidPoints++;
            invalidRows.push({ row: i + 1, lat, lng });
            continue;
          }

          if (lng < -180 || lng > 180) {
            invalidPoints++;
            invalidRows.push({ row: i + 1, lat, lng });
            continue;
          }

          // Only include essential properties to reduce memory usage
          const properties = {
            // Include coordinate columns
            [columns.lat]: lat,
            [columns.lng]: lng,
            // Include all other columns
            ...Object.fromEntries(
              headers
                .map((h, idx) => [h, values[idx]])
                .filter(([key]) => 
                  // Only exclude coordinate columns
                  key.toLowerCase() !== columns.lat.toLowerCase() && 
                  key.toLowerCase() !== columns.lng.toLowerCase()
                )
            )
          };

          data.push({
            position: [lng, lat],
            properties
          });

          validPoints++;

          // Log progress for large files
          if (i % CHUNK_SIZE === 0) {
            console.log(`Processed ${i} rows...`);
          }
        }

        console.log('CSV processing complete:', {
          totalRows: lines.length - 1,
          validPoints,
          invalidPoints,
          invalidRows: invalidRows.length > 0 ? invalidRows : undefined
        });

        if (data.length === 0) {
          throw new Error('No valid data points found in CSV');
        }

        // Calculate bounds only from valid points
        const bounds = {
          minLat: Math.min(...data.map(d => d.position[1])),
          maxLat: Math.max(...data.map(d => d.position[1])),
          minLng: Math.min(...data.map(d => d.position[0])),
          maxLng: Math.max(...data.map(d => d.position[0])),
        };

        console.log('Data bounds:', bounds);

        const centerLat = (bounds.minLat + bounds.maxLat) / 2;
        const centerLng = (bounds.minLng + bounds.maxLng) / 2;
        const latDiff = bounds.maxLat - bounds.minLat;
        const lngDiff = bounds.maxLng - bounds.minLng;
        
        const maxDiff = Math.max(latDiff, lngDiff);
        const zoom = Math.min(20, Math.max(3, -Math.log2(maxDiff * 2.5)));

        const newLayer: LayerInfo = {
          id: layers.length,
          name: file.name,
          visible: true,
          data,
          color: '#ff0000',
          opacity: 0.7,
          type: 'csv',
          columns,
          pointSize: 5
        };
        setLayers([...layers, newLayer]);

        setViewState({
          latitude: centerLat,
          longitude: centerLng,
          zoom,
        });
      } catch (error) {
        console.error('Error parsing CSV:', error);
        alert(error instanceof Error ? error.message : 'Error parsing CSV file');
      } finally {
        setIsLoading(false);
      }
    };
    reader.readAsText(file);
  };

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const geojson = JSON.parse(e.target?.result as string) as FeatureCollection;
        const newLayer: LayerInfo = {
          id: layers.length,
          name: file.name,
          visible: true,
          data: geojson,
          color: '#ff0000',
          opacity: 0.7,
          type: 'geojson',
        };
        setLayers([...layers, newLayer]);

        // Calculate bounds and update view
        const bounds = calculateBounds(geojson);
        if (bounds) {
          const centerLat = (bounds.minLat + bounds.maxLat) / 2;
          const centerLng = (bounds.minLng + bounds.maxLng) / 2;
          const latDiff = bounds.maxLat - bounds.minLat;
          const lngDiff = bounds.maxLng - bounds.minLng;
          
          // Calculate zoom level based on the coordinate differences
          const maxDiff = Math.max(latDiff, lngDiff);
          // Use a more appropriate zoom calculation that scales better with geographic size
          const zoom = Math.min(20, Math.max(3, -Math.log2(maxDiff * 2.5)));

          setViewState({
            latitude: centerLat,
            longitude: centerLng,
            zoom,
          });
        }
      } catch (error) {
        console.error('Error parsing GeoJSON:', error);
      }
    };
    reader.readAsText(file);
  };

  const toggleLayer = (layerId: number) => {
    setLayers(layers.map(layer => 
      layer.id === layerId ? { ...layer, visible: !layer.visible } : layer
    ));
  };

  const removeLayer = (layerId: number) => {
    setLayers(layers.filter(layer => layer.id !== layerId));
    // Reset selected feature and columns when removing a layer
    setSelectedFeature(null);
    setSelectedColumns([]);
  };

  const updateLayerColor = (layerId: number, color: string) => {
    setLayers(layers.map(layer => 
      layer.id === layerId ? { ...layer, color } : layer
    ));
  };

  const updateLayerOpacity = (layerId: number, opacity: number) => {
    setLayers(layers.map(layer => 
      layer.id === layerId ? { ...layer, opacity } : layer
    ));
  };

  const updateLayerPointSize = (layerId: number, size: number) => {
    setLayers(layers.map(layer => 
      layer.id === layerId ? { ...layer, pointSize: size } : layer
    ));
  };

  const hexToRGB = (hex: string): [number, number, number] => {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    return [r, g, b];
  };

  const toggleLayerExpanded = (layerId: number) => {
    setLayers(layers.map(layer => 
      layer.id === layerId ? { ...layer, isExpanded: !layer.isExpanded } : layer
    ));
  };

  // Add this function to compare features
  const areFeaturesEqual = (feature1: Feature, feature2: Feature): boolean => {
    if (feature1.geometry.type !== feature2.geometry.type) return false;
    
    if (feature1.geometry.type === 'Point' && feature2.geometry.type === 'Point') {
      return JSON.stringify(feature1.geometry.coordinates) === JSON.stringify(feature2.geometry.coordinates);
    }
    
    // For polygons and other geometries, compare their properties
    return JSON.stringify(feature1.properties) === JSON.stringify(feature2.properties);
  };

  const handleApplyFilter = (layerId: number, filter: (item: any) => boolean, filterInfo: FilterInfo) => {
    setActiveFilters(prev => ({
      ...prev,
      [layerId]: [...(prev[layerId] || []), { fn: filter, info: filterInfo }]
    }));
  };

  const handleRemoveFilter = (layerId: number, index: number) => {
    setActiveFilters(prev => ({
      ...prev,
      [layerId]: prev[layerId]?.filter((_, i) => i !== index) || []
    }));
  };

  const applyFilters = (layerId: number, data: any[]) => {
    const layerFilters = activeFilters[layerId] || [];
    return data.filter(item => layerFilters.every(filter => filter.fn(item)));
  };

  const renderLayers = () => {
    return layers
      .filter(layer => layer.visible)
      .map((layer: LayerInfo) => {
        const [r, g, b] = hexToRGB(layer.color);
        
        if (layer.type === 'csv') {
          const layerData = layer.data;
          const filteredData = activeFilters[layer.id]?.length > 0 
            ? layerData.filter((item: any) => activeFilters[layer.id].every(filter => filter.fn(item)))
            : layerData;

          return new ScatterplotLayer({
            key: layer.id,
            id: `csv-layer-${layer.id}`,
            data: filteredData,
            getPosition: (d: any) => d.position,
            getFillColor: [r, g, b, Math.round(layer.opacity * 255)],
            getRadius: (d: any) => {
              if (selectedFeature && 
                  selectedFeature.geometry.type === 'Point' &&
                  JSON.stringify(d.position) === JSON.stringify(selectedFeature.geometry.coordinates)) {
                return (layer.pointSize || 5) * 2;
              }
              return layer.pointSize || 5;
            },
            radiusScale: 1,
            radiusUnits: "pixels",
            radiusMinPixels: 1,
            radiusMaxPixels: 20,
            pickable: true,
            updateTriggers: {
              getRadius: [selectedFeature, layer.pointSize]
            },
            onClick: (info: any) => {
              if (info.object) {
                const feature = {
                  type: 'Feature',
                  geometry: {
                    type: 'Point',
                    coordinates: info.object.position
                  },
                  properties: info.object.properties
                } as Feature;
                setSelectedFeature(feature);
              }
            }
          });
        }

        // For GeoJSON layers
        const layerData = layer.data;
        const filteredData = {
          ...layerData,
          features: activeFilters[layer.id]?.length > 0
            ? layerData.features.filter((item: Feature) => activeFilters[layer.id].every(filter => filter.fn(item)))
            : layerData.features
        };

        return new GeoJsonLayer({
          key: layer.id,
          id: `geojson-layer-${layer.id}`,
          data: filteredData,
          filled: true,
          stroked: true,
          lineWidthUnits: "pixels",
          lineWidthMinPixels: 1,
          getFillColor: (d: Feature) => {
            if (selectedFeature && areFeaturesEqual(d, selectedFeature)) {
              return [r, g, b, Math.round(layer.opacity * 255)]; // Full opacity for selected
            }
            return [r, g, b, Math.round(layer.opacity * 128)]; // More transparent for non-selected
          },
          getLineColor: [r, g, b, 255], // Always show borders with full opacity
          pickable: true,
          updateTriggers: {
            getFillColor: [layer.color, layer.opacity, selectedFeature],
            lineWidthMinPixels: [selectedFeature]
          },
          onClick: (info: any) => {
            setSelectedFeature(info.object as Feature);
          }
        });
      });
  };

  return (
    <div className="fixed inset-0">
      <div className="absolute top-4 left-4 z-10">
        <div className="bg-white rounded-lg shadow-lg">
          <button
            onClick={() => setShowAddData(!showAddData)}
            className="w-full p-3 flex items-center justify-center hover:bg-gray-50 rounded-lg transition-colors"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
          </button>
          
          {showAddData && (
            <div className="p-4 border-t border-gray-200">
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Upload GeoJSON
                  </label>
                  <input
                    type="file"
                    accept=".json,.geojson"
                    onChange={handleFileUpload}
                    disabled={isLoading}
                    className="block w-full text-sm text-gray-500
                      file:mr-4 file:py-2 file:px-4
                      file:rounded-md file:border-0
                      file:text-sm file:font-semibold
                      file:bg-blue-50 file:text-blue-700
                      hover:file:bg-blue-100
                      disabled:opacity-50 disabled:cursor-not-allowed"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Upload CSV (Points)
                  </label>
                  <input
                    type="file"
                    accept=".csv"
                    onChange={handleCSVUpload}
                    disabled={isLoading}
                    className="block w-full text-sm text-gray-500
                      file:mr-4 file:py-2 file:px-4
                      file:rounded-md file:border-0
                      file:text-sm file:font-semibold
                      file:bg-blue-50 file:text-blue-700
                      hover:file:bg-blue-100
                      disabled:opacity-50 disabled:cursor-not-allowed"
                  />
                  <p className="mt-1 text-xs text-gray-500">
                    CSV should have columns named lat/latitude/y and lng/longitude/x
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
      {isLoading && (
        <div className="absolute inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-4">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mx-auto"></div>
          </div>
        </div>
      )}
      {selectedFeature && (
        <div className="absolute top-4 right-4 z-10 bg-white rounded-lg shadow-lg p-4 max-w-md">
          <div className="flex justify-between items-center mb-2">
            <h3 className="text-sm font-medium text-gray-900">Feature Properties</h3>
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
              <button
                onClick={() => setSelectedFeature(null)}
                className="text-gray-500 hover:text-gray-700"
              >
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
                      onChange={() => handleColumnToggle(column)}
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
      )}
      <div className="absolute bottom-4 left-4 z-10">
        <div className="flex flex-col space-y-2">
          <button
            onClick={() => setShowLayers(!showLayers)}
            className="bg-white p-2 rounded-lg shadow-lg hover:bg-gray-50 transition-colors"
            title={showLayers ? "Hide Layers" : "Show Layers"}
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
            </svg>
          </button>
        </div>
      </div>
      {showLayers && (
        <div className="absolute bottom-16 left-4 z-10 bg-white rounded-lg shadow-lg p-4 max-w-md">
          <h3 className="text-sm font-medium text-gray-900 mb-2">Layers</h3>
          <div className="space-y-4">
            {layers.map(layer => (
              <div key={layer.id} className="bg-white rounded-md border border-gray-200 overflow-hidden">
                <div className="flex items-center justify-between p-2">
                  <div className="flex items-center space-x-2">
                    <input
                      type="checkbox"
                      checked={layer.visible}
                      onChange={() => toggleLayer(layer.id)}
                      className="h-4 w-4 text-blue-600 rounded border-gray-300"
                    />
                    <span className="text-sm text-gray-700 truncate max-w-[150px]">{layer.name}</span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <button
                      onClick={() => toggleLayerExpanded(layer.id)}
                      className="text-gray-500 hover:text-gray-700"
                      title="Symbology"
                    >
                      <PaintBrushIcon className="h-5 w-5" />
                    </button>
                    <button
                      onClick={() => setShowFilterModal(layer.id)}
                      className="text-gray-500 hover:text-gray-700"
                      title="Filter"
                    >
                      <FunnelIcon className="h-5 w-5" />
                    </button>
                    <button
                      onClick={() => removeLayer(layer.id)}
                      className="text-red-600 hover:text-red-800"
                      title="Remove Layer"
                    >
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
                        onChange={(e) => updateLayerColor(layer.id, e.target.value)}
                        className="h-6 w-6 rounded cursor-pointer"
                      />
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
                        onChange={(e) => updateLayerOpacity(layer.id, parseFloat(e.target.value))}
                        className="w-full"
                      />
                    </div>
                    {layer.type === 'csv' && (
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
                          onChange={(e) => {
                            const size = parseInt(e.target.value);
                            updateLayerPointSize(layer.id, size);
                          }}
                          className="w-full"
                        />
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
      <FilterModal
        isOpen={showFilterModal !== null}
        onClose={() => setShowFilterModal(null)}
        data={layers.find(l => l.id === showFilterModal)?.type === 'csv' 
          ? layers.find(l => l.id === showFilterModal)?.data
          : layers.find(l => l.id === showFilterModal)?.data.features || []}
        onApplyFilter={(filter, filterInfo) => {
          handleApplyFilter(showFilterModal!, filter, filterInfo);
          setShowFilterModal(null);
        }}
        activeFilters={showFilterModal !== null ? activeFilters[showFilterModal]?.map(f => f.info) || [] : []}
        onRemoveFilter={(index) => showFilterModal !== null && handleRemoveFilter(showFilterModal, index)}
      />
      <DeckGL
        style={{ width: '100%', height: '100%' }}
        viewState={viewState}
        onViewStateChange={({ viewState }) => {
          if ('latitude' in viewState && 'longitude' in viewState && 'zoom' in viewState) {
            setViewState(viewState as MapViewState);
          }
        }}
        controller={true}
        layers={renderLayers()}
      >
        <Map
          mapStyle={mapStyle}
          mapboxAccessToken={import.meta.env.VITE_MAPBOX_TOKEN}
        />
        <div className="absolute bottom-16 right-4 z-10">
          <div className="relative">
            <button
              onClick={() => setShowBasemapSelector(!showBasemapSelector)}
              className="bg-white px-3 py-2 rounded-lg shadow-lg text-sm text-gray-700 hover:bg-gray-50 flex items-center space-x-2"
            >
              <span>Base Map</span>
              <svg
                className={`h-4 w-4 transform transition-transform ${showBasemapSelector ? 'rotate-180' : ''}`}
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>
            {showBasemapSelector && (
              <div className="absolute bottom-full right-0 mb-2 bg-white rounded-lg shadow-lg py-2 min-w-[120px]">
                {Object.entries(basemapOptions).map(([name, url]) => (
                  <button
                    key={name}
                    onClick={() => {
                      setMapStyle(url);
                      setShowBasemapSelector(false);
                    }}
                    className={`w-full px-4 py-2 text-left text-sm hover:bg-gray-50 ${
                      mapStyle === url ? 'text-blue-600 font-medium' : 'text-gray-700'
                    }`}
                  >
                    {name}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
        <div className="absolute bottom-5 right-4 z-10 flex items-center space-x-2 text-sm text-gray-600">
          <span>Boyang Sa</span>
          <a
            href="https://www.boyangsa.com"
            target="_blank"
            rel="noopener noreferrer"
            className="text-gray-600 hover:text-gray-900"
            title="Personal Website"
          >
            <svg
              className="h-5 w-5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9"
              />
            </svg>
          </a>
          <a
            href="https://github.com/bobsa514"
            target="_blank"
            rel="noopener noreferrer"
            className="text-gray-600 hover:text-gray-900"
            title="GitHub Profile"
          >
            <svg
              className="h-5 w-5"
              fill="currentColor"
              viewBox="0 0 24 24"
              aria-hidden="true"
            >
              <path
                fillRule="evenodd"
                d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.91-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z"
                clipRule="evenodd"
              />
            </svg>
          </a>
        </div>
      </DeckGL>
    </div>
  );
};

export default GeospatialViewer; 