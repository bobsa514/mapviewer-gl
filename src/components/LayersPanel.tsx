/**
 * Layers rail panel — list of map layers and SQL-only tables.
 *
 * Redesigned in v2.3: each row shows a color swatch + name + meta, with
 * actions (style / filter / toggle visibility / rename / remove) revealed on
 * hover or selection. Clicking a row sets it as the "selected layer," which
 * the parent uses to drive the Symbology/Filter rail panels below.
 *
 * SQL-only tables (DuckDB tables without map geometry) are grouped at the
 * bottom and only expose a rename/remove action.
 */

import React, { useEffect, useRef, useState } from 'react';
import type { LayerInfo, DuckDBOnlyTable } from '../types';
import { colorScales } from '../types';
import {
  EyeIcon,
  EyeOffIcon,
  PaletteIcon,
  FilterIcon,
  EditIcon,
  TrashIcon,
  DragIcon,
  PlusIcon,
} from './icons';

interface LayersPanelProps {
  layers: LayerInfo[];
  duckdbOnlyTables: DuckDBOnlyTable[];
  selectedLayerId: number | null;
  activeFilterCounts: Record<number, number>;
  onSelect: (layerId: number) => void;
  onToggleVisibility: (layerId: number) => void;
  onRename: (layerId: number, name: string) => void;
  onRemove: (layerId: number) => void;
  onReorder: (fromIndex: number, toIndex: number) => void;
  onAddData: () => void;
  onEditTarget: (layerId: number, target: 'style' | 'filter') => void;
  onRemoveDuckDBOnlyTable: (tableName: string) => void;
}

interface LayerRowProps {
  layer: LayerInfo;
  selected: boolean;
  filterCount: number;
  onSelect: () => void;
  onToggleVisibility: () => void;
  onRename: (name: string) => void;
  onRemove: () => void;
  onStyleClick: () => void;
  onFilterClick: () => void;
  onDragStart: () => void;
  onDragOver: (e: React.DragEvent) => void;
  onDrop: () => void;
  onDragEnd: () => void;
  dragOver: boolean;
  dragging: boolean;
}

const LayerRow: React.FC<LayerRowProps> = ({
  layer,
  selected,
  filterCount,
  onSelect,
  onToggleVisibility,
  onRename,
  onRemove,
  onStyleClick,
  onFilterClick,
  onDragStart,
  onDragOver,
  onDrop,
  onDragEnd,
  dragOver,
  dragging,
}) => {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(layer.name);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editing) inputRef.current?.focus();
  }, [editing]);

  const commit = () => {
    setEditing(false);
    if (draft.trim() && draft.trim() !== layer.name) onRename(draft.trim());
    else setDraft(layer.name);
  };

  const swatchStyle: React.CSSProperties = layer.colorMapping
    ? {
        background: `linear-gradient(135deg, ${colorScales[layer.colorMapping.colorScale][0]}, ${
          colorScales[layer.colorMapping.colorScale][colorScales[layer.colorMapping.colorScale].length - 1]
        })`,
      }
    : { background: layer.color };

  const meta = [
    layer.sourceType ?? (layer.type === 'h3' ? 'h3' : 'layer'),
    layer.type === 'geojson'
      ? `${layer.data?.features?.length ?? 0} feats`
      : layer.type === 'h3'
      ? `${layer.data?.length ?? 0} hexes`
      : `${layer.data?.length ?? 0} pts`,
  ].join(' · ');

  return (
    <div
      className={`layer-row ${selected ? 'selected' : ''} ${!layer.visible ? 'hidden' : ''} ${
        layer.type === 'h3' ? 'hex-variant' : ''
      }`}
      style={{
        borderTop: dragOver ? '2px solid var(--accent)' : undefined,
        opacity: dragging ? 0.5 : undefined,
      }}
      draggable
      onDragStart={onDragStart}
      onDragOver={onDragOver}
      onDrop={onDrop}
      onDragEnd={onDragEnd}
      onClick={onSelect}
      role="button"
      aria-selected={selected}
    >
      <span className="layer-drag" onClick={(e) => e.stopPropagation()} aria-hidden>
        <DragIcon size={12} />
      </span>
      <div
        className={`layer-swatch ${layer.colorMapping ? 'gradient' : ''} ${layer.type === 'h3' ? 'hex' : ''}`}
        style={swatchStyle}
      />
      <div style={{ minWidth: 0 }}>
        {editing ? (
          <input
            ref={inputRef}
            className="input"
            style={{ height: 22, fontSize: 12.5 }}
            value={draft}
            onClick={(e) => e.stopPropagation()}
            onChange={(e) => setDraft(e.target.value)}
            onBlur={commit}
            onKeyDown={(e) => {
              if (e.key === 'Enter') commit();
              if (e.key === 'Escape') {
                setEditing(false);
                setDraft(layer.name);
              }
            }}
          />
        ) : (
          <div
            className="layer-name"
            onDoubleClick={(e) => {
              e.stopPropagation();
              setEditing(true);
            }}
            title={layer.name}
          >
            {layer.name}
          </div>
        )}
        <div className="layer-meta">
          {meta}
          {filterCount > 0 && (
            <span style={{ color: 'var(--accent-ink)', marginLeft: 6 }}>
              · <span className="badge-dot" />
              {filterCount} filter{filterCount > 1 ? 's' : ''}
            </span>
          )}
        </div>
      </div>
      <div className="layer-actions" onClick={(e) => e.stopPropagation()}>
        <button className="icon-btn" title="Style" aria-label="Edit symbology" onClick={onStyleClick}>
          <PaletteIcon size={13} />
        </button>
        <button className="icon-btn" title="Filter" aria-label="Edit filters" onClick={onFilterClick}>
          <FilterIcon size={13} />
        </button>
        <button
          className="icon-btn"
          title={layer.visible ? 'Hide' : 'Show'}
          aria-label={layer.visible ? 'Hide layer' : 'Show layer'}
          onClick={onToggleVisibility}
        >
          {layer.visible ? <EyeIcon size={13} /> : <EyeOffIcon size={13} />}
        </button>
        <button
          className="icon-btn"
          title="Rename"
          aria-label="Rename layer"
          onClick={() => setEditing(true)}
        >
          <EditIcon size={13} />
        </button>
        <button className="icon-btn" title="Remove" aria-label="Remove layer" onClick={onRemove}>
          <TrashIcon size={13} />
        </button>
      </div>
    </div>
  );
};

export const LayersPanel: React.FC<LayersPanelProps> = ({
  layers,
  duckdbOnlyTables,
  selectedLayerId,
  activeFilterCounts,
  onSelect,
  onToggleVisibility,
  onRename,
  onRemove,
  onReorder,
  onAddData,
  onEditTarget,
  onRemoveDuckDBOnlyTable,
}) => {
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);

  return (
    <div className="panel-section">
      <div className="panel-head">
        <div>
          <div className="panel-title">Layers<em>.</em></div>
          <div className="panel-desc">
            {layers.length} map · {duckdbOnlyTables.length} sql-only
          </div>
        </div>
        <button className="btn sm" onClick={onAddData} aria-label="Add data">
          <PlusIcon size={11} /> Add
        </button>
      </div>

      <div>
        {layers.map((layer, index) => (
          <LayerRow
            key={layer.id}
            layer={layer}
            selected={selectedLayerId === layer.id}
            filterCount={activeFilterCounts[layer.id] ?? 0}
            onSelect={() => onSelect(layer.id)}
            onToggleVisibility={() => onToggleVisibility(layer.id)}
            onRename={(name) => onRename(layer.id, name)}
            onRemove={() => onRemove(layer.id)}
            onStyleClick={() => onEditTarget(layer.id, 'style')}
            onFilterClick={() => onEditTarget(layer.id, 'filter')}
            onDragStart={() => setDragIndex(index)}
            onDragOver={(e) => {
              e.preventDefault();
              e.dataTransfer.dropEffect = 'move';
              setDragOverIndex(index);
            }}
            onDrop={() => {
              if (dragIndex !== null && dragIndex !== index) onReorder(dragIndex, index);
              setDragIndex(null);
              setDragOverIndex(null);
            }}
            onDragEnd={() => {
              setDragIndex(null);
              setDragOverIndex(null);
            }}
            dragOver={dragOverIndex === index}
            dragging={dragIndex === index}
          />
        ))}
        {layers.length === 0 && (
          <div className="muted" style={{ fontSize: 12, padding: '6px 2px' }}>
            No layers yet — drop a file or press Add.
          </div>
        )}
      </div>

      {duckdbOnlyTables.length > 0 && (
        <div style={{ marginTop: 14 }}>
          <div className="panel-sub" style={{ marginBottom: 8, paddingLeft: 6 }}>
            SQL-only tables
          </div>
          {duckdbOnlyTables.map((t) => (
            <div
              key={t.tableName}
              className="layer-row sql-only"
              style={{ cursor: 'default' }}
              onClick={(e) => e.stopPropagation()}
              title={`${t.fileName} · ${t.sourceType} · ${t.columns.length} columns`}
            >
              <span />
              <div className="layer-swatch" />
              <div style={{ minWidth: 0 }}>
                <div className="layer-name">{t.tableName}</div>
                <div className="layer-meta">
                  {t.sourceType} · {t.columns.length} cols
                </div>
              </div>
              <div className="layer-actions" style={{ opacity: 1 }}>
                <button
                  className="icon-btn"
                  title="Remove table"
                  aria-label="Remove SQL-only table"
                  onClick={() => onRemoveDuckDBOnlyTable(t.tableName)}
                >
                  <TrashIcon size={13} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
