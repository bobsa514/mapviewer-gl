// Faux styled basemap SVG + feature rendering

const BASEMAP_STYLES = {
  light: {
    land:   "oklch(0.97 0.005 90)",
    water:  "oklch(0.93 0.015 230)",
    road:   "oklch(0.88 0.008 270)",
    roadMaj:"oklch(0.82 0.01 270)",
    border: "oklch(0.85 0.008 270)",
    label:  "oklch(0.45 0.01 270)",
    labelSub:"oklch(0.6 0.01 270)",
  },
  dark: {
    land:   "oklch(0.25 0.012 270)",
    water:  "oklch(0.18 0.02 240)",
    road:   "oklch(0.32 0.01 270)",
    roadMaj:"oklch(0.38 0.012 270)",
    border: "oklch(0.35 0.012 270)",
    label:  "oklch(0.7 0.01 270)",
    labelSub:"oklch(0.55 0.01 270)",
  },
  osm: {
    land:   "oklch(0.955 0.008 110)",
    water:  "oklch(0.88 0.03 230)",
    road:   "oklch(0.92 0.01 80)",
    roadMaj:"oklch(0.85 0.02 60)",
    border: "oklch(0.78 0.01 270)",
    label:  "oklch(0.4 0.02 60)",
    labelSub:"oklch(0.55 0.02 60)",
  },
};

// Stylized CONUS-ish landmass path (designed, not geographically accurate)
const LANDMASS_PATH = "M60,180 C70,140 100,120 140,110 C170,90 210,85 245,95 C280,80 320,70 360,78 C400,72 450,80 490,92 C530,85 580,95 620,110 C670,100 720,108 760,125 C800,118 850,130 880,155 C895,180 905,210 900,250 C905,290 895,330 880,370 C870,410 850,445 820,470 C780,485 740,490 700,485 C650,492 600,488 560,475 C520,480 480,478 440,468 C400,475 360,470 320,458 C280,468 240,465 200,455 C160,465 120,458 90,435 C70,410 58,380 55,340 C48,300 50,260 55,220 C55,200 58,190 60,180 Z";

const COASTLINE_EXTRAS = [
  "M820,140 C850,135 880,150 885,175 L880,155 C860,145 840,142 820,140 Z", // upper right peninsula
  "M700,470 C720,485 740,500 720,520 C700,510 690,490 700,470 Z", // florida
];

const WATER_FEATURES = [
  // great lakes-ish cluster
  { type: "ellipse", cx: 650, cy: 195, rx: 55, ry: 22 },
  { type: "ellipse", cx: 680, cy: 230, rx: 30, ry: 14 },
  { type: "ellipse", cx: 720, cy: 200, rx: 28, ry: 12 },
];

const ROADS_MAJOR = [
  "M80,310 L320,305 L560,320 L820,315",
  "M180,200 L250,320 L320,430",
  "M620,120 L640,260 L660,420",
  "M380,100 L400,260 L460,420",
  "M520,110 L560,270 L620,440",
];
const ROADS_MINOR = [
  "M120,250 L280,260 L400,250 L540,260 L700,255 L860,260",
  "M150,380 L290,375 L430,380 L590,370 L750,380",
  "M220,160 L280,260 L340,360 L420,450",
  "M480,140 L520,260 L560,380",
  "M700,160 L720,260 L740,380",
];
const BORDERS = [
  "M150,200 L210,200 L250,180 L310,220 L380,200",
  "M200,280 L320,290 L400,280 L480,300",
  "M500,190 L600,200 L680,190",
  "M430,380 L550,390 L650,380 L780,390",
];

const PLACE_LABELS = [
  { x: 150, y: 200, text: "Pacific", size: 10, water: true },
  { x: 780, y: 80, text: "Atlantic", size: 10, water: true },
  { x: 460, y: 550, text: "Gulf of Mexico", size: 9, water: true },
  { x: 230, y: 270, text: "Rocky Mts", size: 9, muted: true },
  { x: 560, y: 260, text: "Plains", size: 9, muted: true },
  { x: 760, y: 300, text: "Appalachian", size: 9, muted: true },
];

function MapSurface({ basemap = "light", children, onMouseMove, onMouseLeave, onClick }) {
  const S = BASEMAP_STYLES[basemap] || BASEMAP_STYLES.light;
  return (
    <svg className="map-svg" viewBox="0 0 960 600" preserveAspectRatio="xMidYMid slice"
         onMouseMove={onMouseMove} onMouseLeave={onMouseLeave} onClick={onClick}>
      {/* water background */}
      <rect width="960" height="600" fill={S.water} />

      {/* subtle grid */}
      <g opacity="0.35" stroke={S.border} strokeWidth="0.4">
        {Array.from({ length: 11 }, (_, i) => (
          <line key={`v${i}`} x1={i*96} y1="0" x2={i*96} y2="600" />
        ))}
        {Array.from({ length: 7 }, (_, i) => (
          <line key={`h${i}`} x1="0" y1={i*100} x2="960" y2={i*100} />
        ))}
      </g>

      {/* landmass */}
      <g>
        <path d={LANDMASS_PATH} fill={S.land} stroke={S.border} strokeWidth="1"/>
        {COASTLINE_EXTRAS.map((d, i) => (
          <path key={i} d={d} fill={S.land} stroke={S.border} strokeWidth="1"/>
        ))}
      </g>

      {/* inland water */}
      <g>
        {WATER_FEATURES.map((w, i) => (
          <ellipse key={i} cx={w.cx} cy={w.cy} rx={w.rx} ry={w.ry}
                   fill={S.water} stroke={S.border} strokeWidth="0.6"/>
        ))}
      </g>

      {/* borders */}
      <g stroke={S.border} strokeWidth="0.8" fill="none" strokeDasharray="2 3" opacity="0.6">
        {BORDERS.map((d, i) => <path key={i} d={d} />)}
      </g>

      {/* roads */}
      <g stroke={S.road} strokeWidth="0.6" fill="none" opacity="0.7">
        {ROADS_MINOR.map((d, i) => <path key={i} d={d}/>)}
      </g>
      <g stroke={S.roadMaj} strokeWidth="1.1" fill="none" opacity="0.8">
        {ROADS_MAJOR.map((d, i) => <path key={i} d={d}/>)}
      </g>

      {/* labels */}
      <g fontFamily="Inter, sans-serif" fontSize="10" letterSpacing="0.08em">
        {PLACE_LABELS.map((l, i) => (
          <text key={i} x={l.x} y={l.y}
                fill={l.water ? S.labelSub : S.label}
                fontSize={l.size}
                fontStyle={l.water ? "italic" : "normal"}
                opacity={l.muted ? 0.7 : 1}
                textTransform="uppercase">
            {l.text.toUpperCase()}
          </text>
        ))}
      </g>

      {children}
    </svg>
  );
}

// Quantile-classify a set of values into N buckets; returns {breaks, classify(v)}
function classify(values, n) {
  const sorted = [...values].filter(v => typeof v === "number" && !isNaN(v)).sort((a,b)=>a-b);
  const breaks = [];
  for (let i = 1; i < n; i++) {
    const idx = Math.floor((i / n) * sorted.length);
    breaks.push(sorted[idx]);
  }
  breaks.push(sorted[sorted.length-1]);
  const min = sorted[0];
  return {
    min, breaks,
    classify: (v) => {
      for (let i = 0; i < breaks.length; i++) {
        if (v <= breaks[i]) return i;
      }
      return breaks.length - 1;
    }
  };
}

// Rendered feature points for cities layer
function PointsLayer({ layer, points, onHover, onLeave, onClick, hoveredId, pinnedId }) {
  if (!layer.visible || layer.sqlOnly) return null;
  const pal = layer.colorBy ? PALETTES[layer.colorBy.palette] : null;
  const cls = layer.colorBy ? classify(points.map(p => p[layer.colorBy.column]), layer.colorBy.classes) : null;
  return (
    <g opacity={layer.opacity}>
      {points.map(p => {
        const c = cls ? pal[cls.classify(p[layer.colorBy.column])] : layer.color;
        const isHover = hoveredId === p.id;
        const isPinned = pinnedId === p.id;
        const r = (layer.pointSize || 5) + (isHover || isPinned ? 2 : 0);
        return (
          <g key={p.id} style={{ cursor: "pointer" }}
             onMouseEnter={(e) => onHover(p, e)}
             onMouseLeave={onLeave}
             onClick={(e) => { e.stopPropagation(); onClick(p); }}>
            {isPinned && <circle cx={p.x} cy={p.y} r={r+5} fill="none" stroke="var(--accent)" strokeWidth="1.5" />}
            <circle cx={p.x} cy={p.y} r={r+1} fill="white" opacity="0.9" />
            <circle cx={p.x} cy={p.y} r={r} fill={c} stroke="oklch(0.3 0.02 270)" strokeWidth="0.4" />
          </g>
        );
      })}
    </g>
  );
}

// Stylized state polygons for visual depth (symbolic, not geographic)
const STATE_POLYS = [
  "M150,200 L210,200 L210,280 L150,280 Z",
  "M210,200 L280,200 L280,290 L210,290 Z",
  "M280,200 L360,200 L360,290 L280,290 Z",
  "M360,200 L440,200 L440,290 L360,290 Z",
  "M440,200 L520,200 L520,290 L440,290 Z",
  "M520,200 L600,200 L600,290 L520,290 Z",
  "M600,200 L680,200 L680,290 L600,290 Z",
  "M680,200 L760,200 L760,290 L680,290 Z",
  "M760,200 L830,200 L830,290 L760,290 Z",

  "M150,290 L220,290 L220,370 L150,370 Z",
  "M220,290 L300,290 L300,370 L220,370 Z",
  "M300,290 L380,290 L380,370 L300,370 Z",
  "M380,290 L460,290 L460,370 L380,370 Z",
  "M460,290 L540,290 L540,370 L460,370 Z",
  "M540,290 L620,290 L620,370 L540,370 Z",
  "M620,290 L700,290 L700,370 L620,370 Z",
  "M700,290 L780,290 L780,370 L700,370 Z",
  "M780,290 L850,290 L850,370 L780,370 Z",

  "M160,370 L240,370 L240,440 L160,440 Z",
  "M240,370 L320,370 L320,440 L240,440 Z",
  "M320,370 L400,370 L400,440 L320,440 Z",
  "M400,370 L480,370 L480,440 L400,440 Z",
  "M480,370 L560,370 L560,440 L480,440 Z",
  "M560,370 L640,370 L640,440 L560,440 Z",
  "M640,370 L720,370 L720,440 L640,440 Z",
  "M720,370 L800,370 L800,440 L720,440 Z",
];

function PolygonsLayer({ layer }) {
  if (!layer.visible || layer.sqlOnly) return null;
  const clipId = `clip-${layer.id}`;
  return (
    <g opacity={layer.opacity}>
      <defs>
        <clipPath id={clipId}>
          <path d={LANDMASS_PATH}/>
        </clipPath>
      </defs>
      <g clipPath={`url(#${clipId})`}>
        {STATE_POLYS.map((d, i) => (
          <path key={i} d={d} fill={layer.color} stroke="oklch(0.5 0.02 270)" strokeWidth="0.5" strokeOpacity="0.4"/>
        ))}
      </g>
    </g>
  );
}

Object.assign(window, { MapSurface, PointsLayer, PolygonsLayer, classify, BASEMAP_STYLES });
