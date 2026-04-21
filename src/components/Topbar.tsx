import React from 'react';
import { SqlIcon, LinkIcon, DownloadIcon, PlusIcon } from './icons';

interface TopbarProps {
  loaded: boolean;
  layerCount: number;
  latitude: number;
  longitude: number;
  zoom: number;
  onOpenSQL: () => void;
  onShare: () => void;
  onExport: () => void;
  onAddData: () => void;
}

export const Topbar: React.FC<TopbarProps> = ({
  loaded,
  layerCount,
  latitude,
  longitude,
  zoom,
  onOpenSQL,
  onShare,
  onExport,
  onAddData,
}) => {
  const coords = `${latitude.toFixed(1)}°${latitude >= 0 ? 'N' : 'S'}, ${Math.abs(longitude).toFixed(1)}°${longitude >= 0 ? 'E' : 'W'}`;
  return (
    <header className="topbar">
      <div className="brand">
        <span className="brand-dot" />
        <span className="brand-wordmark">MapViewer</span>
        <em>gl</em>
      </div>
      <div className="topbar-sep" />
      <div className="topbar-meta">
        <span>{loaded ? `${layerCount} layer${layerCount === 1 ? '' : 's'}` : 'no session'}</span>
        {loaded && (
          <>
            <span>·</span>
            <span className="mono">{coords}</span>
            <span>·</span>
            <span className="mono">z {zoom.toFixed(1)}</span>
          </>
        )}
      </div>
      <div className="topbar-right">
        {loaded && (
          <button className="btn sm ghost" onClick={onOpenSQL} aria-label="Open SQL workspace">
            <SqlIcon size={13} /> SQL
            <kbd style={{ marginLeft: 4 }}>⌘K</kbd>
          </button>
        )}
        {loaded && (
          <button className="btn sm ghost" onClick={onShare} aria-label="Copy shareable view URL">
            <LinkIcon size={13} /> Share view
          </button>
        )}
        {loaded && (
          <button className="btn sm ghost" onClick={onExport} aria-label="Export session">
            <DownloadIcon size={13} /> Export
          </button>
        )}
        <button className="btn sm" onClick={onAddData} aria-label="Add data">
          <PlusIcon size={13} /> Add data
        </button>
      </div>
    </header>
  );
};
