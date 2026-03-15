# CTO Briefing — MapViewer-GL — 2026-03-14

## Technical Health

**Build:** Green. Production build completes in ~5.5s with zero errors. Two Vite warnings about mixed static/dynamic imports for `papaparse` and `duckdb.ts` — cosmetic, no runtime impact.

**Lint:** 10 warnings, 0 errors. The `--max-warnings 20` threshold in `package.json` gives 10 warnings of headroom before CI breaks. All 10 are react-hooks/exhaustive-deps warnings in `MapViewerGL.tsx` — these are intentional suppressions (adding the suggested deps would cause infinite re-render loops), but they should be explicitly silenced with eslint-disable comments so the warning budget is not consumed by known-intentional cases.

**Bundle:** 13 MB total dist. Two chunks exceed 800 KB (maplibre-gl at 802 KB, vendor-deckgl at 828 KB). This is inherent to these libraries and not actionable without dropping features. Main app chunk is a healthy 125 KB.

**Browserslist:** 13 months stale. Should run `npx update-browserslist-db@latest` — trivial fix, affects build target accuracy.

**Version mismatch:** `package.json` says `"version": "2.0.0"` but CHANGELOG documents v2.1.0 as shipped. The version field should be `2.1.0`.

**Overall:** Stable for a solo project. The codebase is well-organized with clear separation of concerns (utils vs. components), good inline documentation, and consistent patterns. The primary concern is the complete absence of tests and the growing monolith in MapViewerGL.tsx.

---

## Critical Technical Debt

### P1 | Effort M | No automated tests — zero test coverage

There are no tests of any kind: no unit tests, no integration tests, no smoke tests. Every code change is deployed with only TypeScript type-checking and lint as safety nets. This is the single biggest risk to stability. A regression in `duckdb.ts` (SQL escaping, geometry round-trips) or `csv.ts` (coordinate parsing) could ship silently.

**Impact now:** Low, because the codebase is small and the developer manually tests. **Impact at scale:** High — any contributor (human or AI) making changes to shared utilities has no way to verify they did not break existing behavior.

### P1 | Effort S | SQL query executes 2-4 times for geometry columns

In `src/utils/duckdb.ts:240-306`, `executeQuery()` runs the user's SQL query up to 4 times when geometry columns are present: (1) initial query, (2) DESCRIBE, (3) display query with ST_AsText, (4) GeoJSON extraction query with ST_AsGeoJSON. For expensive queries (spatial joins on large datasets), this multiplies execution time by 3-4x. The initial query result is discarded entirely when geometry is detected.

**Fix approach:** Run DESCRIBE on the query first (without materializing results via `DESCRIBE (query)` or use `CREATE TEMP VIEW`), then execute once with both ST_AsText and ST_AsGeoJSON columns in a single pass.

### P2 | Effort S | React Hook dependency warnings consuming lint budget

All 10 ESLint warnings are `react-hooks/exhaustive-deps` in MapViewerGL.tsx (lines 139, 150, 213, 373, 411, 456, 468, 640, 792). These are intentionally omitted deps (adding them would cause loops). They should get explicit `// eslint-disable-next-line react-hooks/exhaustive-deps` comments, freeing the warning budget for genuine issues.

### P2 | Effort S | DuckDB module singleton is not resilient to initialization failures

In `src/utils/duckdb.ts:16-17`, `db` and `conn` are module-level singletons. If `initDuckDB()` partially fails (e.g., CDN is down, WASM fails to instantiate), `db` may be set to a non-null value while `conn` remains null, or the spatial extension may fail to load. Subsequent calls to `initDuckDB()` will no-op (`if (db) return;`) and all queries will fail. There is no retry mechanism and no way to reset state.

### P2 | Effort M | `registeredTableNames` Set in duckdb.ts leaks on page lifetime

The `registeredTableNames` Set at `src/utils/duckdb.ts:20` only grows — `unregisterLayer()` removes from it, but if the user imports a config (which calls `setLayers([])` then re-adds layers), the old names remain in the Set, and the deduplication counter may produce unexpected names. Also, since this is module-level state, it persists across React strict-mode double-renders and fast-refresh cycles, causing name collisions during development.

### P2 | Effort L | MapViewerGL.tsx monolith (1,261 lines, 28 state variables)

MapViewerGL.tsx manages 28 `useState` calls, 8 `useRef` calls, and contains all business logic (CSV parsing orchestration, GeoJSON handling, Parquet handling, config import/export, layer management, filter management, DuckDB sync, deck.gl layer creation). This makes it:
- Hard to reason about re-render triggers
- Impossible to test individual features in isolation
- Risky for AI agents to modify (high chance of unintended side effects)

### P3 | Effort S | BigInt precision loss

`src/utils/duckdb.ts:316` and `:336` silently convert BigInt to Number. Values above 2^53 will lose precision. This matters for datasets with large integer IDs (census tract FIPS codes, OSM node IDs). A safe conversion would use string representation for BigInts that exceed `Number.MAX_SAFE_INTEGER`.

### P3 | Effort S | H3 column detection only validates first row

`src/components/MapViewerGL.tsx:182` checks `isValidH3Index(previewRows[0][h3ColumnIndex])`. If the first row has a valid H3 index but subsequent rows do not, the entire dataset is treated as H3 data and invalid rows are silently dropped. Should validate multiple sample rows.

### P3 | Effort S | Config import does not clear DuckDB-only tables

`applyConfig()` at line 551 clears layers, filters, and selection, but does not clear `duckdbOnlyTables`. If the user had CSV-only or Parquet-only tables from a previous session, they persist through config import, creating ghost table references.

---

## Architecture Concerns

### State Management Scalability

The current "all state in one component" approach works at 1,261 lines but is reaching its limit. The next feature that adds state (undo/redo, multi-select, layer groups, attribute table view) will push this past maintainability. The recommended migration path is:

1. **Near-term:** Extract a custom hook `useLayerManager()` that encapsulates layer CRUD, filters, symbology, and DuckDB sync. This can be done without introducing any new dependencies.
2. **Medium-term:** If the app grows to 2,000+ lines or needs cross-component state sharing (e.g., a standalone attribute table panel), adopt Zustand (3 KB, zero boilerplate). Do NOT adopt Redux — it is overkill for this app.

### Code Splitting Effectiveness

The dynamic `import()` for `duckdb.ts` and `shapefile.ts` is partially defeated:
- `papaparse` is imported statically in MapViewerGL.tsx (line 7: `import Papa from 'papaparse'`) AND dynamically in `duckdb.ts:470`. The static import forces it into the main bundle. Since Papa is only used in `handleCSVFile`, it should be dynamically imported there.
- `duckdb.ts` is dynamically imported in several places but also statically imported for `sanitizeTableName` (line 16). This pulls the entire module into the main chunk. `sanitizeTableName` should be moved to a separate utility file.

### Dual Deployment (GitHub Pages + Vercel)

The `vite.config.ts` conditionally sets `base` based on `GITHUB_ACTIONS` env var. Vercel config exists but there is no Vercel CI/CD pipeline defined — deployment appears manual. If both are live, they could serve different versions. Recommendation: pick one as primary, use the other as preview/staging only. The COOP/COEP headers in `vercel.json` are required for SharedArrayBuffer (DuckDB WASM threading) — GitHub Pages does not set these headers, which means **DuckDB may not use multi-threading on the GitHub Pages deployment**.

---

## Security & Reliability

### SQL Injection — Mitigated but Fragile

Column names are properly escaped via `escapeIdentifier()` in `duckdb.ts`. Table names use double-quote wrapping. However, user-entered SQL in the SQL Editor (`SQLEditor.tsx:94`) is passed directly to `executeQuery()` with no sandboxing. Since DuckDB-WASM runs entirely in-browser and can only access data the user uploaded, this is acceptable — there is no server to attack. But if DuckDB-WASM ever gains filesystem or network access, this would need revisiting.

### Config File Import — No Schema Validation

`handleConfigFile()` at line 622 parses the JSON and checks only `config.version`. A malformed config file with missing `viewState`, invalid `layers[].type`, or unexpected `data` shapes will cause runtime crashes. Should validate with a schema or at minimum check required fields.

### Error Boundaries — None

There are no React error boundaries. A rendering crash in any component (e.g., malformed GeoJSON in LegendDisplay, null properties in FeaturePropertiesPanel) will unmount the entire app. A single `<ErrorBoundary>` wrapping MapViewerGL would prevent full-app crashes and show a recovery UI.

### Memory Management

Large GeoJSON datasets are held in memory as full JavaScript objects in `layers[].data`. There is no mechanism to:
- Warn users about memory limits
- Virtualize/stream large datasets
- Release memory when layers are removed (GC handles this, but the `registeredTableNames` Set retains references to names indefinitely)

This is acceptable for the current use case but will become a problem if users load multiple 50MB+ files.

---

## Recommended Technical Tasks (Ranked)

### 1. P1 | Effort L | Add Core Test Suite

**Why now:** Every session of AI-assisted coding risks regressions in the utility layer. Tests for the pure functions (`sanitizeTableName`, `escapeIdentifier`, `inferColumnType`, `detectCoordinateColumns`, `detectH3Column`, `calculateBounds`, `getColorForValue`, `processChunk`) can be written quickly and provide high confidence. These functions have well-defined inputs and outputs.

**Approach:** Add Vitest (works natively with Vite, zero-config). Start with `src/utils/duckdb.test.ts`, `src/utils/csv.test.ts`, `src/utils/geometry.test.ts`, `src/utils/layers.test.ts`. Add `test` script to package.json. Add test step to CI pipeline.

**Acceptance criteria:** 15+ test cases covering the pure utility functions. CI runs tests before deploy.

### 2. P1 | Effort M | Fix SQL Query Quadruple Execution

**Why now:** Users running spatial joins on moderate datasets (10K+ rows) will notice 3-4x slower query times than necessary. This is the most impactful performance fix available.

**Approach:** In `executeQuery()`, run `DESCRIBE (${sql})` first to detect geometry columns without materializing results. Then construct a single SELECT that includes both the display columns and geometry-as-GeoJSON in one pass. Eliminates 2-3 redundant query executions.

**Acceptance criteria:** A query with a geometry column executes the user's SQL at most twice (DESCRIBE + combined result query).

### 3. P2 | Effort S | Suppress Intentional ESLint Warnings + Update Browserslist

**Why now:** 10 of 20 warning slots are consumed by intentional suppressions. This is a 15-minute task that improves CI signal quality.

**Approach:** Add `// eslint-disable-next-line react-hooks/exhaustive-deps` comments to the 9 intentional suppressions in MapViewerGL.tsx. Move the `useToast` hook export out of Toast.tsx into a separate file to fix the react-refresh warning. Run `npx update-browserslist-db@latest`. Reduce `--max-warnings` from 20 to 5.

**Acceptance criteria:** `yarn lint` shows 0 warnings. `--max-warnings` set to 5.

### 4. P2 | Effort M | Extract `useLayerManager` Hook from MapViewerGL.tsx

**Why now:** The monolith is at 1,261 lines and is the file most likely to be modified in any future session. Extracting the layer CRUD logic (add, remove, rename, reorder, toggle, color/size/opacity updates, filter management) into a custom hook reduces MapViewerGL.tsx by ~300 lines and makes layer management independently testable.

**Approach:** Create `src/hooks/useLayerManager.ts`. Move state (`layers`, `activeFilters`, `duckdbOnlyTables`, `registeredTables`) and all layer mutation functions into the hook. MapViewerGL.tsx calls the hook and passes results to child components.

**Acceptance criteria:** MapViewerGL.tsx under 900 lines. All layer operations work identically. No regressions in UI.

### 5. P2 | Effort S | Add React Error Boundary

**Why now:** A single malformed feature or unexpected null in any component will crash the entire app with a white screen. An error boundary is 20 lines of code and converts crashes into recoverable error messages.

**Approach:** Create `src/components/ErrorBoundary.tsx`. Wrap `MapViewerGL` in `App.tsx`. Show "Something went wrong. Reload?" with a button to `window.location.reload()`.

**Acceptance criteria:** A thrown error in any child component shows the error UI instead of a blank screen.

---

## Build & Deploy Status

| Item | Status | Notes |
|------|--------|-------|
| Build | Green | 5.5s, 0 errors |
| Lint | Green | 10 warnings (within 20 threshold) |
| TypeScript | Green | Strict mode, 0 errors |
| CI (GitHub Actions) | Green (last check: a414a6c) | Lint + Build, deploys to GitHub Pages |
| Vercel | Config present, no CI pipeline | Manual deploy only; COOP/COEP headers set |
| Browserslist | Stale (13 months) | Run `npx update-browserslist-db@latest` |
| Package version | Mismatched | `package.json` says 2.0.0, CHANGELOG says 2.1.0 |

---

## Decision Points for Founder

1. **Primary deployment target:** GitHub Pages does not support COOP/COEP headers, which may disable DuckDB WASM multi-threading. If DuckDB performance matters, Vercel should be the primary deployment. If GitHub Pages is preferred for simplicity, accept single-threaded WASM. This needs a deliberate choice.

2. **Test investment timing:** Adding Vitest now (~2 evenings of work) pays dividends immediately by enabling confident refactoring. Deferring tests makes every future change riskier. My strong recommendation is to prioritize this above new features.

3. **React 19 upgrade:** `package.json` specifies `"react": "^18.2.0"` but the project context mentions React 19. Verify which version is actually installed. If 18, there is no urgency to upgrade. If 19, update the type definitions (`@types/react`) to match.
