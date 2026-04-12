import React, { useState, useLayoutEffect, useRef } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { cn } from '../../utils/cn';
import {
  formatFieldLabel,
  isPlainObject,
  toDateInputValue,
  sortedScalarKeys,
  collectLineItemKeys,
  scalarUsesNumberInput,
  scalarUsesTextarea,
  lineItemFieldIsNumeric,
  INTERNAL_LINE_ITEM_KEY,
  generateLineItemKey,
} from '../../utils/invoiceDataForm';

const inputClass =
  'w-full rounded-xl border border-gray-300 px-3 py-2 text-sm text-gray-900 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:bg-gray-50 disabled:text-gray-500';

function updateValue(prev, key, next) {
  return { ...prev, [key]: next };
}

export function InvoiceCorrectedDataForm({ value, onChange, disabled }) {
  const data = value && typeof value === 'object' ? value : {};
  const valueRef = useRef(value);
  const onChangeRef = useRef(onChange);
  valueRef.current = value;
  onChangeRef.current = onChange;
  const [jsonDrafts, setJsonDrafts] = useState({});

  const setField = (key, v) => {
    onChange(updateValue(data, key, v));
  };

  const scalarKeys = sortedScalarKeys(data);

  const handleScalarChange = (key, raw, type) => {
    if (type === 'number') {
      const n = parseFloat(raw);
      setField(key, Number.isFinite(n) ? n : 0);
      return;
    }
    setField(key, raw);
  };

  const jsonText = (key, v) =>
    Object.prototype.hasOwnProperty.call(jsonDrafts, key)
      ? jsonDrafts[key]
      : JSON.stringify(v ?? null, null, 2);

  const handleJsonDraft = (key, text) => {
    try {
      const parsed = JSON.parse(text || 'null');
      setField(key, parsed);
      setJsonDrafts((d) => {
        const { [key]: _removed, ...rest } = d;
        return rest;
      });
    } catch {
      setJsonDrafts((d) => ({ ...d, [key]: text }));
    }
  };

  const items = Array.isArray(data.items) ? data.items : [];

  const itemsNeedStableIds =
    items.length > 0 && items.some((row) => !row?.[INTERNAL_LINE_ITEM_KEY]);

  useLayoutEffect(() => {
    if (!itemsNeedStableIds) return;
    const v = valueRef.current && typeof valueRef.current === 'object' ? valueRef.current : {};
    const list = Array.isArray(v.items) ? v.items : [];
    const next = list.map((row) =>
      row?.[INTERNAL_LINE_ITEM_KEY]
        ? row
        : { ...(row || {}), [INTERNAL_LINE_ITEM_KEY]: generateLineItemKey() }
    );
    onChangeRef.current({ ...v, items: next });
  }, [itemsNeedStableIds]);

  const setItems = (nextItems) => {
    onChange({ ...data, items: nextItems });
  };

  const updateItem = (index, key, v) => {
    const next = items.map((row, i) =>
      i === index ? { ...row, [key]: v } : row
    );
    setItems(next);
  };

  const addItem = () => {
    const keys = collectLineItemKeys(items);
    const template = keys.reduce((acc, k) => {
      acc[k] = lineItemFieldIsNumeric(k, items[0]?.[k]) ? 0 : '';
      return acc;
    }, {});
    if (keys.length === 0) {
      template.description = '';
      template.quantity = 1;
      template.unitPrice = 0;
      template.totalPrice = 0;
    }
    template[INTERNAL_LINE_ITEM_KEY] = generateLineItemKey();
    setItems([...items, template]);
  };

  const removeItem = (index) => {
    setItems(items.filter((_, i) => i !== index));
  };

  const itemKeys = collectLineItemKeys(items);

  return (
    <div className="space-y-10">
      <section>
        <h3 className="mb-4 text-sm font-semibold uppercase tracking-wide text-gray-500">
          Invoice fields
        </h3>
        <div className="grid grid-cols-1 gap-x-6 gap-y-5 sm:grid-cols-2">
          {scalarKeys.map((key) => {
            const v = data[key];

            if (Array.isArray(v)) {
              return (
                <div key={key} className="sm:col-span-2">
                  <label
                    htmlFor={`field-${key}`}
                    className="mb-1.5 block text-sm font-medium text-gray-700"
                  >
                    {formatFieldLabel(key)} (JSON)
                  </label>
                  <textarea
                    id={`field-${key}`}
                    disabled={disabled}
                    rows={3}
                    className={cn(inputClass, 'font-mono text-xs')}
                    value={jsonText(key, v)}
                    onChange={(e) => handleJsonDraft(key, e.target.value)}
                  />
                </div>
              );
            }

            if (isPlainObject(v)) {
              return (
                <div key={key} className="sm:col-span-2">
                  <label
                    htmlFor={`field-${key}`}
                    className="mb-1.5 block text-sm font-medium text-gray-700"
                  >
                    {formatFieldLabel(key)} (JSON)
                  </label>
                  <textarea
                    id={`field-${key}`}
                    disabled={disabled}
                    rows={4}
                    className={cn(inputClass, 'font-mono text-xs')}
                    value={jsonText(key, v)}
                    onChange={(e) => handleJsonDraft(key, e.target.value)}
                  />
                </div>
              );
            }

            const dateField =
              /date$/i.test(key) || key === 'invoiceDate' || key === 'dueDate';

            if (dateField) {
              return (
                <div key={key}>
                  <label
                    htmlFor={`field-${key}`}
                    className="mb-1.5 block text-sm font-medium text-gray-700"
                  >
                    {formatFieldLabel(key)}
                  </label>
                  <input
                    id={`field-${key}`}
                    type="date"
                    disabled={disabled}
                    className={inputClass}
                    value={toDateInputValue(v)}
                    onChange={(e) => setField(key, e.target.value || null)}
                  />
                </div>
              );
            }

            if (typeof v === 'boolean') {
              return (
                <div key={key} className="flex items-center gap-3 pt-6">
                  <input
                    id={`field-${key}`}
                    type="checkbox"
                    disabled={disabled}
                    className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                    checked={Boolean(v)}
                    onChange={(e) => setField(key, e.target.checked)}
                  />
                  <label htmlFor={`field-${key}`} className="text-sm font-medium text-gray-700">
                    {formatFieldLabel(key)}
                  </label>
                </div>
              );
            }

            if (scalarUsesNumberInput(key, v)) {
              return (
                <div key={key}>
                  <label
                    htmlFor={`field-${key}`}
                    className="mb-1.5 block text-sm font-medium text-gray-700"
                  >
                    {formatFieldLabel(key)}
                  </label>
                  <input
                    id={`field-${key}`}
                    type="number"
                    step="any"
                    disabled={disabled}
                    className={inputClass}
                    value={v === null || v === undefined ? '' : v}
                    onChange={(e) => handleScalarChange(key, e.target.value, 'number')}
                  />
                </div>
              );
            }

            if (scalarUsesTextarea(key, v)) {
              return (
                <div key={key} className="sm:col-span-2">
                  <label
                    htmlFor={`field-${key}`}
                    className="mb-1.5 block text-sm font-medium text-gray-700"
                  >
                    {formatFieldLabel(key)}
                  </label>
                  <textarea
                    id={`field-${key}`}
                    disabled={disabled}
                    rows={4}
                    className={inputClass}
                    value={v == null ? '' : String(v)}
                    onChange={(e) => handleScalarChange(key, e.target.value, 'text')}
                  />
                </div>
              );
            }

            return (
              <div key={key}>
                <label
                  htmlFor={`field-${key}`}
                  className="mb-1.5 block text-sm font-medium text-gray-700"
                >
                  {formatFieldLabel(key)}
                </label>
                <input
                  id={`field-${key}`}
                  type="text"
                  disabled={disabled}
                  className={inputClass}
                  value={v == null ? '' : String(v)}
                  onChange={(e) => handleScalarChange(key, e.target.value, 'text')}
                />
              </div>
            );
          })}
        </div>
      </section>

      <section>
        <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <h3 className="text-sm font-semibold uppercase tracking-wide text-gray-500">
            Line items
          </h3>
          <button
            type="button"
            disabled={disabled}
            onClick={addItem}
            className="inline-flex items-center justify-center gap-2 rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-gray-800 shadow-sm hover:border-indigo-200 hover:bg-indigo-50/50 disabled:opacity-50"
          >
            <Plus className="h-4 w-4" aria-hidden />
            Add line
          </button>
        </div>

        {items.length === 0 ? (
          <p className="rounded-xl border border-dashed border-gray-200 bg-gray-50/80 py-10 text-center text-sm text-gray-500">
            No line items. Add a row or they will appear here when the invoice includes products.
          </p>
        ) : (
          <div className="space-y-4">
            {items.map((row, index) => {
              const lineKey = row[INTERNAL_LINE_ITEM_KEY] ?? `pending-${index}`;
              return (
                <div
                  key={lineKey}
                  className="rounded-2xl border border-gray-100 bg-gray-50/50 p-4 shadow-sm sm:p-5"
                >
                  <div className="mb-3 flex items-center justify-between gap-2">
                    <span className="text-xs font-semibold uppercase tracking-wide text-gray-400">
                      Line {index + 1}
                    </span>
                    <button
                      type="button"
                      disabled={disabled}
                      onClick={() => removeItem(index)}
                      className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-medium text-red-600 hover:bg-red-50 disabled:opacity-50"
                    >
                      <Trash2 className="h-3.5 w-3.5" aria-hidden />
                      Remove
                    </button>
                  </div>
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                    {itemKeys.map((ik) => {
                      const cell = row[ik];
                      const numeric = lineItemFieldIsNumeric(ik, cell);
                      return (
                        <div key={ik}>
                          <label
                            htmlFor={`item-${lineKey}-${ik}`}
                            className="mb-1.5 block text-sm font-medium text-gray-700"
                          >
                            {formatFieldLabel(ik)}
                          </label>
                          {numeric ? (
                            <input
                              id={`item-${lineKey}-${ik}`}
                              type="number"
                              step="any"
                              disabled={disabled}
                              className={inputClass}
                              value={cell === null || cell === undefined ? '' : cell}
                              onChange={(e) => {
                                const n = parseFloat(e.target.value);
                                updateItem(
                                  index,
                                  ik,
                                  Number.isFinite(n) ? n : 0
                                );
                              }}
                            />
                          ) : (
                            <input
                              id={`item-${lineKey}-${ik}`}
                              type="text"
                              disabled={disabled}
                              className={inputClass}
                              value={cell == null ? '' : String(cell)}
                              onChange={(e) => updateItem(index, ik, e.target.value)}
                            />
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
