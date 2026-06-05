# MapViewer-GL — Architecture

**Last updated:** 2026-06-04

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | React 18 (function components + hooks) |
| Map | deck.gl 9.2 + MapLibre GL JS |
| SQL Engine | DuckDB-WASM (in-browser) |
| Build | Vite 5 + TypeScript |
| Styling | Custom CSS (OKLCH design system) + Tailwind (legacy modals) |
| Testing | Vitest 3 |
| Package Manager | Yarn 4 (node-modules linker) |
| Deploy | Vercel (auto-deploy on push to `main`) |

## Design System

- **Colors:** OKLCH space, accent hue 253 (muted lilac)
- **Fonts:** Instrument Serif (display), Inter (UI, 13px), JetBrains Mono (code/data)
- **Density:** Compact — 14px padding, 8px gap, 26px row height
- **Design tokens:** `src/styles/design.css`

## File Structure

```
src/
├── App.tsx                    # Root: imports design.css, wraps <MapViewerGL/> in ErrorBoundary
├── main.tsx                   # Entry: ReactDOM.createRoot + StrictMode
├── types.ts                   # All shared type definitions (LayerInfo, FilterInfo, etc.)
├── components/
│   ├── MapViewerGL.tsx        # Main component — owns ALL state
│   ├── Topbar.tsx             # Brand + layer count + live coordinates + actions
│   ├── LayersPanel.tsx        # Left-rail: layer list with swatch/name/meta/actions
│   ├── SymbologyPanel.tsx     # Left-rail: color, opacity, point size, color-by-column
│   ├── FilterPanel.tsx        # Left-rail: active filters + add-filter form
│   ├── Inspector.tsx          # Right-rail: feature attributes (hover/click/pin)
│   ├── EmptyState.tsx         # Welcome screen with sample data cards
│   ├── MapControls.tsx        # Zoom in/out/recenter (top-right of map)
│   ├── BasemapSelector.tsx    # Segmented pill: osm/light/dark (bottom-right)
│   ├── LegendDisplay.tsx      # Color ramp + breaks card (bottom-left)
│   ├── SQLEditor.tsx          # Floating SQL workspace overlay
│   ├── AddDataModal.tsx       # Data import modal (Tailwind — legacy)
│   ├── CSVPreviewModal.tsx    # CSV column selection (Tailwind — legacy)
│   ├── GeoJSONPreviewModal.tsx # GeoJSON property selection (Tailwind — legacy)
│   ├── Toast.tsx              # Toast notification system + useToast hook
│   ├── ErrorBoundary.tsx      # Catches render crashes, shows recovery UI
│   └── icons.tsx              # Shared inline SVG icons
├── styles/
│   └── design.css             # OKLCH design tokens + component classes
├── data/
│   └── samples.ts             # Built-in sample GeoJSON (US Cities, US States)
├── utils/
│   ├── duckdb.ts              # DuckDB-WASM init, table CRUD, Parquet/CSV/GeoJSON handling
│   ├── csv.ts                 # CSV parsing, coordinate/H3 detection, chunk processing
│   ├── geometry.ts            # Coordinate extraction, bounds, color/size mapping
│   ├── layers.ts              # Numeric column detection, filtered value extraction
│   ├── shapefile.ts           # Shapefile (.zip) → GeoJSON via shpjs
│   ├── tableName.ts           # Sanitize file names → DuckDB-safe table names
│   └── __tests__/             # Vitest unit tests
```

## State Management

**MapViewerGL.tsx is the single state owner.** All state lives in `useState` hooks at the top of this component. Child components are pure: they receive props and fire callbacks. There is no Redux, Zustand, or Context.

Key state variables:

| Variable | Type | Purpose |
|---|---|---|
| `layers` | `LayerInfo[]` | Map layers with all metadata (symbology, filters, data) |
| `activeFilters` | `{[layerId]: FilterEntry[]}` | Per-layer filter functions + serializable info |
| `selectedLayerId` | `number \| null` | Which layer the left-rail panels target |
| `editTarget` | `'style' \| 'filter'` | Which left-rail panel is showing |
| `viewState` | `MapViewState` | Current map center + zoom |
| `mapStyle` | `BasemapStyle` | Current basemap |
| `selectedFeature` | `Feature \| null` | Feature being hovered or pinned |
| `isFeatureLocked` | `boolean` | Whether inspector is pinned to a feature |
| `duckdbOnlyTables` | `DuckDBOnlyTable[]` | Tables without map layers |
| `registeredTables` | `string[]` | All tables registered in DuckDB |
| `showSQLEditor` | `boolean` | SQL workspace visibility |

## Data Flow

```
File upload → parse (csv/geojson/shapefile/parquet)
  → has geometry? → Add as LayerInfo (map layer) + register in DuckDB
  → no geometry?  → Add as DuckDBOnlyTable (SQL-only)
```

deck.gl layers are memoized with `useMemo([layers, activeFilters])`. When layers or filters change, new deck.gl layers are created with filtered data, and deck.gl efficiently diffs them.

## Key Design Decisions

1. **No API keys** — basemaps use free Carto/OSM tiles
2. **Lazy loading** — DuckDB-WASM (~200KB) and shpjs (~141KB) are dynamic `import()` only
3. **Code splitting** — deck.gl, React, H3 chunked via Vite `manualChunks`
4. **Geometry round-trip** — ST_GeomFromGeoJSON / ST_AsGeoJSON (not WKT)
5. **registeredTablesRef** — `useRef` for DuckDB table tracking to avoid stale closures in async effects
6. **SQL escaping** — `escapeIdentifier()` for all column names
7. **URL hash state** — map position persisted in `#lat=...&lng=...&zoom=...` (debounced 300ms)
8. **ErrorBoundary** — wraps MapViewerGL to prevent white-screen crashes
9. **DeckGL canvas sizing** — force-sized to 100%×100% via CSS to fill grid cell

## Filter Architecture

```
FilterPanel                          MapViewerGL                     deck.gl
───────────                          ──────────                      ───────
buildColumns(items)                  handleApplyFilter()             useMemo([layers,
  → ColumnMeta[]                       → wrap for H3                  activeFilters])
buildFilterFn(column, info)            → setActiveFilters()            → filter data
  → (item) => boolean                  → new reference                → new deck layers
handleApply()                                                   
  → create FilterInfo                                          
  → call onApplyFilter                                          
```

The filter chain is:
1. User fills form in FilterPanel → creates `FilterInfo` + filter function
2. `handleApplyFilter` wraps H3 filters, stores in `activeFilters` state
3. State update triggers re-render, `deckLayers` useMemo re-runs
4. Each layer's data is filtered through `activeFilters[layerId].every(fn)`
5. Filtered data passed to deck.gl layers, map updates

## DuckDB Integration

Table name: `sanitizeTableName(filename)` — removes extension, replaces special chars with `_`, lowercases, prefixes digit-starting names.

Sync mechanism: `useEffect([layers, isDuckDBReady, duckdbOnlyTables])` keeps DuckDB tables in sync with React state. Uses `registeredTablesRef` for race-condition-safe lookups.

## Confirmation Dialogs

Two destructive actions require confirmation:
- **Remove layer** — modal with layer name + "This cannot be undone"
- **Import session config** — modal warning about replacing all current layers
