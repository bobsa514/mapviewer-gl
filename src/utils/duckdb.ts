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

import type { FeatureCollection, Feature, Geometry } from 'geojson';
import type { LayerInfo } from '../types';
import { sanitizeTableName, registeredTableNames } from './tableName';

// Re-export so existing callers that import from duckdb.ts still work
export { sanitizeTableName };

let db: any = null;
let conn: any = null;

/** Escape a column name for safe use in SQL identifiers (double-quote escaping). */
export const escapeIdentifier = (name: string): string => `"${name.replace(/"/g, '""')}"`;


/**
 * Initialize DuckDB-WASM with the Spatial extension.
 * Uses a Blob worker wrapper to avoid cross-origin Worker restrictions.
 * No-ops if already initialized.
 */
export const initDuckDB = async (): Promise<void> => {
  if (db) return;

  const duckdb = await import('@duckdb/duckdb-wasm');

  // Use jsDelivr CDN bundles — pinned to match installed npm package version
  const DUCKDB_VERSION = '1.33.1-dev20.0';
  const JSDELIVR_BUNDLES = {
    mvp: {
      mainModule: `https://cdn.jsdelivr.net/npm/@duckdb/duckdb-wasm@${DUCKDB_VERSION}/dist/duckdb-mvp.wasm`,
      mainWorker: `https://cdn.jsdelivr.net/npm/@duckdb/duckdb-wasm@${DUCKDB_VERSION}/dist/duckdb-browser-mvp.worker.js`,
    },
    eh: {
      mainModule: `https://cdn.jsdelivr.net/npm/@duckdb/duckdb-wasm@${DUCKDB_VERSION}/dist/duckdb-eh.wasm`,
      mainWorker: `https://cdn.jsdelivr.net/npm/@duckdb/duckdb-wasm@${DUCKDB_VERSION}/dist/duckdb-browser-eh.worker.js`,
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


/** Infer a DuckDB column type (BIGINT, DOUBLE, or VARCHAR) from sample values. */
export const inferColumnType = (values: any[]): string => {
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
export const inferColumnTypes = (items: any[], getProps: (item: any) => Record<string, any>): Record<string, string> => {
  const sampleSize = Math.min(items.length, 100);
  const sample = items.slice(0, sampleSize);

  // Scan all sample items to discover property keys (handles null/sparse properties)
  const propColumnsSet = new Set<string>();
  for (const item of sample) {
    const props = getProps(item);
    if (props) {
      for (const key of Object.keys(props)) {
        propColumnsSet.add(key);
      }
    }
  }
  const propColumns = Array.from(propColumnsSet);

  const types: Record<string, string> = {};
  for (const col of propColumns) {
    const values = sample.map(item => getProps(item)?.[col]);
    types[col] = inferColumnType(values);
  }
  return types;
};

export const formatValue = (val: any, type: string): string => {
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
    const colDefs = propColumns.map(col => `${escapeIdentifier(col)} ${colTypes[col]}`).join(', ');

    await conn.query(`CREATE TABLE "${tableName}" (${colDefs}${colDefs ? ', ' : ''}geom GEOMETRY)`);

    const batchSize = 500;
    for (let i = 0; i < features.length; i += batchSize) {
      const batch = features.slice(i, i + batchSize);
      const values = batch.map(f => {
        const propValues = propColumns.map(col => formatValue(f.properties?.[col], colTypes[col]));
        const geojson = JSON.stringify(f.geometry).replace(/'/g, "''");
        return `(${propValues.join(', ')}${propValues.length ? ', ' : ''}ST_GeomFromGeoJSON('${geojson}'))`;
      }).join(', ');
      await conn.query(`INSERT INTO "${tableName}" VALUES ${values}`);
    }
  } else if (layer.type === 'point') {
    const data: any[] = layer.data;
    if (data.length === 0) return;

    const colTypes = inferColumnTypes(data, d => d.properties || {});
    const propColumns = Object.keys(colTypes);
    const colDefs = propColumns.map(col => `${escapeIdentifier(col)} ${colTypes[col]}`).join(', ');

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
    const colDefs = propColumns.map(col => `${escapeIdentifier(col)} ${colTypes[col]}`).join(', ');

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
  registeredTableNames.delete(tableName);
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
 * Automatically detects geometry columns via DESCRIBE (without materializing data),
 * then runs a single combined query that includes both ST_AsText (for display)
 * and ST_AsGeoJSON (for layer extraction) — max 2 query executions total.
 */
export const executeQuery = async (sql: string): Promise<QueryResult> => {
  if (!conn) throw new Error('DuckDB not initialized');

  const start = performance.now();

  // Step 1: Detect geometry columns via DESCRIBE (no data materialized)
  let columns: string[] = [];
  const geomColNames: string[] = [];
  let describeSucceeded = false;

  try {
    const descResult = await conn.query(`DESCRIBE (${sql})`);
    const descRows = descResult.toArray();
    for (const row of descRows) {
      const colName = row.column_name as string;
      const colType = String(row.column_type || '').toUpperCase();
      columns.push(colName);
      if (colType === 'GEOMETRY' || colType === 'WKB_GEOMETRY') {
        geomColNames.push(colName);
      }
    }
    describeSucceeded = true;
  } catch {
    // DESCRIBE failed — will fall back to running the query directly
  }

  // Step 2: Execute the query (single execution regardless of geometry)
  let result: any;

  if (describeSucceeded && geomColNames.length > 0) {
    // Geometry detected: run a single combined query with both ST_AsText (display)
    // and ST_AsGeoJSON (for layer extraction) columns
    const selectParts = columns.map(col => {
      if (geomColNames.includes(col)) {
        return `ST_AsText(${escapeIdentifier(col)}) as ${escapeIdentifier(col)}, ST_AsGeoJSON(${escapeIdentifier(col)}) as ${escapeIdentifier(col + '__geojson')}`;
      }
      return escapeIdentifier(col);
    });
    const combinedSql = `SELECT ${selectParts.join(', ')} FROM (${sql}) AS __user_query`;

    try {
      result = await conn.query(combinedSql);
    } catch {
      // If combined query fails, try plain query
      result = await conn.query(sql);
      columns = result.schema.fields.map((f: any) => f.name);
      geomColNames.length = 0; // Clear geometry detection
    }
  } else if (describeSucceeded) {
    // No geometry columns — run plain query
    result = await conn.query(sql);
  } else {
    // DESCRIBE failed — run plain query and detect geometry from schema
    result = await conn.query(sql);
    columns = result.schema.fields.map((f: any) => f.name);

    // Fallback geometry detection by column name
    for (let i = 0; i < columns.length; i++) {
      const colName = columns[i].toLowerCase();
      if (colName === 'geom' || colName === 'geometry') {
        const field = result.schema.fields[i];
        const typeStr = String(field.type || '').toUpperCase();
        if (!typeStr.includes('STRUCT')) {
          geomColNames.push(columns[i]);
        }
      }
    }
  }

  const executionTimeMs = performance.now() - start;

  // Step 3: Process results
  const batchData = result.toArray();
  const resultColumns: string[] = result.schema.fields.map((f: any) => f.name);

  // Filter out the __geojson helper columns from the display columns
  const displayColumns = resultColumns.filter((c: string) => !c.endsWith('__geojson'));

  const rows: any[][] = [];
  const features: Feature[] = [];

  for (const row of batchData) {
    // Build display row (without __geojson columns)
    const rowData: any[] = [];
    for (const col of displayColumns) {
      let val = row[col];
      if (typeof val === 'bigint') val = Number(val);
      rowData.push(val);
    }
    rows.push(rowData);

    // Build GeoJSON features from __geojson columns
    if (geomColNames.length > 0) {
      const geomCol = geomColNames[0];
      const geojsonStr = row[geomCol + '__geojson'];
      if (geojsonStr && typeof geojsonStr === 'string') {
        try {
          const geometry = JSON.parse(geojsonStr) as Geometry;
          const properties: Record<string, any> = {};
          for (const col of displayColumns) {
            if (!geomColNames.includes(col)) {
              let val = row[col];
              if (typeof val === 'bigint') val = Number(val);
              properties[col] = val;
            }
          }
          features.push({ type: 'Feature', geometry, properties });
        } catch {
          // Skip unparseable geometry
        }
      }
    }
  }

  const hasGeometry = features.length > 0;
  const geojson: FeatureCollection | undefined = hasGeometry
    ? { type: 'FeatureCollection', features }
    : undefined;

  return { columns: displayColumns, rows, hasGeometry, geojson, rowCount: rows.length, executionTimeMs };
};

export const isDuckDBReady = (): boolean => db !== null;

/**
 * Register a Parquet file in DuckDB using native read_parquet().
 * Detects geometry columns by name/type for GeoParquet support.
 */
export const registerParquetFile = async (file: File): Promise<{
  tableName: string;
  geomColumn: string | null;
  geomColumnType: string | null;
  columns: string[];
}> => {
  await initDuckDB();
  const tableName = sanitizeTableName(file.name);
  const buffer = await file.arrayBuffer();
  await db.registerFileBuffer(file.name, new Uint8Array(buffer));

  await conn.query(`DROP TABLE IF EXISTS "${tableName}"`);
  const escapedFileName = file.name.replace(/'/g, "''");
  await conn.query(`CREATE TABLE "${tableName}" AS SELECT * FROM read_parquet('${escapedFileName}')`);

  const descResult = await conn.query(`DESCRIBE "${tableName}"`);
  const rows = descResult.toArray();

  let geomColumn: string | null = null;
  let geomColumnType: string | null = null;
  const columns: string[] = [];

  for (const row of rows) {
    const colName = row.column_name;
    const colType = String(row.column_type || '').toUpperCase();
    columns.push(colName);

    if (!geomColumn) {
      const nameLower = colName.toLowerCase();
      const isGeomName = nameLower === 'geom' || nameLower === 'geometry' ||
                         nameLower === 'wkb_geometry' || nameLower === 'shape' ||
                         nameLower === 'the_geom';

      if (colType.includes('GEOMETRY') || colType === 'WKB_GEOMETRY') {
        geomColumn = colName;
        geomColumnType = colType;
      } else if (colType === 'BLOB' && isGeomName) {
        geomColumn = colName;
        geomColumnType = colType;
      }
    }
  }

  return { tableName, geomColumn, geomColumnType, columns };
};

/**
 * Extract GeoParquet geometry as a GeoJSON FeatureCollection.
 * If the column is already GEOMETRY type (auto-parsed by DuckDB spatial),
 * uses ST_AsGeoJSON directly. For raw BLOB/WKB, wraps with ST_GeomFromWKB first.
 */
export const extractGeoParquetAsGeoJSON = async (
  tableName: string,
  geomColumn: string,
  geomColumnType?: string | null
): Promise<FeatureCollection> => {
  if (!conn) throw new Error('DuckDB not initialized');

  // Get all columns except geom
  const descResult = await conn.query(`DESCRIBE "${tableName}"`);
  const allCols = descResult.toArray().map((r: any) => r.column_name as string);
  const propCols = allCols.filter((c: string) => c !== geomColumn);

  const selectCols = propCols.map((c: string) => escapeIdentifier(c)).join(', ');
  // If the column is already GEOMETRY, ST_AsGeoJSON works directly.
  // Only use ST_GeomFromWKB for raw BLOB/WKB_GEOMETRY columns.
  const needsWKBConversion = geomColumnType && (geomColumnType === 'BLOB' || geomColumnType === 'WKB_GEOMETRY');
  const geomExpr = needsWKBConversion
    ? `ST_AsGeoJSON(ST_GeomFromWKB(${escapeIdentifier(geomColumn)}))`
    : `ST_AsGeoJSON(${escapeIdentifier(geomColumn)})`;
  const sql = `SELECT ${selectCols ? selectCols + ', ' : ''}${geomExpr} as __geojson FROM "${tableName}"`;

  const result = await conn.query(sql);
  const rows = result.toArray();

  const features: Feature[] = [];
  for (const row of rows) {
    const geojsonStr = row.__geojson;
    if (!geojsonStr) continue;

    try {
      const geometry = JSON.parse(geojsonStr) as Geometry;
      const properties: Record<string, any> = {};
      for (const col of propCols) {
        let val = row[col];
        if (typeof val === 'bigint') val = Number(val);
        properties[col] = val;
      }
      features.push({ type: 'Feature', geometry, properties });
    } catch {
      // Skip rows with unparseable geometry
    }
  }

  return { type: 'FeatureCollection', features };
};

/**
 * Register a plain CSV file as a DuckDB table.
 * Parses CSV in JS and uses INSERT batches (same approach as registerLayer)
 * to avoid DuckDB-WASM virtual filesystem issues with read_csv_auto.
 */
export const registerPlainCSVTable = async (
  file: File,
  selectedColumns?: Set<string>
): Promise<{
  tableName: string;
  columns: string[];
}> => {
  await initDuckDB();
  const tableName = sanitizeTableName(file.name);

  const text = await file.text();
  const Papa = (await import('papaparse')).default;
  const parsed = Papa.parse(text, { header: true, skipEmptyLines: true });

  const rows = parsed.data as Record<string, any>[];
  if (rows.length === 0) throw new Error('CSV file is empty');

  const allColumns = parsed.meta.fields || Object.keys(rows[0]);
  // If user selected specific columns, filter to only those; otherwise use all
  const columns = selectedColumns && selectedColumns.size > 0
    ? allColumns.filter(col => selectedColumns.has(col))
    : allColumns;
  const colTypes: Record<string, string> = {};
  const sampleSize = Math.min(rows.length, 100);
  for (const col of columns) {
    colTypes[col] = inferColumnType(rows.slice(0, sampleSize).map(r => r[col]));
  }

  const colDefs = columns.map(col => `${escapeIdentifier(col)} ${colTypes[col]}`).join(', ');
  await conn.query(`DROP TABLE IF EXISTS "${tableName}"`);
  await conn.query(`CREATE TABLE "${tableName}" (${colDefs})`);

  const batchSize = 500;
  for (let i = 0; i < rows.length; i += batchSize) {
    const batch = rows.slice(i, i + batchSize);
    const values = batch.map(row =>
      `(${columns.map(col => formatValue(row[col], colTypes[col])).join(', ')})`
    ).join(', ');
    await conn.query(`INSERT INTO "${tableName}" VALUES ${values}`);
  }

  return { tableName, columns };
};
