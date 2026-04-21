# MapViewer-GL Redesign — Implementation Plan

**Status:** PLANNED — not yet executed. Ready to pick up in a fresh session.
**Last updated:** 2026-04-17 (planning session)

## Context for a fresh session

1. `UX_SPEC.md` at repo root is the **functional** spec (what the app does + user stories).
2. `docs/design/` is the **visual** source of truth — a Claude Design handoff bundle with an interactive HTML/CSS/JS prototype.
   - `docs/design/README.md` — original handoff readme
   - `docs/design/project/MapViewer-GL.html` — prototype entry
   - `docs/design/project/styles.css` — the design system in CSS (OKLCH, typography, components)
   - `docs/design/project/*.jsx` — prototype React components (reference, not to be copied verbatim)
   - `docs/design/chats/chat1.md` — designer ↔ user conversation showing intent + decisions
3. This file (`IMPLEMENTATION_PLAN.md`) is the execution checklist.

Do not skip reading `docs/design/project/styles.css` and `docs/design/chats/chat1.md` — they contain all the pixel-level decisions.

## Goal

Port the approved visual design onto the real codebase. Keep all functional logic (DuckDB-WASM, deck.gl, file parsers, filters, config I/O) intact. Replace the visual shell and the panels the prototype mocked up.

## Confirmed direction

- The latest design (the Claude Design handoff) is the **source of truth for UI/UX** going forward.
- The filter UI will become a **rail panel** (reached via Style/Filter segmented toggle), not a modal. This is the biggest behavioral change — confirmed with user.

## Design system to adopt verbatim

| Token | Value |
|---|---|
| Display font | `Instrument Serif` (italic variants used for accents) |
| UI font | `Inter` (400/500/600) — **13px base** |
| Code/data font | `JetBrains Mono` (400/500) |
| Background | `oklch(0.985 0.003 270)` — warm-cool off-white |
| Ink | `oklch(0.22 0.01 270)` |
| Accent | `oklch(0.55 0.08 253)` — muted lilac (hue 253, chroma 0.08) |
| Density | `compact` — padding 14/8, row 26px |
| Layout | 3-column grid: **280px \| 1fr \| 300px**, 44px topbar |
| Corner radii | Rails: 0. Buttons: 8px. Cards: 10–12px. |

## State model changes in MapViewerGL.tsx

**Add:**
- `selectedLayerId: number | null` — which layer the left-rail edit panels act on
- `editTarget: 'style' | 'filter'` — which panel is showing in the left rail

**Remove:**
- `showFilterModal` (replaced by `editTarget === 'filter'`)
- `showLayers` (rail is permanent)
- `isExpanded` field on `LayerInfo` (per-layer expand gone; single rail panel driven by selection)

**Keep unchanged:** `layers`, `activeFilters`, `selectedFeature`, `isFeatureLocked`, `showSQLEditor`, `showAddDataModal`, `duckdbOnlyTables`, all file handlers.

## File-by-file changes

### New files
| File | Purpose |
|---|---|
| `src/styles/design.css` | OKLCH design system + component classes, ported from prototype `styles.css` |
| `src/components/Topbar.tsx` | Brand + meta + right-side actions (SQL / Share / Export / Add data) |
| `src/components/Inspector.tsx` | Right-rail inspector — replaces `FeaturePropertiesPanel` |
| `src/components/EmptyState.tsx` | Redesigned welcome — eyebrow + serif h1 + samples grid + privacy promise |
| `src/components/MapControls.tsx` | Zoom in / out / recenter buttons (top-right of map) |
| `src/components/SymbologyPanel.tsx` | Left-rail style panel — base color, opacity, point size, color-by-column + palette grid |
| `src/components/FilterPanel.tsx` | Left-rail filter panel — active filters list + add-filter form (ports logic from `FilterModal`) |

### Modified files
| File | What changes |
|---|---|
| `index.html` | Add Google Fonts preconnect + `<link>` for Instrument Serif / Inter / JetBrains Mono |
| `src/App.tsx` | Import `styles/design.css` (load order: Tailwind → design) |
| `src/components/MapViewerGL.tsx` | Rebuild shell: 3-column grid, integrate Topbar + left rail + Map + right rail (Inspector). Remove floating Layers/SQL toggle buttons. Wire `selectedLayerId`, `editTarget`. |
| `src/components/LayersPanel.tsx` | Re-skin: swatch + name + meta row + hover-reveal actions + drag handle; remove inline symbology |
| `src/components/BasemapSelector.tsx` | Re-skin: segmented pill control bottom-right |
| `src/components/LegendDisplay.tsx` | Re-skin: compact card bottom-left |
| `src/components/Toast.tsx` | Re-skin: dark pill, center-bottom |
| `src/components/SQLEditor.tsx` | Re-skin: floating overlay with `Tables in scope` sidebar + templates list + serif header + meta bar with "Add as map layer" CTA |

### Deleted files
| File | Why |
|---|---|
| `src/components/FeaturePropertiesPanel.tsx` | Replaced by `Inspector.tsx` |
| `src/components/FilterModal.tsx` | Replaced by `FilterPanel.tsx` — the `FilterInfo` type moves to `types.ts` |

### Unchanged (keep Tailwind for now, phase-2 re-skin)
- `AddDataModal.tsx`, `CSVPreviewModal.tsx`, `GeoJSONPreviewModal.tsx`, `ErrorBoundary.tsx`
- All of `src/utils/*`, `src/data/*`, tests

## Execution order

1. **Foundation** — add `design.css`, Google Fonts, import in App. Verify nothing regresses.
2. **Shell** — build new grid layout in `MapViewerGL.tsx` with placeholder Topbar/Inspector.
3. **New components** — Topbar, Inspector, EmptyState, MapControls, SymbologyPanel, FilterPanel.
4. **Re-skin existing** — LayersPanel, SQLEditor, BasemapSelector, LegendDisplay, Toast.
5. **Wire new state** — `selectedLayerId`, `editTarget`, Style/Filter toggle.
6. **Delete** — FeaturePropertiesPanel.tsx, FilterModal.tsx (migrate `FilterInfo` to `types.ts`).
7. **Verify** — `yarn lint`, `yarn test`, `yarn build`, `yarn dev` smoke test.
8. **Docs** — update CLAUDE.md (file structure), CHANGELOG.md (v2.3.0 redesign entry).

## Risks & mitigations

| Risk | Mitigation |
|---|---|
| Tailwind preflight fights design.css body styles | Import design.css **after** Tailwind in App |
| Vitest tests break because types moved | Move `FilterInfo` to `types.ts`; keep the public API stable |
| Users lose filter-modal access pattern | Filter reachable via filter icon on layer → rail switches to FilterPanel |
| OKLCH browser support | All modern browsers (Safari 15.4+, Chrome 111+, FF 113+) |
| Three-column grid breaks on narrow screens | Not addressed in this pass; note in CHANGELOG |

## Done criteria

- `yarn build` — 0 TS errors
- `yarn test` — 57 tests pass
- `yarn lint` — within budget
- `yarn dev` — load sample, click layer → see symbology, toggle to Filter, click feature → see Inspector, open SQL via ⌘K, switch basemap
- CHANGELOG + CLAUDE.md updated

## Out of scope (for this redesign pass)

- Re-skinning AddDataModal / CSVPreviewModal / GeoJSONPreviewModal (phase 2)
- Mobile/narrow-screen responsive layout
- Tweaks panel (design-tool artifact, not a real feature)
- Real-time iteration against the prototype (we're porting the final design, not live-syncing)
