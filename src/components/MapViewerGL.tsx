/**
 * MapViewerGL — main application component.
 *
 * Owns all app state: layers, DuckDB-only tables, filters, map view, modals,
 * and selection. Children (rails, panels, overlays) receive props and emit
 * callbacks — there is no context/global store.
 *
 * Layout (v2.3 redesign):
 *   ┌────────────────────────────────────────────┐
 *   │ Topbar (brand + meta + actions)            │
 *   ├──────────┬────────────────────────┬────────┤
 *   │ Left     │ Map                    │ Right  │
 *   │ rail     │ (deck.gl + controls)   │ rail   │
 *   │ Layers   │ Legend / Basemap       │ Insp.  │
 *   │ + Sym/Fi │ SQL overlay            │        │
 *   └──────────┴────────────────────────┴────────┘
 *
 * Filter UI is a rail panel (not a modal) — toggled by clicking the filter
 * icon on a layer row or by the Style/Filter segmented control.
 */

import React, { useState, useCallback, useRef, useEffect } from 'react';
import DeckGL from '@deck.gl/react';
import { Map } from 'react-map-gl/maplibre';
import { GeoJsonLayer, ScatterplotLayer } from '@deck.gl/layers';
import type { MapViewState } from '@deck.gl/core';
import type { FeatureCollection, Feature } from 'geojson';
import Papa from 'papaparse';
import { H3HexagonLayer } from '@deck.gl/geo-layers';
import * as h3 from 'h3-js';

import type {
  LayerInfo,
  BasemapStyle,
  MapConfiguration,
  CSVPreviewData,
  GeoJSONPreviewData,
  FilterInfo,
  DuckDBOnlyTable,
} from '../types';
import { basemapOptions } from '../types';
import { calculateBounds, hexToRGB, getColorForValue, getSizeForValue } from '../utils/geometry';
import { detectCoordinateColumns, detectH3Column, isValidH3Index, processChunk } from '../utils/csv';
import { getNumericValuesForColumn } from '../utils/layers';
import { sanitizeTableName } from '../utils/tableName';

import { CSVPreviewModal } from './CSVPreviewModal';
import { GeoJSONPreviewModal } from './GeoJSONPreviewModal';
import { BasemapSelector } from './BasemapSelector';
import { LegendDisplay } from './LegendDisplay';
import { LayersPanel } from './LayersPanel';
import { AddDataModal } from './AddDataModal';
import { SQLEditor } from './SQLEditor';
import { useToast, ToastContainer } from './Toast';
import { Topbar } from './Topbar';
import { EmptyState } from './EmptyState';
import { MapControls } from './MapControls';
import { Inspector } from './Inspector';
import { SymbologyPanel } from './SymbologyPanel';
import { FilterPanel } from './FilterPanel';

const DEFAULT_VIEW_STATE: MapViewState = {
  latitude: 39.8283,
  longitude: -98.5795,
  zoom: 3,
};

const parseHashViewState = (): MapViewState => {
  try {
    const hash = window.location.hash.slice(1);
    if (!hash) return DEFAULT_VIEW_STATE;
    const params = new URLSearchParams(hash);
    const lat = parseFloat(params.get('lat') || '');
    const lng = parseFloat(params.get('lng') || '');
    const zoom = parseFloat(params.get('zoom') || '');
    if (isNaN(lat) || isNaN(lng) || isNaN(zoom)) return DEFAULT_VIEW_STATE;
    return { latitude: lat, longitude: lng, zoom };
  } catch {
    return DEFAULT_VIEW_STATE;
  }
};

const INITIAL_VIEW_STATE = parseHashViewState();

const MapViewerGL: React.FC = () => {
  const layerIdCounter = useRef(0);
  const getNextLayerId = useCallback(() => {
    layerIdCounter.current += 1;
    return layerIdCounter.current;
  }, []);

  // --- State ---
  const [layers, setLayers] = useState<LayerInfo[]>([]);
  const [viewState, setViewState] = useState<MapViewState>(INITIAL_VIEW_STATE);
  const [isLoading, setIsLoading] = useState(false);
  const [loadingProgress, setLoadingProgress] = useState(0);
  const [selectedFeature, setSelectedFeature] = useState<Feature | null>(null);
  const [showAddDataModal, setShowAddDataModal] = useState(false);
  const [mapStyle, setMapStyle] = useState<BasemapStyle>(basemapOptions['Carto Light']);
  const [activeFilters, setActiveFilters] = useState<{
    [layerId: number]: { fn: (item: any) => boolean; info: FilterInfo }[];
  }>({});
  const [csvPreview, setCsvPreview] = useState<CSVPreviewData | null>(null);
  const [geoJSONPreview, setGeoJSONPreview] = useState<GeoJSONPreviewData | null>(null);
  const [isFeatureLocked, setIsFeatureLocked] = useState(false);
  const [isDraggingOver, setIsDraggingOver] = useState(false);
  const [hoveredLayerId, setHoveredLayerId] = useState<number | null>(null);

  // New in v2.3: which layer the left rail panels act on, and which panel is showing.
  const [selectedLayerId, setSelectedLayerId] = useState<number | null>(null);
  const [editTarget, setEditTarget] = useState<'style' | 'filter'>('style');

  // DuckDB
  const [registeredTables, setRegisteredTables] = useState<string[]>([]);
  const registeredTablesRef = useRef<string[]>([]);
  const [isDuckDBReady, setIsDuckDBReady] = useState(false);
  const [showSQLEditor, setShowSQLEditor] = useState(false);
  const [duckdbOnlyTables, setDuckdbOnlyTables] = useState<DuckDBOnlyTable[]>([]);

  // Confirmation dialogs
  const [layerToDelete, setLayerToDelete] = useState<number | null>(null);
  const [pendingConfigData, setPendingConfigData] = useState<MapConfiguration | null>(null);

  // File refs (used across async reader callbacks)
  const geojsonFileRef = useRef<File | null>(null);
  const csvFileRef = useRef<File | null>(null);
  const pendingGeoJSONRef = useRef<FeatureCollection | null>(null);
  const pendingGeoJSONNameRef = useRef<string>('shapefile_layer');
  const dragCounterRef = useRef(0);

  const { toasts, addToast, removeToast } = useToast();

  // --- URL hash ↔ view state ---
  const hashUpdateTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (hashUpdateTimer.current) clearTimeout(hashUpdateTimer.current);
    hashUpdateTimer.current = setTimeout(() => {
      const lat = viewState.latitude.toFixed(4);
      const lng = viewState.longitude.toFixed(4);
      const zoom = viewState.zoom.toFixed(2);
      window.history.replaceState(null, '', `#lat=${lat}&lng=${lng}&zoom=${zoom}`);
    }, 300);
    return () => {
      if (hashUpdateTimer.current) clearTimeout(hashUpdateTimer.current);
    };
  }, [viewState]);

  const handleDuckDBReady = useCallback(() => {
    setIsDuckDBReady(true);
  }, []);

  const updateRegisteredTables = useCallback((newTables: string[]) => {
    registeredTablesRef.current = newTables;
    setRegisteredTables(newTables);
  }, []);

  // --- DuckDB layer sync ---
  const layerNamesRef = useRef<string>('');
  const duckdbOnlyNamesRef = useRef<string>('');
  useEffect(() => {
    if (!isDuckDBReady) return;
    const layerNamesKey = layers.map((l) => l.tableName!).sort().join('\0');
    const duckdbNamesKey = duckdbOnlyTables.map((t) => t.tableName).sort().join('\0');
    if (layerNamesKey === layerNamesRef.current && duckdbNamesKey === duckdbOnlyNamesRef.current) return;
    layerNamesRef.current = layerNamesKey;
    duckdbOnlyNamesRef.current = duckdbNamesKey;

    const syncTables = async () => {
      try {
        const { registerLayer, unregisterLayer } = await import('../utils/duckdb');
        const duckdbOnlyNames = duckdbOnlyTables.map((t) => t.tableName);
        const layersToRegister = layers.filter((l) => l.sourceType !== 'parquet');
        const currentLayerTableNames = layersToRegister.map((l) => l.tableName!);
        const parquetLayerTableNames = layers.filter((l) => l.sourceType === 'parquet').map((l) => l.tableName!);
        const allCurrentTableNames = [...currentLayerTableNames, ...parquetLayerTableNames, ...duckdbOnlyNames];

        for (const layer of layersToRegister) {
          const tableName = layer.tableName!;
          if (!registeredTablesRef.current.includes(tableName)) {
            try {
              await registerLayer(layer, tableName);
            } catch (err) {
              console.warn(`Failed to register table "${tableName}":`, err);
            }
          }
        }

        for (const tableName of registeredTablesRef.current) {
          if (!allCurrentTableNames.includes(tableName)) {
            try {
              await unregisterLayer(tableName);
            } catch {
              // Ignore unregister failures
            }
          }
        }

        updateRegisteredTables(allCurrentTableNames);
      } catch {
        // DuckDB not loaded yet
      }
    };
    syncTables();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [layers, isDuckDBReady, duckdbOnlyTables]);

  // --- Selection bookkeeping ---
  // Keep selected layer id valid when layers change.
  useEffect(() => {
    if (selectedLayerId === null) {
      if (layers.length > 0) setSelectedLayerId(layers[0].id);
      return;
    }
    if (!layers.some((l) => l.id === selectedLayerId)) {
      setSelectedLayerId(layers[0]?.id ?? null);
    }
  }, [layers, selectedLayerId]);

  // --- CSV handling ---
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
        addToast('error', error instanceof Error ? error.message : 'Error parsing CSV file');
        setCsvPreview(null);
      }
    };
    reader.readAsText(file);
    // eslint-disable-next-line react-hooks/exhaustive-deps
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

    if (csvPreview.mode === 'duckdb_only') {
      setIsLoading(true);
      try {
        const { registerPlainCSVTable, initDuckDB } = await import('../utils/duckdb');
        await initDuckDB();
        const { tableName, columns } = await registerPlainCSVTable(file, csvPreview.selectedColumns);
        setDuckdbOnlyTables((prev) => [
          ...prev,
          { tableName, fileName: file.name, sourceType: 'csv', columns },
        ]);
        if (!registeredTablesRef.current.includes(tableName)) {
          updateRegisteredTables([...registeredTablesRef.current, tableName]);
        }
      } catch (error) {
        console.error('Error registering CSV table:', error);
        addToast('error', error instanceof Error ? error.message : 'Error registering CSV table');
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
          const hexagons = rows
            .slice(1)
            .map((row) => {
              const values = row.map((cell) => String(cell).trim());
              const h3Index = values[h3ColumnIndex];
              const properties: Record<string, string> = {};
              headers.forEach((header, index) => {
                if (csvPreview.selectedColumns.has(header) && index !== h3ColumnIndex) {
                  properties[header] = values[index];
                }
              });
              return { hex: h3Index, properties };
            })
            .filter((h) => h.hex && isValidH3Index(h.hex));

          if (hexagons.length === 0) throw new Error('No valid H3 indexes found in the data');

          const newLayer: LayerInfo = {
            id: getNextLayerId(),
            name: file.name,
            visible: true,
            data: hexagons,
            color: '#ff0000',
            opacity: 0.7,
            type: 'h3',
            tableName: sanitizeTableName(file.name),
          };
          setLayers((prev) => [...prev, newLayer]);
          setSelectedLayerId(newLayer.id);

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
          const bounds = { minLat: Infinity, maxLat: -Infinity, minLng: Infinity, maxLng: -Infinity };

          while (currentIndex < rows.length) {
            const { data: chunkData, endIndex } = processChunk(
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
            chunkData.forEach((point) => {
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
            id: getNextLayerId(),
            name: file.name,
            visible: true,
            data: allData,
            color: '#ff0000',
            opacity: 0.7,
            type: 'point',
            columns: coordinates,
            pointSize: 5,
            tableName: sanitizeTableName(file.name),
          };
          setLayers((prev) => [...prev, newLayer]);
          setSelectedLayerId(newLayer.id);
          setViewState({ latitude: centerLat, longitude: centerLng, zoom });
        }
      } catch (error) {
        console.error('Error processing CSV:', error);
        addToast('error', error instanceof Error ? error.message : 'Error processing CSV file');
      } finally {
        setIsLoading(false);
        setLoadingProgress(100);
        setCsvPreview(null);
        csvFileRef.current = null;
      }
    };
    reader.readAsText(file);
  };

  // --- GeoJSON handling ---
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
        geojson.features.forEach((feature) => {
          if (feature.properties) Object.keys(feature.properties).forEach((key) => properties.add(key));
        });
        setGeoJSONPreview({
          properties: Array.from(properties),
          features: geojson.features.slice(0, 10),
          selectedProperties: new Set(properties),
        });
      } catch (error) {
        console.error('Error parsing GeoJSON:', error);
        addToast('error', error instanceof Error ? error.message : 'Error parsing GeoJSON file');
      }
    };
    reader.readAsText(file);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // --- Shapefile handling ---
  const handleShapefileFile = useCallback((file: File) => {
    setShowAddDataModal(false);
    setIsLoading(true);
    setLoadingProgress(0);

    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const { parseShapefile } = await import('../utils/shapefile');
        const geojson = await parseShapefile(e.target?.result as ArrayBuffer);

        pendingGeoJSONRef.current = geojson;
        pendingGeoJSONNameRef.current = file.name.replace(/\.[^.]+$/, '');
        geojsonFileRef.current = null;

        const properties = new Set<string>();
        geojson.features.forEach((feature) => {
          if (feature.properties) Object.keys(feature.properties).forEach((key) => properties.add(key));
        });

        setGeoJSONPreview({
          properties: Array.from(properties),
          features: geojson.features.slice(0, 10),
          selectedProperties: new Set(properties),
        });
      } catch (error) {
        console.error('Error parsing shapefile:', error);
        addToast('error', error instanceof Error ? error.message : 'Error parsing shapefile');
      } finally {
        setIsLoading(false);
        setLoadingProgress(100);
      }
    };
    reader.readAsArrayBuffer(file);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // --- Parquet handling ---
  const handleParquetFile = useCallback(async (file: File) => {
    setShowAddDataModal(false);
    setIsLoading(true);
    try {
      const { initDuckDB, registerParquetFile, extractGeoParquetAsGeoJSON } = await import('../utils/duckdb');
      await initDuckDB();
      const { tableName, geomColumn, geomColumnType, columns } = await registerParquetFile(file);

      if (geomColumn) {
        const fc = await extractGeoParquetAsGeoJSON(tableName, geomColumn, geomColumnType);
        if (fc.features.length === 0) {
          addToast('warning', `No valid geometries found in ${file.name}. Registered as SQL-only table.`);
          setDuckdbOnlyTables((prev) => [
            ...prev,
            { tableName, fileName: file.name, sourceType: 'parquet' as const, columns },
          ]);
          updateRegisteredTables([...registeredTablesRef.current, tableName]);
          setIsLoading(false);
          return;
        }
        addGeoJSONLayer(fc, new Set(Object.keys(fc.features[0]?.properties || {})), file.name, 'parquet', tableName);
        if (!registeredTablesRef.current.includes(tableName)) {
          updateRegisteredTables([...registeredTablesRef.current, tableName]);
        }
      } else {
        setDuckdbOnlyTables((prev) => [
          ...prev,
          { tableName, fileName: file.name, sourceType: 'parquet', columns },
        ]);
        if (!registeredTablesRef.current.includes(tableName)) {
          updateRegisteredTables([...registeredTablesRef.current, tableName]);
        }
      }
    } catch (error) {
      console.error('Error processing Parquet file:', error);
      addToast('error', error instanceof Error ? error.message : 'Error processing Parquet file');
    } finally {
      setIsLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleRemoveDuckDBOnlyTable = useCallback(async (tableName: string) => {
    try {
      const { unregisterLayer } = await import('../utils/duckdb');
      await unregisterLayer(tableName);
    } catch {
      // Ignore if DuckDB not ready
    }
    setDuckdbOnlyTables((prev) => prev.filter((t) => t.tableName !== tableName));
    updateRegisteredTables(registeredTablesRef.current.filter((t) => t !== tableName));
    // eslint-disable-next-line react-hooks/exhaustive-deps
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

    if (pendingGeoJSONRef.current) {
      addGeoJSONLayer(
        pendingGeoJSONRef.current,
        geoJSONPreview.selectedProperties,
        pendingGeoJSONNameRef.current,
        'shapefile'
      );
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
        addToast('error', error instanceof Error ? error.message : 'Error processing GeoJSON file');
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

  const addGeoJSONLayer = (
    geojson: FeatureCollection,
    selectedProperties: Set<string>,
    name: string,
    sourceType?: LayerInfo['sourceType'],
    existingTableName?: string
  ) => {
    const tableName = existingTableName || sanitizeTableName(name);

    const filteredGeojson: FeatureCollection = {
      ...geojson,
      features: geojson.features.map((feature) => ({
        ...feature,
        properties: feature.properties
          ? Object.fromEntries(
              Object.entries(feature.properties).filter(([key]) => selectedProperties.has(key))
            )
          : {},
      })),
    };

    const newLayer: LayerInfo = {
      id: getNextLayerId(),
      name,
      visible: true,
      data: filteredGeojson,
      color: '#ff0000',
      opacity: 0.7,
      type: 'geojson',
      sourceType,
      tableName,
    };
    setLayers((prev) => [...prev, newLayer]);
    setSelectedLayerId(newLayer.id);

    const bounds = calculateBounds(filteredGeojson);
    if (bounds && isFinite(bounds.minLat) && isFinite(bounds.maxLat) && isFinite(bounds.minLng) && isFinite(bounds.maxLng)) {
      const centerLat = (bounds.minLat + bounds.maxLat) / 2;
      const centerLng = (bounds.minLng + bounds.maxLng) / 2;
      const maxDiff = Math.max(bounds.maxLat - bounds.minLat, bounds.maxLng - bounds.minLng);
      const zoom = maxDiff > 0 ? Math.min(20, Math.max(3, -Math.log2(maxDiff * 2.5))) : 10;
      setViewState({ latitude: centerLat, longitude: centerLng, zoom });
    }
  };

  // --- Config import/export ---
  const applyConfig = useCallback(
    (config: MapConfiguration) => {
      setLayers([]);
      setActiveFilters({});
      setSelectedFeature(null);
      setViewState(config.viewState);
      setMapStyle(config.basemap);

      const importedIds = config.layers.map(() => getNextLayerId());
      const newFilters: typeof activeFilters = {};

      config.layers.forEach((layerConfig, index) => {
        if (layerConfig.filters && layerConfig.filters.length > 0) {
          newFilters[importedIds[index]] = layerConfig.filters.map((filterInfo) => ({
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
                  return filterInfo.value.values.some((v) => strValue.includes(v.toLowerCase()));
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
            info: filterInfo,
          }));
        }
      });
      setActiveFilters(newFilters);

      const newLayers: LayerInfo[] = config.layers.map((layerConfig, index) => ({
        id: importedIds[index],
        name: layerConfig.name,
        type: layerConfig.type,
        visible: layerConfig.visible,
        color: layerConfig.color,
        opacity: layerConfig.opacity,
        pointSize: layerConfig.pointSize,
        columns: layerConfig.columns,
        data: layerConfig.data,
        colorMapping: layerConfig.colorMapping,
        sizeMapping: layerConfig.sizeMapping,
      }));
      setLayers(newLayers);
      setSelectedLayerId(newLayers[0]?.id ?? null);
    },
    [getNextLayerId]
  );

  const handleConfigFile = useCallback(
    async (file: File) => {
      setShowAddDataModal(false);
      try {
        const text = await file.text();
        const config: MapConfiguration = JSON.parse(text);
        if (!config.version) throw new Error('Invalid configuration file');

        if (layers.length > 0) {
          setPendingConfigData(config);
          return;
        }

        applyConfig(config);
      } catch (error) {
        console.error('Error importing configuration:', error);
        addToast('error', 'Error importing configuration file');
      }
    },
    [layers.length, applyConfig, addToast]
  );

  const exportConfiguration = useCallback(() => {
    const config: MapConfiguration = {
      version: '2.3.0',
      viewState,
      basemap: mapStyle,
      layers: layers.map((layer) => ({
        name: layer.name,
        type: layer.type,
        visible: layer.visible,
        color: layer.color,
        opacity: layer.opacity,
        pointSize: layer.pointSize,
        columns: layer.columns,
        data: layer.data,
        filters: activeFilters[layer.id]?.map((filter) => filter.info),
        selectedProperties:
          layer.type === 'geojson'
            ? Object.keys(layer.data.features[0]?.properties || {})
            : Object.keys(layer.data[0]?.properties || {}),
        colorMapping: layer.colorMapping,
        sizeMapping: layer.sizeMapping,
      })),
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
    addToast('success', 'Session exported');
  }, [viewState, mapStyle, layers, activeFilters, addToast]);

  // --- Layer management ---
  const toggleLayer = (layerId: number) =>
    setLayers((prev) => prev.map((l) => (l.id === layerId ? { ...l, visible: !l.visible } : l)));

  const removeLayer = (layerId: number) => {
    setLayers((prev) => prev.filter((l) => l.id !== layerId));
    setSelectedFeature(null);
    setActiveFilters((prev) => {
      const newFilters = { ...prev };
      delete newFilters[layerId];
      return newFilters;
    });
    if (selectedLayerId === layerId) setSelectedLayerId(null);
  };

  const updateLayerColor = (layerId: number, color: string) =>
    setLayers((prev) => prev.map((l) => (l.id === layerId ? { ...l, color } : l)));

  const updateLayerOpacity = (layerId: number, opacity: number) =>
    setLayers((prev) => prev.map((l) => (l.id === layerId ? { ...l, opacity } : l)));

  const updateLayerPointSize = (layerId: number, size: number) =>
    setLayers((prev) => prev.map((l) => (l.id === layerId ? { ...l, pointSize: size } : l)));

  const renameLayer = (layerId: number, newName: string) =>
    setLayers((prev) => prev.map((l) => (l.id === layerId ? { ...l, name: newName } : l)));

  const reorderLayers = useCallback((fromIndex: number, toIndex: number) => {
    setLayers((prev) => {
      const updated = [...prev];
      const [moved] = updated.splice(fromIndex, 1);
      updated.splice(toIndex, 0, moved);
      return updated;
    });
  }, []);

  const updateLayerColorMapping = (
    layerId: number,
    colorMapping: NonNullable<LayerInfo['colorMapping']>
  ) => {
    setLayers((prev) =>
      prev.map((layer) => {
        if (layer.id === layerId) {
          if (colorMapping.column) {
            const values = getNumericValuesForColumn(layer, colorMapping.column, activeFilters);
            const numericValues = values
              .map((v) => (typeof v === 'string' ? parseFloat(v) : v))
              .filter((v) => !isNaN(v))
              .sort((a, b) => a - b);
            const breaks: number[] = [];
            for (let i = 1; i < colorMapping.numClasses; i++) {
              breaks.push(numericValues[Math.floor((i / colorMapping.numClasses) * numericValues.length)]);
            }
            colorMapping.breaks = breaks;
            colorMapping.colorScale = colorMapping.colorScale || 'YlOrRd';
          }
          return { ...layer, colorMapping: { ...colorMapping } };
        }
        return layer;
      })
    );
  };

  const clearLayerColorMapping = (layerId: number) =>
    setLayers((prev) => prev.map((l) => (l.id === layerId ? { ...l, colorMapping: undefined } : l)));

  // --- Filters ---
  const handleApplyFilter = (
    layerId: number,
    filter: (item: any) => boolean,
    filterInfo: FilterInfo
  ) => {
    const layer = layers.find((l) => l.id === layerId);
    const wrappedFilter =
      layer?.type === 'h3' ? (item: any) => filter(item.properties ?? item) : filter;
    setActiveFilters((prev) => ({
      ...prev,
      [layerId]: [...(prev[layerId] || []), { fn: wrappedFilter, info: filterInfo }],
    }));
  };

  const handleRemoveFilter = (layerId: number, index: number) => {
    setActiveFilters((prev) => ({
      ...prev,
      [layerId]: prev[layerId]?.filter((_, i) => i !== index) || [],
    }));
  };

  // --- Feature equality ---
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

  // --- SQL Add Layer ---
  const handleSQLAddLayer = useCallback((name: string, geojson: FeatureCollection) => {
    addGeoJSONLayer(geojson, new Set(Object.keys(geojson.features[0]?.properties || {})), name);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // --- Drag-and-drop on main canvas ---
  const handleDragEnter = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounterRef.current++;
    if (e.dataTransfer.types.includes('Files')) setIsDraggingOver(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounterRef.current--;
    if (dragCounterRef.current === 0) setIsDraggingOver(false);
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setIsDraggingOver(false);
      dragCounterRef.current = 0;

      const files = Array.from(e.dataTransfer.files);
      if (files.length === 0) return;

      for (const file of files) {
        const ext = file.name.toLowerCase().split('.').pop();
        switch (ext) {
          case 'geojson':
          case 'json':
            handleGeoJSONFile(file);
            break;
          case 'csv':
            handleCSVFile(file);
            break;
          case 'zip':
            handleShapefileFile(file);
            break;
          case 'parquet':
            handleParquetFile(file);
            break;
          default:
            addToast('error', `Unsupported file format: .${ext}`);
        }
      }
    },
    [handleGeoJSONFile, handleCSVFile, handleShapefileFile, handleParquetFile, addToast]
  );

  // Refs for hover feature (prevents deck.gl layer re-creation on every mouse move)
  const selectedFeatureRef = useRef<Feature | null>(null);
  selectedFeatureRef.current = selectedFeature;
  const isFeatureLockedRef = useRef(false);
  isFeatureLockedRef.current = isFeatureLocked;

  // --- deck.gl layers ---
  const deckLayers = React.useMemo(() => {
    return layers
      .filter((layer) => layer.visible)
      .map((layer: LayerInfo) => {
        const [r, g, b] = hexToRGB(layer.color);

        if (layer.type === 'h3') {
          const filteredData =
            activeFilters[layer.id]?.length > 0
              ? layer.data.filter((item: any) =>
                  activeFilters[layer.id].every((filter) => filter.fn({ properties: item.properties }))
                )
              : layer.data;

          return new H3HexagonLayer({
            id: `h3-layer-${layer.id}`,
            data: filteredData,
            pickable: true,
            wireframe: true,
            filled: true,
            extruded: false,
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
              getFillColor: [
                layer.id,
                layer.color,
                layer.opacity,
                layer.colorMapping?.column,
                layer.colorMapping?.breaks.join(','),
              ],
            },
            onClick: (info: any) => {
              if (info.object) {
                const hexBoundary = h3
                  .cellToBoundary(info.object.hex)
                  .map(([lat, lng]: [number, number]) => [lng, lat]);
                const feature = {
                  type: 'Feature',
                  geometry: { type: 'Polygon', coordinates: [hexBoundary] },
                  properties: info.object.properties,
                } as Feature;
                if (
                  isFeatureLockedRef.current &&
                  selectedFeatureRef.current?.geometry.type === 'Polygon' &&
                  JSON.stringify(selectedFeatureRef.current.geometry.coordinates) === JSON.stringify([hexBoundary])
                ) {
                  setIsFeatureLocked(false);
                  setSelectedFeature(null);
                } else {
                  setSelectedFeature(feature);
                  setIsFeatureLocked(true);
                  setHoveredLayerId(layer.id);
                }
              }
            },
            onHover: (info: any) => {
              if (!isFeatureLockedRef.current) {
                if (info.object) {
                  const currentProps = selectedFeatureRef.current?.properties;
                  const newProps = info.object.properties;
                  if (currentProps !== newProps) {
                    setSelectedFeature({
                      type: 'Feature',
                      geometry: {
                        type: 'Polygon',
                        coordinates: [
                          h3
                            .cellToBoundary(info.object.hex)
                            .map(([lat, lng]: [number, number]) => [lng, lat]),
                        ],
                      },
                      properties: info.object.properties,
                    } as Feature);
                    setHoveredLayerId(layer.id);
                  }
                } else if (selectedFeatureRef.current) {
                  setSelectedFeature(null);
                  setHoveredLayerId(null);
                }
              }
            },
          });
        } else if (layer.type === 'point') {
          const filteredData =
            activeFilters[layer.id]?.length > 0
              ? layer.data.filter((item: any) => activeFilters[layer.id].every((filter) => filter.fn(item)))
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
                return !isNaN(numericValue)
                  ? getSizeForValue(numericValue, layer.sizeMapping)
                  : layer.pointSize || 5;
              }
              return layer.pointSize || 5;
            },
            radiusScale: 1,
            radiusUnits: 'pixels' as const,
            radiusMinPixels: 1,
            radiusMaxPixels: 50,
            pickable: true,
            autoHighlight: true,
            highlightColor: [r, g, b, 255],
            updateTriggers: {
              getRadius: [
                layer.id,
                layer.pointSize,
                layer.sizeMapping?.column,
                layer.sizeMapping?.breaks.join(','),
              ],
              getFillColor: [
                layer.id,
                layer.color,
                layer.opacity,
                layer.colorMapping?.column,
                layer.colorMapping?.breaks.join(','),
              ],
            },
            onClick: (info: any) => {
              if (info.object) {
                const feature = {
                  type: 'Feature',
                  geometry: { type: 'Point', coordinates: info.object.position },
                  properties: info.object.properties,
                } as Feature;
                if (
                  isFeatureLockedRef.current &&
                  selectedFeatureRef.current?.geometry.type === 'Point' &&
                  JSON.stringify(selectedFeatureRef.current.geometry.coordinates) ===
                    JSON.stringify(info.object.position)
                ) {
                  setIsFeatureLocked(false);
                  setSelectedFeature(null);
                } else {
                  setSelectedFeature(feature);
                  setIsFeatureLocked(true);
                  setHoveredLayerId(layer.id);
                }
              }
            },
            onHover: (info: any) => {
              if (!isFeatureLockedRef.current) {
                if (info.object) {
                  const currentProps = selectedFeatureRef.current?.properties;
                  const newProps = info.object.properties;
                  if (currentProps !== newProps) {
                    setSelectedFeature({
                      type: 'Feature',
                      geometry: { type: 'Point', coordinates: info.object.position },
                      properties: info.object.properties,
                    } as Feature);
                    setHoveredLayerId(layer.id);
                  }
                } else if (selectedFeatureRef.current) {
                  setSelectedFeature(null);
                  setHoveredLayerId(null);
                }
              }
            },
          });
        }

        // GeoJSON
        const filteredData =
          activeFilters[layer.id]?.length > 0
            ? {
                ...layer.data,
                features: layer.data.features.filter((item: Feature) =>
                  activeFilters[layer.id].every((filter) => filter.fn(item))
                ),
              }
            : layer.data;

        return new GeoJsonLayer({
          id: `geojson-layer-${layer.id}`,
          data: filteredData,
          _normalize: false,
          filled: true,
          stroked: true,
          lineWidthUnits: 'pixels' as const,
          lineWidthMinPixels: 1,
          pointRadiusUnits: 'pixels' as const,
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
            getFillColor: [
              layer.id,
              layer.color,
              layer.opacity,
              layer.colorMapping?.column,
              layer.colorMapping?.breaks.join(','),
            ],
            getPointRadius: [layer.pointSize],
          },
          onClick: (info: any) => {
            if (info.object) {
              if (isFeatureLockedRef.current && areFeaturesEqual(info.object, selectedFeatureRef.current)) {
                setIsFeatureLocked(false);
                setSelectedFeature(null);
              } else {
                setSelectedFeature(info.object);
                setIsFeatureLocked(true);
                setHoveredLayerId(layer.id);
              }
            }
          },
          onHover: (info: any) => {
            if (!isFeatureLockedRef.current) {
              if (info.object) {
                if (info.object !== selectedFeatureRef.current) {
                  setSelectedFeature(info.object);
                  setHoveredLayerId(layer.id);
                }
              } else if (selectedFeatureRef.current) {
                setSelectedFeature(null);
                setHoveredLayerId(null);
              }
            }
          },
        });
      });
  }, [layers, activeFilters]);

  // --- Built-in samples ---
  const loadSampleData = async (dataset: 'cities' | 'states' | 'both') => {
    const { sampleCities, sampleStates } = await import('../data/samples');
    if (dataset === 'cities' || dataset === 'both') {
      addGeoJSONLayer(
        sampleCities,
        new Set(Object.keys(sampleCities.features[0]?.properties || {})),
        'US Major Cities'
      );
    }
    if (dataset === 'states' || dataset === 'both') {
      addGeoJSONLayer(
        sampleStates,
        new Set(Object.keys(sampleStates.features[0]?.properties || {})),
        'US States (sample)'
      );
    }
  };

  // --- Topbar action helpers ---
  const copyShareURL = () => {
    navigator.clipboard?.writeText(window.location.href);
    addToast('success', 'View URL copied to clipboard');
  };

  const zoomIn = () => setViewState((prev) => ({ ...prev, zoom: Math.min(20, prev.zoom + 1) }));
  const zoomOut = () => setViewState((prev) => ({ ...prev, zoom: Math.max(0, prev.zoom - 1) }));
  const recenter = () => setViewState(DEFAULT_VIEW_STATE);

  // --- ⌘K keyboard shortcut for SQL ---
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        if (layers.length > 0 || duckdbOnlyTables.length > 0) {
          e.preventDefault();
          setShowSQLEditor((v) => !v);
        }
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [layers.length, duckdbOnlyTables.length]);

  // --- Derived ---
  const hasSession = layers.length > 0 || duckdbOnlyTables.length > 0;
  const selectedLayer = layers.find((l) => l.id === selectedLayerId) ?? null;
  const inspectorLayer = hoveredLayerId !== null ? layers.find((l) => l.id === hoveredLayerId) : null;
  const activeFilterCounts = Object.fromEntries(
    Object.entries(activeFilters).map(([id, filters]) => [Number(id), filters.length])
  );
  const selectedLayerFilters = selectedLayer ? activeFilters[selectedLayer.id] ?? [] : [];

  return (
    <div
      className={`app ${isDraggingOver ? 'drag-over' : ''}`}
      onDragEnter={handleDragEnter}
      onDragLeave={handleDragLeave}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
    >
      <Topbar
        loaded={hasSession}
        layerCount={layers.length}
        latitude={viewState.latitude}
        longitude={viewState.longitude}
        zoom={viewState.zoom}
        onOpenSQL={() => setShowSQLEditor((v) => !v)}
        onShare={copyShareURL}
        onExport={exportConfiguration}
        onAddData={() => setShowAddDataModal(true)}
      />

      {/* Left rail */}
      <aside className="rail-left scroll">
        <LayersPanel
          layers={layers}
          duckdbOnlyTables={duckdbOnlyTables}
          selectedLayerId={selectedLayerId}
          activeFilterCounts={activeFilterCounts}
          onSelect={setSelectedLayerId}
          onToggleVisibility={toggleLayer}
          onRename={renameLayer}
          onRemove={(id) => setLayerToDelete(id)}
          onReorder={reorderLayers}
          onAddData={() => setShowAddDataModal(true)}
          onEditTarget={(id, target) => {
            setSelectedLayerId(id);
            setEditTarget(target);
          }}
          onRemoveDuckDBOnlyTable={handleRemoveDuckDBOnlyTable}
        />

        {selectedLayer && (
          <div className="panel-section">
            <div className="segmented" role="tablist" aria-label="Layer edit target">
              <button
                role="tab"
                aria-selected={editTarget === 'style'}
                className={editTarget === 'style' ? 'active' : ''}
                onClick={() => setEditTarget('style')}
              >
                Style
              </button>
              <button
                role="tab"
                aria-selected={editTarget === 'filter'}
                className={editTarget === 'filter' ? 'active' : ''}
                onClick={() => setEditTarget('filter')}
              >
                Filter{selectedLayerFilters.length > 0 ? ` · ${selectedLayerFilters.length}` : ''}
              </button>
            </div>
          </div>
        )}

        {selectedLayer && editTarget === 'style' && (
          <SymbologyPanel
            layer={selectedLayer}
            onUpdateColor={updateLayerColor}
            onUpdateOpacity={updateLayerOpacity}
            onUpdatePointSize={updateLayerPointSize}
            onUpdateColorMapping={updateLayerColorMapping}
            onClearColorMapping={clearLayerColorMapping}
          />
        )}

        {selectedLayer && editTarget === 'filter' && (
          <FilterPanel
            layer={selectedLayer}
            activeFilters={selectedLayerFilters}
            onApplyFilter={handleApplyFilter}
            onRemoveFilter={handleRemoveFilter}
          />
        )}

        {!selectedLayer && layers.length === 0 && (
          <div className="panel-section muted" style={{ fontSize: 12 }}>
            Add a layer to start styling and filtering.
          </div>
        )}
      </aside>

      {/* Map area */}
      <div className="map-wrap">
        {!hasSession && !isLoading && (
          <EmptyState
            onLoadSample={loadSampleData}
            onAddData={() => setShowAddDataModal(true)}
          />
        )}

        {hasSession && (
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
        )}

        {hasSession && (
          <>
            <MapControls onZoomIn={zoomIn} onZoomOut={zoomOut} onRecenter={recenter} />
            <LegendDisplay layers={layers} />
            <BasemapSelector mapStyle={mapStyle} onSelect={setMapStyle} />
          </>
        )}

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

        {isLoading && (
          <div className="modal-backdrop" style={{ pointerEvents: 'none' }}>
            <div className="modal" style={{ pointerEvents: 'auto', minWidth: 260 }}>
              <h3>Processing<em>…</em></h3>
              <div style={{ height: 6, borderRadius: 999, background: 'var(--bg-sunken)', overflow: 'hidden' }}>
                <div
                  style={{
                    height: '100%',
                    width: `${Math.max(5, Math.round(loadingProgress))}%`,
                    background: 'var(--accent)',
                    transition: 'width 300ms ease',
                  }}
                />
              </div>
              <p className="muted" style={{ fontSize: 12, marginTop: 10, marginBottom: 0 }}>
                {Math.round(loadingProgress)}%
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Right rail */}
      <aside className="rail-right scroll">
        <Inspector
          feature={selectedFeature}
          isPinned={isFeatureLocked}
          layerName={inspectorLayer?.name}
          onTogglePin={() => {
            if (!selectedFeature) return;
            setIsFeatureLocked((v) => !v);
          }}
          onClear={() => {
            setSelectedFeature(null);
            setIsFeatureLocked(false);
            setHoveredLayerId(null);
          }}
        />
      </aside>

      {/* Modals */}
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

      {csvPreview && (
        <CSVPreviewModal
          csvPreview={csvPreview}
          onClose={() => {
            setCsvPreview(null);
            csvFileRef.current = null;
          }}
          onToggleColumn={toggleColumnSelection}
          onSelectAll={() =>
            setCsvPreview({ ...csvPreview, selectedColumns: new Set(csvPreview.headers) })
          }
          onDeselectAll={() =>
            setCsvPreview({ ...csvPreview, selectedColumns: new Set(csvPreview.coordinateColumns) })
          }
          onProceed={proceedWithSelectedColumns}
        />
      )}

      {geoJSONPreview && (
        <GeoJSONPreviewModal
          geoJSONPreview={geoJSONPreview}
          onClose={() => {
            setGeoJSONPreview(null);
            geojsonFileRef.current = null;
            pendingGeoJSONRef.current = null;
          }}
          onToggleProperty={toggleGeoJSONPropertySelection}
          onSelectAll={() =>
            setGeoJSONPreview({
              ...geoJSONPreview,
              selectedProperties: new Set(geoJSONPreview.properties),
            })
          }
          onDeselectAll={() =>
            setGeoJSONPreview({ ...geoJSONPreview, selectedProperties: new Set() })
          }
          onProceed={proceedWithSelectedGeoJSONProperties}
        />
      )}

      {layerToDelete !== null && (
        <div className="modal-backdrop" role="dialog" aria-modal="true" onClick={() => setLayerToDelete(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h3>Remove layer<em>?</em></h3>
            <p>
              Remove &ldquo;{layers.find((l) => l.id === layerToDelete)?.name || 'this layer'}&rdquo;?
              This cannot be undone.
            </p>
            <div className="actions">
              <button className="btn" onClick={() => setLayerToDelete(null)}>
                Cancel
              </button>
              <button
                className="btn primary"
                onClick={() => {
                  removeLayer(layerToDelete);
                  setLayerToDelete(null);
                }}
              >
                Remove
              </button>
            </div>
          </div>
        </div>
      )}

      {pendingConfigData && (
        <div className="modal-backdrop" role="dialog" aria-modal="true" onClick={() => setPendingConfigData(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h3>Import session<em>?</em></h3>
            <p>This will replace all current layers and settings.</p>
            <div className="actions">
              <button className="btn" onClick={() => setPendingConfigData(null)}>
                Cancel
              </button>
              <button
                className="btn accent"
                onClick={() => {
                  applyConfig(pendingConfigData);
                  setPendingConfigData(null);
                }}
              >
                Import
              </button>
            </div>
          </div>
        </div>
      )}

      <ToastContainer toasts={toasts} onRemove={removeToast} />
    </div>
  );
};

export default MapViewerGL;
