import { describe, it, expect } from 'vitest';
import type { FilterInfo, LayerInfo } from '../../types';
import { extractDataItems, buildColumns, buildFilterFn } from '../../components/FilterPanel';
import type { ColumnMeta } from '../../components/FilterPanel';

// ── Helpers ──────────────────────────────────────────────────────────

const makeGeoJSONLayer = (features: any[]): LayerInfo => ({
  id: 1,
  name: 'test',
  type: 'geojson',
  data: { type: 'FeatureCollection', features },
  visible: true,
  color: '#ff0000',
  opacity: 0.7,
});

const makePointLayer = (data: any[]): LayerInfo => ({
  id: 2,
  name: 'points',
  type: 'point',
  data,
  visible: true,
  color: '#ff0000',
  opacity: 0.7,
  columns: { lat: 'lat', lng: 'lng' },
  pointSize: 5,
});

const makeH3Layer = (data: any[]): LayerInfo => ({
  id: 3,
  name: 'hexes',
  type: 'h3',
  data,
  visible: true,
  color: '#ff0000',
  opacity: 0.7,
});

// ── extractDataItems ─────────────────────────────────────────────────

describe('extractDataItems', () => {
  it('returns features for geojson layers', () => {
    const layer = makeGeoJSONLayer([
      { type: 'Feature', geometry: null, properties: { a: 1 } },
    ]);
    expect(extractDataItems(layer)).toHaveLength(1);
    expect(extractDataItems(layer)[0].properties.a).toBe(1);
  });

  it('returns empty array for geojson with no features', () => {
    const layer = makeGeoJSONLayer([]);
    expect(extractDataItems(layer)).toEqual([]);
  });

  it('returns data as-is for point layers', () => {
    const layer = makePointLayer([
      { position: [0, 0], properties: { name: 'A' } },
    ]);
    expect(extractDataItems(layer)[0].position).toEqual([0, 0]);
    expect(extractDataItems(layer)[0].properties.name).toBe('A');
  });

  it('wraps H3 data with properties sub-key', () => {
    const layer = makeH3Layer([
      { hex: '811fbffffffffff', properties: { pop: 1000 } },
    ]);
    const items = extractDataItems(layer);
    expect(items[0].properties).toBeDefined();
    expect(items[0].properties.pop).toBe(1000);
  });
});

// ── buildColumns ─────────────────────────────────────────────────────

describe('buildColumns', () => {
  it('returns empty for empty items', () => {
    expect(buildColumns([])).toEqual([]);
  });

  it('detects numeric column', () => {
    const items = [{ properties: { pop: 100 } }, { properties: { pop: 200 } }];
    const cols = buildColumns(items);
    expect(cols.find((c) => c.name === 'pop')?.type).toBe('numeric');
  });

  it('detects text column', () => {
    const items = [
      { properties: { name: 'Chicago' } },
      { properties: { name: 'New York' } },
    ];
    const cols = buildColumns(items);
    expect(cols.find((c) => c.name === 'name')?.type).toBe('text');
  });

  it('includes unique values for text columns', () => {
    const items = [
      { properties: { state: 'CA' } },
      { properties: { state: 'NY' } },
      { properties: { state: 'CA' } },
    ];
    const col = buildColumns(items).find((c) => c.name === 'state')!;
    expect(col.type).toBe('text');
    expect(col.uniqueValues).toEqual(['CA', 'NY']);
  });

  it('stores min and max for numeric columns', () => {
    const items = [
      { properties: { val: 10 } },
      { properties: { val: 20 } },
      { properties: { val: 5 } },
    ];
    const col = buildColumns(items).find((c) => c.name === 'val')!;
    expect(col.type).toBe('numeric');
    expect(col.min).toBe(5);
    expect(col.max).toBe(20);
  });

  it('handles null/empty values without error', () => {
    const items = [
      { properties: { name: 'A', pop: null } },
      { properties: { name: 'B', pop: 200 } },
    ];
    const cols = buildColumns(items);
    const popCol = cols.find((c) => c.name === 'pop')!;
    expect(popCol.min).toBe(200);
    expect(popCol.max).toBe(200);
  });

  it('handles items without properties (raw objects)', () => {
    const items = [{ name: 'A' }, { name: 'B' }];
    const cols = buildColumns(items);
    expect(cols.find((c) => c.name === 'name')?.type).toBe('text');
  });

  it('handles string-numeric values as numeric if ≥50%', () => {
    const items = [
      { properties: { val: '10' } },
      { properties: { val: '20' } },
      { properties: { val: 'x' } },
      { properties: { val: '30' } },
    ];
    const col = buildColumns(items).find((c) => c.name === 'val')!;
    // 3/4 are numeric → isNumeric
    expect(col.type).toBe('numeric');
  });

  it('filters out "position" key', () => {
    const items = [
      { position: [0, 0], properties: { name: 'A' } },
    ];
    const cols = buildColumns(items);
    expect(cols.find((c) => c.name === 'position')).toBeUndefined();
  });
});

// ── buildFilterFn ────────────────────────────────────────────────────

describe('buildFilterFn — numeric range', () => {
  const col: ColumnMeta = { name: 'pop', type: 'numeric' };
  const info: FilterInfo = {
    column: 'pop',
    type: 'numeric',
    value: { type: 'range', min: 100, max: 500 },
  };
  const fn = buildFilterFn(col, info);

  it('includes value within range', () => {
    expect(fn({ properties: { pop: 300 } })).toBe(true);
    expect(fn({ properties: { pop: 100 } })).toBe(true);
    expect(fn({ properties: { pop: 500 } })).toBe(true);
  });

  it('excludes value outside range', () => {
    expect(fn({ properties: { pop: 50 } })).toBe(false);
    expect(fn({ properties: { pop: 600 } })).toBe(false);
  });

  it('excludes null/undefined', () => {
    expect(fn({ properties: { pop: null } })).toBe(false);
    expect(fn({ properties: {} })).toBe(false);
  });

  it('handles string values', () => {
    expect(fn({ properties: { pop: '300' } })).toBe(true);
  });

  it('uses ?? fallback for items without .properties', () => {
    expect(fn({ pop: 300 })).toBe(true);
  });
});

describe('buildFilterFn — numeric comparison', () => {
  const col: ColumnMeta = { name: 'val', type: 'numeric' };

  it('= works', () => {
    const fn = buildFilterFn(col, { column: 'val', type: 'numeric', value: { type: 'comparison', operator: '=', value: 42 } });
    expect(fn({ properties: { val: 42 } })).toBe(true);
    expect(fn({ properties: { val: 43 } })).toBe(false);
    expect(fn({ properties: { val: '42' } })).toBe(true);
  });

  it('< works', () => {
    const fn = buildFilterFn(col, { column: 'val', type: 'numeric', value: { type: 'comparison', operator: '<', value: 100 } });
    expect(fn({ properties: { val: 99 } })).toBe(true);
    expect(fn({ properties: { val: 100 } })).toBe(false);
  });

  it('<= works', () => {
    const fn = buildFilterFn(col, { column: 'val', type: 'numeric', value: { type: 'comparison', operator: '<=', value: 100 } });
    expect(fn({ properties: { val: 100 } })).toBe(true);
  });

  it('> works', () => {
    const fn = buildFilterFn(col, { column: 'val', type: 'numeric', value: { type: 'comparison', operator: '>', value: 100 } });
    expect(fn({ properties: { val: 101 } })).toBe(true);
    expect(fn({ properties: { val: 100 } })).toBe(false);
  });

  it('>= works', () => {
    const fn = buildFilterFn(col, { column: 'val', type: 'numeric', value: { type: 'comparison', operator: '>=', value: 100 } });
    expect(fn({ properties: { val: 100 } })).toBe(true);
  });
});

describe('buildFilterFn — text exact multi-select (autocomplete =)', () => {
  const col: ColumnMeta = { name: 'state', type: 'text', uniqueValues: ['CA', 'NY', 'TX'] };
  const info: FilterInfo = {
    column: 'state',
    type: 'text',
    value: { type: 'multiple', values: ['CA', 'NY'], match: 'exact' },
  };
  const fn = buildFilterFn(col, info);

  it('matches selected value (case-insensitive)', () => {
    expect(fn({ properties: { state: 'CA' } })).toBe(true);
    expect(fn({ properties: { state: 'ca' } })).toBe(true);
  });

  it('does not match unselected value', () => {
    expect(fn({ properties: { state: 'TX' } })).toBe(false);
  });

  it('does substring matching only for contains (not exact)', () => {
    // "California" should NOT match "CA" in exact mode
    const caliCol: ColumnMeta = { name: 'state', type: 'text' };
    const exactInfo: FilterInfo = { column: 'state', type: 'text', value: { type: 'multiple', values: ['CA'], match: 'exact' } };
    const fnExact = buildFilterFn(caliCol, exactInfo);
    expect(fnExact({ properties: { state: 'California' } })).toBe(false);
  });
});

describe('buildFilterFn — text contains (substring, legacy)', () => {
  const col: ColumnMeta = { name: 'name', type: 'text' };

  it('case-insensitive substring match', () => {
    const info: FilterInfo = { column: 'name', type: 'text', value: { type: 'multiple', values: ['chicago'] } };
    const fn = buildFilterFn(col, info);
    expect(fn({ properties: { name: 'Chicago' } })).toBe(true);
    expect(fn({ properties: { name: 'CHICAGO' } })).toBe(true);
  });

  it('does not match missing value', () => {
    const info: FilterInfo = { column: 'name', type: 'text', value: { type: 'multiple', values: ['chicago'] } };
    const fn = buildFilterFn(col, info);
    expect(fn({ properties: { name: 'Boston' } })).toBe(false);
  });

  it('backward-compat: no match field = substring', () => {
    // Old config exports have `multiple` without `match` field
    const info: FilterInfo = { column: 'name', type: 'text', value: { type: 'multiple', values: ['ill'] } };
    const fn = buildFilterFn(col, info);
    expect(fn({ properties: { name: 'Illinois' } })).toBe(true);
  });

  it('OR semantics across multiple values', () => {
    const info: FilterInfo = { column: 'name', type: 'text', value: { type: 'multiple', values: ['chicago', 'boston'] } };
    const fn = buildFilterFn(col, info);
    expect(fn({ properties: { name: 'Chicago' } })).toBe(true);
    expect(fn({ properties: { name: 'Boston' } })).toBe(true);
    expect(fn({ properties: { name: 'Denver' } })).toBe(false);
  });
});

describe('buildFilterFn — text comparison', () => {
  const col: ColumnMeta = { name: 'name', type: 'text' };

  it('= is case-insensitive', () => {
    const info: FilterInfo = { column: 'name', type: 'text', value: { type: 'comparison', operator: '=', value: 'chicago' } };
    const fn = buildFilterFn(col, info);
    expect(fn({ properties: { name: 'Chicago' } })).toBe(true);
    expect(fn({ properties: { name: 'chicago' } })).toBe(true);
    expect(fn({ properties: { name: 'Boston' } })).toBe(false);
  });

  it('< compares lexicographically', () => {
    const info: FilterInfo = { column: 'name', type: 'text', value: { type: 'comparison', operator: '<', value: 'M' } };
    const fn = buildFilterFn(col, info);
    expect(fn({ properties: { name: 'Apple' } })).toBe(true);   // 'Apple' < 'M'
    expect(fn({ properties: { name: 'Zebra' } })).toBe(false);  // 'Zebra' > 'M'
  });
});

describe('buildFilterFn — edge cases', () => {
  const col: ColumnMeta = { name: 'name', type: 'text' };

  it('handles null value gracefully', () => {
    const info: FilterInfo = { column: 'name', type: 'text', value: { type: 'comparison', operator: '=', value: 'chicago' } };
    const fn = buildFilterFn(col, info);
    expect(fn({ properties: { name: null } })).toBe(false);
  });

  it('handles missing property gracefully', () => {
    const info: FilterInfo = { column: 'name', type: 'text', value: { type: 'comparison', operator: '=', value: 'chicago' } };
    const fn = buildFilterFn(col, info);
    expect(fn({ properties: {} })).toBe(false);
  });

  it('handles raw object without .properties', () => {
    // H3 wrapped items: filter receives raw properties via ?? fallback
    const col: ColumnMeta = { name: 'state', type: 'text' };
    const info: FilterInfo = { column: 'state', type: 'text', value: { type: 'multiple', values: ['CA'], match: 'exact' } };
    const fn = buildFilterFn(col, info);
    expect(fn({ state: 'CA' })).toBe(true);
  });

  it('return true for unknown value type', () => {
    const badInfo = { column: 'x', type: 'text', value: {} } as unknown as FilterInfo;
    const fn = buildFilterFn(col, badInfo);
    expect(fn({ properties: { x: 'anything' } })).toBe(true);
  });
});
