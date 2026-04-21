import React from 'react';
import { UploadIcon, DownloadIcon, LockIcon, PointsIcon, PolyIcon } from './icons';

type SampleKey = 'cities' | 'states' | 'both';

interface SampleEntry {
  id: SampleKey;
  title: string;
  desc: string;
  kind: 'points' | 'polygons';
}

const SAMPLES: SampleEntry[] = [
  { id: 'cities', title: 'US Major Cities', desc: '10 points · population attribute', kind: 'points' },
  { id: 'states', title: 'US States (sample)', desc: '3 polygons · area attribute', kind: 'polygons' },
];

interface EmptyStateProps {
  onLoadSample: (sample: SampleKey) => void;
  onAddData: () => void;
  onImportConfig?: () => void;
}

export const EmptyState: React.FC<EmptyStateProps> = ({ onLoadSample, onAddData, onImportConfig }) => {
  return (
    <div className="empty">
      <div className="empty-inner">
        <div className="empty-eyebrow">MapViewer-GL · client-side geospatial workspace</div>
        <h1>
          A quiet place to load, <em>style</em>, and query your spatial data.
        </h1>
        <p className="lede">
          GeoJSON, CSV, Shapefile, GeoParquet — drop anything here and see it on a map in seconds.
          Every layer becomes a SQL table. Nothing leaves your browser.
        </p>
        <div className="empty-actions">
          <button className="btn primary" onClick={onAddData}>
            <UploadIcon size={14} /> Add data
          </button>
          {onImportConfig && (
            <button className="btn" onClick={onImportConfig}>
              <DownloadIcon size={14} /> Import session
            </button>
          )}
        </div>

        <div className="empty-samples">
          <div className="empty-samples-title">or — try with sample data</div>
          <div className="sample-grid">
            {SAMPLES.map((s) => (
              <button key={s.id} className="sample-card" onClick={() => onLoadSample(s.id)}>
                <div className="sample-thumb">
                  {s.kind === 'points' ? <PointsIcon size={20} /> : <PolyIcon size={20} />}
                </div>
                <div>
                  <div className="sample-name">{s.title}</div>
                  <div className="sample-desc">{s.desc}</div>
                </div>
              </button>
            ))}
          </div>
        </div>

        <div className="empty-promise">
          <LockIcon size={14} />
          <span>All parsing, SQL and rendering runs in your browser. No uploads. Closing the tab discards everything.</span>
        </div>
      </div>
    </div>
  );
};
