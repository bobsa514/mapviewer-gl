/**
 * Layer data inspection utilities for identifying numeric columns
 * (used by color/size symbology) and extracting filtered numeric values.
 */

import type { Feature } from 'geojson';
import type { LayerInfo, FilterInfo } from '../types';

/**
 * Identify columns in a layer that contain predominantly numeric values.
 * A column qualifies if ≥50% of its non-null sample values are parseable as numbers.
 */
export const getNumericColumns = (layer: LayerInfo): string[] => {
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

  const collectPropertyValues = (items: any[], getProps: (item: any) => any) => {
    const propertyValues: { [key: string]: any[] } = {};
    items.forEach(item => {
      const props = getProps(item);
      if (props) {
        Object.entries(props).forEach(([key, value]) => {
          if (!propertyValues[key]) propertyValues[key] = [];
          propertyValues[key].push(value);
        });
      }
    });
    return propertyValues;
  };

  let propertyValues: { [key: string]: any[] } = {};

  if (layer.type === 'geojson' && layer.data.features.length > 0) {
    propertyValues = collectPropertyValues(layer.data.features, (f: Feature) => f.properties);
  } else if (layer.type === 'point' && layer.data.length > 0) {
    propertyValues = collectPropertyValues(layer.data, (d: any) => d.properties);
  } else if (layer.type === 'h3' && layer.data.length > 0) {
    propertyValues = collectPropertyValues(layer.data, (d: any) => d.properties);
  }

  return Object.entries(propertyValues)
    .filter(([_, values]) => hasNumericValues(values))
    .map(([key]) => key);
};

/**
 * Extract numeric values for a specific column from a layer, respecting active filters.
 * Used to compute classification breaks for color/size symbology.
 */
export const getNumericValuesForColumn = (
  layer: LayerInfo,
  column: string,
  activeFilters: { [layerId: number]: { fn: (item: any) => boolean; info: FilterInfo }[] }
): number[] => {
  const getValue = (properties: { [key: string]: any } | null | undefined): number => {
    const value = properties?.[column];
    if (value === null || value === undefined || value === '') return 0;
    if (typeof value === 'string') {
      const parsed = parseFloat(value);
      return isNaN(parsed) ? 0 : parsed;
    }
    return typeof value === 'number' ? value : 0;
  };

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
