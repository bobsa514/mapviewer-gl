/**
 * CSV parsing utilities for detecting coordinate columns, H3 hex indexes,
 * and processing rows into map-ready point data in batches.
 */

import * as h3 from 'h3-js';

/**
 * Auto-detect latitude/longitude column names from CSV headers.
 * Checks common aliases (lat, latitude, y, lng, longitude, lon, x, etc.).
 */
export const detectCoordinateColumns = (headers: string[]): { lat: string; lng: string } | null => {
  const possibleLatColumns = ['latitude', 'lat', 'y'];
  const possibleLngColumns = ['longitude', 'lng', 'long', 'lon', 'x'];

  let latColumn = headers.find(h =>
    possibleLatColumns.some(term => h.toLowerCase().trim() === term.toLowerCase())
  );

  let lngColumn = headers.find(h =>
    possibleLngColumns.some(term => h.toLowerCase().trim() === term.toLowerCase())
  );

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

/** Auto-detect an H3 hex index column from CSV headers (e.g. hex_id, h3_index, h3). */
export const detectH3Column = (headers: string[]): string | null => {
  const possibleH3Names = ['hex_id', 'h3_index', 'h3', 'hexagon'];

  const h3Column = headers.find(h =>
    possibleH3Names.some(name => h.toLowerCase().trim() === name.toLowerCase())
  );

  if (h3Column) {
    return h3Column;
  }

  return headers.find(h =>
    possibleH3Names.some(name => h.toLowerCase().includes(name.toLowerCase()))
  ) || null;
};

/** Validate whether a string is a valid H3 cell index. */
export const isValidH3Index = (value: string): boolean => {
  try {
    return h3.isValidCell(value);
  } catch {
    return false;
  }
};

/**
 * Process a chunk of CSV rows into point data objects with [lng, lat] positions.
 * Filters out rows with invalid or out-of-range coordinates.
 * Returns the processed data and the end index for the next chunk.
 */
export const processChunk = (
  rows: string[][],
  startIndex: number,
  headers: string[],
  selectedColumns: Set<string>,
  _coordinates: { lat: string; lng: string },
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

    const lat = parseFloat(values[latIndex]);
    const lng = parseFloat(values[lngIndex]);

    if (isNaN(lat) || isNaN(lng) || lat < -90 || lat > 90 || lng < -180 || lng > 180) {
      continue;
    }

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
};
