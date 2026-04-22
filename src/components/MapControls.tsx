import React from 'react';
import { ZoomInIcon, ZoomOutIcon, TargetIcon } from './icons';

interface MapControlsProps {
  onZoomIn: () => void;
  onZoomOut: () => void;
  onRecenter: () => void;
}

export const MapControls: React.FC<MapControlsProps> = ({ onZoomIn, onZoomOut, onRecenter }) => (
  <div className="map-ctrls">
    <button className="map-ctrl" title="Zoom in" aria-label="Zoom in" onClick={onZoomIn}>
      <ZoomInIcon size={14} />
    </button>
    <button className="map-ctrl" title="Zoom out" aria-label="Zoom out" onClick={onZoomOut}>
      <ZoomOutIcon size={14} />
    </button>
    <button className="map-ctrl" title="Recenter" aria-label="Recenter view" onClick={onRecenter}>
      <TargetIcon size={14} />
    </button>
  </div>
);
