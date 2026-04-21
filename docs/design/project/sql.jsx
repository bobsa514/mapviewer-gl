// SQL editor overlay with mock results

const SQL_TEMPLATES = [
  { name: "Preview rows",    q: (t) => `SELECT * FROM ${t}\nLIMIT 10;` },
  { name: "Row count",       q: (t) => `SELECT COUNT(*) AS n FROM ${t};` },
  { name: "Spatial join",    q: (a, b) => `SELECT a.name, b.name AS region\nFROM ${a} a, ${b} b\nWHERE ST_Within(a.geom, b.geom);` },
  { name: "Buffer + intersect", q: (a, b) => `SELECT a.*, b.name AS nearby\nFROM ${a} a, ${b} b\nWHERE ST_Intersects(\n  ST_Buffer(a.geom, 0.25),\n  b.geom\n);` },
];

// Mock result set
const MOCK_RESULT = {
  cols: ["city", "state", "population", "region", "within_ca"],
  rows: [
    ["Los Angeles", "CA", 3979576, "West", true],
    ["San Diego",   "CA", 1423851, "West", true],
    ["San Jose",    "CA", 1021795, "West", true],
    ["San Francisco","CA", 873965, "West", true],
    ["Fresno",      "CA", 542107,  "West", true],
    ["Sacramento",  "CA", 513624,  "West", true],
    ["Long Beach",  "CA", 466742,  "West", true],
    ["Oakland",     "CA", 433031,  "West", true],
    ["Bakersfield", "CA", 383579,  "West", true],
    ["Anaheim",     "CA", 350365,  "West", true],
    ["Santa Ana",   "CA", 332318,  "West", true],
    ["Riverside",   "CA", 328155,  "West", true],
    ["Stockton",    "CA", 310496,  "West", true],
    ["Irvine",      "CA", 287401,  "West", true],
    ["Chula Vista", "CA", 275487,  "West", true],
    ["Fremont",     "CA", 241110,  null,   true],
  ],
  ms: 34,
  hasGeom: true,
};

function sqlHighlight(src) {
  const KW = /\b(SELECT|FROM|WHERE|JOIN|ON|AS|LIMIT|ORDER BY|GROUP BY|HAVING|AND|OR|NOT|COUNT|SUM|AVG|MIN|MAX|WITH|CTE|DISTINCT|BY|DESC|ASC|CASE|WHEN|THEN|ELSE|END|IS|NULL|IN|LIKE)\b/gi;
  const FN = /\b(ST_Within|ST_Intersects|ST_Contains|ST_Buffer|ST_AsGeoJSON|ST_GeomFromGeoJSON|ST_AsText)\b/g;
  const STR = /'[^']*'/g;
  const NUM = /\b\d+(\.\d+)?\b/g;
  const CMT = /--[^\n]*/g;
  // Very lightweight tokenizer — enough for preview. Ordered so longer runs first.
  let html = src
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  html = html
    .replace(CMT, m => `<span style="color:var(--ink-4)">${m}</span>`)
    .replace(STR, m => `<span style="color:oklch(0.55 0.1 140)">${m}</span>`)
    .replace(FN,  m => `<span style="color:var(--accent-ink);font-weight:500">${m}</span>`)
    .replace(KW,  m => `<span style="color:oklch(0.45 0.07 260);font-weight:500">${m}</span>`)
    .replace(NUM, m => `<span style="color:oklch(0.5 0.1 30)">${m}</span>`);
  return html;
}

function SqlEditor({ layers, open, onClose, onAddLayer, pushToast }) {
  const [q, setQ] = React.useState(
    `-- Every layer is a SQL table. Try Cmd/Ctrl + Enter.\nSELECT a.name AS city, b.name AS region, a.population\nFROM cities a, states b\nWHERE ST_Within(a.geom, b.geom)\n  AND b.abbr = 'CA'\nORDER BY a.population DESC\nLIMIT 20;`
  );
  const [result, setResult] = React.useState(null);
  const [running, setRunning] = React.useState(false);
  const taRef = React.useRef(null);

  const run = React.useCallback(() => {
    setRunning(true);
    setResult(null);
    setTimeout(() => {
      setResult(MOCK_RESULT);
      setRunning(false);
    }, 450);
  }, []);

  const onKeyDown = (e) => {
    if ((e.metaKey || e.ctrlKey) && e.key === "Enter") { e.preventDefault(); run(); }
  };

  const insertForTable = (t) => {
    setQ(`SELECT * FROM ${t} LIMIT 10;`);
    setTimeout(() => taRef.current?.focus(), 50);
  };

  const insertTemplate = (tpl) => {
    const first = layers.filter(l => !l.sqlOnly)[0]?.id || "cities";
    const second = layers.filter(l => !l.sqlOnly)[1]?.id || "states";
    setQ(tpl.q(first, second));
  };

  if (!open) return null;

  return (
    <div className="sql-overlay" onClick={e => e.stopPropagation()}>
      <div className="sql-head">
        <div className="sql-head-left">
          <SqlIcon size={16} />
          <h3>SQL <em>workspace</em></h3>
          <span className="chip">DuckDB · spatial</span>
        </div>
        <div className="row" style={{ gap: 6 }}>
          <button className="btn sm ghost"><InfoIcon size={13}/> Help</button>
          <button className="icon-btn" onClick={onClose}><CloseIcon size={14}/></button>
        </div>
      </div>

      <div className="sql-body">
        <div className="sql-tables">
          <div className="sql-tables-title">Tables in scope</div>
          {layers.map(l => (
            <div key={l.id} className="sql-table-row" onClick={() => insertForTable(l.id)}>
              <span className="dot" style={{ background: l.sqlOnly ? "var(--ink-4)" : l.color }}/>
              <span>{l.id}</span>
              <span className="cols">{l.cols?.length}c</span>
            </div>
          ))}
          <div className="sql-tables-title" style={{ marginTop: 16 }}>Templates</div>
          {SQL_TEMPLATES.map((t, i) => (
            <div key={i} className="sql-table-row" onClick={() => insertTemplate(t)}>
              <SparkIcon size={11}/>
              <span>{t.name}</span>
            </div>
          ))}
        </div>

        <div className="sql-main">
          <textarea ref={taRef} className="sql-editor"
            value={q} onChange={e => setQ(e.target.value)} onKeyDown={onKeyDown}
            spellCheck={false}/>
          <div className="sql-toolbar">
            <div className="sql-templates">
              {SQL_TEMPLATES.slice(0,3).map((t, i) => (
                <button key={i} className="sql-tpl" onClick={() => insertTemplate(t)}>{t.name}</button>
              ))}
            </div>
            <div className="sql-run">
              <span className="muted"><kbd style={{ fontFamily: "var(--font-mono)", background: "var(--bg-raised)", border: "1px solid var(--line)", padding: "1px 5px", borderRadius: 3, fontSize: 10.5 }}>⌘↵</kbd> to run</span>
              <button className="btn sm accent" onClick={run} disabled={running}>
                <PlayIcon size={10}/> {running ? "Running…" : "Run query"}
              </button>
            </div>
          </div>

          <div className="sql-results">
            {!result && !running && (
              <div style={{ padding: "32px 20px", color: "var(--ink-3)", textAlign: "center", fontSize: 12 }}>
                <div style={{ fontFamily: "var(--font-display)", fontSize: 22, color: "var(--ink-2)", fontStyle: "italic", marginBottom: 6 }}>
                  No results yet
                </div>
                Press <kbd className="mono" style={{ background: "var(--bg-raised)", border: "1px solid var(--line)", padding: "1px 5px", borderRadius: 3 }}>⌘↵</kbd> to execute the query above.
              </div>
            )}
            {running && (
              <div style={{ padding: 32, textAlign: "center", color: "var(--ink-3)", fontSize: 12 }}>Executing…</div>
            )}
            {result && (
              <table>
                <thead>
                  <tr>{result.cols.map(c => <th key={c}>{c}</th>)}</tr>
                </thead>
                <tbody>
                  {result.rows.map((r, i) => (
                    <tr key={i}>
                      {r.map((v, j) => (
                        <td key={j} className={v === null ? "null" : typeof v === "number" ? "num" : ""}>
                          {v === null ? "null" : typeof v === "boolean" ? String(v) : typeof v === "number" ? v.toLocaleString() : v}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          {result && (
            <div className="sql-meta">
              <span className="stat"><span className="muted">rows</span> {result.rows.length}</span>
              <span className="stat"><span className="muted">time</span> {result.ms}ms</span>
              {result.hasGeom && <span className="chip accent"><span className="badge-dot"/> geometry column detected</span>}
              <span className="space"/>
              <button className="btn sm" onClick={() => { pushToast("Results exported as CSV"); }}><DownloadIcon size={12}/> Export CSV</button>
              {result.hasGeom && (
                <button className="btn sm accent" onClick={() => { onAddLayer(result); pushToast("Added query result as layer"); }}>
                  <PlusIcon size={12}/> Add as map layer
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

Object.assign(window, { SqlEditor, sqlHighlight });
