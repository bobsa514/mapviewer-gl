import React, { useState, useCallback } from 'react';
import DeckGL from '@deck.gl/react';
import { GeoJsonLayer, ScatterplotLayer } from '@deck.gl/layers';
import { Map } from 'react-map-gl';
import type { ViewState } from '@deck.gl/core';
import type { FeatureCollection, Feature, Geometry } from 'geojson';

// Initial viewport state (USA view)
const INITIAL_VIEW_STATE: ViewState = {
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
  const [viewState, setViewState] = useState<ViewState>(INITIAL_VIEW_STATE);
  const [hoveredFeature, setHoveredFeature] = useState<Feature | null>(null);
  const [activeColorPicker, setActiveColorPicker] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState(false);

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
      possibleLatColumns.includes(h.toLowerCase().trim())
    );
    const lngColumn = headers.find(h => 
      possibleLngColumns.includes(h.toLowerCase().trim())
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
        console.log('Raw CSV text:', csvText.substring(0, 500));

        // Split by newlines and remove empty lines and trim whitespace
        const lines = csvText
          .split(/\r?\n/)
          .map(line => line.trim())
          .filter(line => line.length > 0);

        console.log('Number of lines:', lines.length);
        console.log('First line:', lines[0]);

        if (lines.length < 2) {
          throw new Error('CSV file is empty or has no data rows');
        }

        // Parse headers and clean them
        const headers = lines[0]
          .split(',')
          .map(h => h.trim());

        console.log('Headers:', headers);

        const columns = detectCoordinateColumns(headers);
        if (!columns) {
          throw new Error('Could not detect latitude and longitude columns');
        }
        console.log('Detected columns:', columns);

        // Find column indices
        const latIndex = headers.indexOf(columns.lat);
        const lngIndex = headers.indexOf(columns.lng);

        console.log('Column indices:', { latIndex, lngIndex });

        const data = lines.slice(1)
          .map((line, index) => {
            // Split by comma and clean values
            const values = line.split(',').map(v => v.trim());
            
            console.log(`Processing row ${index + 1}:`, { 
              values, 
              latValue: values[latIndex],
              lngValue: values[lngIndex],
              latIndex,
              lngIndex
            });
            
            // Parse coordinates
            const lat = parseFloat(values[latIndex]);
            const lng = parseFloat(values[lngIndex]);
            
            if (isNaN(lat) || isNaN(lng)) {
              console.log('Invalid coordinates:', { 
                lat, 
                lng, 
                values, 
                latIndex, 
                lngIndex,
                latValue: values[latIndex],
                lngValue: values[lngIndex]
              });
              return null;
            }

            return {
              position: [lng, lat],
              properties: Object.fromEntries(
                headers.map((h, i) => [h, values[i]])
              )
            };
          })
          .filter((point): point is NonNullable<typeof point> => point !== null);

        console.log('Processed data points:', data.length);
        console.log('First data point:', data[0]);

        if (data.length === 0) {
          throw new Error('No valid data points found in CSV');
        }

        const newLayer: LayerInfo = {
          id: layers.length,
          name: file.name,
          visible: true,
          data,
          color: '#ff0000',
          opacity: 0.7,
          type: 'csv',
          columns,
          pointSize: 5 // Default to 5 pixels
        };
        setLayers([...layers, newLayer]);

        // Calculate bounds and update view
        const bounds = {
          minLat: Math.min(...data.map(d => d.position[1])),
          maxLat: Math.max(...data.map(d => d.position[1])),
          minLng: Math.min(...data.map(d => d.position[0])),
          maxLng: Math.max(...data.map(d => d.position[0])),
        };

        console.log('Calculated bounds:', bounds);

        const centerLat = (bounds.minLat + bounds.maxLat) / 2;
        const centerLng = (bounds.minLng + bounds.maxLng) / 2;
        const latDiff = bounds.maxLat - bounds.minLat;
        const lngDiff = bounds.maxLng - bounds.minLng;
        
        const maxDiff = Math.max(latDiff, lngDiff);
        const zoom = Math.min(20, Math.max(3, -Math.log2(maxDiff * 2.5)));

        console.log('Setting view state:', { centerLat, centerLng, zoom });

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

  const toggleColorPicker = (layerId: number) => {
    setActiveColorPicker(activeColorPicker === layerId ? null : layerId);
  };

  // Add click outside handler
  React.useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (activeColorPicker !== null) {
        setActiveColorPicker(null);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [activeColorPicker]);

  const toggleLayerExpanded = (layerId: number) => {
    setLayers(layers.map(layer => 
      layer.id === layerId ? { ...layer, isExpanded: !layer.isExpanded } : layer
    ));
  };

  const renderLayers = () => {
    return layers
      .filter(layer => layer.visible)
      .map((layer: LayerInfo) => {
        const [r, g, b] = hexToRGB(layer.color);
        
        if (layer.type === 'csv') {
          return (
            <ScatterplotLayer
              key={layer.id}
              id={`csv-layer-${layer.id}`}
              data={layer.data}
              getPosition={d => d.position}
              getFillColor={[r, g, b, Math.round(layer.opacity * 255)]}
              getRadius={1} // Fixed base radius
              radiusScale={layer.pointSize || 5} // Default to 5 pixels
              radiusUnits="pixels" // Use pixels for consistent size
              radiusMinPixels={1}
              radiusMaxPixels={20}
              pickable={true}
              onHover={info => {
                if (info.object) {
                  setHoveredFeature({
                    type: 'Feature',
                    geometry: {
                      type: 'Point',
                      coordinates: info.object.position
                    },
                    properties: info.object.properties
                  } as Feature);
                } else {
                  setHoveredFeature(null);
                }
              }}
            />
          );
        }

        return (
          <GeoJsonLayer
            key={layer.id}
            id={`geojson-layer-${layer.id}`}
            data={layer.data}
            filled={true}
            stroked={true}
            lineWidthMinPixels={1}
            getFillColor={[r, g, b, Math.round(layer.opacity * 255)]}
            getLineColor={[r, g, b, 255]} // Use same color as fill but full opacity
            pickable={true}
            updateTriggers={{
              getFillColor: [layer.color, layer.opacity],
              getLineColor: [layer.color]
            }}
            onHover={info => {
              setHoveredFeature(info.object as Feature);
            }}
          />
        );
      });
  };

  return (
    <div className="fixed inset-0">
      <div className="absolute top-4 left-4 z-10 bg-white rounded-lg shadow-lg p-4">
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
      {isLoading && (
        <div className="absolute inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-4">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mx-auto"></div>
          </div>
        </div>
      )}
      {hoveredFeature && (
        <div className="absolute top-4 right-4 z-10 bg-white rounded-lg shadow-lg p-4 max-w-md">
          <h3 className="text-sm font-medium text-gray-900 mb-2 text-left">Feature Properties</h3>
          <div className="text-sm text-gray-600 text-left">
            {Object.entries(hoveredFeature.properties || {}).map(([key, value]) => (
              <div key={key} className="mb-1">
                <span className="font-medium">{key}:</span> {String(value)}
              </div>
            ))}
          </div>
        </div>
      )}
      <div className="absolute bottom-4 left-4 z-10 bg-white rounded-lg shadow-lg p-4 max-w-md">
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
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                      {layer.isExpanded ? (
                        <path fillRule="evenodd" d="M5 10a1 1 0 011-1h8a1 1 0 110 2H6a1 1 0 01-1-1z" clipRule="evenodd" />
                      ) : (
                        <path fillRule="evenodd" d="M10 5a1 1 0 011 1v3h3a1 1 0 110 2h-3v3a1 1 0 11-2 0v-3H6a1 1 0 110-2h3V6a1 1 0 011-1z" clipRule="evenodd" />
                      )}
                    </svg>
                  </button>
                  <button
                    onClick={() => removeLayer(layer.id)}
                    className="text-red-600 hover:text-red-800"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                    </svg>
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
      <DeckGL
        className="w-full h-full"
        viewState={viewState}
        onViewStateChange={({ viewState }: { viewState: ViewState }) => setViewState(viewState)}
        controller={true}
      >
        <Map
          mapStyle="https://basemaps.cartocdn.com/gl/positron-gl-style/style.json"
          mapboxAccessToken={import.meta.env.VITE_MAPBOX_TOKEN}
        />
        {renderLayers()}
      </DeckGL>
    </div>
  );
};

export default GeospatialViewer; 