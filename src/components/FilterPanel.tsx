/**
 * Left-rail filter panel. Replaces the old modal-style FilterModal.
 *
 * Filter capabilities:
 *   - numeric `range` — bounded inclusive range (min ≤ v ≤ max)
 *   - numeric `=`, `<`, `<=`, `>`, `>=` — exact comparison
 *   - text `=` — autocomplete multi-select from column's unique values.
 *     Click suggestions to pick exact values (OR semantics, case-insensitive).
 *   - text `<`, `<=`, `>`, `>=` — exact string comparison
 *   - text `contains` — case-insensitive substring match with comma-separated
 *     OR semantics
 */

import React, { useState, useMemo, useEffect, useRef } from 'react';
import type { LayerInfo, FilterInfo, ComparisonOperator } from '../types';
import { CloseIcon } from './icons';

/** Operators available in the rail UI. `range` (numeric) and `contains` (text)
 *  are UI-only variants that serialize to `type: 'range'` and `type: 'multiple'`
 *  respectively. The five comparison operators serialize to `type: 'comparison'`. */
export type Operator = ComparisonOperator | 'range' | 'contains';

export type ColumnMeta = {
  name: string;
  type: 'numeric' | 'text';
  uniqueValues?: string[];
  min?: number;
  max?: number;
};

export interface ActiveFilterEntry {
  fn: (item: any) => boolean;
  info: FilterInfo;
}

interface FilterPanelProps {
  layer: LayerInfo;
  activeFilters: ActiveFilterEntry[];
  onApplyFilter: (layerId: number, fn: (item: any) => boolean, info: FilterInfo) => void;
  onRemoveFilter: (layerId: number, index: number) => void;
}

export const extractDataItems = (layer: LayerInfo): any[] => {
  if (layer.type === 'geojson') return (layer.data?.features || []) as any[];
  if (layer.type === 'h3') return (layer.data || []).map((d: any) => ({ properties: d.properties }));
  return (layer.data || []) as any[];
};

/** Detect column types, min/max for numeric, unique values for text.  */
export const buildColumns = (items: any[]): ColumnMeta[] => {
  if (items.length === 0) return [];
  const first = items[0]?.properties ?? items[0];
  if (!first || typeof first !== 'object') return [];
  const keys = Object.keys(first).filter((k) => k !== 'position');
  return keys.map((key) => {
    let numericCount = 0;
    let nonEmpty = 0;
    let min = Infinity;
    let max = -Infinity;
    const uniques = new Set<string>();
    for (const item of items) {
      const raw = item?.properties?.[key] ?? item?.[key];
      if (raw === null || raw === undefined || raw === '') continue;
      nonEmpty += 1;
      const num = typeof raw === 'number' ? raw : parseFloat(String(raw));
      if (!isNaN(num) && isFinite(num)) {
        numericCount += 1;
        if (num < min) min = num;
        if (num > max) max = num;
      }
      uniques.add(String(raw));
    }
    const isNumeric = nonEmpty > 0 && numericCount / nonEmpty >= 0.5;
    return isNumeric
      ? { name: key, type: 'numeric', min: isFinite(min) ? min : 0, max: isFinite(max) ? max : 0 }
      : { name: key, type: 'text', uniqueValues: [...uniques].sort((a, b) => a.localeCompare(b)) };
  });
};

/**
 * Build a filter function from a ColumnMeta and a serialised FilterInfo.
 *
 * When `info.value.type === 'multiple'` and `match === 'exact'`, the function
 * performs a case-insensitive exact match against each value (OR semantics).
 * This is the autocomplete / multi-select path for text `=`.
 *
 * When `match` is absent or `'substring'`, it does case-insensitive substring
 * matching — the legacy `contains` path.
 */
export const buildFilterFn = (column: ColumnMeta, info: FilterInfo): (item: any) => boolean => {
  return (item: any) => {
    const raw = item?.properties?.[column.name] ?? item?.[column.name];

    if (info.value.type === 'range') {
      const n = typeof raw === 'number' ? raw : parseFloat(String(raw));
      if (isNaN(n)) return false;
      return n >= info.value.min && n <= info.value.max;
    }

    if (info.value.type === 'multiple') {
      if (info.value.match === 'exact') {
        const s = String(raw ?? '').toLowerCase();
        return info.value.values.some((v) => s === v.toLowerCase());
      }
      const lower = String(raw ?? '').toLowerCase();
      return info.value.values.some((v) => lower.includes(v.toLowerCase()));
    }

    if (info.type === 'numeric') {
      const n = typeof raw === 'number' ? raw : parseFloat(String(raw));
      if (isNaN(n)) return false;
      const v = Number(info.value.value);
      switch (info.value.operator) {
        case '=': return n === v;
        case '<': return n < v;
        case '<=': return n <= v;
        case '>': return n > v;
        case '>=': return n >= v;
      }
    }

    const raw_s = String(raw ?? '');
    const v = String(info.value.value);
    switch (info.value.operator) {
      case '=': return raw_s.toLowerCase() === v.toLowerCase();
      case '<': return raw_s < v;
      case '<=': return raw_s <= v;
      case '>': return raw_s > v;
      case '>=': return raw_s >= v;
    }
    return true;
  };
};

export const FilterPanel: React.FC<FilterPanelProps> = ({
  layer,
  activeFilters,
  onApplyFilter,
  onRemoveFilter,
}) => {
  const items = useMemo(() => extractDataItems(layer), [layer]);
  const columns = useMemo(() => buildColumns(items), [items]);
  const [colName, setColName] = useState<string>('');
  const [op, setOp] = useState<Operator>('=');
  const [value, setValue] = useState<string>('');
  const [rangeMin, setRangeMin] = useState<string>('');
  const [rangeMax, setRangeMax] = useState<string>('');

  // Autocomplete state for text `=` — multi-select chips + search
  const [pickedValues, setPickedValues] = useState<string[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [highlightIndex, setHighlightIndex] = useState(-1);
  const searchRef = useRef<HTMLInputElement>(null);
  const suggestionRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (columns.length > 0 && !columns.some((c) => c.name === colName)) {
      setColName(columns[0].name);
    }
  }, [columns, colName]);

  const currentCol = columns.find((c) => c.name === colName);

  // Reset draft when layer or column changes
  useEffect(() => {
    setValue('');
    setPickedValues([]);
    setShowSuggestions(false);
    if (currentCol?.type === 'numeric') {
      setRangeMin(currentCol.min !== undefined ? String(currentCol.min) : '');
      setRangeMax(currentCol.max !== undefined ? String(currentCol.max) : '');
      if (op === 'contains') setOp('=');
    } else {
      setRangeMin('');
      setRangeMax('');
      if (op === 'range') setOp('=');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [layer.id, colName]);

  // Filtered suggestions for autocomplete
  const filteredSuggestions = useMemo(() => {
    if (currentCol?.type !== 'text' || op !== '=' || !currentCol.uniqueValues) return [];
    const q = value.toLowerCase();
    // Exclude already-picked values; show up to 50
    return currentCol.uniqueValues
      .filter((v) => !pickedValues.includes(v) && v.toLowerCase().includes(q))
      .slice(0, 50);
  }, [currentCol, op, value, pickedValues]);

  // Close suggestions on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (
        showSuggestions &&
        suggestionRef.current &&
        searchRef.current &&
        !suggestionRef.current.contains(e.target as Node) &&
        !searchRef.current.contains(e.target as Node)
      ) {
        setShowSuggestions(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [showSuggestions]);

  const togglePick = (val: string) => {
    setPickedValues((prev) =>
      prev.includes(val) ? prev.filter((v) => v !== val) : [...prev, val]
    );
  };

  const removePick = (val: string) => {
    setPickedValues((prev) => prev.filter((v) => v !== val));
  };

  const handleApply = () => {
    if (!currentCol) return;
    let info: FilterInfo;

    if (currentCol.type === 'numeric') {
      if (op === 'range') {
        const min = parseFloat(rangeMin);
        const max = parseFloat(rangeMax);
        if (isNaN(min) || isNaN(max)) return;
        info = { column: currentCol.name, type: 'numeric', value: { type: 'range', min, max } };
      } else if (op === 'contains') {
        return;
      } else {
        const n = parseFloat(value);
        if (isNaN(n)) return;
        info = { column: currentCol.name, type: 'numeric', value: { type: 'comparison', operator: op, value: n } };
      }
    } else {
      if (op === 'range') return;

      if (op === '=' && pickedValues.length > 0) {
        info = { column: currentCol.name, type: 'text', value: { type: 'multiple', values: pickedValues, match: 'exact' } };
      } else if (op === 'contains') {
        const trimmed = value.trim();
        if (trimmed.length === 0) return;
        const values = trimmed.split(',').map((v) => v.trim()).filter(Boolean);
        if (values.length === 0) return;
        info = { column: currentCol.name, type: 'text', value: { type: 'multiple', values } };
      } else {
        const trimmed = value.trim();
        if (trimmed.length === 0) return;
        info = { column: currentCol.name, type: 'text', value: { type: 'comparison', operator: op, value: trimmed } };
      }
    }

    onApplyFilter(layer.id, buildFilterFn(currentCol, info), info);
    setValue('');
    setPickedValues([]);
    setShowSuggestions(false);
  };

  const opOptions: Operator[] = currentCol?.type === 'numeric'
    ? ['=', '<', '<=', '>', '>=', 'range']
    : ['=', '<', '<=', '>', '>=', 'contains'];

  // Render label for an active filter
  const filterLabel = (info: FilterInfo): string => {
    if (info.value.type === 'range') return 'range';
    if (info.value.type === 'multiple') return info.value.match === 'exact' ? 'is' : 'contains';
    return info.value.operator;
  };

  const filterValue = (info: FilterInfo): string => {
    if (info.value.type === 'range') return `${info.value.min}…${info.value.max}`;
    if (info.value.type === 'multiple') return info.value.values.join(', ');
    return String(info.value.value);
  };

  return (
    <div className="panel-section">
      <div className="panel-head">
        <div>
          <div className="panel-title">Filters<em>.</em></div>
          <div className="panel-desc">
            {activeFilters.length} active · AND
          </div>
        </div>
      </div>

      <div className="stack-sm">
        {activeFilters.map((f, i) => (
          <div key={i} className="filter-row">
            <code>{f.info.column}</code>
            <span className="muted">{filterLabel(f.info)}</span>
            <code>{filterValue(f.info)}</code>
            <span className="space" />
            <button className="icon-btn" onClick={() => onRemoveFilter(layer.id, i)} aria-label="Remove filter">
              <CloseIcon size={11} />
            </button>
          </div>
        ))}
        {activeFilters.length === 0 && (
          <div className="muted" style={{ fontSize: 12, padding: '4px 2px' }}>
            No filters yet. Add one below to hide rows from the map.
          </div>
        )}
      </div>

      {columns.length > 0 && (
        <div
          className="stack-sm"
          style={{
            marginTop: 12,
            padding: 10,
            background: 'var(--bg-sunken)',
            borderRadius: 8,
            border: '1px solid var(--line-2)',
          }}
        >
          <div className="row" style={{ gap: 6 }}>
            <select
              className="select"
              style={{ flex: 2 }}
              value={colName}
              onChange={(e) => setColName(e.target.value)}
              aria-label="Filter column"
            >
              {columns.map((c) => (
                <option key={c.name} value={c.name}>{c.name}</option>
              ))}
            </select>
            <select
              className="select"
              style={{ width: 86 }}
              value={op}
              onChange={(e) => setOp(e.target.value as Operator)}
              aria-label="Filter operator"
            >
              {opOptions.map((o) => (
                <option key={o} value={o}>{o}</option>
              ))}
            </select>
          </div>

          {/* Picked chips for text autocomplete */}
          {currentCol?.type === 'text' && op === '=' && pickedValues.length > 0 && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
              {pickedValues.map((v) => (
                <span key={v} className="chip" style={{ fontSize: 11 }}>
                  {v}
                  <button
                    className="icon-btn"
                    style={{ marginLeft: 4, width: 14, height: 14 }}
                    onClick={() => removePick(v)}
                    aria-label={`Remove ${v}`}
                  >
                    <CloseIcon size={8} />
                  </button>
                </span>
              ))}
            </div>
          )}

          {op === 'range' && currentCol?.type === 'numeric' ? (
            <div className="row" style={{ gap: 6 }}>
              <input
                className="input"
                style={{ flex: 1 }}
                type="number"
                placeholder="min"
                value={rangeMin}
                onChange={(e) => setRangeMin(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') handleApply(); }}
              />
              <input
                className="input"
                style={{ flex: 1 }}
                type="number"
                placeholder="max"
                value={rangeMax}
                onChange={(e) => setRangeMax(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') handleApply(); }}
              />
              <button className="btn sm accent" onClick={handleApply}>Add</button>
            </div>
          ) : currentCol?.type === 'text' && op === '=' ? (
            /* Autocomplete multi-select for text = */
            <div style={{ position: 'relative' }}>
              <div className="row" style={{ gap: 6 }}>
                <input
                  ref={searchRef}
                  className="input"
                  style={{ flex: 1 }}
                  type="text"
                  placeholder="Type to search suggestions…"
                  value={value}
                  onChange={(e) => {
                    setValue(e.target.value);
                    setShowSuggestions(true);
                    setHighlightIndex(-1);
                  }}
                  onFocus={() => {
                    if (filteredSuggestions.length > 0) setShowSuggestions(true);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      // If a suggestion is highlighted, pick it
                      if (showSuggestions && highlightIndex >= 0 && highlightIndex < filteredSuggestions.length) {
                        togglePick(filteredSuggestions[highlightIndex]);
                        setValue('');
                        setShowSuggestions(false);
                        setHighlightIndex(-1);
                      } else if (pickedValues.length > 0) {
                        handleApply();
                      }
                      e.preventDefault();
                    }
                    if (e.key === 'ArrowDown') {
                      e.preventDefault();
                      setShowSuggestions(true);
                      setHighlightIndex((prev) =>
                        prev < filteredSuggestions.length - 1 ? prev + 1 : 0
                      );
                    }
                    if (e.key === 'ArrowUp') {
                      e.preventDefault();
                      setHighlightIndex((prev) =>
                        prev > 0 ? prev - 1 : filteredSuggestions.length - 1
                      );
                    }
                    if (e.key === 'Escape') {
                      setShowSuggestions(false);
                      setHighlightIndex(-1);
                    }
                  }}
                  aria-label="Search filter values"
                />
                <button className="btn sm accent" onClick={handleApply} disabled={pickedValues.length === 0}>
                  Add
                </button>
              </div>
              {showSuggestions && filteredSuggestions.length > 0 && (
                <div
                  ref={suggestionRef}
                  className="suggestions-dropdown"
                  style={{
                    position: 'absolute',
                    zIndex: 10,
                    top: '100%',
                    left: 0,
                    right: 58,
                    marginTop: 2,
                    maxHeight: 180,
                    overflowY: 'auto',
                    background: 'var(--surface)',
                    border: '1px solid var(--line)',
                    borderRadius: 8,
                    boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
                  }}
                >
                  {filteredSuggestions.map((s, i) => {
                    const picked = pickedValues.includes(s);
                    return (
                      <div
                        key={s}
                        className={`suggestion-item ${i === highlightIndex ? 'highlighted' : ''}`}
                        style={{
                          padding: '5px 10px',
                          fontSize: 12,
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          gap: 6,
                          background: i === highlightIndex ? 'var(--bg-sunken)' : picked ? 'var(--accent-soft)' : undefined,
                        }}
                        onMouseDown={(e) => {
                          e.preventDefault();
                          togglePick(s);
                          setValue('');
                          searchRef.current?.focus();
                        }}
                        onMouseEnter={() => setHighlightIndex(i)}
                      >
                        <span style={{ width: 14, fontSize: 10, flexShrink: 0 }}>
                          {picked ? '✓' : ''}
                        </span>
                        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {s}
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}
              {showSuggestions && filteredSuggestions.length === 0 && value.length > 0 && (
                <div
                  style={{
                    position: 'absolute',
                    zIndex: 10,
                    top: '100%',
                    left: 0,
                    right: 58,
                    marginTop: 2,
                    padding: '6px 10px',
                    fontSize: 11,
                    color: 'var(--ink-3)',
                    background: 'var(--surface)',
                    border: '1px solid var(--line)',
                    borderRadius: 8,
                  }}
                >
                  No matching values found
                </div>
              )}
              <div className="muted" style={{ fontSize: 11, marginTop: 4 }}>
                Search and click to pick values.{' '}
                {pickedValues.length > 0 ? `${pickedValues.length} selected — press Add to apply.` : 'Select at least one to enable the filter.'}
              </div>
            </div>
          ) : (
            <div className="row" style={{ gap: 6 }}>
              <input
                className="input"
                style={{ flex: 1 }}
                type={currentCol?.type === 'numeric' ? 'number' : 'text'}
                placeholder={
                  currentCol?.type === 'text' && op === 'contains'
                    ? 'value (comma-separated for OR)'
                    : 'value'
                }
                value={value}
                onChange={(e) => setValue(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') handleApply(); }}
              />
              <button className="btn sm accent" onClick={handleApply}>Add</button>
            </div>
          )}

          {currentCol?.type === 'text' && op === 'contains' && (
            <div className="muted" style={{ fontSize: 11 }}>
              Case-insensitive substring match. Use commas to OR multiple terms.
            </div>
          )}
          {currentCol?.type === 'text' && op === '=' && (
            <div className="muted" style={{ fontSize: 11 }}>
              Search suggestions from the data above. Pick one or more values, then press Add.
            </div>
          )}
        </div>
      )}
    </div>
  );
};
