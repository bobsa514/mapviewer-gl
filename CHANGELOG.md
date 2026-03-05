# Changelog

All notable changes to this project will be documented in this file.

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
