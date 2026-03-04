/**
 * SQL Editor panel — a bottom-anchored split-pane UI for running DuckDB queries.
 *
 * Left pane: SQL textarea with syntax help and registered table chips.
 * Right pane: results table or contextual help with example queries.
 * If query results include a geometry column, an "Add as Layer" button
 * lets the user visualize the output on the map.
 *
 * DuckDB-WASM is lazily initialized on first render; the editor shows
 * a loading spinner until the WASM module is ready.
 */

import React, { useState, useCallback, useRef, useEffect } from 'react';
import { XMarkIcon } from '@heroicons/react/24/outline';
import type { FeatureCollection } from 'geojson';

interface SQLEditorProps {
  registeredTables: string[];
  onAddLayer: (name: string, geojson: FeatureCollection) => void;
  onDuckDBReady: () => void;
  onClose: () => void;
}

export const SQLEditor: React.FC<SQLEditorProps> = ({ registeredTables, onAddLayer, onDuckDBReady, onClose }) => {
  const [isLoading, setIsLoading] = useState(false);
  const [isDuckDBReady, setIsDuckDBReady] = useState(false);
  const [sql, setSql] = useState('');
  const [showHelp, setShowHelp] = useState(false);
  const [leftWidthPercent, setLeftWidthPercent] = useState(60);
  const [result, setResult] = useState<{
    columns: string[];
    rows: any[][];
    hasGeometry: boolean;
    geojson?: FeatureCollection;
    rowCount: number;
    executionTimeMs: number;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const isDraggingRef = useRef(false);

  useEffect(() => {
    if (!isDuckDBReady) {
      setIsLoading(true);
      import('../utils/duckdb').then(({ initDuckDB }) => {
        initDuckDB()
          .then(() => {
            setIsDuckDBReady(true);
            setIsLoading(false);
            onDuckDBReady();
          })
          .catch(err => {
            setError(`Failed to load DuckDB: ${err.message}`);
            setIsLoading(false);
          });
      });
    }
  }, [isDuckDBReady, onDuckDBReady]);

  // Divider drag handling
  const handleDividerMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    isDraggingRef.current = true;

    const onMouseMove = (e: MouseEvent) => {
      if (!isDraggingRef.current || !containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      const newPercent = ((e.clientX - rect.left) / rect.width) * 100;
      setLeftWidthPercent(Math.min(80, Math.max(20, newPercent)));
    };

    const onMouseUp = () => {
      isDraggingRef.current = false;
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
    };

    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
  }, []);

  const runQuery = useCallback(async () => {
    if (!sql.trim()) return;
    setError(null);
    setResult(null);
    setIsLoading(true);

    try {
      const { executeQuery } = await import('../utils/duckdb');
      const queryResult = await executeQuery(sql);
      setResult(queryResult);
    } catch (err: any) {
      setError(err.message || 'Query execution failed');
    } finally {
      setIsLoading(false);
    }
  }, [sql]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
      e.preventDefault();
      runQuery();
    }
  }, [runQuery]);

  const handleAddAsLayer = useCallback(() => {
    if (result?.geojson) {
      const name = `sql_result_${Date.now()}`;
      onAddLayer(name, result.geojson);
    }
  }, [result, onAddLayer]);

  const insertExample = (example: string) => {
    setSql(example);
    setShowHelp(false);
    textareaRef.current?.focus();
  };

  return (
    <div className="fixed bottom-0 left-0 right-0 z-[90] bg-white border-t border-gray-300 shadow-lg h-[40vh]">
      {/* Header bar */}
      <div className="flex items-center justify-between px-4 h-9 bg-gray-100 border-b border-gray-200 select-none">
        <div className="flex items-center space-x-2">
          <span className="text-sm font-medium text-gray-700">SQL Editor</span>
          {isDuckDBReady && registeredTables.length > 0 && (
            <span className="text-xs text-gray-400">
              ({registeredTables.length} table{registeredTables.length !== 1 ? 's' : ''})
            </span>
          )}
        </div>
        <div className="flex items-center space-x-3">
          {result && (
            <span className="text-xs text-gray-500">
              {result.rowCount} rows in {result.executionTimeMs.toFixed(0)}ms
            </span>
          )}
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition-colors">
            <XMarkIcon className="h-4 w-4" />
          </button>
        </div>
      </div>

      <div ref={containerRef} className="flex h-[calc(100%-36px)]">
        {/* Left: SQL input */}
        <div style={{ width: `${leftWidthPercent}%` }} className="flex flex-col">
          {isLoading && !isDuckDBReady ? (
            <div className="flex-1 flex items-center justify-center">
              <div className="text-center">
                <div className="animate-spin h-8 w-8 border-4 border-blue-500 border-t-transparent rounded-full mx-auto mb-2"></div>
                <p className="text-sm text-gray-500">Loading DuckDB...</p>
              </div>
            </div>
          ) : (
            <>
              <textarea
                ref={textareaRef}
                value={sql}
                onChange={(e) => setSql(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={registeredTables.length > 0
                  ? `Try: SELECT * FROM ${registeredTables[0]} LIMIT 10`
                  : 'Add data layers first, then query them here...'}
                className="flex-1 p-3 font-mono text-sm resize-none outline-none bg-gray-50"
                spellCheck={false}
                autoFocus
              />
              <div className="flex items-center justify-between px-3 py-2 bg-gray-50 border-t border-gray-200">
                <div className="flex items-center space-x-2">
                  <button
                    onClick={runQuery}
                    disabled={isLoading || !sql.trim()}
                    className="px-3 py-1 text-sm font-medium text-white bg-blue-600 rounded hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isLoading ? 'Running...' : 'Run'}
                  </button>
                  {result?.hasGeometry && (
                    <button
                      onClick={handleAddAsLayer}
                      className="px-3 py-1 text-sm font-medium text-blue-600 bg-blue-50 rounded hover:bg-blue-100"
                    >
                      Add as Layer
                    </button>
                  )}
                  <button
                    onClick={() => setShowHelp(!showHelp)}
                    className={`px-2 py-1 text-xs rounded transition-colors ${showHelp ? 'bg-blue-100 text-blue-700' : 'text-gray-500 hover:text-gray-700 hover:bg-gray-100'}`}
                    title="Help & examples"
                  >
                    ?
                  </button>
                </div>
                {registeredTables.length > 0 && (
                  <div className="flex items-center gap-1.5 flex-wrap justify-end max-w-[50%]">
                    {registeredTables.map(t => (
                      <button
                        key={t}
                        onClick={() => insertExample(`SELECT * FROM ${t} LIMIT 10`)}
                        className="text-xs px-1.5 py-0.5 bg-gray-100 text-blue-600 rounded hover:bg-blue-50 hover:text-blue-700 truncate max-w-[140px]"
                        title={t}
                      >
                        {t}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </>
          )}
        </div>

        {/* Resizable divider */}
        <div
          className="w-1.5 bg-gray-200 hover:bg-blue-400 cursor-col-resize flex-shrink-0 transition-colors"
          onMouseDown={handleDividerMouseDown}
        />

        {/* Right: Results or Help */}
        <div style={{ width: `${100 - leftWidthPercent}%` }} className="flex flex-col overflow-hidden">
          {showHelp ? (
            <div className="flex-1 overflow-auto p-4 text-sm text-gray-600 space-y-4 text-left">
              <div>
                <h3 className="font-semibold text-gray-800 mb-1">How it works</h3>
                <p>Each layer you add becomes a SQL table. The table name is derived from the file name (lowercase, special characters replaced with underscores).</p>
              </div>

              {registeredTables.length > 0 && (
                <div>
                  <h3 className="font-semibold text-gray-800 mb-1">Your tables</h3>
                  <div className="space-y-1">
                    {registeredTables.map(t => (
                      <div key={t} className="flex items-center justify-between bg-gray-50 px-2 py-1 rounded">
                        <code className="text-xs font-mono text-blue-600">{t}</code>
                        <button
                          onClick={() => insertExample(`SELECT * FROM ${t} LIMIT 10`)}
                          className="text-xs text-blue-500 hover:underline"
                        >
                          query
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div>
                <h3 className="font-semibold text-gray-800 mb-1">Example queries</h3>
                <div className="space-y-2">
                  {registeredTables.length > 0 && (
                    <>
                      <ExampleQuery
                        label="Preview data"
                        sql={`SELECT * FROM ${registeredTables[0]} LIMIT 10`}
                        onInsert={insertExample}
                      />
                      <ExampleQuery
                        label="Count rows"
                        sql={`SELECT COUNT(*) as total FROM ${registeredTables[0]}`}
                        onInsert={insertExample}
                      />
                    </>
                  )}
                  {registeredTables.length >= 2 && (
                    <ExampleQuery
                      label="Join two layers"
                      sql={`SELECT a.*, b.*\nFROM ${registeredTables[0]} a\nJOIN ${registeredTables[1]} b\n  ON a.geom = b.geom\nLIMIT 10`}
                      onInsert={insertExample}
                    />
                  )}
                  <ExampleQuery
                    label="Spatial join (points in polygons)"
                    sql={`SELECT a.*, b.*\nFROM points a, polygons b\nWHERE ST_Within(a.geom, b.geom)`}
                    onInsert={insertExample}
                  />
                  <ExampleQuery
                    label="Buffer & intersect"
                    sql={`SELECT a.*, b.*\nFROM layer_a a, layer_b b\nWHERE ST_Intersects(\n  ST_Buffer(a.geom, 0.01),\n  b.geom\n)`}
                    onInsert={insertExample}
                  />
                </div>
              </div>

              <div>
                <h3 className="font-semibold text-gray-800 mb-1">Add results as a layer</h3>
                <p>If your query returns a <code className="text-xs bg-gray-100 px-1 rounded">geom</code> column, an "Add as Layer" button appears to visualize the results on the map.</p>
              </div>

              <div>
                <h3 className="font-semibold text-gray-800 mb-1">Keyboard shortcut</h3>
                <p><kbd className="px-1.5 py-0.5 bg-gray-100 border border-gray-300 rounded text-xs">Ctrl</kbd> + <kbd className="px-1.5 py-0.5 bg-gray-100 border border-gray-300 rounded text-xs">Enter</kbd> to run query</p>
              </div>
            </div>
          ) : (
            <>
              {error && (
                <div className="p-3 bg-red-50 border-b border-red-200 text-sm text-red-700 text-left">
                  {error}
                </div>
              )}
              {result && (
                <div className="flex-1 overflow-auto">
                  <table className="min-w-full text-xs">
                    <thead className="bg-gray-50 sticky top-0">
                      <tr>
                        {result.columns.map((col, i) => (
                          <th key={i} className="px-3 py-2 text-left font-medium text-gray-500 border-b border-gray-200">
                            {col}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {result.rows.slice(0, 1000).map((row, i) => (
                        <tr key={i} className={i % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                          {row.map((cell, j) => (
                            <td key={j} className="px-3 py-1.5 text-gray-600 border-b border-gray-100 max-w-[200px] truncate text-left">
                              {cell === null ? <span className="text-gray-300">NULL</span> : String(cell)}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
              {!result && !error && (
                <div className="flex-1 flex flex-col items-start justify-center text-sm text-gray-400 p-4 text-left">
                  {registeredTables.length > 0 ? (
                    <>
                      <p>Run a query to see results</p>
                      <p className="mt-2 text-xs">Click <span className="text-blue-500">?</span> for help & examples</p>
                    </>
                  ) : (
                    <>
                      <p>No tables available yet</p>
                      <p className="mt-1 text-xs">Add data layers to the map first &mdash; each layer becomes a queryable SQL table</p>
                    </>
                  )}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
};

const ExampleQuery: React.FC<{ label: string; sql: string; onInsert: (sql: string) => void }> = ({ label, sql, onInsert }) => (
  <div className="bg-gray-50 rounded p-2 text-left">
    <div className="flex items-center justify-between mb-1">
      <span className="text-xs font-medium text-gray-700">{label}</span>
      <button onClick={() => onInsert(sql)} className="text-xs text-blue-500 hover:underline">use</button>
    </div>
    <pre className="text-xs font-mono text-gray-500 whitespace-pre-wrap">{sql}</pre>
  </div>
);
