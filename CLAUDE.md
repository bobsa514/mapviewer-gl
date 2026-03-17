# MapViewer-GL — AI Agent Instructions

## Project Overview
MapViewer-GL is a **client-side** geospatial data viewer built with React, deck.gl, and MapLibre GL JS. All data processing happens in the browser — no backend. Users upload GeoJSON, CSV, Shapefile, or Parquet files, style them on an interactive map, and run SQL queries via DuckDB-WASM.

**Live demo:** https://bobsa514.github.io/mapviewer-gl/
**Deployed via:** GitHub Pages (GitHub Actions CI in `.github/workflows/deploy.yml`)

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
│   ├── MapViewerGL.tsx            # Main component — owns ALL state, orchestrates everything
│   ├── AddDataModal.tsx           # Centered modal with tabs: GeoJSON, CSV, Shapefile, Parquet, Config
│   ├── CSVPreviewModal.tsx        # CSV column mapping (lat/lng selection or DuckDB-only mode)
│   ├── SQLEditor.tsx              # DuckDB-WASM SQL editor with spatial extension
│   ├── LayersPanel.tsx            # Layer list — visibility, remove, rename, symbology, filter, drag reorder
│   ├── BasemapSelector.tsx        # Carto Light / Carto Dark / OSM switcher
│   ├── FilterModal.tsx            # Per-column numeric/text filtering
│   ├── FeaturePropertiesPanel.tsx # Click-to-inspect feature attributes
│   ├── LegendDisplay.tsx          # Color and size legends
│   ├── GeoJSONPreviewModal.tsx    # GeoJSON text preview
│   ├── Toast.tsx                  # Toast notification system (useToast hook + ToastContainer)
│   └── ErrorBoundary.tsx          # Catches rendering crashes, shows recovery UI
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

### State Management
- **MapViewerGL.tsx owns all state** — layers, filters, symbology, DuckDB tables, modals
- Child components are pure: receive props, fire callbacks
- No state management library (no Redux/Zustand) — React useState + useCallback

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
