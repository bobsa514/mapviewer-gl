# MapViewer-GL — Functional & UX Specification

**Purpose of this document:** A feature-and-behavior brief for the UI/UX designer building an interactive prototype. It describes **what the product does** and **what the user is trying to accomplish** — *not* how the current UI looks, where controls sit, or what styling is applied. Treat all current visual decisions as disposable. The prototype should re-imagine layout, affordances, and flow from scratch.

---

## 1. Product in One Sentence

A **100% client-side geospatial workspace** where a user can load data files, style them on an interactive map, filter and inspect them, run spatial SQL queries across them, and share the resulting view — all without a server or an account.

## 2. Who Uses This

| Persona | What they bring | What they want |
|---|---|---|
| **Data analyst** exploring unfamiliar geospatial data | A CSV or Parquet file they just received | Visual check: "what does this look like on a map? are the coordinates right? what's the distribution?" |
| **Urban planner / researcher** doing a lightweight spatial analysis | One or more shapefiles / GeoJSONs of a study area | Overlay data sources, filter to a subset, join layers, produce a view they can share |
| **Engineer / GIS professional** prototyping a SQL spatial query | Parquet / GeoParquet files, possibly without a live database | Sandbox to test spatial SQL (ST_Within, ST_Intersects, ST_Buffer) and see results geographically |
| **Student / educator** learning geospatial concepts | Sample or downloaded data | A zero-setup way to see color scales, classifications, spatial joins in action |
| **Privacy-conscious user** with sensitive data | A file they cannot upload to a cloud service | Visualization that guarantees the data never leaves their machine |

The **unifying trait**: user wants map + data + query power *without* installing QGIS, setting up a Postgres/PostGIS database, or uploading to Kepler/Felt/Mapbox.

## 3. Guiding Principles (for the designer)

- **Zero-install, zero-signup, zero-server.** The product must feel instantly usable. First-time experience matters more than power-user efficiency.
- **Data is the hero.** The map view is the primary surface; every other control should be retractable, dismissable, or out of the way when the user is reading the map.
- **Progressive disclosure.** A novice should never see SQL. An expert should be able to reach it in one action.
- **Every layer is queryable.** The mental model is: *"anything I add to the map can also be queried with SQL; anything I compute in SQL can be added to the map."* Make this round-trip obvious.
- **Nothing is destructive without confirmation.** Removing a layer, overwriting a session, discarding filters — all should be undoable or confirmable.

---

## 4. Core User Stories

Grouped by user intent, not by screen.

### 4.1 Loading data
- As a user, I want to **upload a file** (GeoJSON, CSV, Shapefile ZIP, Parquet/GeoParquet) and see it appear on the map immediately.
- As a user, I want to **drag a file from my desktop onto the app anywhere** and have it loaded — I should not have to find a specific drop zone.
- As a user, I want to **load multiple files in one session** and have them appear as separate layers I can toggle.
- As a user, I want the app to **auto-detect coordinate columns** in my CSV so I don't have to configure anything if the column names are standard (`lat`, `lng`, `latitude`, `longitude`, etc.).
- As a user with an **H3-indexed CSV**, I want the app to detect the hex column and render hexagons without me configuring anything.
- As a user with a **CSV that has no coordinates** (a reference table, a lookup), I want to load it anyway and use it in a SQL JOIN against a layer that does have coordinates.
- As a first-time visitor, I want to **try the product with sample data in one click** before committing to uploading my own.
- As a user with slow-to-parse data, I want to see **a progress indicator** so I know the app isn't frozen.
- As a user who uploaded the wrong file or a malformed file, I want a **clear error message** (not a crash or a silent failure).

### 4.2 Controlling what I load
- As a user previewing a CSV, I want to **see the first ~10 rows and a list of columns**, and pick which columns to import (e.g., drop 20 irrelevant columns to reduce memory).
- As a user previewing a GeoJSON/Shapefile, I want to **see a sample of features and their properties**, and pick which properties to keep.
- As a user loading coordinate data, I want to **see which columns the app auto-detected as latitude/longitude** and not be able to accidentally deselect them.

### 4.3 Managing layers
- As a user, I want to see a **list of all loaded layers** with clear names.
- As a user, I want to **show / hide** a layer without removing it.
- As a user, I want to **rename a layer** (because the file name is rarely the right label).
- As a user, I want to **reorder layers** — what renders on top, what renders underneath.
- As a user, I want to **remove a layer** and have the app confirm before destroying my work.
- As a user, I want to know which layers are **map layers** and which are **SQL-only tables** (loaded but invisible on the map, available for JOINs).

### 4.4 Styling (symbology)
- As a user, I want to **pick a single color** for a layer as a starting point.
- As a user, I want to **color a layer by a numeric column** (e.g., "color these tracts by population") using a classified color scale.
- As a user, I want to **choose between sequential color palettes** (single-hue and multi-hue, e.g., Reds, Blues, YlOrRd) similar to ColorBrewer.
- As a user, I want to **control the number of classes** in the classification (3–10).
- As a user with point data, I want to **size points by a numeric column** (e.g., "size by population") with a minimum and maximum pixel size.
- As a user, I want to **adjust opacity and a fixed point size** with simple controls.
- As a user, I want **changes to take effect live** on the map without a separate "apply" step.

### 4.5 Filtering
- As a user, I want to **filter a layer by a column** — keep only features matching a condition.
- As a user, I want to filter **numeric columns** with a range (min–max) or a comparison (=, <, ≤, >, ≥).
- As a user, I want to filter **text columns** by selecting one or more values from a suggested list (autocomplete), or by comparison against a typed value.
- As a user, I want to **stack multiple filters on one layer** (AND semantics).
- As a user, I want to **see at a glance** how many filters are active on each layer.
- As a user, I want to **remove a single filter** without clearing them all.

### 4.6 Inspecting individual features
- As a user, I want to **hover a feature on the map** and see its attributes in a peek panel.
- As a user, I want to **click a feature to pin** the inspection panel so I can read it without the map chasing my cursor.
- As a user with features that have 30+ properties, I want to **choose which attributes to display** in the inspection panel (so it's readable).

### 4.7 Querying data with SQL
- As a user, I want to **open a SQL editor** where every layer I've loaded is available as a table.
- As a user, I want the SQL engine to **support spatial functions** — at minimum `ST_Within`, `ST_Intersects`, `ST_Buffer`, `ST_AsGeoJSON`, `ST_GeomFromGeoJSON`, plus general SQL (joins, filters, aggregations, CTEs).
- As a user, I want the editor to show me **which tables are available** and let me insert a sample query in one click.
- As a user, I want **example query templates** — preview rows, count rows, spatial join (points-in-polygons), buffer + intersect.
- As a user, I want a **keyboard shortcut** to run the query (Cmd/Ctrl+Enter) without reaching for a button.
- As a user, I want to see the **result as a table** below/next to my query.
- As a user, I want to see **how long the query took and how many rows returned**.
- As a user, if my query returns a **geometry column**, I want to **add the result back to the map as a new layer** in one click.
- As a user, I want to **export query results as CSV** to use elsewhere.
- As a user, I want to see **clear, readable error messages** when my SQL fails (syntax, unknown table, type error).

### 4.8 Navigating and orienting
- As a user, I want to **pan and zoom** the map with standard gestures (drag, scroll, pinch).
- As a user, I want to **switch basemaps** — at minimum a light, a dark, and a plain OpenStreetMap style.
- As a user, I want **legends** for any layer with a classified color or size mapping — otherwise I can't interpret what I'm seeing.
- As a user adding a new layer, I want the map to **auto-zoom to the layer's extent** so I don't have to hunt for my data.

### 4.9 Saving and sharing
- As a user, I want to **export my full session** (all layers, styling, filters, view state, basemap) as a single file I can re-load later.
- As a user, I want to **import a previously exported session** and pick up where I left off.
- As a user importing a session when I already have data loaded, I want the app to **warn me** before it overwrites my work.
- As a user, I want to **copy the URL** and share it with a colleague such that when they open it, the map opens at the **same view (pan/zoom position)** I was looking at.
- As a user, I want all of this to work **without an account or a cloud service**.

### 4.10 Recovering from errors
- As a user, if the app crashes, I want a **clear recovery path** (reload, or a message explaining what happened) — not a blank screen.
- As a user, if my file is malformed, I want a **specific error** ("no coordinates detected", "invalid H3 index", "not a valid GeoJSON") — not "something went wrong".

---

## 5. Analytical Tools — Detailed Content

This section describes each capability's **inputs, behavior, and outputs**. The designer should decide *how* these are surfaced; the content itself is fixed.

### 5.1 Data Ingestion

**Supported formats:**

| Format | Extensions | Becomes a map layer? | Becomes a SQL table? | Notes |
|---|---|---|---|---|
| GeoJSON | `.geojson`, `.json` | Yes | Yes | All geometry types (Point, LineString, Polygon, Multi*) |
| CSV with lat/lng columns | `.csv` | Yes (points) | Yes | Auto-detects column names; user can override |
| CSV with H3 hex column | `.csv` | Yes (hexagons) | Yes | Auto-detects H3 column if present |
| CSV without geometry | `.csv` | **No** | Yes | Becomes a "SQL-only" reference table for JOINs |
| Shapefile | `.zip` (containing `.shp` + `.dbf` + `.prj`) | Yes | Yes | Extracted in-browser |
| GeoParquet | `.parquet` | Yes | Yes | Geometry auto-detected from WKB/BLOB columns |
| Parquet (no geometry) | `.parquet` | No | Yes | Becomes a SQL-only table |
| Session configuration | `.json` (specific schema) | Replaces current session | — | See §5.9 |

**Ingestion flow has three phases:**
1. **Receive file** (via file picker OR drag-and-drop onto the app anywhere)
2. **Preview & configure** (optional — for CSV and GeoJSON/Shapefile, user selects which columns/properties to keep; for coordinate-based CSV, user confirms or overrides lat/lng detection)
3. **Load** (progress indicator shown for large files; on completion, layer appears in the layer list and map auto-zooms to its extent)

**Auto-detection rules the designer should be aware of:**
- Lat column candidates: `lat`, `latitude`, `y` (case-insensitive)
- Lng column candidates: `lng`, `lon`, `long`, `longitude`, `x` (case-insensitive)
- H3 column: a column named something like `h3`, `hex`, `h3_index` whose first value is a valid H3 index string
- Geometry column in Parquet: inspected via metadata / type (WKB)

### 5.2 Layer Management

Each layer has these metadata and controls:

| Property | Description |
|---|---|
| Name | Editable label (defaults to file name) |
| Visibility | Show/hide on the map without removing |
| Source type | GeoJSON / CSV / Shapefile / GeoParquet — user should be able to see this |
| Geometry type | Point / Polygon-or-line / Hexagon (H3) — affects which style options apply |
| Color (single) | Base color, used when no color mapping is active |
| Opacity | 0–100% |
| Point size (fixed) | For point layers: pixel radius when no size mapping is active |
| Color mapping | Optional: classified color by numeric column (see §5.3) |
| Size mapping | Optional, points only: classified size by numeric column (see §5.3) |
| Filters | Optional: one or more active filters (see §5.4) |
| Order | Position in the layer stack (top = renders last = on top of other layers) |
| Active filter count | Surface this somewhere — users need to know when data is filtered |

**Destructive actions require confirmation:**
- Removing a layer
- Importing a configuration while layers are present

**SQL-only tables** are a distinct concept from map layers. They have no color, geometry type, or visual representation, but they appear in the SQL editor's table list. The UI should clearly distinguish them.

### 5.3 Symbology (Visual Encoding)

**Classified color mapping** (any geometry type):
- User picks: a numeric column, a color scale, and a number of classes (3–10)
- System computes: quantile breaks across the data, skipping null/empty values
- Available color scales (ColorBrewer-inspired sequential palettes):
  - **Single-hue**: Reds, Blues, Greens, Greys
  - **Multi-hue**: YlGnBu, YlOrRd, PuBuGn, RdPu
- Clearing the color mapping returns the layer to its single base color

**Classified size mapping** (point layers only):
- User picks: a numeric column, a number of classes (3–10), a min pixel size, a max pixel size
- System computes: quantile breaks, maps each class to a size between min and max
- Disabling: returns points to the fixed point size

### 5.4 Filtering

Filters are per-layer and stack with AND semantics.

**Filter types:**

| Column type | Operators available | Input |
|---|---|---|
| Numeric | `range` (min–max, default) | Two values, inclusive |
| Numeric | `=`, `<`, `<=`, `>`, `>=` | One numeric value |
| Text | `=` with multi-select | Pick one or more values from autocomplete suggestions (OR semantics within one filter) |
| Text | `=`, `<`, `<=`, `>`, `>=` (single value) | One text value, compared literally |

**Behavior:**
- A column's type (numeric vs. text) is auto-inferred (≥50% of non-null values are numeric → numeric)
- Adding a filter **does not** remove the underlying data — just hides rows on the map
- Filters **propagate to classification breaks**: if a user filters then applies color-by-column, breaks are computed on the filtered data
- Filters are preserved in exported configurations (§5.9)

### 5.5 Feature Inspection

**Hover behavior:**
- Hovering a feature surfaces its attributes in a panel
- The panel updates live as the cursor moves
- Hovering off the map clears the panel

**Click behavior:**
- Clicking a feature "pins" the panel — it no longer follows the cursor
- Clicking the same feature again un-pins
- Clicking elsewhere on the map clears the pinned selection

**Attribute selection:**
- User can toggle which attributes appear in the panel (useful for features with many properties)
- Default: first 5 attributes

### 5.6 SQL Query Engine

**Runtime:** DuckDB running in-browser (WebAssembly) with the spatial extension loaded.

**Available on launch:**
- Every loaded layer, exposed as a SQL table (table name derived from file name, sanitized)
- Every SQL-only table (CSVs/Parquets without geometry)
- The standard DuckDB function library
- Spatial functions including at minimum: `ST_Within`, `ST_Intersects`, `ST_Contains`, `ST_Buffer`, `ST_AsGeoJSON`, `ST_GeomFromGeoJSON`, `ST_AsText`

**Inputs:**
- Free-form SQL text
- Keyboard shortcut to execute: Cmd/Ctrl + Enter

**Outputs:**
- Columnar result set rendered as a table (with pagination or virtual scrolling for large results — at least 1000 rows visible)
- Row count and execution time
- If result contains a geometry column → an action to **"Add as a new map layer"**
- An action to **export results as CSV**
- Syntax/runtime errors rendered inline with the query

**Example query templates** the UI should surface (minimum set):
- Preview: `SELECT * FROM {table} LIMIT 10`
- Count: `SELECT COUNT(*) FROM {table}`
- Join two layers: `SELECT a.*, b.* FROM {A} a JOIN {B} b ON a.geom = b.geom`
- Spatial join (points in polygons): `SELECT a.*, b.* FROM {A} a, {B} b WHERE ST_Within(a.geom, b.geom)`
- Buffer + intersect: `SELECT ... WHERE ST_Intersects(ST_Buffer(a.geom, 0.01), b.geom)`

**Help content** the designer should plan to surface somewhere accessible:
- Explanation that each layer is a SQL table
- The rule for deriving table names from file names
- The Cmd/Ctrl+Enter shortcut
- Example queries (above)
- A list of the user's current tables, with a one-click "insert query" action

### 5.7 Legends

Shown automatically whenever a visible layer has an active color or size mapping.
- **Color legend:** vertical color ramp with numeric break labels and the column name
- **Size legend:** graduated circle sizes with numeric break labels and the column name
- Multiple legends stack when multiple layers have active mappings
- Legends hide automatically when mappings are cleared or the layer is hidden

### 5.8 Map Navigation & Basemap

**Map controls:** pan, zoom, scroll-wheel zoom, pinch-zoom, standard map gestures.

**Basemaps** (built-in, free, no API key):
- Light (default)
- Dark
- Plain OpenStreetMap

**Auto-zoom:** when a new layer is added, the map recenters and zooms to fit its bounding box.

### 5.9 Session Persistence

**Configuration export** — one-click download of a JSON file containing:
- Map view state (center, zoom)
- Selected basemap
- For every layer: name, geometry type, visibility, color, opacity, point size, coordinate column mapping (if CSV), raw data, active filters, selected properties, color mapping, size mapping

**Configuration import** — user picks a previously exported JSON file:
- If no layers are loaded: applied immediately
- If layers are loaded: confirm overwrite before applying

**URL sharing** — the map view state (lat, lng, zoom) is continuously encoded in the URL hash (e.g., `#lat=37.77&lng=-122.42&zoom=12`). Opening a shared URL restores that view.

**Important scope note:** URL sharing encodes *view position only* — it does NOT encode layers or data. Shared recipients still need the configuration file (or must upload their own data) to reproduce a full session.

### 5.10 Sample Data

First-time visitors should be able to load built-in sample datasets in one click without uploading anything. Current samples: US major cities (points) and US states (polygons). The designer should treat this as a required "first experience" affordance but is free to rework the sample library.

---

## 6. Screens / Views

These are the **distinct functional states** the prototype needs. Each is described by what the user sees and what actions are available, *not* by where things sit on the screen.

### 6.1 Empty / Welcome State
**When:** App loads for the first time, or all layers have been removed.
**Content:**
- Product name and one-line value proposition
- A clear "Add Data" call-to-action
- A "Try with sample data" affordance (at least two datasets: points + polygons)
- A statement that data stays in the browser (privacy promise)
**Actions:** open the data import flow; load a sample dataset.

### 6.2 Main Workspace
**When:** At least one layer is loaded.
**Content & actions:**
- Interactive map (primary surface)
- Add-more-data action (always accessible)
- Access to the layer list
- Access to the SQL editor
- Access to the basemap selector
- Access to configuration export
- Feature inspection panel (appears on hover/click)
- Legends (appear automatically for classified layers)

### 6.3 Data Import Flow
**When:** User initiated an "add data" action.
**Content:**
- Selection of format (GeoJSON, CSV, Shapefile, Parquet, or "import a saved configuration")
- A drop zone / file picker for the selected format
- A one-line explanation of what that format does (e.g., "Upload a zipped shapefile containing .shp/.dbf/.prj")
- For the configuration tab: also an **export current configuration** action

### 6.4 CSV Preview & Column Selection
**When:** User uploaded a CSV.
**Content:**
- A label indicating whether this CSV will become a map layer (coordinates detected) or a SQL-only table (no coordinates detected)
- Sample rows (~10)
- All columns with checkboxes to include/exclude
- Detected coordinate columns are visually flagged and cannot be deselected when in map-layer mode
- "Select all" / "Deselect all" actions
- A count of selected vs. total columns
- Proceed button (disabled if zero columns selected) / Cancel

### 6.5 GeoJSON (or Shapefile) Property Selection
**When:** User uploaded a GeoJSON file or a shapefile.
**Content:**
- Every property found across features, with a row showing values for the first ~5 features
- Checkbox per property to include/exclude
- "Select all" / "Deselect all" actions
- Proceed / Cancel

### 6.6 Layers Panel
**When:** User has opened the layer list.
**Per-layer content:**
- Visibility toggle
- Editable name
- Indicator: is this a map layer or a SQL-only table? What was the source format?
- Reorder affordance
- Entry points to: styling/symbology, filtering, removal
- Count badge: active filters

### 6.7 Symbology / Styling Panel (per layer)
**When:** User expanded a layer's styling.
**Content:**
- Base color picker
- Opacity control (0–100%)
- For point layers: fixed point size control
- "Color based on" selector (choose a numeric column; off by default)
  - When active: color scale picker (from the 8 palettes), class count (3–10)
- For point layers: "Size based on" selector
  - When active: class count, min/max pixel size

### 6.8 Filter Builder (per layer)
**When:** User opened a layer's filter.
**Content:**
- List of currently active filters on this layer, each removable
- Column selector (dropdown of all columns in this layer)
- For numeric columns: operator selector (range or comparison) + value input(s); range mode shows min–max of the column as defaults
- For text columns: operator selector; when `=` selected, offer autocomplete multi-select from the column's unique values (with a search-to-filter input); other operators take a single value
- Apply / Cancel

### 6.9 Feature Inspection Panel
**When:** User hovers or clicks a feature.
**Content:**
- Current feature's attributes (only those the user has chosen to display)
- Indicator: whether the panel is "pinned" (click-to-inspect) or "live" (hover-to-inspect)
- Affordance to **choose which attributes to display** (checklist of all available attributes on this feature)
- Close action

### 6.10 SQL Editor Workspace
**When:** User opened the SQL editor.
**Content:**
- SQL text input area
- Run action + Cmd/Ctrl+Enter shortcut
- List of currently available tables (both map-layer tables and SQL-only tables), with each clickable to insert a starter query
- Visual distinction between map-layer tables and SQL-only tables
- Help/examples panel (on demand), with:
  - Explanation of the table model
  - Keyboard shortcuts
  - Example queries (preview, count, join, spatial join, buffer+intersect)
- Results area:
  - When empty: a hint about what to do next
  - When populated: columns + rows, with NULL rendered distinctly, row count + execution time
  - When geometry column detected: "Add result as map layer" action
  - Always (when results exist): "Export CSV" action
- A way to close the editor without losing the query (editor is a transient panel, not a full-screen mode)
- Loading indicator on first open (DuckDB initialization takes ~1–2s)

### 6.11 Basemap Selector
**When:** User wants to change the map background.
**Content:** list of available basemaps with the current one indicated; one-click to switch.

### 6.12 Legends Display
**When:** At least one visible layer has an active color or size mapping.
**Content:** A readable legend per active mapping, showing the column name, the scale/ramp, and numeric break labels. Legends should never fight the map or other panels for space — treat them as reference overlays.

### 6.13 Destructive-Action Confirmation
**When:** User is about to do something that can't be undone (remove a layer, import a config that would replace the current session).
**Content:** explicit statement of what is about to happen and what will be lost, a confirm action, a cancel action. Cancel should be the visually safer option.

### 6.14 Error / Crash Recovery
**When:** An unrecoverable render error occurs.
**Content:** acknowledgment that something went wrong, a reload action. This should never be a blank white screen.

### 6.15 Transient Feedback
- **Progress indicator** — shown for any file processing operation that takes more than ~500ms. Should show percentage when computable.
- **Toast notifications** — for errors, warnings, and informational messages (e.g., "No valid geometries in file, registered as SQL-only table"). Auto-dismiss. Multiple toasts stack.

---

## 7. Edge Cases & Error States the Prototype Should Address

| Situation | Required behavior |
|---|---|
| User drops an unsupported file type | Clear error message naming the extension, list supported formats |
| CSV has no detectable coordinates and no H3 column | Offer to register as SQL-only table |
| GeoParquet file has a geometry column but no valid geometries | Fall back to SQL-only table, warn the user |
| User tries to delete a layer | Confirm first |
| User tries to import a config while layers exist | Confirm first (overwrite warning) |
| User loads many files with name collisions | Auto-disambiguate table names (e.g., suffix counter) and surface this somewhere subtle |
| User runs a SQL query with a syntax error | Inline error next to the query |
| User runs a SQL query with no FROM clause | Same |
| User runs a SELECT that returns zero rows | Show the result table with columns but no rows, not a misleading "error" state |
| DuckDB is still loading when user opens the editor | Clear loading state; inputs disabled until ready |
| Very large file (100k+ rows) being parsed | Progress indicator, non-blocking UI |
| User pastes a URL with a malformed hash | Silently fall back to the default view |
| User's browser tab crashes / is closed | No persistence is expected; but there should be no data leak or half-loaded corrupted session |

---

## 8. Explicitly Out of Scope

The prototype should **not** include these (unless the designer + owner explicitly decide to expand scope):

- User accounts, sign-in, saved sessions on a server
- Cloud storage of uploaded data
- Real-time collaboration
- Drawing / editing geometry by hand
- Time-series / temporal animation
- 3D / extrusion / tilted view
- Printing or high-resolution map export as PNG/PDF (query results CSV export is in scope; rendered-map export is not)
- Routing / directions
- Geocoding (converting an address to a point)
- Commercial basemaps (Mapbox, Google, etc.)

---

## 9. Data Privacy Promise (surface in the welcome state)

All file parsing, SQL execution, and rendering happens **in the browser**. No file content is transmitted to any server. Closing the tab discards everything. This is a load-bearing product claim and should be reassured visibly somewhere the first-time user will see it.

---

## 10. Success Criteria for the Prototype

The prototype is done when a reviewer can click through these flows without the designer narrating:

1. **First-time flow.** Land on empty state → click "sample US cities" → see points on a map → click one → see its attributes.
2. **Upload flow.** Drag a CSV onto the app → see column preview → proceed → see points, auto-zoomed.
3. **Styling flow.** Open layer → enable "color by population" → pick a color scale → see map update and legend appear.
4. **Filter flow.** Open a layer filter → pick "state = CA" → see only California features on the map, with filter badge visible on the layer.
5. **SQL flow.** Open the SQL editor → insert the "spatial join" example → run → see results → click "add as layer" → see the joined result as a new layer on the map.
6. **Share flow.** Pan the map → copy the URL → open in a new tab → land on the same view.
7. **Export flow.** Click export config → open the exported JSON → re-import it → see the session restored.

If a reviewer can't complete one of these with intuitive self-service clicks, the prototype needs another iteration before engineering.
