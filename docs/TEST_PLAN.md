# MapViewer-GL — Test Plan

**Last updated:** 2026-06-04 (audit of v2.3.0 shipped code)

## Current State: 57 Tests, All Passing

| Module | Tests | Covers |
|---|---|---|
| `csv.test.ts` | 15 | `detectCoordinateColumns`, `detectH3Column`, `processChunk` |
| `duckdb.test.ts` | 20 | `sanitizeTableName`, `escapeIdentifier`, `inferColumnType`, `formatValue` |
| `geometry.test.ts` | 16 | `extractCoordinates`, `calculateBounds`, `hexToRGB`, `getColorForValue`, `getSizeForValue` |
| `layers.test.ts` | 6 | `getNumericColumns`, `getNumericValuesForColumn` (including with active filters) |

## Coverage Gaps

### Critical — No component tests exist
- `FilterPanel` — `buildColumns`, `buildFilterFn`, form state management, edge cases
- `SymbologyPanel` — column detection, palette selection, color/opacity/size propagation
- `LayersPanel` — selection, visibility toggle, rename, drag-reorder
- `MapViewerGL` — filter application in deckLayers useMemo, state synchronization
- `SQLEditor` — query execution, table injection, add-as-layer
- `Inspector` — feature display, pin/unpin, formatCoordinate
- `BasemapSelector` — selection state, object comparison
- `LegendDisplay` — legend rendering with breaks
- `MapControls` — zoom/recenter callbacks
- `Toast` — add/remove/auto-dismiss

### Missing Utility Tests
- `tableName.ts` — no dedicated test file (tested indirectly via duckdb.test.ts)
- CSV column selection logic in `MapViewerGL.tsx` — `toggleColumnSelection`, `proceedWithSelectedColumns`
- GeoJSON property selection — `toggleGeoJSONPropertySelection`, `proceedWithSelectedGeoJSONProperties`
- Configuration export/import — `exportConfiguration`, `applyConfig` (filter reconstruction)
- URL hash parsing — `parseHashViewState`
- Feature equality — `areFeaturesEqual`

### Missing Integration Tests
- Full filter flow: add filter → verify deckLayers useMemo output has fewer items
- Full symbology flow: enable color-by-column → verify breaks computed correctly
- Full data flow: upload CSV → preview → select columns → layer created
- Config round-trip: add layer with filters → export → import → verify filters preserved
- SQL: run query with geometry → add as layer → verify layer in list

## Recommended Test Additions

### Priority 1 — Filter logic (extract and test)
```
src/utils/__tests__/filter.test.ts
  - buildColumns: numeric/text detection, empty data, mixed types
  - buildFilterFn: numeric range, numeric comparison, text exact, text contains
  - extractDataItems: geojson, point, h3 data normalization
```

### Priority 2 — Filter integration (component test)
```
src/components/__tests__/FilterPanel.test.tsx
  - Renders with empty filter state
  - Adds numeric range filter
  - Adds text contains filter
  - Shows correct filter count in active list
  - Removes a filter
```

### Priority 3 — Symbology
```
src/utils/__tests__/symbology.test.ts
  - getNumericColumns with edge cases
  - Color mapping break computation
  - Size mapping break computation
```

### Priority 4 — Config round-trip
```
src/__tests__/config.test.ts
  - Export: all layer types with filters → valid JSON
  - Import: config JSON → valid LayerInfo array
  - Import: config with filters → activeFilters correctly reconstructed
  - Import: config version check
```

## Test Infrastructure

- **Runner:** Vitest 3.x
- **Environment:** `node` (no jsdom — cannot render React components in tests)
- **To add component tests:** need to add `@testing-library/react` + `jsdom` or `happy-dom`

## Test Commands
```bash
yarn test          # Run all tests
yarn test --watch  # Watch mode
yarn build         # Also runs tsc type check
```
