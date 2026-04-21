/**
 * Left-rail filter panel. Replaces the old modal-style FilterModal but preserves
 * the same filter capabilities: numeric range, numeric/text comparison, and
 * text multi-select (comma-separated values).
 */

import React, { useState, useMemo, useEffect } from 'react';
import type { LayerInfo, FilterInfo } from '../types';
import { CloseIcon } from './icons';

type ComparisonOperator = '=' | '<=' | '<' | '>=' | '>';

type ColumnMeta = {
  name: string;
  type: 'numeric' | 'text';
  uniqueValues?: string[];
  min?: number;
  max?: number;
};

interface ActiveFilterEntry {
  fn: (item: any) => boolean;
  info: FilterInfo;
}

interface FilterPanelProps {
  layer: LayerInfo;
  activeFilters: ActiveFilterEntry[];
  onApplyFilter: (layerId: number, fn: (item: any) => boolean, info: FilterInfo) => void;
  onRemoveFilter: (layerId: number, index: number) => void;
}

const extractDataItems = (layer: LayerInfo): any[] => {
  if (layer.type === 'geojson') return (layer.data?.features || []) as any[];
  if (layer.type === 'h3') return (layer.data || []).map((d: any) => ({ properties: d.properties }));
  return (layer.data || []) as any[];
};

const buildColumns = (items: any[]): ColumnMeta[] => {
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

const buildFilterFn = (column: ColumnMeta, info: FilterInfo): (item: any) => boolean => {
  return (item: any) => {
    const raw = item?.properties?.[column.name] ?? item?.[column.name];
    if (info.type === 'numeric') {
      const n = typeof raw === 'number' ? raw : parseFloat(String(raw));
      if (isNaN(n)) return false;
      if (info.value.type === 'range') return n >= info.value.min && n <= info.value.max;
      const v = Number(info.value.value);
      switch (info.value.operator) {
        case '=': return n === v;
        case '<': return n < v;
        case '<=': return n <= v;
        case '>': return n > v;
        case '>=': return n >= v;
      }
    }
    const s = String(raw ?? '').toLowerCase();
    if (info.value.type === 'multiple') {
      return info.value.values.some((v) => s.includes(v.toLowerCase()));
    }
    const v = String(info.value.value).toLowerCase();
    switch (info.value.operator) {
      case '=': return s === v;
      case '<': return s < v;
      case '<=': return s <= v;
      case '>': return s > v;
      case '>=': return s >= v;
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
  const [op, setOp] = useState<ComparisonOperator | 'range'>('=');
  const [value, setValue] = useState<string>('');
  const [rangeMin, setRangeMin] = useState<string>('');
  const [rangeMax, setRangeMax] = useState<string>('');

  useEffect(() => {
    if (columns.length > 0 && !columns.some((c) => c.name === colName)) {
      setColName(columns[0].name);
    }
  }, [columns, colName]);

  const currentCol = columns.find((c) => c.name === colName);

  useEffect(() => {
    // When column changes, reset operator/value; prefill range for numeric
    setValue('');
    if (currentCol?.type === 'numeric') {
      setRangeMin(currentCol.min !== undefined ? String(currentCol.min) : '');
      setRangeMax(currentCol.max !== undefined ? String(currentCol.max) : '');
      if (op === 'range') return; // keep range mode
    } else {
      setRangeMin('');
      setRangeMax('');
      if (op === 'range') setOp('=');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [colName]);

  const handleApply = () => {
    if (!currentCol) return;
    let info: FilterInfo;
    if (currentCol.type === 'numeric') {
      if (op === 'range') {
        const min = parseFloat(rangeMin);
        const max = parseFloat(rangeMax);
        if (isNaN(min) || isNaN(max)) return;
        info = { column: currentCol.name, type: 'numeric', value: { type: 'range', min, max } };
      } else {
        const n = parseFloat(value);
        if (isNaN(n)) return;
        info = { column: currentCol.name, type: 'numeric', value: { type: 'comparison', operator: op, value: n } };
      }
    } else {
      if (op === 'range') return;
      if (op === '=' && value.includes(',')) {
        const values = value.split(',').map((v) => v.trim()).filter(Boolean);
        if (values.length === 0) return;
        info = { column: currentCol.name, type: 'text', value: { type: 'multiple', values } };
      } else if (op === '=' && value.trim().length > 0) {
        info = { column: currentCol.name, type: 'text', value: { type: 'multiple', values: [value.trim()] } };
      } else if (value.trim().length > 0) {
        info = { column: currentCol.name, type: 'text', value: { type: 'comparison', operator: op, value: value.trim() } };
      } else {
        return;
      }
    }

    onApplyFilter(layer.id, buildFilterFn(currentCol, info), info);
    setValue('');
  };

  const opOptions: Array<ComparisonOperator | 'range'> = currentCol?.type === 'numeric'
    ? ['=', '<', '<=', '>', '>=', 'range']
    : ['=', '<', '<=', '>', '>='];

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
            <span className="muted">
              {f.info.value.type === 'range'
                ? 'range'
                : f.info.value.type === 'multiple'
                ? '='
                : f.info.value.operator}
            </span>
            <code>
              {f.info.value.type === 'range'
                ? `${f.info.value.min}…${f.info.value.max}`
                : f.info.value.type === 'multiple'
                ? f.info.value.values.join(', ')
                : String(f.info.value.value)}
            </code>
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
              onChange={(e) => setOp(e.target.value as ComparisonOperator | 'range')}
              aria-label="Filter operator"
            >
              {opOptions.map((o) => (
                <option key={o} value={o}>{o}</option>
              ))}
            </select>
          </div>
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
          ) : (
            <div className="row" style={{ gap: 6 }}>
              <input
                className="input"
                style={{ flex: 1 }}
                type={currentCol?.type === 'numeric' ? 'number' : 'text'}
                placeholder={
                  currentCol?.type === 'text' && op === '='
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
          {currentCol?.type === 'text' && op === '=' && (
            <div className="muted" style={{ fontSize: 11 }}>
              Matches if the cell contains any of the comma-separated terms.
            </div>
          )}
        </div>
      )}
    </div>
  );
};
