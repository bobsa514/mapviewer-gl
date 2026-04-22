# MapViewer-GL — AI Agent Instructions

## Project Overview
MapViewer-GL is a **client-side** geospatial data viewer built with React, deck.gl, and MapLibre GL JS. All data processing happens in the browser — no backend. Users upload GeoJSON, CSV, Shapefile, or Parquet files, style them on an interactive map, and run SQL queries via DuckDB-WASM.

**Live demo:** https://mapviewer-gl.vercel.app
**Deployed via:** Vercel (auto-deploy on push to `main`). CI checks in `.github/workflows/ci.yml`.

## UI/UX Source of Truth

The shipped UI is being replaced. When making ANY UI/UX decision on this repo, consult these first:
- **`UX_SPEC.md`** (repo root) — functional spec: what the app does, user stories, screens. No design decisions.
- **`docs/design/`** — Claude Design handoff bundle (visual source of truth). Key files:
  - `docs/design/project/styles.css` — the design system in CSS (OKLCH, typography)
  - `docs/design/project/MapViewer-GL.html` + `project/*.jsx` — interactive prototype
  - `docs/design/chats/chat1.md` — designer/user conversation with intent + iteration history
  - `docs/design/IMPLEMENTATION_PLAN.md` — step-by-step checklist for porting the design onto the real codebase (planned 2026-04-17, not yet executed)

Do NOT defer to the current shipped UI when designing new things — it's being replaced per the plan above.

## Build & Dev Commands
```bash
corepack enable          # Required first time — enables Yarn 4
yarn install             # Install dependencies
yarn dev                 # Dev server → http://localhost:5173
yarn build               # Production build (also runs TypeScript check)
yarn test                # Run Vitest unit tests
yarn lint                # ESLint
yarn preview             # Preview production build locally
```

**Package manager:** Yarn 4 (via Corepack). Do NOT use npm.

## File Structure
```
src/
├── App.tsx                        # Minimal wrapper with ErrorBoundary
├── main.tsx                       # Entry point
├── types.ts                       # All shared TypeScript types (LayerInfo, CSVPreviewData, DuckDBOnlyTable, etc.)
├── components/
│   ├── MapViewerGL.tsx            # Main component — owns ALL state, renders the 3-col grid shell
│   ├── Topbar.tsx                 # Brand + layer/coord meta + SQL / Share / Export / Add data
│   ├── LayersPanel.tsx            # Left-rail layer list (swatch + name + meta + hover actions)
│   ├── SymbologyPanel.tsx         # Left-rail style panel — color, opacity, size, color-by-column
│   ├── FilterPanel.tsx            # Left-rail filter panel — active filters + add-filter form
│   ├── Inspector.tsx              # Right-rail feature inspector (pin/unpin)
│   ├── EmptyState.tsx             # Welcome screen (eyebrow + serif h1 + sample cards)
│   ├── MapControls.tsx            # Zoom in/out/recenter (top-right of map)
│   ├── BasemapSelector.tsx        # Carto Light / Dark / OSM segmented pill (bottom-right of map)
│   ├── LegendDisplay.tsx          # Color ramp + breaks card (bottom-left of map)
│   ├── SQLEditor.tsx              # DuckDB-WASM workspace — floating overlay
│   ├── AddDataModal.tsx           # Tabs: GeoJSON, CSV, Shapefile, Parquet, Config (Tailwind — phase-2 re-skin)
│   ├── CSVPreviewModal.tsx        # CSV column mapping (Tailwind — phase-2 re-skin)
│   ├── GeoJSONPreviewModal.tsx    # GeoJSON property selection (Tailwind — phase-2 re-skin)
│   ├── Toast.tsx                  # Toast notification system (dark pill, center-bottom)
│   ├── ErrorBoundary.tsx          # Catches rendering crashes, shows recovery UI
│   └── icons.tsx                  # Shared inline SVG icons (editorial thin-stroke set)
├── styles/
│   └── design.css                 # OKLCH design tokens + component classes (ported from docs/design)
├── data/
│   └── samples.ts                 # Built-in sample GeoJSON datasets (US Cities, US States)
├── utils/
│   ├── duckdb.ts                  # DuckDB-WASM init, table registration, Parquet/CSV/GeoJSON handling
│   ├── csv.ts                     # CSV parsing, coordinate detection, H3 column detection
│   ├── geometry.ts                # Coordinate extraction from GeoJSON features
│   ├── layers.ts                  # deck.gl layer factory (GeoJsonLayer, ScatterplotLayer, H3HexagonLayer)
│   ├── shapefile.ts               # Shapefile (.zip) parsing via shpjs
│   ├── tableName.ts               # sanitizeTableName — extracted from duckdb.ts for code splitting
│   └── __tests__/                 # Vitest unit tests for all utility modules
```

## Architecture

### Visual design system (v2.3+)
- **Source of truth:** `src/styles/design.css` (OKLCH tokens + component classes).
- **Fonts:** Instrument Serif (display), Inter (UI, 13 px base), JetBrains Mono (data).
- **Accent:** `oklch(0.55 0.08 253)` — muted lilac. Hue is `--accent-h = 253`.
- **Density:** compact (`--pad: 14px`, `--pad-sm: 8px`, `--row: 26px`).
- **Layout:** `.app` grid — `280px | 1fr | 300px` columns × `44px | 1fr` rows.
- When building new UI, use classes from `design.css` (`.btn`, `.btn.accent`, `.panel-section`, `.panel-title em`, `.field`, `.kv-row`, `.chip`, `.segmented`, `.modal`, `.toast`, etc.) rather than Tailwind utilities.

### State Management
- **MapViewerGL.tsx owns all state** — layers, filters, symbology, DuckDB tables, modals, `selectedLayerId`, `editTarget`
- Child components are pure: receive props, fire callbacks
- No state management library (no Redux/Zustand) — React useState + useCallback
- **`selectedLayerId`** drives which layer the Symbology/Filter rail panels act on. Clicking a layer row or its style/filter icon updates both `selectedLayerId` and `editTarget`.
- **`editTarget: 'style' | 'filter'`** — segmented toggle in the left rail decides which panel renders below the layer list.

### Data Flow
```
File upload → parse (CSV/GeoJSON/Shapefile/Parquet)
  → if has geometry → add as map layer (deck.gl) + register in DuckDB
  → if no geometry → register as DuckDB-only table (SQL queries/JOINs only)
```

### Key Design Decisions
- **No API keys** — basemaps use free Carto/OSM tiles
- **Code splitting** — DuckDB-WASM (~200KB) and shpjs (~141KB) are lazy-loaded via dynamic `import()`; vendor chunks (deck.gl, React, H3) split via Vite manualChunks
- **DuckDB table names** = sanitized file names (spaces/special chars replaced, auto-deduplication on collision)
- **Toast notifications** — errors shown via Toast component (not browser `alert()`)
- **registeredTables tracking** — uses `useRef` (not `useState`) to avoid stale closures in async effects
- **SQL escaping** — column names escaped via `escapeIdentifier()` in duckdb.ts
- **GeoJSON round-trip** — geometry stored in DuckDB via `ST_GeomFromGeoJSON`, extracted via `ST_AsGeoJSON`
- **deck.gl layers memoized** with `useMemo` — only recreate when data/filters change
- **URL hash state** — map position persisted in URL hash for shareable links
- **Main canvas drag-and-drop** — files can be dropped anywhere on the map, not just the Add Data modal
- **ErrorBoundary** — wraps MapViewerGL to prevent white-screen crashes
- **Filter is a rail panel, not a modal** (v2.3) — opening filters swaps the left-rail panel via `editTarget='filter'`; there is no modal overlay anymore.
- **DeckGL canvas sizing** — `.map-wrap` is a CSS-grid cell (no explicit size); the `#deckgl-overlay` canvas is force-sized to `100% × 100%` in `design.css` so deck.gl fills the grid cell correctly.

### Supported Data Formats
| Format | Map layer? | DuckDB table? | Handler |
|--------|-----------|---------------|---------|
| GeoJSON | Yes | Yes | `handleGeoJSONFile` |
| CSV (with lat/lng) | Yes | Yes | `handleCSVFile` → `proceedWithSelectedColumns` |
| CSV (with H3) | Yes | Yes | `handleCSVFile` → H3 path |
| CSV (no geo) | No | Yes (DuckDB-only) | `handleCSVFile` → `registerPlainCSVTable` |
| Shapefile (.zip) | Yes | Yes | `handleShapefileUpload` |
| GeoParquet | Yes | Yes | `handleParquetFile` → `extractGeoParquetAsGeoJSON` |
| Plain Parquet | No | Yes (DuckDB-only) | `handleParquetFile` → no geom detected |

## Known Issues (from CHANGELOG v2.2.0)
- H3 column detection only validates the first preview row
- BigInt values silently converted to Number (precision loss > 2^53)
- maplibre-gl and vendor-deckgl chunks exceed 800 KB (expected for these libraries)
- `papaparse` is still statically imported in MapViewerGL.tsx (used for CSV parsing); `sanitizeTableName` extracted to `tableName.ts` to restore DuckDB lazy-load

## Common Tasks

### Adding a new data format
1. Add parser in `src/utils/newformat.ts`
2. Add handler function in `MapViewerGL.tsx`
3. Add tab in `AddDataModal.tsx`
4. If geo: create layer via `addGeoJSONLayer`; if not: push to `duckdbOnlyTables`
5. Register table in DuckDB via `duckdb.ts`
6. Update CLAUDE.md, CHANGELOG.md, README.md

### Adding a new UI panel/control
1. Create component in `src/components/`
2. Add state in `MapViewerGL.tsx`
3. Pass props down, callbacks up
