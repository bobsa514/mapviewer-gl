import { describe, it, expect } from 'vitest';
import { extractCoordinates, calculateBounds, hexToRGB, getColorForValue, getSizeForValue } from '../geometry';
import type { FeatureCollection } from 'geojson';

describe('extractCoordinates', () => {
  it('extracts Point coordinates', () => {
    expect(extractCoordinates({ type: 'Point', coordinates: [1, 2] })).toEqual([[1, 2]]);
  });

  it('extracts LineString coordinates', () => {
    expect(extractCoordinates({ type: 'LineString', coordinates: [[1, 2], [3, 4]] })).toEqual([[1, 2], [3, 4]]);
  });

  it('extracts Polygon coordinates', () => {
    const coords = extractCoordinates({ type: 'Polygon', coordinates: [[[0, 0], [1, 0], [1, 1], [0, 0]]] });
    expect(coords).toEqual([[0, 0], [1, 0], [1, 1], [0, 0]]);
  });

  it('extracts MultiPoint coordinates', () => {
    expect(extractCoordinates({ type: 'MultiPoint', coordinates: [[1, 2], [3, 4]] })).toEqual([[1, 2], [3, 4]]);
  });

  it('extracts MultiPolygon coordinates', () => {
    const geom = { type: 'MultiPolygon' as const, coordinates: [[[[0, 0], [1, 0], [1, 1], [0, 0]]]] };
    expect(extractCoordinates(geom)).toEqual([[0, 0], [1, 0], [1, 1], [0, 0]]);
  });

  it('handles GeometryCollection', () => {
    const geom = {
      type: 'GeometryCollection' as const,
      geometries: [
        { type: 'Point' as const, coordinates: [1, 2] },
        { type: 'Point' as const, coordinates: [3, 4] },
      ]
    };
    expect(extractCoordinates(geom)).toEqual([[1, 2], [3, 4]]);
  });

  it('returns empty for unknown type', () => {
    expect(extractCoordinates({ type: 'Unknown' } as any)).toEqual([]);
  });
});

describe('calculateBounds', () => {
  it('computes bounding box of features', () => {
    const fc: FeatureCollection = {
      type: 'FeatureCollection',
      features: [
        { type: 'Feature', geometry: { type: 'Point', coordinates: [-122, 37] }, properties: {} },
        { type: 'Feature', geometry: { type: 'Point', coordinates: [-74, 41] }, properties: {} },
      ]
    };
    const bounds = calculateBounds(fc);
    expect(bounds).toEqual({ minLat: 37, maxLat: 41, minLng: -122, maxLng: -74 });
  });

  it('returns null for features without geometry', () => {
    const fc: FeatureCollection = {
      type: 'FeatureCollection',
      features: [
        { type: 'Feature', geometry: null as any, properties: {} },
      ]
    };
    expect(calculateBounds(fc)).toBeNull();
  });

  it('returns null for empty feature collection', () => {
    const fc: FeatureCollection = { type: 'FeatureCollection', features: [] };
    expect(calculateBounds(fc)).toBeNull();
  });
});

describe('hexToRGB', () => {
  it('converts hex to RGB', () => {
    expect(hexToRGB('#ff0000')).toEqual([255, 0, 0]);
    expect(hexToRGB('#00ff00')).toEqual([0, 255, 0]);
    expect(hexToRGB('#0000ff')).toEqual([0, 0, 255]);
    expect(hexToRGB('#ffffff')).toEqual([255, 255, 255]);
    expect(hexToRGB('#000000')).toEqual([0, 0, 0]);
  });
});

describe('getColorForValue', () => {
  it('returns base color when no breaks', () => {
    const mapping = { column: 'val', numClasses: 5, breaks: [], colorScale: 'Reds' as const };
    expect(getColorForValue(10, '#ff0000', mapping)).toEqual([255, 0, 0]);
  });

  it('maps value to correct class', () => {
    const mapping = { column: 'val', numClasses: 3, breaks: [10, 20], colorScale: 'Blues' as const };
    // value 5 <= 10 → index 0 → Blues[0]
    const result = getColorForValue(5, '#000000', mapping);
    expect(result).toEqual(hexToRGB('#eff3ff'));
  });

  it('maps high value to last class', () => {
    const mapping = { column: 'val', numClasses: 3, breaks: [10, 20], colorScale: 'Blues' as const };
    // value 25 > all breaks → index numClasses-1 = 2 → Blues[2]
    const result = getColorForValue(25, '#000000', mapping);
    expect(result).toEqual(hexToRGB('#6baed6'));
  });
});

describe('getSizeForValue', () => {
  it('returns minSize when no breaks', () => {
    const mapping = { column: 'val', numClasses: 3, breaks: [], minSize: 2, maxSize: 20 };
    expect(getSizeForValue(10, mapping)).toBe(2);
  });

  it('maps value to interpolated size', () => {
    const mapping = { column: 'val', numClasses: 3, breaks: [10, 20], minSize: 2, maxSize: 20 };
    // value 5 <= 10 → sizeIndex 0 → fraction 0/2 = 0 → size = 2
    expect(getSizeForValue(5, mapping)).toBe(2);
    // value 15 <= 20 → sizeIndex 1 → fraction 1/2 = 0.5 → size = 2 + 18*0.5 = 11
    expect(getSizeForValue(15, mapping)).toBe(11);
  });
});
