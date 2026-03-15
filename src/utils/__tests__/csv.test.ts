import { describe, it, expect } from 'vitest';
import { detectCoordinateColumns, detectH3Column, processChunk } from '../csv';

describe('detectCoordinateColumns', () => {
  it('detects standard lat/lng headers', () => {
    const result = detectCoordinateColumns(['id', 'latitude', 'longitude', 'name']);
    expect(result).toEqual({ lat: 'latitude', lng: 'longitude' });
  });

  it('detects short lat/lng headers', () => {
    const result = detectCoordinateColumns(['lat', 'lng', 'value']);
    expect(result).toEqual({ lat: 'lat', lng: 'lng' });
  });

  it('detects x/y headers', () => {
    const result = detectCoordinateColumns(['id', 'y', 'x']);
    expect(result).toEqual({ lat: 'y', lng: 'x' });
  });

  it('detects case-insensitive headers', () => {
    const result = detectCoordinateColumns(['ID', 'Latitude', 'Longitude']);
    expect(result).toEqual({ lat: 'Latitude', lng: 'Longitude' });
  });

  it('detects prefixed headers like lat_field', () => {
    const result = detectCoordinateColumns(['id', 'lat_field', 'lng_field']);
    expect(result).toEqual({ lat: 'lat_field', lng: 'lng_field' });
  });

  it('returns null when no coordinate columns found', () => {
    const result = detectCoordinateColumns(['id', 'name', 'value']);
    expect(result).toBeNull();
  });

  it('returns null for empty headers', () => {
    const result = detectCoordinateColumns([]);
    expect(result).toBeNull();
  });
});

describe('detectH3Column', () => {
  it('detects hex_id column', () => {
    expect(detectH3Column(['id', 'hex_id', 'value'])).toBe('hex_id');
  });

  it('detects h3_index column', () => {
    expect(detectH3Column(['id', 'h3_index', 'value'])).toBe('h3_index');
  });

  it('detects h3 column', () => {
    expect(detectH3Column(['id', 'h3', 'value'])).toBe('h3');
  });

  it('detects partial match', () => {
    expect(detectH3Column(['id', 'my_hex_id_col', 'value'])).toBe('my_hex_id_col');
  });

  it('returns null when no H3 column found', () => {
    expect(detectH3Column(['id', 'name', 'value'])).toBeNull();
  });
});

describe('processChunk', () => {
  it('processes valid rows into point data', () => {
    const rows = [
      ['header1', 'header2', 'lat', 'lng'],
      ['a', 'b', '37.7749', '-122.4194'],
      ['c', 'd', '40.7484', '-73.9857'],
    ];
    const headers = ['col1', 'col2', 'lat', 'lng'];
    const selectedColumns = new Set(['col1', 'col2']);
    const coords = { lat: 'lat', lng: 'lng' };

    const { data, endIndex } = processChunk(
      rows, 1, headers, selectedColumns, coords, 2, 3, 100, () => {}
    );

    expect(data).toHaveLength(2);
    expect(data[0].position).toEqual([-122.4194, 37.7749]);
    expect(data[0].properties).toEqual({ col1: 'a', col2: 'b' });
    expect(endIndex).toBe(3);
  });

  it('filters out invalid coordinates', () => {
    const rows = [
      ['h1', 'h2', 'h3', 'h4'],
      ['a', 'b', 'invalid', '-122.4194'],
      ['c', 'd', '37.7749', '-122.4194'],
    ];
    const headers = ['col1', 'col2', 'lat', 'lng'];

    const { data } = processChunk(
      rows, 1, headers, new Set(['col1']), { lat: 'lat', lng: 'lng' }, 2, 3, 100, () => {}
    );

    expect(data).toHaveLength(1);
  });

  it('filters out out-of-range coordinates', () => {
    const rows = [
      ['h1', 'h2', 'h3', 'h4'],
      ['a', 'b', '91', '-122.4194'], // lat > 90
    ];
    const headers = ['col1', 'col2', 'lat', 'lng'];

    const { data } = processChunk(
      rows, 1, headers, new Set(['col1']), { lat: 'lat', lng: 'lng' }, 2, 3, 100, () => {}
    );

    expect(data).toHaveLength(0);
  });
});
