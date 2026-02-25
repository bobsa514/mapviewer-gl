import React, { useState, useEffect } from 'react';
import { XMarkIcon } from '@heroicons/react/24/outline';

export interface FilterInfo {
  column: string;
  type: 'numeric' | 'text';
  value: 
    | { type: 'range'; min: number; max: number }
    | { type: 'comparison'; operator: ComparisonOperator; value: number | string }
    | { type: 'multiple'; values: string[] };
}

type ComparisonOperator = '=' | '<=' | '<' | '>' | '>=';

interface FilterModalProps {
  isOpen: boolean;
  onClose: () => void;
  data: any[];
  onApplyFilter: (filter: (item: any) => boolean, filterInfo: FilterInfo) => void;
  activeFilters: FilterInfo[];
  onRemoveFilter: (index: number) => void;
  layerType?: 'geojson' | 'point' | 'h3';
}

interface ColumnInfo {
  name: string;
  type: 'numeric' | 'text';
  uniqueValues?: string[];
}

export const FilterModal: React.FC<FilterModalProps> = ({
  isOpen,
  onClose,
  data,
  onApplyFilter,
  activeFilters,
  onRemoveFilter,
}) => {
  const [columns, setColumns] = useState<ColumnInfo[]>([]);
  const [selectedColumn, setSelectedColumn] = useState<string>('');
  const [numericRange, setNumericRange] = useState<{ min: number; max: number }>({ min: 0, max: 0 });
  const [textFilter, setTextFilter] = useState<string>('');
  const [selectedValues, setSelectedValues] = useState<string[]>([]);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [comparisonOperator, setComparisonOperator] = useState<ComparisonOperator>('=');
  const [singleValue, setSingleValue] = useState<string>('');

  useEffect(() => {
    setSelectedValues([]);
    setTextFilter('');
    setSingleValue('');
    setComparisonOperator('=');
  }, [selectedColumn]);

  useEffect(() => {
    if (data.length > 0) {
      const firstItem = data[0];
      const properties = firstItem.properties || firstItem;
      
      const columnInfo = Object.keys(properties)
        .filter(key => key !== 'position')
        .map(key => {
          const values = data.map(item => {
            const itemProps = item.properties || item;
            return itemProps[key];
          });
          
          const nonEmptyValues = values.filter(v => v !== null && v !== undefined && v !== '');
          const numericCount = nonEmptyValues.filter(v => {
            if (typeof v === 'number') return true;
            if (typeof v === 'string') return !isNaN(parseFloat(v));
            return false;
          }).length;
          
          const isNumeric = nonEmptyValues.length > 0 && numericCount / nonEmptyValues.length >= 0.5;
          const uniqueValues = isNumeric ? undefined : 
            [...new Set(values.map(String))]
              .sort((a, b) => a.toLowerCase().localeCompare(b.toLowerCase()));
          
          return {
            name: key,
            type: isNumeric ? 'numeric' as const : 'text' as const,
            uniqueValues
          };
        });
      setColumns(columnInfo);
    }
  }, [data]);

  useEffect(() => {
    if (selectedColumn) {
      const column = columns.find(c => c.name === selectedColumn);
      if (column?.type === 'numeric') {
        const values = data.map(item => {
          const itemProps = item.properties || item;
          return itemProps[selectedColumn];
        });
        setNumericRange({
          min: Math.min(...values),
          max: Math.max(...values)
        });
      } else if (column?.type === 'text' && column.uniqueValues) {
        setSuggestions(column.uniqueValues);
      }
    } else {
      setSuggestions([]);
    }
  }, [selectedColumn, columns, data]);

  useEffect(() => {
    if (selectedColumn && textFilter) {
      const column = columns.find(c => c.name === selectedColumn);
      if (column?.type === 'text' && column.uniqueValues) {
        const filtered = column.uniqueValues
          .filter(value => value.toLowerCase().includes(textFilter.toLowerCase()));
        setSuggestions(filtered);
      }
    }
  }, [selectedColumn, textFilter, columns]);

  const formatFilterDescription = (filter: FilterInfo) => {
    if (filter.type === 'numeric') {
      if (filter.value.type === 'range') {
        return `${filter.column}: ${filter.value.min} to ${filter.value.max}`;
      } else {
        const comparisonValue = filter.value as { type: 'comparison'; operator: ComparisonOperator; value: number };
        return `${filter.column} ${comparisonValue.operator} ${comparisonValue.value}`;
      }
    }
    if (filter.value.type === 'multiple') {
      return `${filter.column}: ${filter.value.values.join(' OR ')}`;
    }
    const comparisonValue = filter.value as { type: 'comparison'; operator: ComparisonOperator; value: string };
    return `${filter.column} ${comparisonValue.operator} "${comparisonValue.value}"`;
  };

  const handleApplyFilter = () => {
    if (!selectedColumn) return;

    const column = columns.find(c => c.name === selectedColumn);
    if (!column) return;

    let filterFn: (item: any) => boolean;
    let filterInfo: FilterInfo;
    
    if (column.type === 'numeric') {
      if (comparisonOperator === '=' || singleValue !== '') {
        const numValue = Number(singleValue);
        filterFn = (item: any) => {
          const itemProps = item.properties || item;
          const value = itemProps[selectedColumn];
          switch (comparisonOperator) {
            case '=': return value === numValue;
            case '<': return value < numValue;
            case '<=': return value <= numValue;
            case '>': return value > numValue;
            case '>=': return value >= numValue;
            default: return false;
          }
        };
        filterInfo = {
          column: selectedColumn,
          type: 'numeric',
          value: { type: 'comparison', operator: comparisonOperator, value: numValue }
        };
      } else {
        filterFn = (item: any) => {
          const itemProps = item.properties || item;
          const value = itemProps[selectedColumn];
          return value >= numericRange.min && value <= numericRange.max;
        };
        filterInfo = {
          column: selectedColumn,
          type: 'numeric',
          value: { type: 'range', min: numericRange.min, max: numericRange.max }
        };
      }
    } else {
      if (comparisonOperator === '=' && selectedValues.length > 0) {
        filterFn = (item: any) => {
          const itemProps = item.properties || item;
          const value = String(itemProps[selectedColumn]).toLowerCase();
          return selectedValues.some(selected => 
            value.includes(selected.toLowerCase())
          );
        };
        filterInfo = {
          column: selectedColumn,
          type: 'text',
          value: { type: 'multiple', values: selectedValues }
        };
      } else if (singleValue) {
        filterFn = (item: any) => {
          const itemProps = item.properties || item;
          const value = String(itemProps[selectedColumn]);
          const compareValue = singleValue;
          switch (comparisonOperator) {
            case '=': return value === compareValue;
            case '<': return value < compareValue;
            case '<=': return value <= compareValue;
            case '>': return value > compareValue;
            case '>=': return value >= compareValue;
            default: return false;
          }
        };
        filterInfo = {
          column: selectedColumn,
          type: 'text',
          value: { type: 'comparison', operator: comparisonOperator, value: singleValue }
        };
      } else {
        return;
      }
    }

    onApplyFilter(filterFn, filterInfo);
    onClose();
  };

  const handleTextFieldFocus = () => {
    const column = columns.find(c => c.name === selectedColumn);
    if (column?.type === 'text' && column.uniqueValues) {
      setSuggestions(column.uniqueValues.slice(0, 5));
    }
  };

  const handleValueSelect = (value: string) => {
    if (!selectedValues.includes(value)) {
      setSelectedValues(prev => [...prev, value]);
    }
    setTextFilter('');
  };

  const handleRemoveValue = (valueToRemove: string) => {
    setSelectedValues(prev => prev.filter(v => v !== valueToRemove));
  };

  const renderFilterInput = () => {
    const column = columns.find(c => c.name === selectedColumn);
    if (!column) return null;

    return (
      <div className="space-y-4">
        <div className="flex items-center space-x-2">
          <select
            className="p-2 border rounded-md bg-white shadow-sm"
            value={comparisonOperator}
            onChange={(e) => setComparisonOperator(e.target.value as ComparisonOperator)}
          >
            <option value="=">=</option>
            <option value="<=">&le;</option>
            <option value="<">&lt;</option>
            <option value=">=">&ge;</option>
            <option value=">">&gt;</option>
          </select>
          {comparisonOperator === '=' && column.type === 'text' ? (
            <div className="flex-1">
              <input
                type="text"
                className="w-full p-2 border rounded-md shadow-sm"
                value={textFilter}
                onChange={(e) => setTextFilter(e.target.value)}
                onFocus={handleTextFieldFocus}
                placeholder="Type to search..."
              />
              {selectedValues.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-2">
                  {selectedValues.map(value => (
                    <span
                      key={value}
                      className="inline-flex items-center px-3 py-1 rounded-full text-sm bg-blue-100 text-blue-700"
                    >
                      {value}
                      <button
                        onClick={() => handleRemoveValue(value)}
                        className="ml-1.5 text-blue-500 hover:text-blue-700"
                      >
                        <XMarkIcon className="h-4 w-4" />
                      </button>
                    </span>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <input
              type={column.type === 'numeric' ? "number" : "text"}
              className="flex-1 p-2 border rounded-md shadow-sm"
              value={singleValue}
              onChange={(e) => setSingleValue(e.target.value)}
              placeholder={`Enter ${column.type === 'numeric' ? 'number' : 'text'}...`}
            />
          )}
        </div>

        {comparisonOperator === '=' && column.type === 'text' && suggestions.length > 0 && (
          <div className="mt-1 border rounded-md bg-white shadow-lg max-h-60 overflow-y-auto">
            {suggestions
              .filter(suggestion => !selectedValues.includes(suggestion))
              .map(suggestion => (
                <div
                  key={suggestion}
                  className="px-3 py-2 hover:bg-gray-50 cursor-pointer text-gray-700"
                  onClick={() => handleValueSelect(suggestion)}
                >
                  {suggestion}
                </div>
              ))}
          </div>
        )}
      </div>
    );
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl p-6 w-[480px] max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-xl font-semibold text-gray-900">Filter Data</h2>
          <button 
            onClick={onClose} 
            className="text-gray-400 hover:text-gray-500 transition-colors"
          >
            <XMarkIcon className="w-6 h-6" />
          </button>
        </div>

        {activeFilters.length > 0 && (
          <div className="mb-6">
            <h3 className="text-sm font-medium text-gray-700 mb-2">Active Filters</h3>
            <div className="space-y-2">
              {activeFilters.map((filter, index) => (
                <div key={index} className="flex items-center justify-between bg-gray-50 px-3 py-2 rounded-lg">
                  <span className="text-sm text-gray-600">{formatFilterDescription(filter)}</span>
                  <button
                    onClick={() => onRemoveFilter(index)}
                    className="text-gray-400 hover:text-gray-500"
                  >
                    <XMarkIcon className="h-4 w-4" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="space-y-4">
          <div>
            <label className="block text-base font-medium text-gray-700 mb-2">
              Select Column
            </label>
            <select
              className="w-full p-2.5 border rounded-lg bg-white shadow-sm text-gray-900"
              value={selectedColumn}
              onChange={(e) => setSelectedColumn(e.target.value)}
            >
              <option value="">Select a column</option>
              {columns.map(column => (
                <option key={column.name} value={column.name}>
                  {column.name}
                </option>
              ))}
            </select>
          </div>

          {selectedColumn && renderFilterInput()}
        </div>

        <div className="mt-6 flex justify-end space-x-3">
          <button
            onClick={onClose}
            className="px-4 py-2 text-gray-700 hover:text-gray-900 font-medium"
          >
            Cancel
          </button>
          <button
            onClick={handleApplyFilter}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
            disabled={
              !selectedColumn || 
              (columns.find(c => c.name === selectedColumn)?.type === 'text' && 
               comparisonOperator === '=' && 
               selectedValues.length === 0 && 
               !singleValue)
            }
          >
            Apply Filter
          </button>
        </div>
      </div>
    </div>
  );
}; 