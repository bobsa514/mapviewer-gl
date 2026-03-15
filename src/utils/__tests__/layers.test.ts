import { describe, it, expect } from 'vitest';
import { getNumericColumns, getNumericValuesForColumn } from '../layers';
import type { LayerInfo } from '../../types';

const makeGeoJSONLayer = (features: any[]): LayerInfo => ({
  id: 1,
  name: 'test',
  type: 'geojson',
  data: { type: 'FeatureCollection', features },
  visible: true,
  color: '#ff0000',
  opacity: 0.7,
});

describe('getNumericColumns', () => {
  it('identifies numeric columns in geojson layers', () => {
    const layer = makeGeoJSONLayer([
      { type: 'Feature', geometry: { type: 'Point', coordinates: [0, 0] }, properties: { pop: 100, name: 'a', ratio: 0.5 } },
      { type: 'Feature', geometry: { type: 'Point', coordinates: [1, 1] }, properties: { pop: 200, name: 'b', ratio: 0.8 } },
    ]);
    const cols = getNumericColumns(layer);
    expect(cols).toContain('pop');
    expect(cols).toContain('ratio');
    expect(cols).not.toContain('name');
  });

  it('returns empty for non-numeric data', () => {
    const layer = makeGeoJSONLayer([
      { type: 'Feature', geometry: { type: 'Point', coordinates: [0, 0] }, properties: { name: 'a', city: 'b' } },
    ]);
    expect(getNumericColumns(layer)).toEqual([]);
  });

  it('handles empty features', () => {
    const layer = makeGeoJSONLayer([]);
    expect(getNumericColumns(layer)).toEqual([]);
  });
});

describe('getNumericValuesForColumn', () => {
  it('extracts numeric values from geojson layer', () => {
    const layer = makeGeoJSONLayer([
      { type: 'Feature', geometry: { type: 'Point', coordinates: [0, 0] }, properties: { pop: 100 } },
      { type: 'Feature', geometry: { type: 'Point', coordinates: [1, 1] }, properties: { pop: 200 } },
      { type: 'Feature', geometry: { type: 'Point', coordinates: [2, 2] }, properties: { pop: null } },
    ]);
    expect(getNumericValuesForColumn(layer, 'pop', {})).toEqual([100, 200]);
  });

  it('parses string numeric values', () => {
    const layer = makeGeoJSONLayer([
      { type: 'Feature', geometry: { type: 'Point', coordinates: [0, 0] }, properties: { pop: '100' } },
      { type: 'Feature', geometry: { type: 'Point', coordinates: [1, 1] }, properties: { pop: '200' } },
    ]);
    expect(getNumericValuesForColumn(layer, 'pop', {})).toEqual([100, 200]);
  });

  it('respects active filters', () => {
    const layer = makeGeoJSONLayer([
      { type: 'Feature', geometry: { type: 'Point', coordinates: [0, 0] }, properties: { pop: 100, name: 'a' } },
      { type: 'Feature', geometry: { type: 'Point', coordinates: [1, 1] }, properties: { pop: 200, name: 'b' } },
    ]);
    const filters = {
      1: [{ fn: (item: any) => item.properties.name === 'b', info: {} as any }]
    };
    expect(getNumericValuesForColumn(layer, 'pop', filters)).toEqual([200]);
  });
});
