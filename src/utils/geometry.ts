/**
 * Geometry utilities for coordinate extraction, bounding box computation,
 * and color/size mapping for classified symbology.
 */

import type { Geometry, FeatureCollection } from 'geojson';
import type { ColorScaleName, LayerInfo } from '../types';
import { colorScales } from '../types';

/** Recursively extract all [lng, lat] coordinate pairs from any GeoJSON geometry. */
export const extractCoordinates = (geometry: Geometry): number[][] => {
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
};

/**
 * Compute the bounding box of a FeatureCollection.
 * Uses iterative min/max (not spread operator) to avoid stack overflow on large datasets.
 */
export const calculateBounds = (geojson: FeatureCollection) => {
  let minLat = Infinity;
  let maxLat = -Infinity;
  let minLng = Infinity;
  let maxLng = -Infinity;
  let hasCoords = false;

  for (const feature of geojson.features) {
    if (!feature.geometry) continue;
    const coords = extractCoordinates(feature.geometry);
    for (const coord of coords) {
      const lng = coord[0];
      const lat = coord[1];
      if (isNaN(lat) || isNaN(lng)) continue;
      if (lat < minLat) minLat = lat;
      if (lat > maxLat) maxLat = lat;
      if (lng < minLng) minLng = lng;
      if (lng > maxLng) maxLng = lng;
      hasCoords = true;
    }
  }

  if (!hasCoords) return null;

  return { minLat, maxLat, minLng, maxLng };
};

/** Convert a hex color string (#RRGGBB) to an [R, G, B] tuple. */
export const hexToRGB = (hex: string): [number, number, number] => {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return [r, g, b];
};

/** Map a numeric value to an RGB color using classified breaks and a color scale. */
export const getColorForValue = (
  value: number,
  baseColor: string,
  colorMapping: NonNullable<LayerInfo['colorMapping']>
): [number, number, number] => {
  if (!colorMapping.breaks.length) return hexToRGB(baseColor);

  let colorIndex = colorMapping.numClasses - 1;
  for (let i = 0; i < colorMapping.breaks.length; i++) {
    if (value <= colorMapping.breaks[i]) {
      colorIndex = i;
      break;
    }
  }

  const colors = colorScales[colorMapping.colorScale];
  const color = colors[colorIndex];
  return hexToRGB(color);
};

/** Map a numeric value to a point radius using classified breaks and a min/max size range. */
export const getSizeForValue = (value: number, sizeMapping: NonNullable<LayerInfo['sizeMapping']>): number => {
  if (!sizeMapping.breaks.length) return sizeMapping.minSize;

  let sizeIndex = 0;
  for (let i = 0; i < sizeMapping.breaks.length; i++) {
    if (value <= sizeMapping.breaks[i]) {
      sizeIndex = i;
      break;
    }
  }
  if (sizeIndex === 0 && value > sizeMapping.breaks[sizeMapping.breaks.length - 1]) {
    sizeIndex = sizeMapping.numClasses - 1;
  }

  const sizeFraction = sizeIndex / (sizeMapping.numClasses - 1);
  return sizeMapping.minSize + (sizeMapping.maxSize - sizeMapping.minSize) * sizeFraction;
};
