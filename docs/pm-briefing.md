# PM Briefing — MapViewer-GL — 2026-03-14

## Product Status

**Current version:** v2.1.0 (released 2026-03-06)
**State:** Stable, polished, no known regressions. No external users yet.
**Since v2.1.0:** Only 2 commits — Vercel deployment config and CI lint threshold fix. The product is between feature pushes.

The product has shipped a comprehensive set of features for a browser-based GIS viewer: multi-format data loading (GeoJSON, CSV, Shapefile, Parquet), in-browser SQL via DuckDB-WASM, layer styling/filtering/reordering, and a polished UI with toast notifications, welcome screen, and accessibility improvements.

**Housekeeping issue:** `package.json` says version `2.0.0` but CHANGELOG documents v2.1.0 as shipped. Should be updated.

---

## User-Facing Priorities

### P0 | Effort S | Sample datasets on welcome screen
**Why:** First-time visitors see an empty map with no data. Without sample data to click, most visitors will bounce. The welcome screen exists but requires users to bring their own files. Adding 2-3 small sample datasets (e.g., US states GeoJSON, city points CSV) with one-click load eliminates the cold-start problem.

### P1 | Effort M | URL hash state / shareable map links
**Why:** Currently there is no way to share a configured map view with someone else. URL-encoded view state (center, zoom, maybe layer config) transforms this from a personal tool into something people can reference and share — dramatically increasing word-of-mouth potential.

### P1 | Effort S | Drag-and-drop on main map canvas (not just modal)
**Why:** Users expect to drag a file onto the map to load it. Currently drag-and-drop only works inside the Add Data modal. This is a UX friction point that will frustrate power users.

### P1 | Effort S | Simple analytics (privacy-respecting)
**Why:** There are zero signals about how many people use the tool, which features are used, or where users drop off. Without data, product decisions are blind. A minimal, privacy-respecting solution (e.g., Plausible, Umami, or even a simple hit counter) provides actionable signal.

### P2 | Effort M | Attribute table view
**Why:** GIS users expect to see tabular data alongside the map. The SQL editor partially serves this need, but a dedicated attribute table (like QGIS or ArcGIS) is a standard expectation. This is the most-requested feature in comparable tools.

### P2 | Effort M | Export map as image / screenshot
**Why:** Users often need to share a static image of their map (for reports, presentations, Slack). This is a high-value, moderate-effort feature that would differentiate from simpler tools like geojson.io.

---

## Product Gaps

1. **No data persistence** — all data is lost when the tab closes. Users cannot save and return to their work.
2. **No sharing mechanism** — no way to share a map view, configuration, or screenshot with others.
3. **No undo/redo** — destructive actions (remove layer, apply filter) cannot be reversed.
4. **No attribute table** — can only see feature properties one-at-a-time via click inspect.
5. **No geocoding/search** — cannot search for addresses or place names on the map.
6. **No measurement tools** — cannot measure distances or areas on the map.
7. **No print/export** — cannot export the map view as an image or PDF.

---

## Recommended Next Features (for v2.2 or v3.0)

### 1. Sample Datasets + Guided Tour (Effort S)
Bundle 2-3 small GeoJSON files. Add "Load sample data" buttons to the welcome screen. Optionally add 3-step tooltips showing key features. **Rationale:** Eliminates cold-start problem for every new visitor. Essential before any public launch.

### 2. Main Canvas Drag-and-Drop (Effort S)
Accept file drops on the full map canvas, not just inside the modal. **Rationale:** This is table-stakes UX. Kepler.gl and geojson.io both support this. Quick win.

### 3. URL State Sharing (Effort M)
Encode view state (center, zoom, basemap) in URL hash. Optionally encode layer config for full map sharing. **Rationale:** Creates shareability — the single biggest driver of organic growth for web tools.

### 4. Map Screenshot Export (Effort M)
Use deck.gl's `Deck.toDataURL()` or html2canvas to export the current map view as PNG. **Rationale:** High-value for professional users who need to include maps in reports.

### 5. Attribute Table Panel (Effort L)
A resizable bottom panel showing tabular data for the selected layer. Support sorting, filtering, and click-to-zoom. **Rationale:** Standard GIS feature. Bridges the gap between the map view and the SQL editor for users who don't know SQL.

---

## Open Questions for Founder

1. **Who is the target first user?** The product is feature-complete enough to launch, but "launch to whom?" is the most important question. GIS professionals? Data scientists? Students? The answer affects which features to prioritize next.

2. **Do you want persistence?** Adding localStorage or IndexedDB save/load would make this a daily-use tool instead of a one-time demo. But it's M-L effort and adds complexity. Is this a priority?

3. **Primary deployment: GitHub Pages or Vercel?** The Vercel config was just added but GitHub Pages is the current primary. Vercel supports headers needed for DuckDB threading. This is also a CTO question but has product implications (custom domain, performance).

4. **Analytics: yes or no?** The privacy-first positioning is a differentiator. Adding even privacy-respecting analytics (Plausible/Umami) is a philosophical choice. But without it, you're flying blind on user behavior.

5. **Version number:** Should the next release be v2.2 (incremental) or v3.0 (if adding persistence/sharing)? And `package.json` needs updating to `2.1.0`.
