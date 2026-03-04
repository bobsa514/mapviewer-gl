/**
 * DuckDB-WASM integration for in-browser SQL queries on map layers.
 *
 * Lazy-loaded via dynamic import — the ~200 KB WASM bundle is fetched from
 * jsDelivr CDN on first use and never included in the main JS bundle.
 * Includes the DuckDB Spatial extension for ST_* functions (ST_Within,
 * ST_Intersects, ST_Buffer, etc.) enabling cross-layer spatial joins.
 *
 * Flow: initDuckDB() → registerLayer() per layer → executeQuery() from SQL editor.
 * Geometry is stored as native GEOMETRY and converted to/from WKT for display.
 */

import type { FeatureCollection, Feature, Geometry, Position } from 'geojson';
import type { LayerInfo } from '../types';

let db: any = null;
let conn: any = null;

/** Convert a layer/file name into a safe SQL table identifier (lowercase, underscores). */
export const sanitizeTableName = (name: string): string => {
  return name
    .replace(/\.[^.]+$/, '') // remove file extension
    .replace(/[^a-zA-Z0-9_]/g, '_') // replace non-alphanumeric
    .replace(/^(\d)/, '_$1') // prefix if starts with digit
    .toLowerCase();
};

/**
 * Initialize DuckDB-WASM with the Spatial extension.
 * Uses a Blob worker wrapper to avoid cross-origin Worker restrictions.
 * No-ops if already initialized.
 */
export const initDuckDB = async (): Promise<void> => {
  if (db) return;

  const duckdb = await import('@duckdb/duckdb-wasm');

  // Use jsDelivr CDN bundles
  const JSDELIVR_BUNDLES = {
    mvp: {
      mainModule: 'https://cdn.jsdelivr.net/npm/@duckdb/duckdb-wasm/dist/duckdb-mvp.wasm',
      mainWorker: 'https://cdn.jsdelivr.net/npm/@duckdb/duckdb-wasm/dist/duckdb-browser-mvp.worker.js',
    },
    eh: {
      mainModule: 'https://cdn.jsdelivr.net/npm/@duckdb/duckdb-wasm/dist/duckdb-eh.wasm',
      mainWorker: 'https://cdn.jsdelivr.net/npm/@duckdb/duckdb-wasm/dist/duckdb-browser-eh.worker.js',
    },
  };

  const bundle = await duckdb.selectBundle(JSDELIVR_BUNDLES);

  // Create a blob worker to avoid cross-origin restrictions
  const workerUrl = bundle.mainWorker!;
  const workerScript = `importScripts("${workerUrl}");`;
  const blob = new Blob([workerScript], { type: 'application/javascript' });
  const worker = new Worker(URL.createObjectURL(blob));

  const logger = new duckdb.ConsoleLogger();
  db = new duckdb.AsyncDuckDB(logger, worker);
  await db.instantiate(bundle.mainModule, bundle.pthreadWorker);

  conn = await db.connect();

  // Load spatial extension
  await conn.query('INSTALL spatial; LOAD spatial;');
};

/** Convert a GeoJSON Geometry to WKT string for SQL insertion. Supports 2D Point through MultiPolygon. */
const geometryToWKT = (geometry: Geometry): string => {
  const coordToStr = (coord: Position) => `${coord[0]} ${coord[1]}`;
  const ringToStr = (ring: Position[]) => `(${ring.map(coordToStr).join(', ')})`;

  switch (geometry.type) {
    case 'Point':
      return `POINT(${coordToStr(geometry.coordinates)})`;
    case 'LineString':
      return `LINESTRING(${geometry.coordinates.map(coordToStr).join(', ')})`;
    case 'Polygon':
      return `POLYGON(${geometry.coordinates.map(ringToStr).join(', ')})`;
    case 'MultiPoint':
      return `MULTIPOINT(${geometry.coordinates.map(coordToStr).join(', ')})`;
    case 'MultiLineString':
      return `MULTILINESTRING(${geometry.coordinates.map(c => `(${c.map(coordToStr).join(', ')})`).join(', ')})`;
    case 'MultiPolygon':
      return `MULTIPOLYGON(${geometry.coordinates.map(p => `(${p.map(ringToStr).join(', ')})`).join(', ')})`;
    default:
      return '';
  }
};

/** Parse a WKT string back into a GeoJSON Geometry. Returns null for unrecognized types. */
const wktToGeometry = (wkt: string): Geometry | null => {
  const wktTrimmed = wkt.trim();

  const parseCoord = (s: string): Position => {
    const parts = s.trim().split(/\s+/).map(Number);
    return parts;
  };

  const parseCoordList = (s: string): Position[] => {
    return s.split(',').map(parseCoord);
  };

  if (wktTrimmed.startsWith('POINT')) {
    const coords = wktTrimmed.match(/POINT\s*\(([^)]+)\)/);
    if (!coords) return null;
    return { type: 'Point', coordinates: parseCoord(coords[1]) };
  }

  if (wktTrimmed.startsWith('LINESTRING')) {
    const coords = wktTrimmed.match(/LINESTRING\s*\((.+)\)/);
    if (!coords) return null;
    return { type: 'LineString', coordinates: parseCoordList(coords[1]) };
  }

  if (wktTrimmed.startsWith('MULTIPOLYGON')) {
    const inner = wktTrimmed.match(/MULTIPOLYGON\s*\(\(\((.+)\)\)\)/);
    if (!inner) return null;
    const polygons = inner[1].split(')),((').map(p =>
      p.split('),(').map(ring => parseCoordList(ring))
    );
    return { type: 'MultiPolygon', coordinates: polygons };
  }

  if (wktTrimmed.startsWith('POLYGON')) {
    const inner = wktTrimmed.match(/POLYGON\s*\(\((.+)\)\)/);
    if (!inner) return null;
    const rings = inner[1].split('),(').map(ring => parseCoordList(ring));
    return { type: 'Polygon', coordinates: rings };
  }

  if (wktTrimmed.startsWith('MULTILINESTRING')) {
    const inner = wktTrimmed.match(/MULTILINESTRING\s*\(\((.+)\)\)/);
    if (!inner) return null;
    const lines = inner[1].split('),(').map(l => parseCoordList(l));
    return { type: 'MultiLineString', coordinates: lines };
  }

  if (wktTrimmed.startsWith('MULTIPOINT')) {
    const inner = wktTrimmed.match(/MULTIPOINT\s*\((.+)\)/);
    if (!inner) return null;
    const coords = inner[1].replace(/[()]/g, '').split(',').map(parseCoord);
    return { type: 'MultiPoint', coordinates: coords };
  }

  return null;
};

/** Infer a DuckDB column type (BIGINT, DOUBLE, or VARCHAR) from sample values. */
const inferColumnType = (values: any[]): string => {
  const nonNull = values.filter(v => v !== null && v !== undefined && v !== '');
  if (nonNull.length === 0) return 'VARCHAR';

  // Check if all non-null values are numeric
  const allNumeric = nonNull.every(v => {
    if (typeof v === 'number') return true;
    if (typeof v === 'string') return !isNaN(Number(v)) && v.trim() !== '';
    return false;
  });

  if (allNumeric) {
    // Check if all are integers
    const allInteger = nonNull.every(v => {
      const n = typeof v === 'number' ? v : Number(v);
      return Number.isInteger(n);
    });
    return allInteger ? 'BIGINT' : 'DOUBLE';
  }

  return 'VARCHAR';
};

/** Sample up to 100 items and infer the SQL type for each property column. */
const inferColumnTypes = (items: any[], getProps: (item: any) => Record<string, any>): Record<string, string> => {
  const sampleSize = Math.min(items.length, 100);
  const sample = items.slice(0, sampleSize);
  const propColumns = Object.keys(getProps(items[0]) || {});

  const types: Record<string, string> = {};
  for (const col of propColumns) {
    const values = sample.map(item => getProps(item)?.[col]);
    types[col] = inferColumnType(values);
  }
  return types;
};

const formatValue = (val: any, type: string): string => {
  if (val === null || val === undefined) return 'NULL';
  if (type === 'BIGINT' || type === 'DOUBLE') {
    const n = Number(val);
    if (isNaN(n)) return 'NULL';
    return String(n);
  }
  return `'${String(val).replace(/'/g, "''")}'`;
};

/**
 * Register a map layer as a DuckDB table.
 * Converts GeoJSON, point, or H3 layer data into SQL INSERTs with auto-inferred types.
 * Geometry columns use WKT via ST_GeomFromText; H3 layers store hex_id as VARCHAR.
 */
export const registerLayer = async (layer: LayerInfo, tableName: string): Promise<void> => {
  if (!conn) throw new Error('DuckDB not initialized');

  await conn.query(`DROP TABLE IF EXISTS "${tableName}"`);

  if (layer.type === 'geojson') {
    const features: Feature[] = layer.data.features;
    if (features.length === 0) return;

    const colTypes = inferColumnTypes(features, f => f.properties || {});
    const propColumns = Object.keys(colTypes);
    const colDefs = propColumns.map(col => `"${col}" ${colTypes[col]}`).join(', ');

    await conn.query(`CREATE TABLE "${tableName}" (${colDefs}${colDefs ? ', ' : ''}geom GEOMETRY)`);

    const batchSize = 500;
    for (let i = 0; i < features.length; i += batchSize) {
      const batch = features.slice(i, i + batchSize);
      const values = batch.map(f => {
        const propValues = propColumns.map(col => formatValue(f.properties?.[col], colTypes[col]));
        const wkt = geometryToWKT(f.geometry);
        return `(${propValues.join(', ')}${propValues.length ? ', ' : ''}ST_GeomFromText('${wkt}'))`;
      }).join(', ');
      await conn.query(`INSERT INTO "${tableName}" VALUES ${values}`);
    }
  } else if (layer.type === 'point') {
    const data: any[] = layer.data;
    if (data.length === 0) return;

    const colTypes = inferColumnTypes(data, d => d.properties || {});
    const propColumns = Object.keys(colTypes);
    const colDefs = propColumns.map(col => `"${col}" ${colTypes[col]}`).join(', ');

    await conn.query(`CREATE TABLE "${tableName}" (${colDefs}${colDefs ? ', ' : ''}geom GEOMETRY)`);

    const batchSize = 500;
    for (let i = 0; i < data.length; i += batchSize) {
      const batch = data.slice(i, i + batchSize);
      const values = batch.map(d => {
        const propValues = propColumns.map(col => formatValue(d.properties?.[col], colTypes[col]));
        const wkt = `POINT(${d.position[0]} ${d.position[1]})`;
        return `(${propValues.join(', ')}${propValues.length ? ', ' : ''}ST_GeomFromText('${wkt}'))`;
      }).join(', ');
      await conn.query(`INSERT INTO "${tableName}" VALUES ${values}`);
    }
  } else if (layer.type === 'h3') {
    const data: any[] = layer.data;
    if (data.length === 0) return;

    const colTypes = inferColumnTypes(data, d => d.properties || {});
    const propColumns = Object.keys(colTypes);
    const colDefs = propColumns.map(col => `"${col}" ${colTypes[col]}`).join(', ');

    await conn.query(`CREATE TABLE "${tableName}" (hex_id VARCHAR${colDefs ? ', ' : ''}${colDefs})`);

    const batchSize = 500;
    for (let i = 0; i < data.length; i += batchSize) {
      const batch = data.slice(i, i + batchSize);
      const values = batch.map(d => {
        const propValues = propColumns.map(col => formatValue(d.properties?.[col], colTypes[col]));
        return `('${d.hex}'${propValues.length ? ', ' : ''}${propValues.join(', ')})`;
      }).join(', ');
      await conn.query(`INSERT INTO "${tableName}" VALUES ${values}`);
    }
  }
};

/** Drop a previously registered layer table from DuckDB. */
export const unregisterLayer = async (tableName: string): Promise<void> => {
  if (!conn) return;
  await conn.query(`DROP TABLE IF EXISTS "${tableName}"`);
};

export interface QueryResult {
  columns: string[];
  rows: any[][];
  hasGeometry: boolean;
  geojson?: FeatureCollection;
  rowCount: number;
  executionTimeMs: number;
}

/**
 * Execute a user SQL query and return structured results.
 * Automatically detects geometry columns and wraps them with ST_AsText()
 * so the results can be converted back to GeoJSON for the "Add as Layer" feature.
 */
export const executeQuery = async (sql: string): Promise<QueryResult> => {
  if (!conn) throw new Error('DuckDB not initialized');

  const start = performance.now();

  // First run the query to inspect schema
  const initialResult = await conn.query(sql);
  const initialColumns: string[] = initialResult.schema.fields.map((f: any) => f.name);

  // Detect geometry columns by name or type
  const geomColNames: string[] = [];
  for (let i = 0; i < initialColumns.length; i++) {
    const field = initialResult.schema.fields[i];
    const colName = initialColumns[i].toLowerCase();
    const typeStr = String(field.type || '').toLowerCase();
    if (colName === 'geom' || colName === 'geometry' ||
        typeStr.includes('geometry') || typeStr.includes('blob') ||
        field.type?.typeId === 13) {
      geomColNames.push(initialColumns[i]);
    }
  }

  // If geometry columns found, re-run with ST_AsText conversion
  let result: any;
  let columns: string[];
  if (geomColNames.length > 0) {
    const wrappedSql = `SELECT ${initialColumns.map(col =>
      geomColNames.includes(col) ? `ST_AsText("${col}") as "${col}"` : `"${col}"`
    ).join(', ')} FROM (${sql}) AS __user_query`;
    try {
      result = await conn.query(wrappedSql);
      columns = result.schema.fields.map((f: any) => f.name);
    } catch {
      // If wrapping fails (e.g. non-geometry BLOB), fall back to original
      result = initialResult;
      columns = initialColumns;
    }
  } else {
    result = initialResult;
    columns = initialColumns;
  }

  const executionTimeMs = performance.now() - start;
  const rows: any[][] = [];
  const batchData = result.toArray();

  // Re-detect geom column index (now as WKT text)
  let geomColIndex = -1;
  for (let i = 0; i < columns.length; i++) {
    const colName = columns[i].toLowerCase();
    if (colName === 'geom' || colName === 'geometry') {
      geomColIndex = i;
      break;
    }
  }

  const features: Feature[] = [];

  for (const row of batchData) {
    const rowData: any[] = [];
    for (let i = 0; i < columns.length; i++) {
      let val = row[columns[i]];
      if (typeof val === 'bigint') {
        val = Number(val);
      }
      rowData.push(val);
    }
    rows.push(rowData);

    if (geomColIndex >= 0) {
      const geomVal = rowData[geomColIndex];
      if (geomVal && typeof geomVal === 'string') {
        const geometry = wktToGeometry(geomVal);
        if (geometry) {
          const properties: Record<string, any> = {};
          columns.forEach((col, i) => {
            if (i !== geomColIndex) {
              properties[col] = rowData[i];
            }
          });
          features.push({ type: 'Feature', geometry, properties });
        }
      }
    }
  }

  const hasGeometry = geomColIndex >= 0 && features.length > 0;
  const geojson: FeatureCollection | undefined = hasGeometry
    ? { type: 'FeatureCollection', features }
    : undefined;

  return { columns, rows, hasGeometry, geojson, rowCount: rows.length, executionTimeMs };
};

export const isDuckDBReady = (): boolean => db !== null;
