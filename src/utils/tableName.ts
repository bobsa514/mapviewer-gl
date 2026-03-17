/**
 * Table name utilities — extracted from duckdb.ts so that components can
 * import sanitizeTableName without pulling in the heavy DuckDB-WASM bundle.
 */

/** Track registered table names to avoid collisions when uploading files with the same name. */
export const registeredTableNames = new Set<string>();

/** Convert a layer/file name into a safe SQL table identifier (lowercase, underscores). */
export const sanitizeTableName = (name: string, deduplicate = true): string => {
  const base = name
    .replace(/\.[^.]+$/, '') // remove file extension
    .replace(/[^a-zA-Z0-9_]/g, '_') // replace non-alphanumeric
    .replace(/^(\d)/, '_$1') // prefix if starts with digit
    .toLowerCase();

  if (!deduplicate) return base;

  let candidate = base;
  let counter = 1;
  while (registeredTableNames.has(candidate)) {
    candidate = `${base}_${counter}`;
    counter++;
  }
  registeredTableNames.add(candidate);
  return candidate;
};
