# Contributing to MapViewer-GL

Thanks for your interest in contributing! This document covers how to get started, the project conventions, and how to submit changes.

## Getting Started

### Prerequisites
- Node.js 18+
- Corepack enabled (`corepack enable`) for Yarn 4
- A modern browser (Chrome/Firefox/Edge) for testing

### Setup

```bash
git clone https://github.com/bobsa514/mapviewer-gl.git
cd mapviewer-gl
yarn install
yarn dev
```

The dev server runs at `http://localhost:5173` with hot module replacement.

### Building

```bash
yarn build
```

This produces a production bundle in `dist/`. DuckDB-WASM and shpjs are code-split into separate chunks and only loaded on demand.

## Project Overview

MapViewer-GL is a client-side geospatial data viewer built with React, deck.gl, and MapLibre GL JS. All data processing happens in the browser — there is no backend.

### Key Architectural Decisions

- **No API keys required** — basemaps use free Carto and OpenStreetMap tiles
- **Code splitting** — DuckDB-WASM (~200 KB) and shpjs (~141 KB) are lazy-loaded via dynamic `import()` so they don't affect initial page load
- **State in MapViewerGL** — the main component owns all state; child components receive props and fire callbacks
- **Types in `src/types.ts`** — shared domain types are centralized, not scattered across components
- **Utilities in `src/utils/`** — pure functions for geometry, CSV parsing, layer inspection, DuckDB, and shapefile parsing

### DuckDB-WASM Integration

DuckDB is a major feature that enables SQL analytics on map layers. Key things to know:

- **Lazy initialization** — `initDuckDB()` in `src/utils/duckdb.ts` is called only when the SQL editor opens
- **WASM from CDN** — the DuckDB WASM binary is loaded from jsDelivr, not bundled
- **Blob Worker** — a blob wrapper is used for the Web Worker to avoid cross-origin restrictions
- **Spatial extension** — loaded on init for `ST_*` functions (spatial joins, buffers, etc.)
- **Auto type inference** — `registerLayer()` samples up to 100 rows to determine column types (BIGINT, DOUBLE, or VARCHAR)
- **Geometry handling** — stored as native GEOMETRY via `ST_GeomFromGeoJSON()`; converted back with `ST_AsGeoJSON()` for display and GeoJSON export
- **Parquet support** — GeoParquet files are read via `read_parquet()` with auto-detection of geometry columns; plain Parquet files are registered as SQL-only tables
- **COOP/COEP headers** — required for SharedArrayBuffer (DuckDB threading); configured in `vite.config.ts` for dev server

### Shapefile Support

Shapefile parsing uses [shpjs](https://github.com/calvinmetcalf/shapefile-js) which handles ZIP extraction and SHP/DBF parsing. After parsing, the data flows through the same GeoJSON pipeline (preview modal, layer creation, DuckDB registration).

## How to Contribute

### Reporting Bugs

Open an issue with:
- Steps to reproduce
- Expected vs actual behavior
- Browser and OS
- Sample data file if relevant (or a description of it)

### Suggesting Features

Open an issue describing the use case and proposed solution. For large features, discuss the approach before starting implementation.

### Submitting Code

1. Fork the repo and create a branch from `main`
2. Make your changes
3. Run `yarn build` to verify no build errors
4. Test manually with sample data (GeoJSON, CSV, Shapefile, Parquet)
5. If you changed DuckDB integration, test SQL queries including spatial operations
6. Submit a pull request with a clear description of what changed and why

### Code Style

- TypeScript with strict types — avoid `any` where possible
- React functional components with hooks
- Tailwind CSS for styling — no separate CSS files
- JSDoc comments on exported functions and modules
- Keep components focused — if a component grows past ~300 lines, consider splitting it

### Commit Messages

Follow conventional commits:
- `feat:` — new feature
- `fix:` — bug fix
- `refactor:` — code restructuring without behavior change
- `chore:` — tooling, dependencies, CI
- `docs:` — documentation only

## Areas for Contribution

Here are some areas where contributions would be particularly valuable:

- **Performance** — Arrow-based ingestion for DuckDB instead of string INSERTs for large datasets
- **3D geometry** — Z/M coordinate support in WKT converters
- **Additional formats** — GeoPackage, KML, TopoJSON, FlatGeobuf
- **Testing** — unit tests for utilities, integration tests for data pipelines
- **Accessibility** — keyboard navigation, screen reader support
- **Mobile** — responsive layout and touch interactions

## Contact

Boyang Sa — [me@boyangsa.com](mailto:me@boyangsa.com) | [GitHub](https://github.com/bobsa514)
