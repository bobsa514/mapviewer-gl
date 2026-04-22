# Changelog

All notable changes to this project will be documented in this file.

## [2.3.0] - 2026-04-20

Visual redesign pass — new editorial design system, topbar, rail-based panels. All functional features (DuckDB-WASM, deck.gl, file parsers, filter semantics, config I/O, URL-hash sharing) are preserved.

### Added
- **Editorial design system** — OKLCH color space with muted-lilac accent (hue 253), Instrument Serif display font, Inter UI (13px base), JetBrains Mono for data. Ported from the Claude Design handoff bundle in `docs/design/project/` into `src/styles/design.css`.
- **3-column app shell** — persistent 280 px left rail (Layers + Symbology/Filter), 1fr map, 300 px right rail (Inspector), 44 px topbar. `MapViewerGL.tsx` owns the new grid layout.
- **Topbar** — new `Topbar.tsx` exposes brand wordmark, layer count + live lat/lng/zoom, and SQL (⌘K) / Share view / Export / Add data actions.
- **Inspector (right rail)** — new `Inspector.tsx` replaces the old floating `FeaturePropertiesPanel`; shows primary label, coordinates, and a key-value table of feature attributes with pin/unpin.
- **Empty state** — new `EmptyState.tsx` renders a serif h1, privacy promise, and sample-data cards (US Major Cities, US States) when no data is loaded.
- **Map controls** — new `MapControls.tsx` (zoom in/out/recenter) anchored top-right of the map.
- **Segmented Style/Filter toggle** in the left rail — clicking a layer's style or filter icon selects the layer and switches which panel is showing.
- **Google Fonts preconnect + `<link>`** for Instrument Serif, Inter, JetBrains Mono in `index.html`.

### Changed
- **Filter is now a rail panel, not a modal** — `FilterPanel.tsx` replaces `FilterModal.tsx`. All previous filter capabilities preserved: numeric range, numeric comparison, text comparison, and text multi-match (comma-separated values for OR semantics).
- **Symbology is now a rail panel** — `SymbologyPanel.tsx` hosts color / opacity / point size / color-by-column with a 2×4 palette picker. Replaces the inline per-layer expand-to-style pattern.
- **Layers panel re-skinned** — color swatch + name + mono meta row with hover-reveal actions (style, filter, visibility, rename, remove) and drag-to-reorder. SQL-only tables live in a separate section.
- **SQLEditor re-skinned** — now a floating workspace overlay (not bottom-anchored) with a left sidebar for "Tables in scope" + templates, and a meta bar ("rows · time · Export CSV · Add as map layer") below results.
- **BasemapSelector** — compact segmented pill (osm / light / dark) bottom-right of the map; no dropdown.
- **LegendDisplay** — single compact card bottom-left with typographic title/column + horizontal color ramp + numeric breaks.
- **Toast** — dark-pill style, center-bottom; type surfaces as a small colored dot instead of a full-colored background.
- **Confirmation dialogs** (remove layer, import session) now use the `.modal` design-system class.
- **State model in `MapViewerGL.tsx`** — added `selectedLayerId` and `editTarget ('style' | 'filter')`; removed `showFilterModal`, `showLayers`, and `selectedColumns`/`allAvailableColumns` (the Inspector now shows all attributes by default).
- **LayerInfo type** — removed the unused `isExpanded` field.
- **Config export version** bumped to `2.3.0`; `FilterInfo` type migrated from `FilterModal.tsx` into `types.ts`.
- **Yarn 4 compat** — added `.yarnrc.yml` with `nodeLinker: node-modules` for Node 23+ compatibility (PnP loader fails with `EBADF` on newer Node).

### Removed
- `FilterModal.tsx` — replaced by `FilterPanel.tsx`.
- `FeaturePropertiesPanel.tsx` — replaced by `Inspector.tsx`.
- Floating Layers/SQL/Export toggle buttons (bottom-left) — actions moved to Topbar.
- Welcome overlay card — replaced by full-map `EmptyState`.

### Known limitations
- Narrow-screen/mobile responsive layout is not addressed; the 3-column grid assumes desktop widths.
- The `AddDataModal`, `CSVPreviewModal`, and `GeoJSONPreviewModal` remain on Tailwind styling (phase-2 re-skin).

## [2.2.1] - 2026-03-17

### Fixed
- **Vercel Yarn 4 compatibility** — `vercel.json` now runs `corepack enable` before `yarn install --immutable` so Vercel uses Yarn 4 (Berry) instead of falling back to Yarn 1.22
- **FilterModal numeric coercion** — min/max range calculation and range filter now cast values to `Number()` and skip `NaN`, fixing incorrect ranges when CSV columns contain string-formatted numbers
- **TypeScript strict errors** — added explicit type annotations to 3 `.filter()` callbacks in `layers.ts` that had implicit `any` (TS7006)
- **Config export version** — `exportConfiguration()` now writes `"2.1.0"` matching the actual package version (was hardcoded to `"2.0.0"`)
- **CSS boilerplate cleanup** — removed Vite starter CSS rules (`#root` max-width/padding, `.logo`, dark-mode `:root`) from `App.css` and `index.css` that conflicted with full-screen map layout

### Removed
- **GitHub Pages deployment** — removed `deploy.yml` workflow's gh-pages push step, `gh-pages` npm package, and `predeploy`/`deploy` scripts; deployment is now Vercel-only
- **`gh-pages` branch** — deleted remote branch that was causing failed Vercel Preview builds

### Changed
- **DuckDB lazy-load restored** — extracted `sanitizeTableName` to `src/utils/tableName.ts` so `MapViewerGL.tsx` no longer statically imports `duckdb.ts`; DuckDB WASM bundle is truly lazy-loaded again
- **CSV column selection now functional** — `registerPlainCSVTable` accepts an optional `selectedColumns` parameter; DuckDB-only CSV imports now respect the user's column selection instead of importing all columns

## [2.2.0] - 2026-03-14

### Added
- **Sample datasets on welcome screen** — "US Cities" and "US States" buttons let first-time visitors explore the app without uploading data; data is code-split (~2 KB chunk, lazy-loaded on click)
- **Main canvas drag-and-drop** — drop files directly on the map to load them (not just inside the Add Data modal); visual drop indicator overlay with file format hints
- **URL hash state sharing** — map position is encoded in the URL hash (`#lat=X&lng=Y&zoom=Z`) and restored on page load; debounced updates (300ms)
- **React ErrorBoundary** — rendering crashes now show a recovery UI ("Something went wrong / Reload") instead of a blank white screen
- **Vitest test suite** — 57 unit tests across 4 test files covering all pure utility functions (`csv.ts`, `geometry.ts`, `layers.ts`, `duckdb.ts`); CI runs tests before deploy

### Fixed
- **SQL query quadruple execution** — geometry queries now execute max 2 times (DESCRIBE + combined ST_AsText/ST_AsGeoJSON) instead of up to 4 separate queries; significant performance improvement for spatial joins
- **ESLint warning budget** — all 9 intentional `react-hooks/exhaustive-deps` suppressions now use explicit `eslint-disable-next-line` comments; lint threshold reduced from 20 to 5

### Changed
- **package.json version** updated from 2.0.0 to 2.1.0 (was out of sync with CHANGELOG)
- **ESLint config** now ignores `.claude/` and PnP files
- **duckdb.ts** exports `escapeIdentifier`, `inferColumnType`, `inferColumnTypes`, `formatValue` for testability
- **Vitest 3.x** added as dev dependency; test config added to `vite.config.ts`
- **CI pipeline** now runs `yarn test` between lint and build steps

## [2.1.0] - 2026-03-06

### Added
- **Toast notifications** — replaced all browser `alert()` calls with styled, auto-dismissing toast notifications
- **Welcome screen** — empty state with instructions when no data is loaded
- **Delete layer confirmation** — removing a layer now requires confirmation
- **Config import confirmation** — importing a config when layers exist shows a warning dialog
- **Loading progress bar** — file processing shows a visual progress bar instead of plain text
- **Filter badges** — active filter count shown on layer cards in the Layers panel
- **Layer drag-and-drop reorder** — drag layers to change rendering order
- **SQL results export** — "Export CSV" button to download query results
- **Config export button** — export configuration is now accessible from the main UI (not just inside Add Data modal)
- **Accessibility** — `aria-label` on all icon buttons, `role="dialog"` on modals
- **Responsive modals** — all modals now adapt to smaller screens

### Fixed
- **SQL injection** — column names in DuckDB queries now properly escape double quotes via `escapeIdentifier`
- **DuckDB sync race condition** — `registeredTables` tracking moved from `useState` to `useRef` to prevent stale closures
- **FilterModal crash on large datasets** — `Math.min/max(...spread)` replaced with iterative loop (fixes RangeError on 100K+ rows)
- **GeoJSON null properties** — `inferColumnTypes` now scans first 100 features instead of only the first one
- **GeoParquet empty result** — shows warning and registers as SQL-only table instead of adding an empty layer
- **Table name collision** — uploading files that produce the same sanitized name now auto-appends a counter
- **BLOB column detection** — non-geometry BLOB columns no longer trigger geometry extraction
- **Null values in classification** — null/empty values filtered before computing quantile breaks (instead of defaulting to 0)
- **Hover performance** — `setSelectedFeature` now skips updates when hovering over the same feature
- **ESLint config** — upgraded to ESLint 9 with flat config; fixed lint command for Yarn compatibility
- **Unused code** — removed dead `getGeometryKey` function and unused `Geometry` import

### Changed
- **Bundle splitting** — main app chunk reduced from 1,194 KB to 118 KB via manual vendor chunks (deck.gl, React, H3)
- **deck.gl** upgraded from mixed 9.1.x/9.2.x to unified **9.2.11**
- **luma.gl** upgraded from 9.0.x to **9.2.6**
- **loaders.gl** upgraded to **4.3.4**
- **ESLint** upgraded from 8.x to **9.x**
- **CI pipeline** — Node 18→20, added yarn cache, added lint step
- **Source maps** hidden in production builds (`sourcemap: 'hidden'`)
- **Vite dev server** `fs.strict` set to `true` for security
- **`predeploy` script** changed from `npm run build` to `yarn build`
- Added `.prettierrc` and `.editorconfig` for code formatting consistency

### Known Issues
- H3 column detection only validates the first preview row
- SQL queries with geometry columns execute 2-4 times
- No automated test suite
- maplibre-gl and vendor-deckgl chunks exceed 800 KB (expected for these libraries)

## [2.0.0] - 2026-03-04

### Added
- **GeoParquet support** — upload `.parquet` files with geometry columns; auto-detected and rendered on the map
- **Plain Parquet support** — Parquet files without geometry are registered as SQL-only tables for JOINs and queries
- **Plain CSV as SQL tables** — CSV files without coordinate or H3 columns are registered as DuckDB tables instead of being rejected
- **Parquet tab** in Add Data modal alongside GeoJSON, CSV, Shapefile, and Config
- **Layer rename** — click a layer name in the Layers panel to edit it inline
- **DuckDB-only table badges** — SQL editor shows purple "DB" badges for tables without map layers
- **Shapefile source tracking** — shapefile layers now use the actual file name instead of a generic name

### Changed
- **Geometry round-trips** use `ST_GeomFromGeoJSON` / `ST_AsGeoJSON` instead of WKT for reliable handling of complex geometries (MultiPolygon, etc.)
- **Geometry column detection** in SQL queries uses `DESCRIBE` for precise type checking, avoiding false positives on STRUCT columns like `bbox`
- **DuckDB CDN URLs** are now pinned to match the installed npm package version (`1.33.1-dev20.0`)
- **Config export version** bumped to `2.0.0`

### Fixed
- Renaming a GeoParquet layer no longer deletes its DuckDB table (table name is stored independently of display name)
- Numeric filter comparisons now work correctly with string-typed CSV values (uses `Number()` conversion)
- Empty filter value no longer creates an unintended `= 0` filter
- File names with special characters no longer break Parquet import SQL
- Removed dead code: unused WKT parser/serializer, unused imports (`extractCoordinates`, `fileInputRef`, `ColorScaleName` in geometry.ts)
- All `tsc --noEmit` strict errors resolved (0 errors)

### Performance
- deck.gl layer instances memoized with `useMemo` — layers only recreate when data or filters change, not on hover/click
- Hover/click handlers use refs instead of state dependencies to avoid layer recreation
- `_normalize: false` on GeoJsonLayer skips expensive coordinate normalization
- `autoHighlight` for GPU-accelerated hover highlighting (replaces per-feature JS computation)

### Known Issues (P2+, planned for future releases)
- H3 column detection only validates the first preview row
- SQL queries with geometry columns execute 2-4 times (initial + DESCRIBE + display + GeoJSON extraction)
- DuckDB-only CSV column selection UI doesn't filter columns (all columns are always registered)
- Importing a map configuration doesn't clear DuckDB-only tables from a previous session
- Residual Vite template styles in `App.css` and `index.css` (global button/root styles)
- `BigInt` values silently converted to `Number` (precision loss for values > 2^53)
- Main JS bundle exceeds 1 MB (could benefit from further code splitting)
- No automated test suite

## [1.0.0] - 2025-04

### Added
- Initial release
- GeoJSON, CSV (lat/lng and H3), and map configuration import/export
- Interactive map with deck.gl (GeoJsonLayer, ScatterplotLayer, H3HexagonLayer) and MapLibre GL JS
- Multiple free basemaps (Carto Light, Carto Dark, OpenStreetMap)
- Per-layer symbology: color mapping, size mapping, opacity, point size
- 8 sequential color scales (ColorBrewer-inspired)
- Column-level data filtering with numeric and text modes
- Feature inspection on click
- Color and size legends
- DuckDB-WASM SQL editor with spatial extension support
- Shapefile (.zip) import via shpjs
- Drag-and-drop file upload
- GitHub Pages deployment via GitHub Actions
