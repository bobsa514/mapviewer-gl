/**
 * SQL Editor — floating workspace overlay anchored to the bottom of the map.
 *
 * Layout (v2.3 redesign):
 *   ┌──────────────────────────────────────────────┐
 *   │ SQL workspace                   [Help] [×]   │ ← .sql-head
 *   ├────────────┬─────────────────────────────────┤
 *   │ Tables     │ textarea (SQL)                  │
 *   │ Templates  │ toolbar (templates · ⌘↵ run)    │
 *   │            │ results                         │
 *   │            │ meta bar (rows · time · add)    │
 *   └────────────┴─────────────────────────────────┘
 *
 * Each registered layer / DuckDB-only table becomes a clickable row that
 * injects `SELECT * FROM <table> LIMIT 10` into the editor. Spatial query
 * templates (preview, count, spatial join, buffer+intersect) are provided.
 *
 * DuckDB-WASM is lazily initialized on first render.
 */

import React, { useState, useCallback, useRef, useEffect } from 'react';
import type { FeatureCollection } from 'geojson';
import type { DuckDBOnlyTable } from '../types';
import { CloseIcon, PlayIcon, DownloadIcon, PlusIcon, SparkIcon, SqlIcon } from './icons';

interface SQLEditorProps {
  registeredTables: string[];
  duckdbOnlyTables: DuckDBOnlyTable[];
  onAddLayer: (name: string, geojson: FeatureCollection) => void;
  onDuckDBReady: () => void;
  onClose: () => void;
  onRemoveDuckDBOnlyTable: (tableName: string) => void;
}

interface Template {
  name: string;
  build: (a: string, b: string) => string;
}

const TEMPLATES: Template[] = [
  { name: 'Preview rows', build: (t) => `SELECT * FROM ${t}\nLIMIT 10;` },
  { name: 'Row count', build: (t) => `SELECT COUNT(*) AS n FROM ${t};` },
  {
    name: 'Spatial join',
    build: (a, b) =>
      `SELECT a.*, b.*\nFROM ${a} a, ${b} b\nWHERE ST_Within(a.geom, b.geom)\nLIMIT 100;`,
  },
  {
    name: 'Buffer + intersect',
    build: (a, b) =>
      `SELECT a.*, b.*\nFROM ${a} a, ${b} b\nWHERE ST_Intersects(\n  ST_Buffer(a.geom, 0.01),\n  b.geom\n)\nLIMIT 100;`,
  },
];

export const SQLEditor: React.FC<SQLEditorProps> = ({
  registeredTables,
  duckdbOnlyTables,
  onAddLayer,
  onDuckDBReady,
  onClose,
  onRemoveDuckDBOnlyTable,
}) => {
  const [isLoading, setIsLoading] = useState(false);
  const [isDuckDBReady, setIsDuckDBReady] = useState(false);
  const [sql, setSql] = useState('');
  const [result, setResult] = useState<{
    columns: string[];
    rows: any[][];
    hasGeometry: boolean;
    geojson?: FeatureCollection;
    rowCount: number;
    executionTimeMs: number;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const taRef = useRef<HTMLTextAreaElement>(null);

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
          .catch((err) => {
            setError(`Failed to load DuckDB: ${err.message ?? String(err)}`);
            setIsLoading(false);
          });
      });
    }
  }, [isDuckDBReady, onDuckDBReady]);

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
      setError(err?.message ?? 'Query execution failed');
    } finally {
      setIsLoading(false);
    }
  }, [sql]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
        e.preventDefault();
        runQuery();
      }
    },
    [runQuery]
  );

  const insertForTable = (table: string) => {
    setSql(`SELECT * FROM ${table} LIMIT 10;`);
    setTimeout(() => taRef.current?.focus(), 30);
  };

  const insertTemplate = (tpl: Template) => {
    const a = registeredTables[0] ?? 'table_a';
    const b = registeredTables[1] ?? 'table_b';
    setSql(tpl.build(a, b));
    setTimeout(() => taRef.current?.focus(), 30);
  };

  const handleAddAsLayer = useCallback(() => {
    if (result?.geojson) {
      onAddLayer(`sql_result_${Date.now()}`, result.geojson);
    }
  }, [result, onAddLayer]);

  const exportCSV = () => {
    if (!result) return;
    const csvRows = [
      result.columns.join(','),
      ...result.rows.map((row) =>
        row
          .map((cell) => {
            if (cell === null || cell === undefined) return '';
            const str = String(cell);
            return str.includes(',') || str.includes('"') || str.includes('\n')
              ? `"${str.replace(/"/g, '""')}"`
              : str;
          })
          .join(',')
      ),
    ];
    const blob = new Blob([csvRows.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'query_results.csv';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="sql-overlay" onClick={(e) => e.stopPropagation()}>
      <div className="sql-head">
        <div className="sql-head-left">
          <SqlIcon size={16} />
          <h3>SQL <em>workspace</em></h3>
          <span className="chip">DuckDB · spatial</span>
        </div>
        <div className="row" style={{ gap: 6 }}>
          <button className="icon-btn" onClick={onClose} aria-label="Close SQL editor">
            <CloseIcon size={14} />
          </button>
        </div>
      </div>

      <div className="sql-body">
        <div className="sql-tables">
          <div className="sql-tables-title">Tables in scope</div>
          {registeredTables.length === 0 && (
            <div className="muted" style={{ fontSize: 11 }}>
              No tables — add data layers first.
            </div>
          )}
          {registeredTables.map((t) => {
            const dbOnly = duckdbOnlyTables.find((d) => d.tableName === t);
            return (
              <div
                key={t}
                className="sql-table-row"
                onClick={() => insertForTable(t)}
                title={dbOnly ? `${t} · ${dbOnly.sourceType}` : t}
              >
                <span
                  className="dot"
                  style={{ background: dbOnly ? 'var(--ink-4)' : 'var(--accent)' }}
                />
                <span>{t}</span>
                {dbOnly && (
                  <button
                    className="icon-btn"
                    title="Remove table"
                    aria-label="Remove SQL-only table"
                    style={{ marginLeft: 'auto' }}
                    onClick={(e) => {
                      e.stopPropagation();
                      onRemoveDuckDBOnlyTable(t);
                    }}
                  >
                    <CloseIcon size={10} />
                  </button>
                )}
              </div>
            );
          })}

          <div className="sql-tables-title" style={{ marginTop: 16 }}>
            Templates
          </div>
          {TEMPLATES.map((t) => (
            <div key={t.name} className="sql-table-row" onClick={() => insertTemplate(t)}>
              <SparkIcon size={11} />
              <span>{t.name}</span>
            </div>
          ))}
        </div>

        <div className="sql-main">
          <textarea
            ref={taRef}
            className="sql-editor"
            value={sql}
            onChange={(e) => setSql(e.target.value)}
            onKeyDown={handleKeyDown}
            spellCheck={false}
            placeholder={
              registeredTables.length > 0
                ? `-- Every layer is a SQL table. Try Cmd/Ctrl + Enter.\nSELECT * FROM ${registeredTables[0]} LIMIT 10;`
                : '-- Add data layers first, then query them here.'
            }
            aria-label="SQL query input"
          />
          <div className="sql-toolbar">
            <div className="sql-templates">
              {TEMPLATES.slice(0, 3).map((t) => (
                <button key={t.name} className="sql-tpl" onClick={() => insertTemplate(t)}>
                  {t.name}
                </button>
              ))}
            </div>
            <div className="sql-run">
              <span className="muted">
                <kbd
                  style={{
                    fontFamily: 'var(--font-mono)',
                    background: 'var(--bg-raised)',
                    border: '1px solid var(--line)',
                    padding: '1px 5px',
                    borderRadius: 3,
                    fontSize: 10.5,
                  }}
                >
                  ⌘↵
                </kbd>{' '}
                to run
              </span>
              <button
                className="btn sm accent"
                onClick={runQuery}
                disabled={isLoading || !sql.trim()}
              >
                <PlayIcon size={10} /> {isLoading && isDuckDBReady ? 'Running…' : 'Run query'}
              </button>
            </div>
          </div>

          <div className="sql-results">
            {isLoading && !isDuckDBReady && (
              <div style={{ padding: '32px 20px', color: 'var(--ink-3)', textAlign: 'center', fontSize: 12 }}>
                Loading DuckDB…
              </div>
            )}
            {error && (
              <div
                style={{
                  padding: '12px 14px',
                  color: 'oklch(0.45 0.15 28)',
                  fontSize: 12,
                  background: 'oklch(0.97 0.02 28)',
                  borderBottom: '1px solid oklch(0.9 0.05 28)',
                }}
                role="alert"
              >
                {error}
              </div>
            )}
            {!result && !isLoading && !error && (
              <div style={{ padding: '32px 20px', color: 'var(--ink-3)', textAlign: 'center', fontSize: 12 }}>
                <div
                  style={{
                    fontFamily: 'var(--font-display)',
                    fontSize: 22,
                    color: 'var(--ink-2)',
                    fontStyle: 'italic',
                    marginBottom: 6,
                  }}
                >
                  No results yet
                </div>
                Press{' '}
                <kbd
                  className="mono"
                  style={{
                    background: 'var(--bg-raised)',
                    border: '1px solid var(--line)',
                    padding: '1px 5px',
                    borderRadius: 3,
                  }}
                >
                  ⌘↵
                </kbd>{' '}
                to execute the query above.
              </div>
            )}
            {result && (
              <table>
                <thead>
                  <tr>
                    {result.columns.map((c) => (
                      <th key={c}>{c}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {result.rows.slice(0, 1000).map((row, i) => (
                    <tr key={i}>
                      {row.map((v, j) => (
                        <td
                          key={j}
                          className={
                            v === null || v === undefined
                              ? 'null'
                              : typeof v === 'number'
                              ? 'num'
                              : ''
                          }
                        >
                          {v === null || v === undefined
                            ? 'null'
                            : typeof v === 'boolean'
                            ? String(v)
                            : typeof v === 'number'
                            ? v.toLocaleString()
                            : String(v)}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          {result && (
            <div className="sql-meta">
              <span className="stat">
                <span className="muted">rows</span> {result.rowCount.toLocaleString()}
              </span>
              <span className="stat">
                <span className="muted">time</span> {result.executionTimeMs.toFixed(0)}ms
              </span>
              {result.hasGeometry && (
                <span className="chip accent">
                  <span className="badge-dot" /> geometry column detected
                </span>
              )}
              <span className="space" />
              <button className="btn sm" onClick={exportCSV}>
                <DownloadIcon size={12} /> Export CSV
              </button>
              {result.hasGeometry && result.geojson && (
                <button className="btn sm accent" onClick={handleAddAsLayer}>
                  <PlusIcon size={12} /> Add as map layer
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
