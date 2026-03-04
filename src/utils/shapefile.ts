/**
 * Shapefile parser — converts a zipped .shp/.dbf/.prj bundle into GeoJSON.
 * Uses the `shpjs` library which handles ZIP extraction internally.
 * Code-split via dynamic import so the 141 KB bundle is only loaded on demand.
 */

import type { FeatureCollection } from 'geojson';
import shp from 'shpjs';

/**
 * Parse a zipped shapefile into a GeoJSON FeatureCollection.
 * If the ZIP contains multiple .shp files, all features are merged into one collection.
 */
export const parseShapefile = async (arrayBuffer: ArrayBuffer): Promise<FeatureCollection> => {
  const result = await shp(arrayBuffer);

  // shpjs can return a single FeatureCollection or an array of them (for multi-layer ZIPs)
  if (Array.isArray(result)) {
    // Merge all FeatureCollections into one
    const merged: FeatureCollection = {
      type: 'FeatureCollection',
      features: result.flatMap(fc => fc.features),
    };
    return merged;
  }

  return result as FeatureCollection;
};
