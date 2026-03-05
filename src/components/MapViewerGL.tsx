import React, { useState, useCallback, useRef, useEffect } from 'react';
import DeckGL from '@deck.gl/react';
import { Map } from 'react-map-gl/maplibre';
import { GeoJsonLayer, ScatterplotLayer } from '@deck.gl/layers';
import type { MapViewState } from '@deck.gl/core';
import type { FeatureCollection, Feature, Geometry } from 'geojson';
import Papa from 'papaparse';
import { H3HexagonLayer } from '@deck.gl/geo-layers';
import * as h3 from 'h3-js';

import type { LayerInfo, BasemapStyle, MapConfiguration, CSVPreviewData, GeoJSONPreviewData, FilterInfo, DuckDBOnlyTable } from '../types';
import { basemapOptions } from '../types';
import { extractCoordinates, calculateBounds, hexToRGB, getColorForValue, getSizeForValue } from '../utils/geometry';
import { detectCoordinateColumns, detectH3Column, isValidH3Index, processChunk } from '../utils/csv';
import { getNumericValuesForColumn } from '../utils/layers';

import { FilterModal } from './FilterModal';
import { CSVPreviewModal } from './CSVPreviewModal';
import { GeoJSONPreviewModal } from './GeoJSONPreviewModal';
import { FeaturePropertiesPanel } from './FeaturePropertiesPanel';
import { BasemapSelector } from './BasemapSelector';
import { LegendDisplay } from './LegendDisplay';
import { LayersPanel } from './LayersPanel';
import { AddDataModal } from './AddDataModal';
import { SQLEditor } from './SQLEditor';

const INITIAL_VIEW_STATE: MapViewState = {
  latitude: 39.8283,
  longitude: -98.5795,
  zoom: 3,
};

const MapViewerGL: React.FC = () => {
  const layerIdCounter = useRef(0);
  const getNextLayerId = useCallback(() => {
    layerIdCounter.current += 1;
    return layerIdCounter.current;
  }, []);

  const [layers, setLayers] = useState<LayerInfo[]>([]);
  const [viewState, setViewState] = useState<MapViewState>(INITIAL_VIEW_STATE);
  const [isLoading, setIsLoading] = useState(false);
  const [loadingProgress, setLoadingProgress] = useState(0);
  const [selectedFeature, setSelectedFeature] = useState<Feature | null>(null);
  const [selectedColumns, setSelectedColumns] = useState<string[]>([]);
  const [allAvailableColumns, setAllAvailableColumns] = useState<string[]>([]);
  const [showAddDataModal, setShowAddDataModal] = useState(false);
  const [mapStyle, setMapStyle] = useState<BasemapStyle>(basemapOptions["Carto Light"]);
  const [showFilterModal, setShowFilterModal] = useState<number | null>(null);
  const [activeFilters, setActiveFilters] = useState<{[layerId: number]: { fn: (item: any) => boolean, info: FilterInfo }[]}>({});
  const [showLayers, setShowLayers] = useState(true);
  const [csvPreview, setCsvPreview] = useState<CSVPreviewData | null>(null);
  const [geoJSONPreview, setGeoJSONPreview] = useState<GeoJSONPreviewData | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const geojsonFileRef = useRef<File | null>(null);
  const csvFileRef = useRef<File | null>(null);
  const pendingGeoJSONRef = useRef<FeatureCollection | null>(null);
  const [isFeatureLocked, setIsFeatureLocked] = useState(false);

  // DuckDB state
  const [registeredTables, setRegisteredTables] = useState<string[]>([]);
  const [isDuckDBReady, setIsDuckDBReady] = useState(false);
  const [showSQLEditor, setShowSQLEditor] = useState(false);
  const [duckdbOnlyTables, setDuckdbOnlyTables] = useState<DuckDBOnlyTable[]>([]);

  const handleDuckDBReady = useCallback(() => {
    setIsDuckDBReady(true);
  }, []);

  // Track which layer names are present to avoid re-syncing on non-structural changes
  const layerNamesRef = useRef<string>('');
  const duckdbOnlyNamesRef = useRef<string>('');

  // Sync layers with DuckDB tables
  useEffect(() => {
    if (!isDuckDBReady) return;

    // Only sync when layers are added/removed, not when properties (color, opacity, etc.) change
    const layerNamesKey = layers.map(l => l.name).sort().join('\0');
    const duckdbNamesKey = duckdbOnlyTables.map(t => t.tableName).sort().join('\0');
    if (layerNamesKey === layerNamesRef.current && duckdbNamesKey === duckdbOnlyNamesRef.current) return;
    layerNamesRef.current = layerNamesKey;
    duckdbOnlyNamesRef.current = duckdbNamesKey;

    const syncTables = async () => {
      try {
        const { registerLayer, unregisterLayer, sanitizeTableName } = await import('../utils/duckdb');

        const duckdbOnlyNames = duckdbOnlyTables.map(t => t.tableName);
        const layersToRegister = layers.filter(l => l.sourceType !== 'parquet');
        const currentLayerTableNames = layersToRegister.map(l => sanitizeTableName(l.name));
        const parquetLayerTableNames = layers.filter(l => l.sourceType === 'parquet').map(l => sanitizeTableName(l.name));
        const allCurrentTableNames = [...currentLayerTableNames, ...parquetLayerTableNames, ...duckdbOnlyNames];

        // Register new layers (per-layer try-catch so one failure doesn't block others)
        for (const layer of layersToRegister) {
          const tableName = sanitizeTableName(layer.name);
          if (!registeredTables.includes(tableName)) {
            try {
              await registerLayer(layer, tableName);
            } catch (err) {
              console.warn(`Failed to register table "${tableName}":`, err);
            }
          }
        }

        // Unregister removed layers
        for (const tableName of registeredTables) {
          if (!allCurrentTableNames.includes(tableName)) {
            try {
              await unregisterLayer(tableName);
            } catch {
              // Ignore unregister failures
            }
          }
        }

        // Always update registered tables list
        setRegisteredTables(allCurrentTableNames);
      } catch {
        // DuckDB not loaded yet, skip sync
      }
    };
    syncTables();
  }, [layers, isDuckDBReady, duckdbOnlyTables]);

  // Update allAvailableColumns when a new feature is selected
  useEffect(() => {
    if (selectedFeature?.properties) {
      const columns = Object.keys(selectedFeature.properties);
      setAllAvailableColumns(columns);
      if (selectedColumns.length === 0 || !selectedColumns.some(col => columns.includes(col))) {
        setSelectedColumns(columns.slice(0, 5));
      }
    }
  }, [selectedFeature]);

  const handleColumnToggle = (column: string) => {
    setSelectedColumns(prev =>
      prev.includes(column) ? prev.filter(c => c !== column) : [...prev, column]
    );
  };

  // ---- CSV handling ----
  const handleCSVFile = useCallback((file: File) => {
    csvFileRef.current = file;
    setGeoJSONPreview(null);
    setCsvPreview(null);
    setShowAddDataModal(false);

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const csvText = e.target?.result as string;
        const parsed = Papa.parse(csvText, { header: false, preview: 11, skipEmptyLines: true });
        if (parsed.errors.length > 0) console.warn('CSV parsing warnings:', parsed.errors);

        const rows = parsed.data as string[][];
        if (rows.length < 2) throw new Error('CSV file is empty or has no data rows');

        const headers = rows[0].map((h: string) => h.trim());
        const previewRows = rows.slice(1, 11);

        const h3Column = detectH3Column(headers);
        const h3ColumnIndex = h3Column ? headers.indexOf(h3Column) : -1;
        let isH3Data = false;
        if (h3ColumnIndex !== -1) {
          isH3Data = isValidH3Index(previewRows[0][h3ColumnIndex]);
        }

        const coordinateColumns = new Set<string>();
        let csvMode: 'geo' | 'duckdb_only' = 'geo';
        if (!isH3Data) {
          const coordinates = detectCoordinateColumns(headers);
          if (coordinates) {
            coordinateColumns.add(coordinates.lat);
            coordinateColumns.add(coordinates.lng);
          } else {
            csvMode = 'duckdb_only';
          }
        }

        setCsvPreview({
          headers,
          rows: previewRows,
          selectedColumns: new Set(headers),
          coordinateColumns,
          isH3Data,
          h3Column: h3Column || undefined,
          mode: csvMode,
        });
      } catch (error) {
        console.error('Error parsing CSV:', error);
        alert(error instanceof Error ? error.message : 'Error parsing CSV file');
        setCsvPreview(null);
      }
    };
    reader.readAsText(file);
  }, []);

  const toggleColumnSelection = (header: string) => {
    if (!csvPreview) return;
    if (csvPreview.coordinateColumns.has(header)) return;
    const newSelected = new Set(csvPreview.selectedColumns);
    if (newSelected.has(header)) newSelected.delete(header);
    else newSelected.add(header);
    setCsvPreview({ ...csvPreview, selectedColumns: newSelected });
  };

  const proceedWithSelectedColumns = async () => {
    if (!csvFileRef.current || !csvPreview) return;
    const file = csvFileRef.current;

    // DuckDB-only mode: register as SQL table, no map layer
    if (csvPreview.mode === 'duckdb_only') {
      setIsLoading(true);
      try {
        const { registerPlainCSVTable } = await import('../utils/duckdb');
        const { initDuckDB } = await import('../utils/duckdb');
        await initDuckDB();
        const { tableName, columns } = await registerPlainCSVTable(file);
        setDuckdbOnlyTables(prev => [...prev, {
          tableName, fileName: file.name, sourceType: 'csv', columns,
        }]);
        setRegisteredTables(prev => prev.includes(tableName) ? prev : [...prev, tableName]);
      } catch (error) {
        console.error('Error registering CSV table:', error);
        alert(error instanceof Error ? error.message : 'Error registering CSV table');
      } finally {
        setIsLoading(false);
        setCsvPreview(null);
        csvFileRef.current = null;
      }
      return;
    }

    setIsLoading(true);
    setLoadingProgress(0);

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const csvText = e.target?.result as string;
        const parsed = Papa.parse(csvText, { header: false, skipEmptyLines: true });
        const rows = parsed.data as string[][];
        const headers = rows[0].map((h: string) => h.trim());

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
            return { hex: h3Index, properties };
          }).filter(h => h.hex && isValidH3Index(h.hex));

          if (hexagons.length === 0) throw new Error('No valid H3 indexes found in the data');

          const newLayer: LayerInfo = {
            id: getNextLayerId(), name: file.name, visible: true,
            data: hexagons, color: '#ff0000', opacity: 0.7, type: 'h3'
          };
          setLayers(prev => [...prev, newLayer]);

          if (hexagons.length > 0) {
            const [centerLat, centerLng] = h3.cellToLatLng(hexagons[0].hex);
            setViewState({ latitude: centerLat, longitude: centerLng, zoom: 11 });
          }
        } else {
          const coordinates = detectCoordinateColumns(headers);
          if (!coordinates) throw new Error('Could not detect latitude and longitude columns');

          const latIndex = headers.indexOf(coordinates.lat);
          const lngIndex = headers.indexOf(coordinates.lng);
          const CHUNK_SIZE = 10000;
          let currentIndex = 1;
          let allData: any[] = [];
          let bounds = { minLat: Infinity, maxLat: -Infinity, minLng: Infinity, maxLng: -Infinity };

          while (currentIndex < rows.length) {
            const { data: chunkData, endIndex } = processChunk(
              rows, currentIndex, headers, csvPreview.selectedColumns,
              coordinates, latIndex, lngIndex, CHUNK_SIZE, setLoadingProgress
            );
            chunkData.forEach(point => {
              bounds.minLat = Math.min(bounds.minLat, point.position[1]);
              bounds.maxLat = Math.max(bounds.maxLat, point.position[1]);
              bounds.minLng = Math.min(bounds.minLng, point.position[0]);
              bounds.maxLng = Math.max(bounds.maxLng, point.position[0]);
            });
            allData = allData.concat(chunkData);
            currentIndex = endIndex;
          }

          if (allData.length === 0) throw new Error('No valid data points found in CSV');

          const centerLat = (bounds.minLat + bounds.maxLat) / 2;
          const centerLng = (bounds.minLng + bounds.maxLng) / 2;
          const maxDiff = Math.max(bounds.maxLat - bounds.minLat, bounds.maxLng - bounds.minLng);
          const zoom = Math.min(20, Math.max(3, -Math.log2(maxDiff * 2.5)));

          const newLayer: LayerInfo = {
            id: getNextLayerId(), name: file.name, visible: true,
            data: allData, color: '#ff0000', opacity: 0.7, type: 'point',
            columns: coordinates, pointSize: 5
          };
          setLayers(prev => [...prev, newLayer]);
          setViewState({ latitude: centerLat, longitude: centerLng, zoom });
        }
      } catch (error) {
        console.error('Error processing CSV:', error);
        alert(error instanceof Error ? error.message : 'Error processing CSV file');
      } finally {
        setIsLoading(false);
        setLoadingProgress(100);
        setCsvPreview(null);
        csvFileRef.current = null;
      }
    };
    reader.readAsText(file);
  };

  // ---- GeoJSON handling ----
  const handleGeoJSONFile = useCallback((file: File) => {
    geojsonFileRef.current = file;
    pendingGeoJSONRef.current = null;
    setCsvPreview(null);
    setGeoJSONPreview(null);
    setShowAddDataModal(false);

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const geojson = JSON.parse(e.target?.result as string) as FeatureCollection;
        const properties = new Set<string>();
        geojson.features.forEach(feature => {
          if (feature.properties) Object.keys(feature.properties).forEach(key => properties.add(key));
        });
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
  }, []);

  // ---- Shapefile handling ----
  const handleShapefileFile = useCallback((file: File) => {
    setShowAddDataModal(false);
    setIsLoading(true);
    setLoadingProgress(0);

    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const { parseShapefile } = await import('../utils/shapefile');
        const geojson = await parseShapefile(e.target?.result as ArrayBuffer);

        // Store parsed GeoJSON and show preview modal
        pendingGeoJSONRef.current = geojson;
        geojsonFileRef.current = null; // no file ref for shapefile path

        const properties = new Set<string>();
        geojson.features.forEach(feature => {
          if (feature.properties) Object.keys(feature.properties).forEach(key => properties.add(key));
        });

        setGeoJSONPreview({
          properties: Array.from(properties),
          features: geojson.features.slice(0, 10),
          selectedProperties: new Set(properties)
        });
      } catch (error) {
        console.error('Error parsing shapefile:', error);
        alert(error instanceof Error ? error.message : 'Error parsing shapefile');
      } finally {
        setIsLoading(false);
        setLoadingProgress(100);
      }
    };
    reader.readAsArrayBuffer(file);
  }, []);

  // ---- Parquet handling ----
  const handleParquetFile = useCallback(async (file: File) => {
    setShowAddDataModal(false);
    setIsLoading(true);
    try {
      const { initDuckDB, registerParquetFile, extractGeoParquetAsGeoJSON } = await import('../utils/duckdb');
      await initDuckDB();
      const { tableName, geomColumn, geomColumnType, columns } = await registerParquetFile(file);

      if (geomColumn) {
        // GeoParquet → extract geometry and add as map layer
        const fc = await extractGeoParquetAsGeoJSON(tableName, geomColumn, geomColumnType);
        addGeoJSONLayer(fc, new Set(Object.keys(fc.features[0]?.properties || {})), file.name, 'parquet');
        setRegisteredTables(prev => prev.includes(tableName) ? prev : [...prev, tableName]);
      } else {
        // Plain Parquet → DuckDB-only table
        setDuckdbOnlyTables(prev => [...prev, {
          tableName, fileName: file.name, sourceType: 'parquet', columns,
        }]);
        setRegisteredTables(prev => prev.includes(tableName) ? prev : [...prev, tableName]);
      }
    } catch (error) {
      console.error('Error processing Parquet file:', error);
      alert(error instanceof Error ? error.message : 'Error processing Parquet file');
    } finally {
      setIsLoading(false);
    }
  }, []);

  // ---- DuckDB-only table removal ----
  const handleRemoveDuckDBOnlyTable = useCallback(async (tableName: string) => {
    try {
      const { unregisterLayer } = await import('../utils/duckdb');
      await unregisterLayer(tableName);
    } catch {
      // Ignore if DuckDB not ready
    }
    setDuckdbOnlyTables(prev => prev.filter(t => t.tableName !== tableName));
    setRegisteredTables(prev => prev.filter(t => t !== tableName));
  }, []);

  const toggleGeoJSONPropertySelection = (property: string) => {
    if (!geoJSONPreview) return;
    const newSelected = new Set(geoJSONPreview.selectedProperties);
    if (newSelected.has(property)) newSelected.delete(property);
    else newSelected.add(property);
    setGeoJSONPreview({ ...geoJSONPreview, selectedProperties: newSelected });
  };

  const proceedWithSelectedGeoJSONProperties = () => {
    if (!geoJSONPreview) return;

    // Use pendingGeoJSONRef (from shapefile) or read from file
    if (pendingGeoJSONRef.current) {
      addGeoJSONLayer(pendingGeoJSONRef.current, geoJSONPreview.selectedProperties, 'shapefile_layer');
      pendingGeoJSONRef.current = null;
      setGeoJSONPreview(null);
      return;
    }

    if (!geojsonFileRef.current) return;

    const file = geojsonFileRef.current;
    setIsLoading(true);
    setLoadingProgress(0);

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const geojson = JSON.parse(e.target?.result as string) as FeatureCollection;
        addGeoJSONLayer(geojson, geoJSONPreview.selectedProperties, file.name);
      } catch (error) {
        console.error('Error processing GeoJSON:', error);
        alert(error instanceof Error ? error.message : 'Error processing GeoJSON file');
      } finally {
        setIsLoading(false);
        setLoadingProgress(100);
        setGeoJSONPreview(null);
        geojsonFileRef.current = null;
      }
    };
    reader.onprogress = (event) => {
      if (event.lengthComputable) setLoadingProgress((event.loaded / event.total) * 100);
    };
    reader.readAsText(file);
  };

  const addGeoJSONLayer = (geojson: FeatureCollection, selectedProperties: Set<string>, name: string, sourceType?: LayerInfo['sourceType']) => {
    const filteredGeojson: FeatureCollection = {
      ...geojson,
      features: geojson.features.map(feature => ({
        ...feature,
        properties: feature.properties
          ? Object.fromEntries(Object.entries(feature.properties).filter(([key]) => selectedProperties.has(key)))
          : {}
      }))
    };

    const newLayer: LayerInfo = {
      id: getNextLayerId(), name, visible: true,
      data: filteredGeojson, color: '#ff0000', opacity: 0.7, type: 'geojson',
      sourceType,
    };
    setLayers(prev => [...prev, newLayer]);

    const bounds = calculateBounds(filteredGeojson);
    if (bounds && isFinite(bounds.minLat) && isFinite(bounds.maxLat) && isFinite(bounds.minLng) && isFinite(bounds.maxLng)) {
      const centerLat = (bounds.minLat + bounds.maxLat) / 2;
      const centerLng = (bounds.minLng + bounds.maxLng) / 2;
      const maxDiff = Math.max(bounds.maxLat - bounds.minLat, bounds.maxLng - bounds.minLng);
      const zoom = maxDiff > 0 ? Math.min(20, Math.max(3, -Math.log2(maxDiff * 2.5))) : 10;
      setViewState({ latitude: centerLat, longitude: centerLng, zoom });
    }
  };

  // ---- Config handling ----
  const handleConfigFile = useCallback(async (file: File) => {
    setShowAddDataModal(false);
    try {
      const text = await file.text();
      const config: MapConfiguration = JSON.parse(text);
      if (!config.version) throw new Error('Invalid configuration file');

      setLayers([]);
      setActiveFilters({});
      setSelectedFeature(null);
      setSelectedColumns([]);
      setViewState(config.viewState);
      setMapStyle(config.basemap);

      const importedIds = config.layers.map(() => getNextLayerId());
      const newFilters: {[layerId: number]: { fn: (item: any) => boolean, info: FilterInfo }[]} = {};

      config.layers.forEach((layerConfig, index) => {
        if (layerConfig.filters && layerConfig.filters.length > 0) {
          newFilters[importedIds[index]] = layerConfig.filters.map(filterInfo => ({
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
                  return filterInfo.value.values.some(v => strValue.includes(v.toLowerCase()));
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

      const newLayers = config.layers.map((layerConfig, index) => ({
        id: importedIds[index],
        name: layerConfig.name,
        type: layerConfig.type,
        visible: layerConfig.visible,
        color: layerConfig.color,
        opacity: layerConfig.opacity,
        pointSize: layerConfig.pointSize,
        columns: layerConfig.columns,
        data: layerConfig.data,
        isExpanded: false,
        colorMapping: layerConfig.colorMapping,
        sizeMapping: layerConfig.sizeMapping
      }));
      setLayers(newLayers);
    } catch (error) {
      console.error('Error importing configuration:', error);
      alert('Error importing configuration file');
    }
  }, [getNextLayerId]);

  const exportConfiguration = () => {
    const config: MapConfiguration = {
      version: "1.0.0",
      viewState,
      basemap: mapStyle,
      layers: layers.map(layer => ({
        name: layer.name, type: layer.type, visible: layer.visible,
        color: layer.color, opacity: layer.opacity, pointSize: layer.pointSize,
        columns: layer.columns, data: layer.data,
        filters: activeFilters[layer.id]?.map(filter => filter.info),
        selectedProperties: layer.type === 'geojson'
          ? Object.keys(layer.data.features[0]?.properties || {})
          : Object.keys(layer.data[0]?.properties || {}),
        colorMapping: layer.colorMapping, sizeMapping: layer.sizeMapping
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

  // ---- Layer management ----
  const toggleLayer = (layerId: number) => {
    setLayers(prev => prev.map(l => l.id === layerId ? { ...l, visible: !l.visible } : l));
  };

  const removeLayer = (layerId: number) => {
    setLayers(prev => prev.filter(l => l.id !== layerId));
    setSelectedFeature(null);
    setSelectedColumns([]);
    setActiveFilters(prev => {
      const newFilters = { ...prev };
      delete newFilters[layerId];
      return newFilters;
    });
    if (showFilterModal === layerId) setShowFilterModal(null);
  };

  const updateLayerColor = (layerId: number, color: string) => {
    setLayers(prev => prev.map(l => l.id === layerId ? { ...l, color } : l));
  };

  const updateLayerOpacity = (layerId: number, opacity: number) => {
    setLayers(prev => prev.map(l => l.id === layerId ? { ...l, opacity } : l));
  };

  const updateLayerPointSize = (layerId: number, size: number) => {
    setLayers(prev => prev.map(l => l.id === layerId ? { ...l, pointSize: size } : l));
  };

  const renameLayer = (layerId: number, newName: string) => {
    setLayers(prev => prev.map(l => l.id === layerId ? { ...l, name: newName } : l));
  };

  const toggleLayerExpanded = (layerId: number) => {
    setLayers(prev => prev.map(l => l.id === layerId ? { ...l, isExpanded: !l.isExpanded } : l));
  };

  const updateLayerColorMapping = (layerId: number, colorMapping: NonNullable<LayerInfo['colorMapping']>) => {
    setLayers(prev => prev.map(layer => {
      if (layer.id === layerId) {
        if (colorMapping.column) {
          const values = getNumericValuesForColumn(layer, colorMapping.column, activeFilters);
          const numericValues = values.map(v => typeof v === 'string' ? parseFloat(v) : v).filter(v => !isNaN(v)).sort((a, b) => a - b);
          const breaks = [];
          for (let i = 1; i < colorMapping.numClasses; i++) {
            breaks.push(numericValues[Math.floor((i / colorMapping.numClasses) * numericValues.length)]);
          }
          colorMapping.breaks = breaks;
          colorMapping.colorScale = colorMapping.colorScale || 'YlOrRd';
        }
        return { ...layer, colorMapping: { ...colorMapping } };
      }
      return layer;
    }));
  };

  const clearLayerColorMapping = (layerId: number) => {
    setLayers(prev => prev.map(l => l.id === layerId ? { ...l, colorMapping: undefined } : l));
  };

  const updateLayerSizeMapping = (layerId: number, sizeMapping: NonNullable<LayerInfo['sizeMapping']>) => {
    setLayers(prev => prev.map(layer => {
      if (layer.id === layerId) {
        if (sizeMapping.column) {
          const values = getNumericValuesForColumn(layer, sizeMapping.column, activeFilters);
          const numericValues = values.map(v => typeof v === 'string' ? parseFloat(v) : v).filter(v => !isNaN(v)).sort((a, b) => a - b);
          const breaks = [];
          for (let i = 1; i < sizeMapping.numClasses; i++) {
            breaks.push(numericValues[Math.floor((i / sizeMapping.numClasses) * numericValues.length)]);
          }
          sizeMapping.breaks = breaks;
        }
        return { ...layer, sizeMapping: { ...sizeMapping } };
      }
      return layer;
    }));
  };

  const clearLayerSizeMapping = (layerId: number) => {
    setLayers(prev => prev.map(l => l.id === layerId ? { ...l, sizeMapping: undefined } : l));
  };

  // ---- Filters ----
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

  // ---- Feature selection ----
  const areFeaturesEqual = (feature1: Feature | null, feature2: Feature | null): boolean => {
    if (!feature1 || !feature2) return false;
    if (feature1.geometry.type !== feature2.geometry.type) return false;
    if (feature1.geometry.type === 'Point' && feature2.geometry.type === 'Point') {
      return JSON.stringify(feature1.geometry.coordinates) === JSON.stringify(feature2.geometry.coordinates);
    }
    if (feature1.geometry.type === 'Polygon' && feature2.geometry.type === 'Polygon') {
      return JSON.stringify(feature1.geometry.coordinates) === JSON.stringify(feature2.geometry.coordinates);
    }
    return JSON.stringify(feature1.properties) === JSON.stringify(feature2.properties);
  };

  // ---- SQL Add Layer ----
  const handleSQLAddLayer = useCallback((name: string, geojson: FeatureCollection) => {
    addGeoJSONLayer(geojson, new Set(Object.keys(geojson.features[0]?.properties || {})), name);
  }, []);

  // Use refs for hover feature to avoid re-rendering deck.gl layers on every mouse move
  const selectedFeatureRef = useRef<Feature | null>(null);
  selectedFeatureRef.current = selectedFeature;
  const isFeatureLockedRef = useRef(false);
  isFeatureLockedRef.current = isFeatureLocked;

  // ---- Render deck.gl layers ----
  const deckLayers = React.useMemo(() => {
    const getGeometryKey = (geometry: Geometry): string => {
      if ('coordinates' in geometry) return JSON.stringify(geometry.coordinates);
      if (geometry.type === 'GeometryCollection') return JSON.stringify(geometry.geometries.map(g => getGeometryKey(g)));
      return '';
    };

    return layers.filter(layer => layer.visible).map((layer: LayerInfo) => {
      const [r, g, b] = hexToRGB(layer.color);

      if (layer.type === 'h3') {
        const filteredData = activeFilters[layer.id]?.length > 0
          ? layer.data.filter((item: any) => activeFilters[layer.id].every(filter => filter.fn({ properties: item.properties })))
          : layer.data;

        return new H3HexagonLayer({
          id: `h3-layer-${layer.id}`,
          data: filteredData,
          pickable: true, wireframe: true, filled: true, extruded: false,
          getHexagon: (d: any) => d.hex,
          getFillColor: (d: any) => {
            if (layer.colorMapping?.column) {
              const value = d.properties[layer.colorMapping.column];
              const numericValue = typeof value === 'string' ? parseFloat(value) : value;
              if (!isNaN(numericValue)) {
                const [cr, cg, cb] = getColorForValue(numericValue, layer.color, layer.colorMapping);
                return [cr, cg, cb, Math.round(layer.opacity * 255)] as [number, number, number, number];
              }
            }
            return [r, g, b, Math.round(layer.opacity * 255)] as [number, number, number, number];
          },
          getLineColor: [255, 255, 255] as [number, number, number],
          lineWidthMinPixels: 1,
          opacity: layer.opacity,
          updateTriggers: {
            getFillColor: [layer.id, layer.color, layer.opacity, layer.colorMapping?.column, layer.colorMapping?.breaks.join(',')]
          },
          onClick: (info: any) => {
            if (info.object) {
              const hexBoundary = h3.cellToBoundary(info.object.hex).map(([lat, lng]: [number, number]) => [lng, lat]);
              const feature = { type: 'Feature', geometry: { type: 'Polygon', coordinates: [hexBoundary] }, properties: info.object.properties } as Feature;
              if (isFeatureLockedRef.current && selectedFeatureRef.current?.geometry.type === 'Polygon' && JSON.stringify(selectedFeatureRef.current.geometry.coordinates) === JSON.stringify([hexBoundary])) {
                setIsFeatureLocked(false); setSelectedFeature(null);
              } else {
                setSelectedFeature(feature); setIsFeatureLocked(true);
              }
            }
          },
          onHover: (info: any) => {
            if (!isFeatureLockedRef.current && info.object) {
              setSelectedFeature({ type: 'Feature', geometry: { type: 'Polygon', coordinates: [h3.cellToBoundary(info.object.hex).map(([lat, lng]: [number, number]) => [lng, lat])] }, properties: info.object.properties } as Feature);
            } else if (!isFeatureLockedRef.current) {
              setSelectedFeature(null);
            }
          }
        });
      } else if (layer.type === 'point') {
        const filteredData = activeFilters[layer.id]?.length > 0
          ? layer.data.filter((item: any) => activeFilters[layer.id].every(filter => filter.fn(item)))
          : layer.data;

        return new ScatterplotLayer({
          id: `point-layer-${layer.id}`,
          data: filteredData,
          getPosition: (d: any) => d.position,
          getFillColor: (d: any) => {
            if (layer.colorMapping?.column) {
              const value = d.properties[layer.colorMapping.column];
              const numericValue = typeof value === 'string' ? parseFloat(value) : value;
              if (!isNaN(numericValue)) {
                const [cr, cg, cb] = getColorForValue(numericValue, layer.color, layer.colorMapping);
                return [cr, cg, cb, Math.round(layer.opacity * 255)] as [number, number, number, number];
              }
            }
            return [r, g, b, Math.round(layer.opacity * 255)] as [number, number, number, number];
          },
          getRadius: (d: any) => {
            if (layer.sizeMapping?.column) {
              const value = d.properties[layer.sizeMapping.column];
              const numericValue = typeof value === 'string' ? parseFloat(value) : value;
              return !isNaN(numericValue) ? getSizeForValue(numericValue, layer.sizeMapping) : (layer.pointSize || 5);
            }
            return layer.pointSize || 5;
          },
          radiusScale: 1, radiusUnits: "pixels" as const, radiusMinPixels: 1, radiusMaxPixels: 50, pickable: true,
          autoHighlight: true,
          highlightColor: [r, g, b, 255],
          updateTriggers: {
            getRadius: [layer.id, layer.pointSize, layer.sizeMapping?.column, layer.sizeMapping?.breaks.join(',')],
            getFillColor: [layer.id, layer.color, layer.opacity, layer.colorMapping?.column, layer.colorMapping?.breaks.join(',')]
          },
          onClick: (info: any) => {
            if (info.object) {
              const feature = { type: 'Feature', geometry: { type: 'Point', coordinates: info.object.position }, properties: info.object.properties } as Feature;
              if (isFeatureLockedRef.current && selectedFeatureRef.current?.geometry.type === 'Point' && JSON.stringify(selectedFeatureRef.current.geometry.coordinates) === JSON.stringify(info.object.position)) {
                setIsFeatureLocked(false); setSelectedFeature(null);
              } else {
                setSelectedFeature(feature); setIsFeatureLocked(true);
              }
            }
          },
          onHover: (info: any) => {
            if (!isFeatureLockedRef.current && info.object) {
              setSelectedFeature({ type: 'Feature', geometry: { type: 'Point', coordinates: info.object.position }, properties: info.object.properties } as Feature);
            } else if (!isFeatureLockedRef.current) { setSelectedFeature(null); }
          }
        });
      }

      // GeoJSON layer
      const filteredData = activeFilters[layer.id]?.length > 0
        ? { ...layer.data, features: layer.data.features.filter((item: Feature) => activeFilters[layer.id].every(filter => filter.fn(item))) }
        : layer.data;

      return new GeoJsonLayer({
        id: `geojson-layer-${layer.id}`,
        data: filteredData,
        _normalize: false,
        filled: true, stroked: true, lineWidthUnits: "pixels" as const, lineWidthMinPixels: 1,
        pointRadiusUnits: "pixels" as const,
        getPointRadius: layer.pointSize || 5,
        getFillColor: (d: Feature) => {
          const alpha = Math.round(layer.opacity * 128);
          if (layer.colorMapping?.column) {
            const value = d.properties?.[layer.colorMapping.column];
            if (typeof value === 'number') {
              const [cr, cg, cb] = getColorForValue(value, layer.color, layer.colorMapping);
              return [cr, cg, cb, alpha] as [number, number, number, number];
            }
          }
          return [r, g, b, alpha] as [number, number, number, number];
        },
        getLineColor: [r, g, b, 255] as [number, number, number, number],
        pickable: true,
        autoHighlight: true,
        highlightColor: [r, g, b, Math.round(layer.opacity * 255)],
        updateTriggers: {
          getFillColor: [layer.id, layer.color, layer.opacity, layer.colorMapping?.column, layer.colorMapping?.breaks.join(',')],
          getPointRadius: [layer.pointSize],
        },
        onClick: (info: any) => {
          if (info.object) {
            if (isFeatureLockedRef.current && areFeaturesEqual(info.object, selectedFeatureRef.current)) {
              setIsFeatureLocked(false); setSelectedFeature(null);
            } else {
              setSelectedFeature(info.object); setIsFeatureLocked(true);
            }
          }
        },
        onHover: (info: any) => {
          if (!isFeatureLockedRef.current && info.object) setSelectedFeature(info.object);
          else if (!isFeatureLockedRef.current) setSelectedFeature(null);
        }
      });
    });
  }, [layers, activeFilters]);

  return (
    <div className="fixed inset-0">
      {/* Add Data button */}
      <div className="absolute top-4 left-4 z-10">
        <div className="bg-white rounded-lg shadow-lg">
          <button
            onClick={() => setShowAddDataModal(true)}
            className="w-full p-3 flex items-center justify-center hover:bg-gray-50 rounded-lg transition-colors"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
          </button>
        </div>
      </div>

      {/* Add Data Modal */}
      <AddDataModal
        isOpen={showAddDataModal}
        onClose={() => setShowAddDataModal(false)}
        onGeoJSONFile={handleGeoJSONFile}
        onCSVFile={handleCSVFile}
        onShapefileFile={handleShapefileFile}
        onParquetFile={handleParquetFile}
        onConfigFile={handleConfigFile}
        onExport={exportConfiguration}
        isLoading={isLoading}
        hasLayers={layers.length > 0}
      />

      {/* Loading overlay */}
      {isLoading && (
        <div className="absolute inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg px-8 py-4">
            <p className="text-lg font-medium text-gray-700">Processing... {Math.round(loadingProgress)}%</p>
          </div>
        </div>
      )}

      {/* Feature Properties Panel */}
      {selectedFeature && (
        <FeaturePropertiesPanel
          selectedFeature={selectedFeature}
          isLocked={isFeatureLocked}
          selectedColumns={selectedColumns}
          allAvailableColumns={allAvailableColumns}
          onClose={() => { setSelectedFeature(null); setIsFeatureLocked(false); }}
          onColumnToggle={handleColumnToggle}
        />
      )}

      {/* Bottom-left buttons: Layers + SQL */}
      <div className="absolute bottom-4 left-4 z-10">
        <div className="flex space-x-2">
          <button
            onClick={() => setShowLayers(!showLayers)}
            className={`p-2 rounded-lg shadow-lg transition-colors ${showLayers ? 'bg-blue-50 text-blue-600' : 'bg-white text-gray-600 hover:bg-gray-50'}`}
            title={showLayers ? "Hide Layers" : "Show Layers"}
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
            </svg>
          </button>
          <button
            onClick={() => setShowSQLEditor(!showSQLEditor)}
            className={`p-2 rounded-lg shadow-lg transition-colors ${showSQLEditor ? 'bg-blue-50 text-blue-600' : 'bg-white text-gray-600 hover:bg-gray-50'}`}
            title={showSQLEditor ? "Hide SQL Editor" : "Show SQL Editor"}
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4m0 5c0 2.21-3.582 4-8 4s-8-1.79-8-4" />
            </svg>
          </button>
        </div>
      </div>

      {/* Layers Panel */}
      {showLayers && (
        <div className="absolute bottom-16 left-4 z-10 bg-white rounded-lg shadow-lg p-4 max-w-md max-h-[60vh] overflow-y-auto">
          <h3 className="text-sm font-medium text-gray-900 mb-2">Layers</h3>
          <LayersPanel
            layers={layers}
            onToggle={toggleLayer}
            onRemove={removeLayer}
            onToggleExpanded={toggleLayerExpanded}
            onUpdateColor={updateLayerColor}
            onUpdateOpacity={updateLayerOpacity}
            onUpdatePointSize={updateLayerPointSize}
            onUpdateColorMapping={updateLayerColorMapping}
            onClearColorMapping={clearLayerColorMapping}
            onUpdateSizeMapping={updateLayerSizeMapping}
            onClearSizeMapping={clearLayerSizeMapping}
            onOpenFilter={(layerId) => setShowFilterModal(layerId)}
            onRename={renameLayer}
          />
        </div>
      )}

      {/* Filter Modal */}
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
              const wrappedFilter = (item: any) => layer.type === 'h3' ? filter(item.properties) : filter(item);
              handleApplyFilter(showFilterModal, wrappedFilter, filterInfo);
            }
          }
          setShowFilterModal(null);
        }}
        activeFilters={showFilterModal !== null ? (activeFilters[showFilterModal]?.map(f => f.info) || []) : []}
        onRemoveFilter={(index) => showFilterModal !== null && handleRemoveFilter(showFilterModal, index)}
        layerType={layers.find(l => l.id === showFilterModal)?.type}
      />

      {/* Map */}
      <DeckGL
        style={{ width: '100%', height: '100%' }}
        viewState={viewState}
        onViewStateChange={({ viewState }) => {
          if ('latitude' in viewState && 'longitude' in viewState && 'zoom' in viewState) {
            setViewState(viewState as MapViewState);
          }
        }}
        controller={true}
        layers={deckLayers}
      >
        <Map mapStyle={mapStyle as any} />
      </DeckGL>

      {/* Legends */}
      <LegendDisplay layers={layers} />

      {/* Basemap Selector */}
      <BasemapSelector mapStyle={mapStyle} onSelect={setMapStyle} />

      {/* Author attribution */}
      <div className="absolute bottom-8 right-4 z-50 flex items-center space-x-4 text-sm text-gray-600">
        <div className="flex items-center space-x-2">
          <span>Boyang Sa</span>
          <a href="https://boyangsa.com" target="_blank" rel="noopener noreferrer" className="text-gray-600 hover:text-gray-900" title="Personal Website">
            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9" />
            </svg>
          </a>
          <a href="https://github.com/bobsa514/mapviewer-gl" target="_blank" rel="noopener noreferrer" className="text-gray-600 hover:text-gray-900" title="GitHub">
            <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
              <path fillRule="evenodd" clipRule="evenodd" d="M12 2C6.477 2 2 6.477 2 12c0 4.42 2.865 8.17 6.839 9.49.5.092.682-.217.682-.482 0-.237-.008-.866-.013-1.7-2.782.604-3.369-1.34-3.369-1.34-.454-1.156-1.11-1.464-1.11-1.464-.908-.62.069-.608.069-.608 1.003.07 1.531 1.03 1.531 1.03.892 1.529 2.341 1.087 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.11-4.555-4.943 0-1.091.39-1.984 1.029-2.683-.103-.253-.446-1.27.098-2.647 0 0 .84-.269 2.75 1.025A9.578 9.578 0 0112 6.836c.85.004 1.705.114 2.504.336 1.909-1.294 2.747-1.025 2.747-1.025.546 1.377.203 2.394.1 2.647.64.699 1.028 1.592 1.028 2.683 0 3.842-2.339 4.687-4.566 4.935.359.309.678.919.678 1.852 0 1.336-.012 2.415-.012 2.743 0 .267.18.578.688.48C19.138 20.167 22 16.418 22 12c0-5.523-4.477-10-10-10z" />
            </svg>
          </a>
        </div>
      </div>

      {/* CSV Preview Modal */}
      {csvPreview && (
        <CSVPreviewModal
          csvPreview={csvPreview}
          onClose={() => { setCsvPreview(null); csvFileRef.current = null; }}
          onToggleColumn={toggleColumnSelection}
          onSelectAll={() => setCsvPreview({ ...csvPreview, selectedColumns: new Set(csvPreview.headers) })}
          onDeselectAll={() => setCsvPreview({ ...csvPreview, selectedColumns: new Set(csvPreview.coordinateColumns) })}
          onProceed={proceedWithSelectedColumns}
        />
      )}

      {/* GeoJSON Preview Modal */}
      {geoJSONPreview && (
        <GeoJSONPreviewModal
          geoJSONPreview={geoJSONPreview}
          onClose={() => { setGeoJSONPreview(null); geojsonFileRef.current = null; pendingGeoJSONRef.current = null; }}
          onToggleProperty={toggleGeoJSONPropertySelection}
          onSelectAll={() => setGeoJSONPreview({ ...geoJSONPreview, selectedProperties: new Set(geoJSONPreview.properties) })}
          onDeselectAll={() => setGeoJSONPreview({ ...geoJSONPreview, selectedProperties: new Set() })}
          onProceed={proceedWithSelectedGeoJSONProperties}
        />
      )}

      {/* SQL Editor */}
      {showSQLEditor && (
        <SQLEditor
          registeredTables={registeredTables}
          duckdbOnlyTables={duckdbOnlyTables}
          onAddLayer={handleSQLAddLayer}
          onDuckDBReady={handleDuckDBReady}
          onClose={() => setShowSQLEditor(false)}
          onRemoveDuckDBOnlyTable={handleRemoveDuckDBOnlyTable}
        />
      )}
    </div>
  );
};

export default MapViewerGL;
