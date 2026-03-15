import { describe, it, expect } from 'vitest';
import { sanitizeTableName, escapeIdentifier, inferColumnType, formatValue } from '../duckdb';

describe('sanitizeTableName', () => {
  it('removes file extension', () => {
    expect(sanitizeTableName('data.geojson', false)).toBe('data');
  });

  it('replaces special characters with underscores', () => {
    expect(sanitizeTableName('my file (2).csv', false)).toBe('my_file__2_');
  });

  it('prefixes names starting with a digit', () => {
    expect(sanitizeTableName('123data.csv', false)).toBe('_123data');
  });

  it('lowercases the name', () => {
    expect(sanitizeTableName('MyData.CSV', false)).toBe('mydata');
  });

  it('handles names with multiple dots', () => {
    expect(sanitizeTableName('my.file.name.csv', false)).toBe('my_file_name');
  });
});

describe('escapeIdentifier', () => {
  it('wraps name in double quotes', () => {
    expect(escapeIdentifier('column_name')).toBe('"column_name"');
  });

  it('escapes double quotes inside the name', () => {
    expect(escapeIdentifier('col"name')).toBe('"col""name"');
  });

  it('handles empty string', () => {
    expect(escapeIdentifier('')).toBe('""');
  });
});

describe('inferColumnType', () => {
  it('returns VARCHAR for empty array', () => {
    expect(inferColumnType([])).toBe('VARCHAR');
  });

  it('returns VARCHAR for all nulls', () => {
    expect(inferColumnType([null, undefined, ''])).toBe('VARCHAR');
  });

  it('returns BIGINT for all integers', () => {
    expect(inferColumnType([1, 2, 3])).toBe('BIGINT');
  });

  it('returns BIGINT for string integers', () => {
    expect(inferColumnType(['1', '2', '3'])).toBe('BIGINT');
  });

  it('returns DOUBLE for mixed integers and floats', () => {
    expect(inferColumnType([1, 2.5, 3])).toBe('DOUBLE');
  });

  it('returns DOUBLE for string floats', () => {
    expect(inferColumnType(['1.1', '2.2'])).toBe('DOUBLE');
  });

  it('returns VARCHAR for non-numeric strings', () => {
    expect(inferColumnType(['hello', 'world'])).toBe('VARCHAR');
  });

  it('returns VARCHAR for mixed types', () => {
    expect(inferColumnType([1, 'hello', 3])).toBe('VARCHAR');
  });
});

describe('formatValue', () => {
  it('returns NULL for null/undefined', () => {
    expect(formatValue(null, 'VARCHAR')).toBe('NULL');
    expect(formatValue(undefined, 'BIGINT')).toBe('NULL');
  });

  it('formats numeric values', () => {
    expect(formatValue(42, 'BIGINT')).toBe('42');
    expect(formatValue(3.14, 'DOUBLE')).toBe('3.14');
    expect(formatValue('42', 'BIGINT')).toBe('42');
  });

  it('returns NULL for non-numeric values in numeric columns', () => {
    expect(formatValue('hello', 'BIGINT')).toBe('NULL');
  });

  it('formats string values with escaping', () => {
    expect(formatValue('hello', 'VARCHAR')).toBe("'hello'");
    expect(formatValue("it's", 'VARCHAR')).toBe("'it''s'");
  });
});
