# MapViewer-GL — Product Requirements Document

**Version:** 2.3.0
**Last updated:** 2026-06-04 (audit of v2.3.0 shipped code)
**Status:** Active development

## Elevator Pitch

A **100% client-side geospatial workspace** where users load data files, style them on an interactive map, filter and inspect features, run spatial SQL queries, and share the resulting view — all without a server or an account.

## Target Personas

| Persona | Need |
|---|---|
| Data analyst | Quick visual check of unfamiliar geospatial data |
| Urban planner / researcher | Overlay, filter, join data sources; share view |
| Engineer / GIS pro | Sandbox for spatial SQL prototyping |
| Student / educator | Zero-setup way to learn geospatial concepts |
| Privacy-conscious user | Visualize data that cannot leave their machine |

## Core Principles

1. **Zero-install, zero-signup, zero-server** — instantly usable
2. **Data is the hero** — map is the primary surface; controls retractable
3. **Progressive disclosure** — novice never sees SQL; expert reaches it in one action
4. **Every layer is queryable** — anything on the map can be SQL-queried; any SQL result can become a map layer
5. **Nothing destructive without confirmation** — remove/overwrite require explicit confirm

## Feature Inventory

### Data Ingestion
- [x] GeoJSON upload — becomes map layer + DuckDB table
- [x] CSV with lat/lng — auto-detect coordinates, becomes point layer
- [x] CSV with H3 column — auto-detect H3 index, becomes hexagon layer
- [x] CSV without geometry — registered as SQL-only table
- [x] Shapefile (.zip) — parsed in-browser, becomes GeoJSON layer
- [x] GeoParquet — auto-detect geometry column, becomes map layer
- [x] Plain Parquet — registered as SQL-only table
- [x] Session config (.json) — import/export full session
- [x] Drag-and-drop anywhere on the map canvas
- [x] Sample datasets (US Cities, US States) — one-click load
- [x] Column/property selection before loading
- [x] Coordinate column auto-detection (lat/lng/latitude/longitude/x/y)
- [x] H3 column auto-detection (hex_id/h3_index/h3/hexagon)
- [x] Progress indicator for large files

### Layer Management
- [x] Layer list with color swatch + name + meta (source type, count)
- [x] Visibility toggle per layer
- [x] Rename layer (double-click or rename button)
- [x] Reorder layers (drag handle)
- [x] Remove layer with confirmation modal
- [x] Map layers vs SQL-only tables visually distinguished
- [x] Filter count badge on layer rows

### Symbology
- [x] Base color picker
- [x] Opacity slider (0–100%)
- [x] Point size slider (point layers)
- [x] Color-by-column with 8 sequential palettes (ColorBrewer-inspired: Reds, Blues, Greens, Greys, YlGnBu, YlOrRd, PuBuGn, RdPu)
- [x] Number of classes control (3–10)
- [x] Live updates (no separate "apply" step)
- [ ] Size-by-column (UI not yet implemented; data model supports it)

### Filtering
- [x] Numeric range filter (min ≤ v ≤ max) with column min/max defaults
- [x] Numeric comparison (=, <, <=, >, >=)
- [x] Text exact comparison (case-sensitive =)
- [x] Text contains (case-insensitive substring, comma-separated OR)
- [x] Stack multiple filters per layer (AND semantics)
- [x] Filter count badge visible in layer list
- [x] Remove individual filter
- [x] Filters preserved in exported configurations

### Feature Inspection
- [x] Hover to peek feature attributes
- [x] Click to pin inspection panel
- [x] Primary label detection (name/NAME/title/id)
- [x] Coordinate display for point features
- [x] Key-value attribute table

### SQL Workspace
- [x] DuckDB-WASM with spatial extension
- [x] All layers available as SQL tables
- [x] Tables-in-scope sidebar with click-to-insert
- [x] Query templates (preview, count, spatial join, buffer+intersect)
- [x] Cmd/Ctrl+Enter to run query
- [x] Results table with row count + execution time
- [x] Geometry column detection → "Add as map layer"
- [x] Export results as CSV
- [x] Error messages inline

### Map
- [x] Pan, zoom, scroll-wheel zoom, pinch-zoom
- [x] 3 basemaps: Carto Light, Carto Dark, OpenStreetMap
- [x] Zoom in/out/recenter controls
- [x] Auto-zoom to new layer extent
- [x] Color legend (auto-displays for classified layers)
- [ ] Size legend (not yet implemented)

### Sharing & Persistence
- [x] Full session export as JSON (layers, styling, filters, view state, basemap)
- [x] Session import with overwrite confirmation
- [x] URL hash sharing (lat/lng/zoom)
- [ ] URL hash does not encode layers/data (by design — privacy)

### Error Handling
- [x] ErrorBoundary (catches render crashes, shows recovery UI)
- [x] Toast notifications for errors, warnings, info
- [x] Malformed file → specific error message
- [x] Unsupported file format → clear error
- [x] SQL syntax errors → inline in editor

### Cross-cutting
- [x] all browser processing (no server)
- [x] No API keys required
- [ ] Responsive/mobile layout (not in v2.3 scope)

## Out of Scope (by design)
- User accounts / cloud storage
- Real-time collaboration
- Drawing/editing geometry
- Time-series animation
- 3D/extrusion
- Map export as PNG/PDF
- Geocoding
- Commercial basemaps (Mapbox, Google)

## Known Issues (v2.3.0)
1. FilterPanel column computation is O(n×c) and blocks UI for large datasets
2. No component-level tests (only utility functions tested)
3. Size-by-column UI not exposed in SymbologyPanel
4. Basemap active-state comparison breaks for OSM after config import
5. GeoJSON color-by-column only handles `typeof number`, not string-numeric
6. Only first visible layer's legend is shown (no stacking)
7. AddDataModal, CSVPreviewModal, GeoJSONPreviewModal still on Tailwind (phase-2 re-skin pending)
