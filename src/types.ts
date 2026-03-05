/**
 * Shared type definitions and constants for MapViewer-GL.
 *
 * Central module for all domain types (layers, basemaps, color scales, etc.)
 * used across components and utilities. Extracted from the original monolithic
 * MapViewerGL component to enable code splitting and reuse.
 */

import type { MapViewState } from '@deck.gl/core';
import type { Feature } from 'geojson';
import type { FilterInfo } from './components/FilterModal';

export type { FilterInfo };

/** Available sequential color scale names (ColorBrewer-inspired). */
export type ColorScaleName = 'Reds' | 'Blues' | 'Greens' | 'Greys' | 'YlGnBu' | 'YlOrRd' | 'PuBuGn' | 'RdPu';

/** 5-class sequential color palettes keyed by scale name. */
export const colorScales: Record<ColorScaleName, string[]> = {
  Reds: ['#fee5d9', '#fcae91', '#fb6a4a', '#de2d26', '#a50f15'],
  Blues: ['#eff3ff', '#bdd7e7', '#6baed6', '#3182bd', '#08519c'],
  Greens: ['#edf8e9', '#bae4b3', '#74c476', '#31a354', '#006d2c'],
  Greys: ['#f7f7f7', '#cccccc', '#969696', '#636363', '#252525'],
  YlGnBu: ['#ffffd9', '#c7e9b4', '#7fcdbb', '#41b6c4', '#225ea8'],
  YlOrRd: ['#ffffb2', '#fecc5c', '#fd8d3c', '#f03b20', '#bd0026'],
  PuBuGn: ['#f6eff7', '#bdc9e1', '#67a9cf', '#1c9099', '#016c59'],
  RdPu: ['#feebe2', '#fbb4b9', '#f768a1', '#c51b8a', '#7a0177']
};

/** A table registered in DuckDB without a corresponding map layer. */
export interface DuckDBOnlyTable {
  tableName: string;
  fileName: string;
  sourceType: 'csv' | 'parquet';
  columns: string[];
}

/** Runtime representation of a single data layer on the map. */
export interface LayerInfo {
  id: number;
  name: string;
  type: 'geojson' | 'point' | 'h3';
  data: any;
  visible: boolean;
  sourceType?: 'geojson' | 'csv' | 'shapefile' | 'parquet';
  tableName?: string;
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

/** A basemap style — either a URL string to a MapLibre style JSON or an inline style object. */
export type BasemapStyle = string | object;

/** Built-in basemap choices (free, no API key required). */
export const basemapOptions: Record<string, BasemapStyle> = {
  "OpenStreetMap": {
    version: 8,
    sources: {
      osm: {
        type: 'raster',
        tiles: ['https://tile.openstreetmap.org/{z}/{x}/{y}.png'],
        tileSize: 256,
        attribution: '© OpenStreetMap contributors'
      }
    },
    layers: [{ id: 'osm', type: 'raster', source: 'osm' }]
  },
  "Carto Light": "https://basemaps.cartocdn.com/gl/positron-gl-style/style.json",
  "Carto Dark": "https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json",
};

/** Serializable snapshot of the full map state for import/export. */
export interface MapConfiguration {
  version: string;
  viewState: MapViewState;
  basemap: BasemapStyle;
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

/** Transient state for the CSV column-selection preview modal. */
export interface CSVPreviewData {
  headers: string[];
  rows: string[][];
  selectedColumns: Set<string>;
  coordinateColumns: Set<string>;
  isH3Data: boolean;
  h3Column?: string;
  mode: 'geo' | 'duckdb_only';
}

/** Transient state for the GeoJSON property-selection preview modal. */
export interface GeoJSONPreviewData {
  properties: string[];
  features: Feature[];
  selectedProperties: Set<string>;
}
