# MapViewer-GL

A browser-based geospatial data viewer with SQL-powered analytics. Upload your data, style it on an interactive map, and run spatial queries — all locally in the browser with zero server-side processing.

[Live Demo](https://bobsa514.github.io/mapviewer-gl/)

## Key Features

### Data Formats
- **GeoJSON** — polygons, lines, points, and multi-geometries
- **CSV** — auto-detects lat/lng columns or H3 hex indexes; CSVs without coordinates are registered as SQL-only tables for JOINs
- **Shapefile** — upload a zipped `.shp`/`.dbf`/`.prj` bundle; parsed client-side via [shpjs](https://github.com/calvinmetcalf/shapefile-js)
- **Parquet / GeoParquet** — GeoParquet files render on the map; plain Parquet files are registered as SQL-only tables for JOINs
- **Map Configurations** — export/import full map state (layers, styles, filters, view)

### In-Browser SQL with DuckDB-WASM
Every data layer you add becomes a queryable SQL table powered by [DuckDB-WASM](https://duckdb.org/docs/api/wasm/overview). This means you can:

- **Query any layer** — `SELECT * FROM my_layer WHERE population > 10000`
- **Join layers** — `SELECT a.*, b.name FROM points a JOIN polygons b ON ...`
- **Spatial operations** — `ST_Within`, `ST_Intersects`, `ST_Buffer`, `ST_Distance`, and more via the [DuckDB Spatial extension](https://duckdb.org/docs/extensions/spatial/overview)
- **Add results as layers** — query results with geometry columns can be visualized directly on the map
- **Non-geo tables** — plain CSV and Parquet files without geometry are available as SQL tables for JOINs and analysis

DuckDB is lazy-loaded (~200 KB WASM) only when you open the SQL editor, so it doesn't affect initial page load.

### Map & Styling
- Multiple free basemaps (Carto Light, Carto Dark, OpenStreetMap) — no API key needed
- Per-layer color and size symbology with classified breaks (equal-interval)
- 8 sequential color scales (Reds, Blues, YlOrRd, etc.)
- Opacity, point size, and visibility controls
- Interactive feature inspection on click
- Color and size legends

### Layer Management
- Drag-and-drop file upload via centered modal
- Toggle visibility, remove, and rename layers
- Column-level filtering with multiple conditions
- Export/import full map configurations as JSON

## Data Privacy

All processing happens locally in your browser. No data is uploaded to any server. When you close the tab, all data is gone.

## Data Format Details

### GeoJSON
Standard GeoJSON FeatureCollection. All geometry types supported. Properties are available for filtering, symbology, and SQL queries.

### CSV (Points)
Include coordinate columns with common names:
- Latitude: `lat`, `latitude`, `y`
- Longitude: `lng`, `long`, `longitude`, `lon`, `x`

### CSV (H3 Hexagons)
Include an H3 index column named: `hex_id`, `h3_index`, `h3`, or `hexagon`. Must contain valid H3 cell addresses.

### Shapefile
Upload a `.zip` containing `.shp`, `.dbf`, and optionally `.prj` files. Multi-layer ZIPs are merged into a single collection.

### Parquet / GeoParquet
Upload `.parquet` files. GeoParquet files with a geometry column are rendered on the map. Plain Parquet files without geometry are registered as SQL-only tables, available for JOINs and queries in the SQL editor.

## Setup

```bash
git clone https://github.com/bobsa514/mapviewer-gl.git
cd mapviewer-gl
```

Install dependencies (uses Yarn 4 via Corepack):

```bash
corepack enable
yarn install
```

Start the development server:

```bash
yarn dev
```

Build for production:

```bash
yarn build
```

## Architecture

The app is a React + TypeScript SPA built with Vite. Key libraries:

| Library | Purpose |
|---|---|
| [deck.gl](https://deck.gl/) | WebGL-accelerated map layers (GeoJSON, Scatterplot, H3) |
| [MapLibre GL JS](https://maplibre.org/) | Basemap rendering (via react-map-gl) |
| [DuckDB-WASM](https://duckdb.org/docs/api/wasm/overview) | In-browser SQL engine with spatial extension |
| [shpjs](https://github.com/calvinmetcalf/shapefile-js) | Shapefile parsing (ZIP to GeoJSON) |
| [PapaParse](https://www.papaparse.com/) | CSV parsing |
| [h3-js](https://h3geo.org/) | H3 hexagon utilities |
| [Tailwind CSS](https://tailwindcss.com/) | Styling |

### Project Structure

```
src/
  types.ts                  # Shared type definitions (LayerInfo, ColorScaleName, etc.)
  utils/
    geometry.ts             # Coordinate extraction, bounds, color/size mapping
    csv.ts                  # CSV column detection and row processing
    layers.ts               # Numeric column detection for symbology
    shapefile.ts            # Shapefile ZIP parsing (code-split)
    duckdb.ts               # DuckDB-WASM init, table registration, query execution (code-split)
  components/
    MapViewerGL.tsx          # Main orchestrator — state management, deck.gl rendering
    AddDataModal.tsx         # Tabbed file upload modal (GeoJSON, CSV, Shapefile, Parquet, Config)
    SQLEditor.tsx            # Split-pane SQL editor with results table
    LayersPanel.tsx          # Layer list with symbology controls
    FilterModal.tsx          # Column-level data filtering
    CSVPreviewModal.tsx      # CSV column selection before import
    GeoJSONPreviewModal.tsx  # GeoJSON property selection before import
    FeaturePropertiesPanel.tsx # On-click feature attribute inspector
    BasemapSelector.tsx      # Basemap style picker
    LegendDisplay.tsx        # Color and size legends
```

## Deployment

Automatically deployed to GitHub Pages on push to `main` via GitHub Actions.

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines.

## Author

**Boyang Sa** — [boyangsa.com](https://boyangsa.com) | [GitHub](https://github.com/bobsa514) | [me@boyangsa.com](mailto:me@boyangsa.com)
