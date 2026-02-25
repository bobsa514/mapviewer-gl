import React, { useState, useCallback, useRef } from 'react';
import DeckGL from '@deck.gl/react';
import { GeoJsonLayer, ScatterplotLayer } from '@deck.gl/layers';
import { Map } from 'react-map-gl';
import type { MapViewState } from '@deck.gl/core';
import type { FeatureCollection, Feature, Geometry } from 'geojson';
import Papa from 'papaparse';
import 'mapbox-gl/dist/mapbox-gl.css';
import { 
  XMarkIcon,
  PaintBrushIcon,
  FunnelIcon
} from '@heroicons/react/24/outline';
import { FilterModal, FilterInfo } from './FilterModal';
import { H3HexagonLayer } from '@deck.gl/geo-layers';
import * as h3 from 'h3-js';

// Initial viewport state (USA view)
const INITIAL_VIEW_STATE: MapViewState = {
  latitude: 39.8283,
  longitude: -98.5795,
  zoom: 3,
};

// Move colorScales definition before LayerInfo interface
type ColorScaleName = 'Reds' | 'Blues' | 'Greens' | 'Greys' | 'YlGnBu' | 'YlOrRd' | 'PuBuGn' | 'RdPu';

const colorScales: Record<ColorScaleName, string[]> = {
  Reds: ['#fee5d9', '#fcae91', '#fb6a4a', '#de2d26', '#a50f15'],
  Blues: ['#eff3ff', '#bdd7e7', '#6baed6', '#3182bd', '#08519c'],
  Greens: ['#edf8e9', '#bae4b3', '#74c476', '#31a354', '#006d2c'],
  Greys: ['#f7f7f7', '#cccccc', '#969696', '#636363', '#252525'],
  YlGnBu: ['#ffffd9', '#c7e9b4', '#7fcdbb', '#41b6c4', '#225ea8'],
  YlOrRd: ['#ffffb2', '#fecc5c', '#fd8d3c', '#f03b20', '#bd0026'],
  PuBuGn: ['#f6eff7', '#bdc9e1', '#67a9cf', '#1c9099', '#016c59'],
  RdPu: ['#feebe2', '#fbb4b9', '#f768a1', '#c51b8a', '#7a0177']
};

interface LayerInfo {
  id: number;
  name: string;
  type: 'geojson' | 'point' | 'h3';
  data: any;
  visible: boolean;
  colorMapping?: {
    column: string;
    numClasses: number;
    breaks: number[];
    colorScale: ColorScaleName;
  };
  sizeMapping?: {
    column: string;
    numClasses: number;
    breaks: number[];
    minSize: number;
    maxSize: number;
  };
  color: string;
  opacity: number;
  columns?: {
    lat: string;
    lng: string;
  };
  pointSize?: number;
  isExpanded?: boolean;
  isH3Data?: boolean;
  h3Column?: string;
}

interface MapConfiguration {
  version: string;
  viewState: MapViewState;
  basemap: string;
  layers: Array<{
    name: string;
    type: 'geojson' | 'point' | 'h3';
    visible: boolean;
    color: string;
    opacity: number;
    pointSize?: number;
    columns?: {
      lat: string;
      lng: string;
    };
    data: any;
    filters?: Array<FilterInfo>;
    selectedProperties?: string[];
    colorMapping?: {
      column: string;
      numClasses: number;
      breaks: number[];
      colorScale: ColorScaleName;
    };
    sizeMapping?: {
      column: string;
      numClasses: number;
      breaks: number[];
      minSize: number;
      maxSize: number;
    };
  }>;
}

interface CSVPreviewData {
  headers: string[];
  rows: string[][];
  selectedColumns: Set<string>;
  coordinateColumns: Set<string>;
  isH3Data: boolean;
  h3Column?: string;
}

interface GeoJSONPreviewData {
  properties: string[];
  features: Feature[];
  selectedProperties: Set<string>;
}

interface HoverInfo {
  x: number;
  y: number;
  data: any;
}

// Color scale preview component
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

// Update the color scale dropdown in the layer controls
const renderColorScaleDropdown = (layer: LayerInfo, updateLayerColorMapping: (layerId: number, colorMapping: NonNullable<LayerInfo['colorMapping']>) => void) => (
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
            updateLayerColorMapping(layer.id, {
              column,
              numClasses: layer.colorMapping?.numClasses || 5,
              breaks: [],
              colorScale: colorScale
            });
          }
        }}
      >
        <optgroup label="Single-hue">
          {(['Reds', 'Blues', 'Greens', 'Greys'] as const).map(scale => (
            <option key={scale} value={scale}>
              {scale}
            </option>
          ))}
        </optgroup>
        <optgroup label="Multi-hue">
          {(['YlGnBu', 'YlOrRd', 'PuBuGn', 'RdPu'] as const).map(scale => (
            <option key={scale} value={scale}>
              {scale}
            </option>
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

// Move SizeLegend component to the same level as ColorLegend
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
        {/* Size circles */}
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
        {/* Value labels */}
        <div className="flex flex-col justify-between py-1 text-xs">
          <span>{layer.sizeMapping.breaks[layer.sizeMapping.breaks.length - 1]?.toFixed(1)}</span>
          <span>{layer.sizeMapping.breaks[Math.floor(layer.sizeMapping.breaks.length / 2)]?.toFixed(1)}</span>
          <span>{layer.sizeMapping.breaks[0]?.toFixed(1)}</span>
        </div>
      </div>
    </div>
  );
};

const MapViewerGL: React.FC = () => {
  const layerIdCounter = useRef(0);
  const getNextLayerId = useCallback(() => {
    layerIdCounter.current += 1;
    return layerIdCounter.current;
  }, []);
  
  const [layers, setLayers] = useState<LayerInfo[]>([]);
  const [viewState, setViewState] = useState<MapViewState>(INITIAL_VIEW_STATE);
  const [hoveredFeature, setHoveredFeature] = useState<Feature | null>(null);
  const [activeColorPicker, setActiveColorPicker] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [loadingProgress, setLoadingProgress] = useState(0);
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
  const [csvPreview, setCsvPreview] = useState<CSVPreviewData | null>(null);
  const [geoJSONPreview, setGeoJSONPreview] = useState<GeoJSONPreviewData | null>(null);
  const [hoverInfo, setHoverInfo] = useState<HoverInfo | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isFeatureLocked, setIsFeatureLocked] = useState(false);

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
    // Exact matches for coordinate column names (case-insensitive)
    const possibleLatColumns = ['latitude', 'lat', 'y'];
    const possibleLngColumns = ['longitude', 'lng', 'long', 'lon', 'x'];

    // Find the first matching latitude column (case-insensitive)
    let latColumn = headers.find(h => 
      possibleLatColumns.some(term => h.toLowerCase().trim() === term.toLowerCase())
    );

    // Find the first matching longitude column (case-insensitive)
    let lngColumn = headers.find(h => 
      possibleLngColumns.some(term => h.toLowerCase().trim() === term.toLowerCase())
    );

    // If no exact matches, try looking for columns that start with these terms
    if (!latColumn || !lngColumn) {
      latColumn = headers.find(h => 
        possibleLatColumns.some(term => 
          h.toLowerCase().trim().startsWith(term.toLowerCase() + '_')
        )
      );
      lngColumn = headers.find(h => 
        possibleLngColumns.some(term => 
          h.toLowerCase().trim().startsWith(term.toLowerCase() + '_')
        )
      );
    }

    if (latColumn && lngColumn) {
      return { lat: latColumn, lng: lngColumn };
    }
    return null;
  };

  const detectH3Column = (headers: string[]): string | null => {
    // Common names for H3 index columns
    const possibleH3Names = ['hex_id', 'h3_index', 'h3', 'hexagon'];
    
    // Find the first matching column (case-insensitive)
    const h3Column = headers.find(h => 
      possibleH3Names.some(name => h.toLowerCase().trim() === name.toLowerCase())
    );
    
    if (h3Column) {
      return h3Column;
    }
    
    // If no exact match, look for columns containing these terms
    return headers.find(h => 
      possibleH3Names.some(name => h.toLowerCase().includes(name.toLowerCase()))
    ) || null;
  };

  const isValidH3Index = (value: string): boolean => {
    try {
      return h3.isValidCell(value);
    } catch {
      return false;
    }
  };

  const processChunk = useCallback((
    rows: string[][],
    startIndex: number,
    headers: string[],
    selectedColumns: Set<string>,
    coordinates: { lat: string; lng: string },
    latIndex: number,
    lngIndex: number,
    chunkSize: number,
    onProgress: (progress: number) => void
  ) => {
    const data = [];
    const endIndex = Math.min(startIndex + chunkSize, rows.length);

    for (let i = startIndex; i < endIndex; i++) {
      const row = rows[i];
      if (!row || row.length === 0) continue;

      const values = row.map(v => String(v).trim());
      
      // Parse coordinates
      const lat = parseFloat(values[latIndex]);
      const lng = parseFloat(values[lngIndex]);
      
      // Validate coordinates
      if (isNaN(lat) || isNaN(lng) || lat < -90 || lat > 90 || lng < -180 || lng > 180) {
        continue;
      }

      // Only include selected columns
      const properties: { [key: string]: any } = {};
      headers.forEach((header, idx) => {
        if (selectedColumns.has(header)) {
          properties[header] = values[idx];
        }
      });

      data.push({
        position: [lng, lat],
        properties
      });
    }

    const totalDataRows = rows.length - 1;
    const progress = ((endIndex - 1) / totalDataRows) * 100;
    onProgress(Math.min(progress, 100));

    return { data, endIndex };
  }, []);

  const handleCSVPreview = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) {
      // Reset preview if no file is selected
      setCsvPreview(null);
      return;
    }

    // Reset any existing previews
    setGeoJSONPreview(null);
    setCsvPreview(null);

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const csvText = e.target?.result as string;
        
        const parsed = Papa.parse(csvText, {
          header: false,
          preview: 11,
          skipEmptyLines: true
        });

        if (parsed.errors.length > 0) {
          console.warn('CSV parsing warnings:', parsed.errors);
        }

        const rows = parsed.data as string[][];
        
        if (rows.length < 2) {
          throw new Error('CSV file is empty or has no data rows');
        }

        const headers = rows[0].map((h: string) => h.trim());
        const previewRows = rows.slice(1, 11);

        // Check for H3 index column
        const h3Column = detectH3Column(headers);
        const h3ColumnIndex = h3Column ? headers.indexOf(h3Column) : -1;
        
        // Validate H3 indexes if found
        let isH3Data = false;
        if (h3ColumnIndex !== -1) {
          const sampleH3Value = previewRows[0][h3ColumnIndex];
          isH3Data = isValidH3Index(sampleH3Value);
        }

        // Identify coordinate columns only if not H3 data
        const coordinateColumns = new Set<string>();
        if (!isH3Data) {
          const coordinates = detectCoordinateColumns(headers);
          if (coordinates) {
            coordinateColumns.add(coordinates.lat);
            coordinateColumns.add(coordinates.lng);
          }
        }

        // By default, select all columns
        const defaultSelected = new Set(headers);

        setCsvPreview({
          headers,
          rows: previewRows,
          selectedColumns: defaultSelected,
          coordinateColumns,
          isH3Data,
          h3Column: h3Column || undefined
        });
      } catch (error) {
        console.error('Error parsing CSV:', error);
        alert(error instanceof Error ? error.message : 'Error parsing CSV file');
        // Reset on error
        if (fileInputRef.current) {
          fileInputRef.current.value = '';
        }
        setCsvPreview(null);
      }
    };
    reader.readAsText(file);
  };

  const toggleColumnSelection = (header: string) => {
    if (!csvPreview) return;
    
    // Don't allow toggling coordinate columns
    if (csvPreview.coordinateColumns.has(header)) return;
    
    const newSelected = new Set(csvPreview.selectedColumns);
    if (newSelected.has(header)) {
      newSelected.delete(header);
    } else {
      newSelected.add(header);
    }
    
    setCsvPreview({
      ...csvPreview,
      selectedColumns: newSelected
    });
  };

  const handleSelectAllColumns = () => {
    if (!csvPreview) return;
    setCsvPreview({
      ...csvPreview,
      selectedColumns: new Set(csvPreview.headers)
    });
  };

  const handleDeselectAllColumns = () => {
    if (!csvPreview) return;
    // Keep only coordinate columns selected
    setCsvPreview({
      ...csvPreview,
      selectedColumns: new Set(csvPreview.coordinateColumns)
    });
  };

  const proceedWithSelectedColumns = () => {
    if (!fileInputRef.current?.files?.[0] || !csvPreview) return;
    
    const file = fileInputRef.current.files[0];
    setIsLoading(true);
    setLoadingProgress(0);
    
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const csvText = e.target?.result as string;
        
        const parsed = Papa.parse(csvText, {
          header: false,
          skipEmptyLines: true
        });
        
        if (parsed.errors.length > 0) {
          console.warn('CSV parsing warnings:', parsed.errors);
        }
        
        const rows = parsed.data as string[][];
        const headers = rows[0].map((h: string) => h.trim());
        
        // Process data based on type (H3 or coordinates)
        if (csvPreview.isH3Data && csvPreview.h3Column) {
          const h3ColumnIndex = headers.indexOf(csvPreview.h3Column);
          const hexagons = rows.slice(1).map(row => {
            const values = row.map(cell => String(cell).trim());
            const h3Index = values[h3ColumnIndex];
            
            const properties: { [key: string]: string } = {};
            headers.forEach((header, index) => {
              if (csvPreview.selectedColumns.has(header) && index !== h3ColumnIndex) {
                properties[header] = values[index];
              }
            });
            
            return {
              hex: h3Index,
              properties
            };
          }).filter(h => h.hex && isValidH3Index(h.hex));
          
          if (hexagons.length === 0) {
            throw new Error('No valid H3 indexes found in the data');
          }
          
          const newLayer: LayerInfo = {
            id: getNextLayerId(),
            name: file.name,
            visible: true,
            data: hexagons,
            color: '#ff0000',
            opacity: 0.7,
            type: 'h3'
          };
          
          setLayers([...layers, newLayer]);
          
          if (hexagons.length > 0) {
            const firstHex = hexagons[0].hex;
            const [centerLat, centerLng] = h3.cellToLatLng(firstHex);
            
            setViewState({
              latitude: centerLat,
              longitude: centerLng,
              zoom: 11
            });
          }
        } else {
          // Process coordinate-based CSV as points
          const coordinates = detectCoordinateColumns(headers);
          if (!coordinates) {
            throw new Error('Could not detect latitude and longitude columns');
          }

          const latIndex = headers.indexOf(coordinates.lat);
          const lngIndex = headers.indexOf(coordinates.lng);
          
          const CHUNK_SIZE = 10000;
          let currentIndex = 1;
          let allData: any[] = [];
          let bounds = {
            minLat: Infinity,
            maxLat: -Infinity,
            minLng: Infinity,
            maxLng: -Infinity
          };

          while (currentIndex < rows.length) {
            const { 
              data: chunkData, 
              endIndex 
            } = processChunk(
              rows, 
              currentIndex,
              headers,
              csvPreview.selectedColumns,
              coordinates,
              latIndex,
              lngIndex,
              CHUNK_SIZE,
              setLoadingProgress
            );

            // Update bounds
            chunkData.forEach(point => {
              bounds.minLat = Math.min(bounds.minLat, point.position[1]);
              bounds.maxLat = Math.max(bounds.maxLat, point.position[1]);
              bounds.minLng = Math.min(bounds.minLng, point.position[0]);
              bounds.maxLng = Math.max(bounds.maxLng, point.position[0]);
            });

            // Append chunk data
            allData = allData.concat(chunkData);
            currentIndex = endIndex;
          }

          if (allData.length === 0) {
            throw new Error('No valid data points found in CSV');
          }

          const centerLat = (bounds.minLat + bounds.maxLat) / 2;
          const centerLng = (bounds.minLng + bounds.maxLng) / 2;
          const latDiff = bounds.maxLat - bounds.minLat;
          const lngDiff = bounds.maxLng - bounds.minLng;
          
          const maxDiff = Math.max(latDiff, lngDiff);
          const zoom = Math.min(20, Math.max(3, -Math.log2(maxDiff * 2.5)));

          const newLayer: LayerInfo = {
            id: getNextLayerId(),
            name: file.name,
            visible: true,
            data: allData,
            color: '#ff0000',
            opacity: 0.7,
            type: 'point',
            columns: coordinates,
            pointSize: 5
          };
          
          setLayers([...layers, newLayer]);
          setViewState({
            latitude: centerLat,
            longitude: centerLng,
            zoom
          });
        }
        
      } catch (error) {
        console.error('Error processing CSV:', error);
        alert(error instanceof Error ? error.message : 'Error processing CSV file');
      } finally {
        setIsLoading(false);
        setLoadingProgress(100);
        setCsvPreview(null);
        if (fileInputRef.current) {
          fileInputRef.current.value = '';
        }
      }
    };
    
    reader.readAsText(file);
  };

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Store the file in the ref for later use
    if (fileInputRef.current) {
      fileInputRef.current.files = event.target.files;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const geojson = JSON.parse(e.target?.result as string) as FeatureCollection;
        
        // Get all unique property names from features
        const properties = new Set<string>();
        geojson.features.forEach(feature => {
          if (feature.properties) {
            Object.keys(feature.properties).forEach(key => properties.add(key));
          }
        });

        // Show preview with first 10 features
        setGeoJSONPreview({
          properties: Array.from(properties),
          features: geojson.features.slice(0, 10),
          selectedProperties: new Set(properties)
        });

      } catch (error) {
        console.error('Error parsing GeoJSON:', error);
        alert(error instanceof Error ? error.message : 'Error parsing GeoJSON file');
      }
    };
    reader.readAsText(file);
  };

  const handleSelectAllGeoJSONProperties = () => {
    if (!geoJSONPreview) return;
    setGeoJSONPreview({
      ...geoJSONPreview,
      selectedProperties: new Set(geoJSONPreview.properties)
    });
  };

  const handleDeselectAllGeoJSONProperties = () => {
    if (!geoJSONPreview) return;
    setGeoJSONPreview({
      ...geoJSONPreview,
      selectedProperties: new Set()
    });
  };

  const toggleGeoJSONPropertySelection = (property: string) => {
    if (!geoJSONPreview) return;
    
    const newSelected = new Set(geoJSONPreview.selectedProperties);
    if (newSelected.has(property)) {
      newSelected.delete(property);
    } else {
      newSelected.add(property);
    }
    
    setGeoJSONPreview({
      ...geoJSONPreview,
      selectedProperties: newSelected
    });
  };

  const proceedWithSelectedGeoJSONProperties = () => {
    if (!fileInputRef.current?.files?.[0] || !geoJSONPreview) return;
    
    const file = fileInputRef.current.files[0];
    setIsLoading(true);
    setLoadingProgress(0);
    
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const geojson = JSON.parse(e.target?.result as string) as FeatureCollection;
        
        // Filter properties in each feature
        const filteredGeojson: FeatureCollection = {
          ...geojson,
          features: geojson.features.map(feature => ({
            ...feature,
            properties: feature.properties ? 
              Object.fromEntries(
                Object.entries(feature.properties)
                  .filter(([key]) => geoJSONPreview.selectedProperties.has(key))
              ) : {}
          }))
        };

        const newLayer: LayerInfo = {
          id: getNextLayerId(),
          name: file.name,
          visible: true,
          data: filteredGeojson,
          color: '#ff0000',
          opacity: 0.7,
          type: 'geojson',
        };
        setLayers([...layers, newLayer]);

        // Calculate bounds and update view
        const bounds = calculateBounds(filteredGeojson);
        if (bounds) {
          const centerLat = (bounds.minLat + bounds.maxLat) / 2;
          const centerLng = (bounds.minLng + bounds.maxLng) / 2;
          const latDiff = bounds.maxLat - bounds.minLat;
          const lngDiff = bounds.maxLng - bounds.minLng;
          
          const maxDiff = Math.max(latDiff, lngDiff);
          const zoom = Math.min(20, Math.max(3, -Math.log2(maxDiff * 2.5)));

          setViewState({
            latitude: centerLat,
            longitude: centerLng,
            zoom,
          });
        }

        // Show success message
        console.log('Successfully added GeoJSON layer with selected properties');
      } catch (error) {
        console.error('Error processing GeoJSON:', error);
        alert(error instanceof Error ? error.message : 'Error processing GeoJSON file');
      } finally {
        setIsLoading(false);
        setLoadingProgress(100);
        // Reset preview
        setGeoJSONPreview(null);
        // Clear the file input
        if (fileInputRef.current) {
          fileInputRef.current.value = '';
        }
      }
    };

    reader.onprogress = (event) => {
      if (event.lengthComputable) {
        const progress = (event.loaded / event.total) * 100;
        setLoadingProgress(progress);
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
    // Clean up filters for the removed layer
    setActiveFilters(prev => {
      const newFilters = { ...prev };
      delete newFilters[layerId];
      return newFilters;
    });
    // Close filter modal if it's open for this layer
    if (showFilterModal === layerId) {
      setShowFilterModal(null);
    }
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
  const areFeaturesEqual = (feature1: Feature | null, feature2: Feature | null): boolean => {
    if (!feature1 || !feature2) return false;
    if (feature1.geometry.type !== feature2.geometry.type) return false;
    
    if (feature1.geometry.type === 'Point' && feature2.geometry.type === 'Point') {
      return JSON.stringify(feature1.geometry.coordinates) === JSON.stringify(feature2.geometry.coordinates);
    }
    
    // For H3 hexagons, compare their coordinates
    if (feature1.geometry.type === 'Polygon' && feature2.geometry.type === 'Polygon') {
      return JSON.stringify(feature1.geometry.coordinates) === JSON.stringify(feature2.geometry.coordinates);
    }
    
    // For other geometries, compare their properties
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

  const getNumericValuesForColumn = (layer: LayerInfo, column: string): number[] => {
    const getValue = (properties: { [key: string]: any } | null | undefined): number => {
      const value = properties?.[column];
      // Handle null/empty values as 0
      if (value === null || value === undefined || value === '') return 0;
      // Handle string numbers
      if (typeof value === 'string') {
        const parsed = parseFloat(value);
        return isNaN(parsed) ? 0 : parsed;
      }
      return typeof value === 'number' ? value : 0;
    };

    // Get filtered data first
    let filteredData;
    if (layer.type === 'geojson') {
      filteredData = activeFilters[layer.id]?.length > 0
        ? layer.data.features.filter((item: Feature) => activeFilters[layer.id].every(filter => filter.fn(item)))
        : layer.data.features;
      return filteredData.map((f: Feature) => getValue(f.properties));
    } else if (layer.type === 'point') {
      filteredData = activeFilters[layer.id]?.length > 0
        ? layer.data.filter((item: { properties: { [key: string]: any } }) => activeFilters[layer.id].every(filter => filter.fn(item)))
        : layer.data;
      return filteredData.map((d: { properties: { [key: string]: any } }) => getValue(d.properties));
    } else if (layer.type === 'h3') {
      filteredData = activeFilters[layer.id]?.length > 0
        ? layer.data.filter((item: { properties: { [key: string]: any } }) => activeFilters[layer.id].every(filter => filter.fn({ properties: item.properties })))
        : layer.data;
      return filteredData.map((d: { properties: { [key: string]: any } }) => getValue(d.properties));
    }
    return [];
  };

  const getColorForValue = (value: number, baseColor: string, colorMapping: NonNullable<LayerInfo['colorMapping']>): [number, number, number] => {
    if (!colorMapping.breaks.length) return hexToRGB(baseColor);

    // Find the appropriate color based on value's position in breaks
    let colorIndex = colorMapping.numClasses - 1; // Default to last color
    for (let i = 0; i < colorMapping.breaks.length; i++) {
      if (value <= colorMapping.breaks[i]) {
        colorIndex = i;
        break;
      }
    }

    // Get color from the selected color scale
    const colors = colorScales[colorMapping.colorScale];
    const color = colors[colorIndex];

    // Parse the color string to RGB values
    return hexToRGB(color);
  };

  // Add color cache
  const colorCache = useRef<{[key: string]: [number, number, number, number]}>({});
  const sizeCache = useRef<{[key: string]: number}>({});

  const updateLayerColorMapping = (layerId: number, colorMapping: LayerInfo['colorMapping']) => {
    setLayers(layers.map(layer => {
      if (layer.id === layerId && colorMapping) {
        // Calculate breaks if we have a column selected
        if (colorMapping.column) {
          const values = getNumericValuesForColumn(layer, colorMapping.column);
          
          // Convert all values to numbers and sort them
          const numericValues = values
            .map(v => typeof v === 'string' ? parseFloat(v) : v)
            .filter(v => !isNaN(v))
            .sort((a, b) => a - b);
          
          // Calculate quantile breaks
          const breaks = [];
          for (let i = 1; i < colorMapping.numClasses; i++) {
            const index = Math.floor((i / colorMapping.numClasses) * numericValues.length);
            breaks.push(numericValues[index]);
          }
          
          colorMapping.breaks = breaks;
          // Ensure we have a valid color scale
          colorMapping.colorScale = colorMapping.colorScale || 'YlOrRd';
        }

        // Force a re-render by creating a new layer object
        return { ...layer, colorMapping: { ...colorMapping } };
      }
      return layer;
    }));
  };

  const renderLayers = () => {
    // Clear caches when layers change
    colorCache.current = {};
    sizeCache.current = {};

    const getGeometryKey = (geometry: Geometry): string => {
      if ('coordinates' in geometry) {
        return JSON.stringify(geometry.coordinates);
      }
      if (geometry.type === 'GeometryCollection') {
        return JSON.stringify(geometry.geometries.map(g => getGeometryKey(g)));
      }
      return '';
    };

    return layers
      .filter(layer => layer.visible)
      .map((layer: LayerInfo) => {
        const [r, g, b] = hexToRGB(layer.color);
        
        if (layer.type === 'h3') {
          // Filter H3 data if there are active filters
          const filteredData = activeFilters[layer.id]?.length > 0
            ? layer.data.filter((item: any) => activeFilters[layer.id].every(filter => filter.fn({ properties: item.properties })))
            : layer.data;

          return new H3HexagonLayer({
            id: `h3-layer-${layer.id}`,
            data: filteredData,
            pickable: true,
            wireframe: true,
            filled: true,
            extruded: false,
            getHexagon: d => d.hex,
            getFillColor: d => {
              const cacheKey = `${layer.id}-${d.hex}`;
              if (colorCache.current[cacheKey]) {
                return colorCache.current[cacheKey];
              }

              let color: [number, number, number, number];
              if (layer.colorMapping?.column) {
                const value = d.properties[layer.colorMapping.column];
                const numericValue = typeof value === 'string' ? parseFloat(value) : value;
                if (!isNaN(numericValue)) {
                  const [r, g, b] = getColorForValue(numericValue, layer.color, layer.colorMapping);
                  color = [r, g, b, Math.round(layer.opacity * 255)];
                } else {
                  color = [r, g, b, Math.round(layer.opacity * 255)];
                }
              } else {
                color = [r, g, b, Math.round(layer.opacity * 255)];
              }
              colorCache.current[cacheKey] = color;
              return color;
            },
            getLineColor: [255, 255, 255],
            lineWidthMinPixels: 1,
            opacity: layer.opacity,
            updateTriggers: {
              getFillColor: [layer.id, layer.color, layer.opacity, layer.colorMapping?.column, layer.colorMapping?.breaks.join(',')]
            },
            onClick: (info: any) => {
              if (info.object) {
                const hexBoundary = h3.cellToBoundary(info.object.hex);
                const feature = {
                  type: 'Feature',
                  geometry: {
                    type: 'Polygon',
                    coordinates: [hexBoundary]
                  },
                  properties: info.object.properties
                } as Feature;

                if (isFeatureLocked && selectedFeature?.geometry.type === 'Polygon' &&
                    JSON.stringify(selectedFeature.geometry.coordinates) === JSON.stringify([hexBoundary])) {
                  setIsFeatureLocked(false);
                  setSelectedFeature(null);
                } else {
                  setSelectedFeature(feature);
                  setIsFeatureLocked(true);
                }
              }
            },
            onHover: (info: any) => {
              if (!isFeatureLocked && info.object) {
                const feature = {
                  type: 'Feature',
                  geometry: {
                    type: 'Polygon',
                    coordinates: [h3.cellToBoundary(info.object.hex)]
                  },
                  properties: info.object.properties
                } as Feature;
                setSelectedFeature(feature);
              } else if (!isFeatureLocked) {
                setSelectedFeature(null);
              }
            }
          });
        } else if (layer.type === 'point') {
          const layerData = layer.data;
          const filteredData = activeFilters[layer.id]?.length > 0 
            ? layerData.filter((item: any) => activeFilters[layer.id].every(filter => filter.fn(item)))
            : layerData;

          return new ScatterplotLayer({
            id: `point-layer-${layer.id}`,
            data: filteredData,
            getPosition: (d: any) => d.position,
            getFillColor: d => {
              const cacheKey = `${layer.id}-${d.position.join(',')}`;
              if (colorCache.current[cacheKey]) {
                return colorCache.current[cacheKey];
              }

              let color: [number, number, number, number];
              if (layer.colorMapping?.column) {
                const value = d.properties[layer.colorMapping.column];
                const numericValue = typeof value === 'string' ? parseFloat(value) : value;
                if (!isNaN(numericValue)) {
                  const [r, g, b] = getColorForValue(numericValue, layer.color, layer.colorMapping);
                  color = [r, g, b, Math.round(layer.opacity * 255)];
                } else {
                  color = [r, g, b, Math.round(layer.opacity * 255)];
                }
              } else {
                color = [r, g, b, Math.round(layer.opacity * 255)];
              }
              colorCache.current[cacheKey] = color;
              return color;
            },
            getRadius: d => {
              const cacheKey = `size-${layer.id}-${d.position.join(',')}`;
              if (sizeCache.current[cacheKey]) {
                return sizeCache.current[cacheKey];
              }

              let size: number;
              if (layer.sizeMapping?.column) {
                const value = d.properties[layer.sizeMapping.column];
                const numericValue = typeof value === 'string' ? parseFloat(value) : value;
                if (!isNaN(numericValue)) {
                  size = getSizeForValue(numericValue, layer.sizeMapping);
                } else {
                  size = layer.pointSize || 5;
                }
              } else {
                size = layer.pointSize || 5;
              }

              if (selectedFeature && 
                  selectedFeature.geometry.type === 'Point' &&
                  JSON.stringify(selectedFeature.geometry.coordinates) === JSON.stringify(d.position)) {
                size *= 2;
              }

              sizeCache.current[cacheKey] = size;
              return size;
            },
            radiusScale: 1,
            radiusUnits: "pixels",
            radiusMinPixels: 1,
            radiusMaxPixels: 50,
            pickable: true,
            updateTriggers: {
              getRadius: [
                layer.id,
                selectedFeature?.geometry.type === 'Point' ? JSON.stringify(selectedFeature.geometry.coordinates) : null,
                layer.pointSize,
                layer.sizeMapping?.column,
                layer.sizeMapping?.breaks.join(',')
              ],
              getFillColor: [
                layer.id,
                layer.color,
                layer.opacity,
                layer.colorMapping?.column,
                layer.colorMapping?.breaks.join(',')
              ]
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

                if (isFeatureLocked && selectedFeature?.geometry.type === 'Point' &&
                    JSON.stringify(selectedFeature.geometry.coordinates) === JSON.stringify(info.object.position)) {
                  setIsFeatureLocked(false);
                  setSelectedFeature(null);
                } else {
                  setSelectedFeature(feature);
                  setIsFeatureLocked(true);
                }
              }
            },
            onHover: (info: any) => {
              if (!isFeatureLocked && info.object) {
                const feature = {
                  type: 'Feature',
                  geometry: {
                    type: 'Point',
                    coordinates: info.object.position
                  },
                  properties: info.object.properties
                } as Feature;
                setSelectedFeature(feature);
              } else if (!isFeatureLocked) {
                setSelectedFeature(null);
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
          id: `geojson-layer-${layer.id}`,
          data: filteredData,
          filled: true,
          stroked: true,
          lineWidthUnits: "pixels",
          lineWidthMinPixels: 1,
          getFillColor: (d: Feature) => {
            const cacheKey = `${layer.id}-${getGeometryKey(d.geometry)}`;
            if (colorCache.current[cacheKey]) {
              return colorCache.current[cacheKey];
            }

            let color: [number, number, number, number];
            if (layer.colorMapping?.column) {
              const value = d.properties?.[layer.colorMapping.column];
              if (typeof value === 'number') {
                const [r, g, b] = getColorForValue(value, layer.color, layer.colorMapping);
                color = [r, g, b, Math.round(layer.opacity * (selectedFeature && areFeaturesEqual(d, selectedFeature) ? 255 : 128))];
              } else {
                color = [r, g, b, Math.round(layer.opacity * (selectedFeature && areFeaturesEqual(d, selectedFeature) ? 255 : 128))];
              }
            } else {
              color = [r, g, b, Math.round(layer.opacity * (selectedFeature && areFeaturesEqual(d, selectedFeature) ? 255 : 128))];
            }
            colorCache.current[cacheKey] = color;
            return color;
          },
          getLineColor: [r, g, b, 255],
          pickable: true,
          updateTriggers: {
            getFillColor: [
              layer.id,
              layer.color,
              layer.opacity,
              selectedFeature ? getGeometryKey(selectedFeature.geometry) : null,
              layer.colorMapping?.column,
              layer.colorMapping?.breaks.join(',')
            ],
            lineWidthMinPixels: [selectedFeature ? getGeometryKey(selectedFeature.geometry) : null]
          },
          onClick: (info: any) => {
            if (info.object) {
              if (isFeatureLocked && areFeaturesEqual(info.object, selectedFeature)) {
                setIsFeatureLocked(false);
                setSelectedFeature(null);
              } else {
                setSelectedFeature(info.object);
                setIsFeatureLocked(true);
              }
            }
          },
          onHover: (info: any) => {
            if (!isFeatureLocked && info.object) {
              setSelectedFeature(info.object);
            } else if (!isFeatureLocked) {
              setSelectedFeature(null);
            }
          }
        });
      });
  };

  const exportConfiguration = () => {
    const config: MapConfiguration = {
      version: "1.0.0",
      viewState,
      basemap: mapStyle,
      layers: layers.map(layer => ({
        name: layer.name,
        type: layer.type,
        visible: layer.visible,
        color: layer.color,
        opacity: layer.opacity,
        pointSize: layer.pointSize,
        columns: layer.columns,
        data: layer.data,
        filters: activeFilters[layer.id]?.map(filter => filter.info),
        selectedProperties: layer.type === 'geojson' 
          ? Object.keys(layer.data.features[0]?.properties || {})
          : Object.keys(layer.data[0]?.properties || {}),
        colorMapping: layer.colorMapping,
        sizeMapping: layer.sizeMapping
      }))
    };

    const blob = new Blob([JSON.stringify(config, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'map-configuration.json';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleConfigFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      importConfiguration(file).then(() => {
        // Reset the file input after successful import
        if (event.target) {
          event.target.value = '';
        }
      });
    }
  };

  const importConfiguration = async (file: File) => {
    try {
      const text = await file.text();
      const config: MapConfiguration = JSON.parse(text);

      // Validate version
      if (!config.version) {
        throw new Error('Invalid configuration file');
      }

      // Reset current state
      setLayers([]);
      setActiveFilters({});
      setSelectedFeature(null);
      setSelectedColumns([]);

      // Set view state
      setViewState(config.viewState);

      // Set basemap
      setMapStyle(config.basemap);

      // Import filters first so they can be applied to the layers
      const newFilters: {[layerId: number]: { fn: (item: any) => boolean, info: FilterInfo }[]} = {};
      config.layers.forEach((layerConfig, index) => {
        if (layerConfig.filters && layerConfig.filters.length > 0) {
          newFilters[index] = layerConfig.filters.map(filterInfo => ({
            fn: (item: any) => {
              const value = item.properties?.[filterInfo.column];
              if (filterInfo.type === 'numeric') {
                const numValue = parseFloat(value);
                if (filterInfo.value.type === 'range') {
                  return numValue >= filterInfo.value.min && numValue <= filterInfo.value.max;
                } else if (filterInfo.value.type === 'comparison') {
                  const compValue = parseFloat(String(filterInfo.value.value));
                  switch (filterInfo.value.operator) {
                    case '<': return numValue < compValue;
                    case '<=': return numValue <= compValue;
                    case '>': return numValue > compValue;
                    case '>=': return numValue >= compValue;
                    case '=': return numValue === compValue;
                    default: return true;
                  }
                }
              } else if (filterInfo.type === 'text') {
                const strValue = String(value).toLowerCase();
                if (filterInfo.value.type === 'multiple') {
                  return filterInfo.value.values.some(v => 
                    strValue.includes(v.toLowerCase())
                  );
                } else if (filterInfo.value.type === 'comparison') {
                  const compValue = String(filterInfo.value.value).toLowerCase();
                  switch (filterInfo.value.operator) {
                    case '=': return strValue === compValue;
                    case '<': return strValue < compValue;
                    case '<=': return strValue <= compValue;
                    case '>': return strValue > compValue;
                    case '>=': return strValue >= compValue;
                    default: return true;
                  }
                }
              }
              return true;
            },
            info: filterInfo
          }));
        }
      });
      setActiveFilters(newFilters);

      // Import and filter layers
      const newLayers = config.layers.map((layerConfig, index) => {
        // Apply filters to the data
        let filteredData = layerConfig.data;
        if (newFilters[index]) {
          if (layerConfig.type === 'geojson') {
            filteredData = {
              ...layerConfig.data,
              features: layerConfig.data.features.filter((feature: Feature) => 
                newFilters[index].every(filter => filter.fn(feature))
              )
            };
          } else if (layerConfig.type === 'point') {
            filteredData = layerConfig.data.filter((point: { properties: any }) => 
              newFilters[index].every(filter => filter.fn(point))
            );
          } else if (layerConfig.type === 'h3') {
            filteredData = layerConfig.data.filter((hex: { properties: any }) => 
              newFilters[index].every(filter => filter.fn({ properties: hex.properties }))
            );
          }
        }

        return {
          id: index,
          name: layerConfig.name,
          type: layerConfig.type,
          visible: layerConfig.visible,
          color: layerConfig.color,
          opacity: layerConfig.opacity,
          pointSize: layerConfig.pointSize,
          columns: layerConfig.columns,
          data: filteredData,
          isExpanded: false,
          colorMapping: layerConfig.colorMapping,
          sizeMapping: layerConfig.sizeMapping
        };
      });

      setLayers(newLayers);

    } catch (error) {
      console.error('Error importing configuration:', error);
      alert('Error importing configuration file');
    }
  };

  // Add back the ColorLegend component
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
          {/* Vertical color bars */}
          <div className="w-6 h-32">
            <div className="h-full flex flex-col">
              {Array.from({ length: layer.colorMapping.numClasses }).map((_, i) => (
                <div
                  key={i}
                  className="flex-1"
                  style={{ backgroundColor: getColorForLegend(i) }}
                />
              ))}
            </div>
          </div>
          {/* Value labels */}
          <div className="flex flex-col justify-between py-1 text-xs">
            <span>{layer.colorMapping.breaks[layer.colorMapping.breaks.length - 1]?.toFixed(1)}</span>
            <span>{layer.colorMapping.breaks[Math.floor(layer.colorMapping.breaks.length / 2)]?.toFixed(1)}</span>
            <span>{layer.colorMapping.breaks[0]?.toFixed(1)}</span>
          </div>
        </div>
      </div>
    );
  };

  const clearLayerColorMapping = (layerId: number) => {
    setLayers(layers.map(layer => 
      layer.id === layerId ? { ...layer, colorMapping: undefined } : layer
    ));
  };

  const getNumericColumns = (layer: LayerInfo): string[] => {
    const isNumeric = (value: any): boolean => {
      if (value === null || value === undefined || value === '') return false;
      if (typeof value === 'string') {
        const parsed = parseFloat(value);
        return !isNaN(parsed);
      }
      return typeof value === 'number' && !isNaN(value);
    };

    const hasNumericValues = (values: any[]): boolean => {
      const nonNullValues = values.filter(v => v !== null && v !== undefined && v !== '');
      if (nonNullValues.length === 0) return false;
      const numericCount = nonNullValues.filter(isNumeric).length;
      return numericCount / nonNullValues.length >= 0.5;
    };

    if (layer.type === 'geojson' && layer.data.features.length > 0) {
      const propertyValues: { [key: string]: any[] } = {};
      layer.data.features.forEach((feature: Feature) => {
        if (feature.properties) {
          Object.entries(feature.properties).forEach(([key, value]) => {
            if (!propertyValues[key]) propertyValues[key] = [];
            propertyValues[key].push(value);
          });
        }
      });
      
      return Object.entries(propertyValues)
        .filter(([_, values]) => hasNumericValues(values))
        .map(([key]) => key);
    } else if (layer.type === 'point' && layer.data.length > 0) {
      const propertyValues: { [key: string]: any[] } = {};
      layer.data.forEach((point: { properties: { [key: string]: any } }) => {
        if (point.properties) {
          Object.entries(point.properties).forEach(([key, value]) => {
            if (!propertyValues[key]) propertyValues[key] = [];
            propertyValues[key].push(value);
          });
        }
      });
      
      return Object.entries(propertyValues)
        .filter(([_, values]) => hasNumericValues(values))
        .map(([key]) => key);
    } else if (layer.type === 'h3' && layer.data.length > 0) {
      const propertyValues: { [key: string]: any[] } = {};
      layer.data.forEach((hex: { properties: { [key: string]: any } }) => {
        if (hex.properties) {
          Object.entries(hex.properties).forEach(([key, value]) => {
            if (!propertyValues[key]) propertyValues[key] = [];
            propertyValues[key].push(value);
          });
        }
      });
      
      return Object.entries(propertyValues)
        .filter(([_, values]) => hasNumericValues(values))
        .map(([key]) => key);
    }
    return [];
  };

  const updateLayerSizeMapping = (layerId: number, sizeMapping: LayerInfo['sizeMapping']) => {
    setLayers(layers.map(layer => {
      if (layer.id === layerId && sizeMapping) {
        // Calculate breaks if we have a column selected
        if (sizeMapping.column) {
          const values = getNumericValuesForColumn(layer, sizeMapping.column);
          
          // Convert all values to numbers and sort them
          const numericValues = values
            .map(v => typeof v === 'string' ? parseFloat(v) : v)
            .filter(v => !isNaN(v))
            .sort((a, b) => a - b);
          
          // Calculate quantile breaks
          const breaks = [];
          for (let i = 1; i < sizeMapping.numClasses; i++) {
            const index = Math.floor((i / sizeMapping.numClasses) * numericValues.length);
            breaks.push(numericValues[index]);
          }
          
          sizeMapping.breaks = breaks;
        }

        // Force a re-render by creating a new layer object
        return { ...layer, sizeMapping: { ...sizeMapping } };
      }
      return layer;
    }));
  };

  const clearLayerSizeMapping = (layerId: number) => {
    setLayers(layers.map(layer => 
      layer.id === layerId ? { ...layer, sizeMapping: undefined } : layer
    ));
  };

  const getSizeForValue = (value: number, sizeMapping: NonNullable<LayerInfo['sizeMapping']>): number => {
    if (!sizeMapping.breaks.length) return sizeMapping.minSize;

    // Find the appropriate size based on value's position in breaks
    let sizeIndex = 0;
    for (let i = 0; i < sizeMapping.breaks.length; i++) {
      if (value <= sizeMapping.breaks[i]) {
        sizeIndex = i;
        break;
      }
    }
    // If value is greater than all breaks, use the maximum size
    if (sizeIndex === 0 && value > sizeMapping.breaks[sizeMapping.breaks.length - 1]) {
      sizeIndex = sizeMapping.numClasses - 1;
    }

    // Interpolate between min and max size
    const sizeFraction = sizeIndex / (sizeMapping.numClasses - 1);
    return sizeMapping.minSize + (sizeMapping.maxSize - sizeMapping.minSize) * sizeFraction;
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
                  <label className="block text-sm font-medium text-gray-700 mb-2 text-left">
                    Upload GeoJSON
                  </label>
                  <input
                    key="geojson-input"
                    type="file"
                    accept=".json,.geojson"
                    onChange={handleFileUpload}
                    onClick={(e) => {
                      // Reset the file input value when clicking
                      (e.target as HTMLInputElement).value = '';
                    }}
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
                  <label className="block text-sm font-medium text-gray-700 mb-2 text-left">
                    Upload CSV
                  </label>
                  <input
                    key="csv-input"
                    type="file"
                    accept=".csv"
                    ref={fileInputRef}
                    onChange={handleCSVPreview}
                    onClick={(e) => {
                      // Reset the file input value when clicking
                      (e.target as HTMLInputElement).value = '';
                    }}
                    disabled={isLoading}
                    className="block w-full text-sm text-gray-500
                      file:mr-4 file:py-2 file:px-4
                      file:rounded-md file:border-0
                      file:text-sm file:font-semibold
                      file:bg-blue-50 file:text-blue-700
                      hover:file:bg-blue-100
                      disabled:opacity-50 disabled:cursor-not-allowed"
                  />
                  <div className="mt-2 text-xs text-gray-500 space-y-1 text-left">
                    <p>Supports two types of CSV files:</p>
                    <p>1. Point data with coordinate columns:</p>
                    <ul className="list-disc list-inside ml-2">
                      <li>Latitude (lat/latitude/y)</li>
                      <li>Longitude (lng/long/longitude/x)</li>
                    </ul>
                    <p>2. H3 hexagon data with index column:</p>
                    <ul className="list-disc list-inside ml-2">
                      <li>H3 index (hex_id/h3_index/h3/hexagon)</li>
                    </ul>
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2 text-left">
                    Import Map Configuration
                  </label>
                  <input
                    key="config-input"
                    type="file"
                    accept=".json"
                    onChange={handleConfigFileUpload}
                    onClick={(e) => {
                      // Reset the file input value when clicking
                      (e.target as HTMLInputElement).value = '';
                    }}
                    disabled={isLoading}
                    className="block w-full text-sm text-gray-500
                      file:mr-4 file:py-2 file:px-4
                      file:rounded-md file:border-0
                      file:text-sm file:font-semibold
                      file:bg-blue-50 file:text-blue-700
                      hover:file:bg-blue-100
                      disabled:opacity-50 disabled:cursor-not-allowed"
                  />
                  <div className="mt-2 text-xs text-gray-500 space-y-1 text-left">
                    <p>Accepts only JSON configuration files previously exported from this tool.</p>
                    <p>Configuration includes:</p>
                    <ul className="list-disc list-inside ml-2">
                      <li>Layer settings and data</li>
                      <li>Map view state</li>
                      <li>Basemap selection</li>
                      <li>Filter configurations</li>
                    </ul>
                  </div>
                </div>
                <button
                  onClick={exportConfiguration}
                  disabled={layers.length === 0}
                  className="w-full px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Export Current Configuration
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
      {isLoading && (
        <div className="absolute inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg px-8 py-4">
            <p className="text-lg font-medium text-gray-700">
              Processing... {Math.round(loadingProgress)}%
            </p>
          </div>
        </div>
      )}
      {selectedFeature && (
        <div className="absolute top-4 right-4 z-[80] bg-white rounded-lg shadow-lg p-4 max-w-md">
          <div className="flex justify-between items-center mb-2">
            <h3 className="text-sm font-medium text-gray-900">
              Feature Properties {isFeatureLocked && "(Locked)"}
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
              <button
                onClick={() => {
                  setSelectedFeature(null);
                  setIsFeatureLocked(false);
                }}
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
                      <span className="text-xs text-gray-500">Color Based On</span>
                      <select
                        className="mt-1 block w-full rounded-md border-gray-300 py-1 pl-2 pr-8 text-xs"
                        value={layer.colorMapping?.column || ''}
                        onChange={(e) => {
                          const column = e.target.value;
                          if (column) {
                            updateLayerColorMapping(layer.id, {
                              column,
                              numClasses: layer.colorMapping?.numClasses || 5,
                              breaks: [],
                              colorScale: 'YlOrRd'  // Always use YlOrRd as default
                            });
                          } else {
                            clearLayerColorMapping(layer.id);
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
                          <div>
                            {renderColorScaleDropdown(layer, updateLayerColorMapping)}
                          </div>
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
                                updateLayerColorMapping(layer.id, {
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
                        onChange={(e) => updateLayerOpacity(layer.id, parseFloat(e.target.value))}
                        className="w-full"
                      />
                    </div>
                    {layer.type === 'point' && (
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
                            onChange={(e) => {
                              const size = parseInt(e.target.value);
                              updateLayerPointSize(layer.id, size);
                            }}
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
                                updateLayerSizeMapping(layer.id, {
                                  column,
                                  numClasses: layer.sizeMapping?.numClasses || 5,
                                  breaks: [],
                                  minSize: 2,
                                  maxSize: 10
                                });
                              } else {
                                clearLayerSizeMapping(layer.id);
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
                                    updateLayerSizeMapping(layer.id, {
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
                                        updateLayerSizeMapping(layer.id, {
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
                                        updateLayerSizeMapping(layer.id, {
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
        </div>
      )}
      <FilterModal
        isOpen={showFilterModal !== null}
        onClose={() => setShowFilterModal(null)}
        data={layers.find(l => l.id === showFilterModal)?.type === 'point' 
          ? layers.find(l => l.id === showFilterModal)?.data
          : layers.find(l => l.id === showFilterModal)?.type === 'h3'
          ? layers.find(l => l.id === showFilterModal)?.data.map((d: any) => d.properties)
          : layers.find(l => l.id === showFilterModal)?.data.features || []}
        onApplyFilter={(filter, filterInfo) => {
          if (showFilterModal !== null) {
            const layer = layers.find(l => l.id === showFilterModal);
            if (layer) {
              const wrappedFilter = (item: any) => {
                if (layer.type === 'h3') {
                  return filter(item.properties);
                }
                return filter(item);
              };
              handleApplyFilter(showFilterModal, wrappedFilter, filterInfo);
            }
          }
          setShowFilterModal(null);
        }}
        activeFilters={showFilterModal !== null ? (activeFilters[showFilterModal]?.map(f => f.info) || []) : []}
        onRemoveFilter={(index) => showFilterModal !== null && handleRemoveFilter(showFilterModal, index)}
        layerType={layers.find(l => l.id === showFilterModal)?.type}
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
      </DeckGL>

      {/* Legends - positioned above basemap button */}
      <div className="absolute bottom-28 right-4 space-y-4 z-[30]">
        {layers.map(layer => {
          if (!layer.visible) return null;
          return (
            <React.Fragment key={layer.id}>
              {layer.colorMapping?.column && (
                <ColorLegend layer={layer} />
              )}
              {layer.type === 'point' && layer.sizeMapping?.column && (
                <SizeLegend layer={layer} />
              )}
            </React.Fragment>
          );
        })}
      </div>

      {/* Basemap selector - Middle z-index */}
      <div className="absolute bottom-16 right-4 z-[60]">
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
          <div className="absolute bottom-12 right-0 bg-white rounded-lg shadow-lg py-2 min-w-[120px] z-[70]">
            {Object.entries(basemapOptions).map(([name, url]) => (
              <button
                key={name}
                onClick={() => {
                  setMapStyle(url);
                  setShowBasemapSelector(false);
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

      {/* Author attribution */}
      <div className="absolute bottom-4 right-4 z-50 flex items-center space-x-4 text-sm text-gray-600">
        <div className="flex items-center space-x-2">
          <span>Boyang Sa</span>
          <a
            href="https://boyangsa.com"
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
            href="https://github.com/bobsa514/mapviewer-gl"
            target="_blank"
            rel="noopener noreferrer"
            className="text-gray-600 hover:text-gray-900"
            title="GitHub"
          >
            <svg
              className="h-5 w-5"
              fill="currentColor"
              viewBox="0 0 24 24"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path
                fillRule="evenodd"
                clipRule="evenodd"
                d="M12 2C6.477 2 2 6.477 2 12c0 4.42 2.865 8.17 6.839 9.49.5.092.682-.217.682-.482 0-.237-.008-.866-.013-1.7-2.782.604-3.369-1.34-3.369-1.34-.454-1.156-1.11-1.464-1.11-1.464-.908-.62.069-.608.069-.608 1.003.07 1.531 1.03 1.531 1.03.892 1.529 2.341 1.087 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.11-4.555-4.943 0-1.091.39-1.984 1.029-2.683-.103-.253-.446-1.27.098-2.647 0 0 .84-.269 2.75 1.025A9.578 9.578 0 0112 6.836c.85.004 1.705.114 2.504.336 1.909-1.294 2.747-1.025 2.747-1.025.546 1.377.203 2.394.1 2.647.64.699 1.028 1.592 1.028 2.683 0 3.842-2.339 4.687-4.566 4.935.359.309.678.919.678 1.852 0 1.336-.012 2.415-.012 2.743 0 .267.18.578.688.48C19.138 20.167 22 16.418 22 12c0-5.523-4.477-10-10-10z"
              />
            </svg>
          </a>
        </div>
      </div>

      {csvPreview && (
        <div className="absolute inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-[90vw] w-[1000px] max-h-[90vh] overflow-hidden flex flex-col">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-semibold text-gray-900">Preview CSV Data</h2>
              <button 
                onClick={() => setCsvPreview(null)}
                className="text-gray-500 hover:text-gray-700"
              >
                <XMarkIcon className="h-6 w-6" />
              </button>
            </div>
            <div className="mb-4 flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <button
                  onClick={handleSelectAllColumns}
                  className="px-3 py-1.5 text-sm bg-gray-100 hover:bg-gray-200 text-gray-700 rounded"
                >
                  Select All
                </button>
                <button
                  onClick={handleDeselectAllColumns}
                  className="px-3 py-1.5 text-sm bg-gray-100 hover:bg-gray-200 text-gray-700 rounded"
                >
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
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-10">
                      Row
                    </th>
                    {csvPreview.headers.map((header, i) => (
                      <th 
                        key={i}
                        className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                      >
                        <div className="flex flex-col space-y-2">
                          <span>{header}</span>
                          <label className="flex items-center space-x-2">
                            <input
                              type="checkbox"
                              checked={csvPreview.selectedColumns.has(header)}
                              onChange={() => toggleColumnSelection(header)}
                              disabled={csvPreview.coordinateColumns.has(header)}
                              className={`h-4 w-4 rounded border-gray-300 ${
                                csvPreview.coordinateColumns.has(header)
                                  ? 'bg-blue-100 text-blue-600 cursor-not-allowed'
                                  : 'text-blue-600'
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
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {i + 1}
                      </td>
                      {row.map((cell, j) => (
                        <td key={j} className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {cell}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="mt-4 flex justify-end space-x-3">
              <button
                onClick={() => setCsvPreview(null)}
                className="px-4 py-2 text-gray-700 hover:text-gray-900 font-medium"
              >
                Cancel
              </button>
              <button
                onClick={proceedWithSelectedColumns}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700"
                disabled={csvPreview.selectedColumns.size === 0}
              >
                Proceed with Selected Columns
              </button>
            </div>
          </div>
        </div>
      )}
      {geoJSONPreview && (
        <div className="absolute inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-[90vw] w-[1000px] max-h-[90vh] overflow-hidden flex flex-col">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-semibold text-gray-900">Preview GeoJSON Data</h2>
              <button 
                onClick={() => setGeoJSONPreview(null)}
                className="text-gray-500 hover:text-gray-700"
              >
                <XMarkIcon className="h-6 w-6" />
              </button>
            </div>
            <div className="mb-4 flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <button
                  onClick={handleSelectAllGeoJSONProperties}
                  className="px-3 py-1.5 text-sm bg-gray-100 hover:bg-gray-200 text-gray-700 rounded"
                >
                  Select All
                </button>
                <button
                  onClick={handleDeselectAllGeoJSONProperties}
                  className="px-3 py-1.5 text-sm bg-gray-100 hover:bg-gray-200 text-gray-700 rounded"
                >
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
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-10">
                      Property
                    </th>
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
                            onChange={() => toggleGeoJSONPropertySelection(property)}
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
              <button
                onClick={() => setGeoJSONPreview(null)}
                className="px-4 py-2 text-gray-700 hover:text-gray-900 font-medium"
              >
                Cancel
              </button>
              <button
                onClick={proceedWithSelectedGeoJSONProperties}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700"
                disabled={geoJSONPreview.selectedProperties.size === 0}
              >
                Proceed with Selected Properties
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default MapViewerGL; 