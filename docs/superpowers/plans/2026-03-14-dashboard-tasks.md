# Dashboard Tasks Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement all non-GTM, non-founder tasks from the 2026-03-14 CEO Dashboard briefing.

**Architecture:** Seven independent tasks that can be parallelized. Most modify different files. Tasks 3 and 7 both touch MapViewerGL.tsx but in different sections (welcome overlay vs viewState/URL).

**Tech Stack:** React 18, TypeScript, Vite, Vitest (new), Tailwind CSS

---

## Task 1: Housekeeping — Version, ESLint, Browserslist

**Files:**
- Modify: `package.json` (version field, lint script)
- Modify: `src/components/MapViewerGL.tsx` (ESLint disable comments)

- [ ] **Step 1: Fix package.json version**
Change `"version": "2.0.0"` → `"version": "2.1.0"`

- [ ] **Step 2: Add eslint-disable comments to MapViewerGL.tsx**
Add `// eslint-disable-next-line react-hooks/exhaustive-deps` above each intentionally suppressed useEffect/useCallback dependency array. The lines are approximately: 139, 150, 213, 373, 411, 456, 468, 640, 792 (useEffect/useCallback hooks with intentionally incomplete deps).

- [ ] **Step 3: Update browserslist**
Run: `npx update-browserslist-db@latest`

- [ ] **Step 4: Reduce lint threshold**
Change `--max-warnings 20` → `--max-warnings 5` in package.json lint script.

- [ ] **Step 5: Verify**
Run: `yarn lint` — should show 0-5 warnings.
Run: `yarn build` — should succeed.

---

## Task 2: React ErrorBoundary

**Files:**
- Create: `src/components/ErrorBoundary.tsx`
- Modify: `src/App.tsx`

- [ ] **Step 1: Create ErrorBoundary component**
A class component that catches rendering errors and shows a recovery UI.

- [ ] **Step 2: Wrap MapViewerGL in App.tsx**
Wrap `<MapViewerGL />` with `<ErrorBoundary>`.

- [ ] **Step 3: Verify**
Run: `yarn build` — should succeed with no type errors.

---

## Task 3: Sample Datasets on Welcome Screen

**Files:**
- Create: `src/data/samples.ts` (inline GeoJSON data)
- Modify: `src/components/MapViewerGL.tsx` (welcome overlay section ~lines 1138-1154)

- [ ] **Step 1: Create sample datasets file**
Create `src/data/samples.ts` with 2 small inline GeoJSON datasets:
1. US state capitals (15-20 points with name, state, population properties)
2. A few US state polygons (3-5 states with name, population properties)

Keep data < 15KB total.

- [ ] **Step 2: Add "Try sample data" buttons to welcome screen**
In the welcome overlay section of MapViewerGL.tsx (around line 1138), add buttons below "Add Data" that load sample datasets via `addGeoJSONLayer`.

- [ ] **Step 3: Verify**
Run: `yarn build` — should succeed.

---

## Task 4: Main Canvas Drag-and-Drop

**Files:**
- Modify: `src/components/MapViewerGL.tsx` (outer div ~line 977, add drag handlers)

- [ ] **Step 1: Add drag-and-drop handlers to root div**
Add `onDragOver`, `onDragEnter`, `onDragLeave`, `onDrop` handlers to the root `<div className="fixed inset-0">`.
Route files by extension: .geojson/.json → handleGeoJSONFile, .csv → handleCSVFile, .zip → handleShapefileFile, .parquet → handleParquetFile.

- [ ] **Step 2: Add visual drop indicator**
Show a blue border/overlay when dragging over the map canvas.

- [ ] **Step 3: Verify**
Run: `yarn build` — should succeed.

---

## Task 5: Vitest Test Suite

**Files:**
- Modify: `package.json` (add vitest dep, test script)
- Modify: `vite.config.ts` (add test config)
- Create: `src/utils/__tests__/csv.test.ts`
- Create: `src/utils/__tests__/geometry.test.ts`
- Create: `src/utils/__tests__/layers.test.ts`
- Create: `src/utils/__tests__/duckdb.test.ts` (sanitizeTableName, escapeIdentifier, inferColumnType only — no WASM)
- Modify: `.github/workflows/deploy.yml` (add test step)

- [ ] **Step 1: Install Vitest**
Run: `yarn add -D vitest`

- [ ] **Step 2: Add test config to vite.config.ts**
Add `test: { globals: true, environment: 'node' }` (via `/// <reference types="vitest" />`)

- [ ] **Step 3: Add test script to package.json**
Add `"test": "vitest run"` to scripts.

- [ ] **Step 4: Write csv.ts tests**
Test: `detectCoordinateColumns`, `detectH3Column`, `isValidH3Index`, `processChunk`

- [ ] **Step 5: Write geometry.ts tests**
Test: `extractCoordinates`, `calculateBounds`, `hexToRGB`, `getColorForValue`, `getSizeForValue`

- [ ] **Step 6: Write layers.ts tests**
Test: `getNumericColumns`, `getNumericValuesForColumn`

- [ ] **Step 7: Write duckdb.ts unit tests**
Test only the pure functions that don't need WASM: `sanitizeTableName` (with deduplicate=false since the global Set is module-level), `escapeIdentifier` (need to export it first or test indirectly), `inferColumnType` (need to export or test indirectly).

Note: `sanitizeTableName` uses a module-level Set for deduplication. Tests should use `deduplicate: false` to avoid side effects, or test the deduplication behavior explicitly.

Note: `escapeIdentifier` and `inferColumnType` are not exported. Either export them for testing, or skip testing them directly.

- [ ] **Step 8: Add test step to CI**
Add `yarn test` step after lint in deploy.yml.

- [ ] **Step 9: Verify**
Run: `yarn test` — all tests should pass.
Run: `yarn build` — should succeed.

---

## Task 6: Fix SQL Query 4x Execution

**Files:**
- Modify: `src/utils/duckdb.ts` (executeQuery function, lines 240-352)

- [ ] **Step 1: Refactor executeQuery**
Current flow (up to 4 queries):
1. `conn.query(sql)` — initial query (result discarded if geometry found)
2. `conn.query(DESCRIBE (sql))` — detect geometry columns
3. `conn.query(displaySql)` — re-run with ST_AsText
4. `conn.query(geojsonSql)` — re-run with ST_AsGeoJSON

New flow (max 2 queries):
1. `conn.query(DESCRIBE (sql))` or `CREATE TEMP VIEW __user_query AS (sql)` — detect columns first
2. Single combined query that includes both ST_AsText (for display) AND ST_AsGeoJSON (for layer extraction) in one SELECT

If DESCRIBE fails, fall back to running the query once and inspecting schema from the result.

- [ ] **Step 2: Verify**
Run: `yarn build` — should succeed.

---

## Task 7: URL Hash State Sharing

**Files:**
- Modify: `src/components/MapViewerGL.tsx` (viewState init + onViewStateChange)

- [ ] **Step 1: Read URL hash on mount**
Parse `window.location.hash` for `#lat=X&lng=Y&zoom=Z&basemap=NAME` on initial render. Use as initial viewState if present, otherwise use INITIAL_VIEW_STATE.

- [ ] **Step 2: Update URL hash on view change**
Debounce URL hash updates (300ms) when viewState changes. Only encode lat, lng, zoom (rounded to 4 decimal places for lat/lng, 2 for zoom).

- [ ] **Step 3: Verify**
Run: `yarn build` — should succeed.
