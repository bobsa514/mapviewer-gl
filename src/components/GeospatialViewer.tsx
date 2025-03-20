import React, { useState, useCallback, useRef } from 'react';
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
import { H3HexagonLayer } from '@deck.gl/geo-layers';
import * as h3 from 'h3-js';

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
  type: 'geojson' | 'point' | 'h3'; // Updated type to distinguish between point and h3
  columns?: {
    lat: string;
    lng: string;
  };
  pointSize?: number; // Now represents pixel size
  isExpanded?: boolean; // Add expanded state for symbology controls
  isH3Data?: boolean;
  h3Column?: string;
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

const GeospatialViewer: React.FC = () => {
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
    lines: string[],
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
    let validPoints = 0;
    let invalidPoints = 0;
    const endIndex = Math.min(startIndex + chunkSize, lines.length);

    for (let i = startIndex; i < endIndex; i++) {
      const line = lines[i];
      if (!line.trim()) continue;

      const values = line.split(',').map(v => v.trim());
      
      // Parse coordinates
      const lat = parseFloat(values[latIndex]);
      const lng = parseFloat(values[lngIndex]);
      
      // Validate coordinates
      if (isNaN(lat) || isNaN(lng) || lat < -90 || lat > 90 || lng < -180 || lng > 180) {
        invalidPoints++;
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

      validPoints++;
    }

    const totalDataRows = lines.length - 1;
    const progress = ((endIndex - 1) / totalDataRows) * 100;
    onProgress(Math.min(progress, 100));

    return { data, validPoints, invalidPoints, endIndex };
  }, []);

  const handleCSVPreview = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const csvText = e.target?.result as string;
        const lines = csvText
          .split(/\r?\n/)
          .map(line => line.trim())
          .filter(line => line.length > 0);

        if (lines.length < 2) {
          throw new Error('CSV file is empty or has no data rows');
        }

        // Parse headers and clean them
        const headers = lines[0].split(',').map(h => h.trim());
        
        // Parse data rows carefully
        const previewRows = lines.slice(1, 11).map(line => {
          const row = new Array(headers.length).fill('');
          let currentCell = '';
          let inQuotes = false;
          let cellIndex = 0;
          
          // Parse the line character by character
          for (let i = 0; i < line.length; i++) {
            const char = line[i];
            
            if (char === '"') {
              inQuotes = !inQuotes;
            } else if (char === ',' && !inQuotes) {
              // End of cell
              if (cellIndex < headers.length) {
                row[cellIndex] = currentCell.trim();
              }
              currentCell = '';
              cellIndex++;
            } else {
              currentCell += char;
            }
          }
          
          // Add the last cell
          if (cellIndex < headers.length) {
            row[cellIndex] = currentCell.trim();
          }
          
          return row;
        });

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
        const lines = csvText.split(/\r?\n/).map(line => line.trim()).filter(line => line.length > 0);
        const headers = lines[0].split(',').map(h => h.trim());
        
        // Process data based on type (H3 or coordinates)
        if (csvPreview.isH3Data && csvPreview.h3Column) {
          const h3ColumnIndex = headers.indexOf(csvPreview.h3Column);
          const hexagons = lines.slice(1).map(line => {
            const values = line.split(',').map(cell => cell.trim());
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
          });
          
          const newLayer: LayerInfo = {
            id: layers.length,
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

          while (currentIndex < lines.length) {
            const { 
              data: chunkData, 
              validPoints, 
              invalidPoints, 
              endIndex 
            } = processChunk(
              lines, 
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
            id: layers.length,
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
          id: layers.length,
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

  const renderLayers = () => {
    return layers
      .filter(layer => layer.visible)
      .map((layer: LayerInfo) => {
        const [r, g, b] = hexToRGB(layer.color);
        
        if (layer.type === 'h3') {
          return new H3HexagonLayer({
            id: `h3-layer-${layer.id}`,
            data: layer.data,
            pickable: true,
            wireframe: true,
            filled: true,
            extruded: false,
            getHexagon: d => d.hex,
            getFillColor: [r, g, b, Math.round(layer.opacity * 255)],
            getLineColor: [255, 255, 255],
            lineWidthMinPixels: 1,
            opacity: layer.opacity,
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
            getFillColor: [r, g, b, Math.round(layer.opacity * 255)],
            getRadius: (d: any) => {
              if (selectedFeature && 
                  selectedFeature.geometry.type === 'Point' &&
                  JSON.stringify(selectedFeature.geometry.coordinates) === JSON.stringify(d.position)) {
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
            if (selectedFeature && areFeaturesEqual(d, selectedFeature)) {
              return [r, g, b, Math.round(layer.opacity * 255)];
            }
            return [r, g, b, Math.round(layer.opacity * 128)];
          },
          getLineColor: [r, g, b, 255],
          pickable: true,
          updateTriggers: {
            getFillColor: [layer.color, layer.opacity, selectedFeature],
            lineWidthMinPixels: [selectedFeature]
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
                  <label className="block text-sm font-medium text-gray-700 mb-2 text-left">
                    Upload CSV
                  </label>
                  <input
                    type="file"
                    accept=".csv"
                    ref={fileInputRef}
                    onChange={handleCSVPreview}
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
        <div className="absolute top-4 right-4 z-10 bg-white rounded-lg shadow-lg p-4 max-w-md">
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

export default GeospatialViewer; 