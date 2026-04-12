/** Internal stable id for React keys on line items; stripped before persisting to the API. */
export const INTERNAL_LINE_ITEM_KEY = '__lineId';

export function generateLineItemKey() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `line-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

/** Assign stable ids to each line item for React keys (mutates a deep-cloned correctedData). */
export function ensureLineItemIds(correctedData) {
  const data = correctedData && typeof correctedData === 'object' ? correctedData : {};
  const items = Array.isArray(data.items) ? data.items : [];
  if (items.length === 0) return { ...data, items };
  return {
    ...data,
    items: items.map((row) => {
      const r = row && typeof row === 'object' ? row : {};
      return {
        ...r,
        [INTERNAL_LINE_ITEM_KEY]: r[INTERNAL_LINE_ITEM_KEY] || generateLineItemKey(),
      };
    }),
  };
}

/** Remove internal keys before sending correctedData to the API. */
export function stripInternalLineItemKeys(correctedData) {
  const data = correctedData && typeof correctedData === 'object' ? correctedData : {};
  const items = Array.isArray(data.items) ? data.items : [];
  return {
    ...data,
    items: items.map((row) => {
      if (!row || typeof row !== 'object') return row;
      const { [INTERNAL_LINE_ITEM_KEY]: _removed, ...rest } = row;
      return rest;
    }),
  };
}

/** Preferred order for common correctedData keys (rest follow alphabetically). */
export const SCALAR_FIELD_PRIORITY = [
  'invoiceNumber',
  'invoiceDate',
  'dueDate',
  'vendorName',
  'vendorTaxId',
  'vendorAddress',
  'customerName',
  'customerTaxId',
  'customerAddress',
  'currency',
  'subtotal',
  'taxTotal',
  'totalAmount',
  'paymentTerms',
  'notes',
];

export function formatFieldLabel(key) {
  if (!key) return '';
  const spaced = String(key).replace(/([A-Z])/g, ' $1').replace(/_/g, ' ');
  return spaced.charAt(0).toUpperCase() + spaced.slice(1).trim();
}

export function isPlainObject(v) {
  return v !== null && typeof v === 'object' && !Array.isArray(v);
}

export function toDateInputValue(val) {
  if (val == null || val === '') return '';
  if (typeof val === 'string' && /^\d{4}-\d{2}-\d{2}/.test(val)) {
    return val.slice(0, 10);
  }
  try {
    const d = new Date(val);
    if (Number.isNaN(d.getTime())) return '';
    return d.toISOString().slice(0, 10);
  } catch {
    return '';
  }
}

export function sortedScalarKeys(data) {
  const keys = Object.keys(data || {}).filter((k) => k !== 'items');
  const priority = SCALAR_FIELD_PRIORITY.filter((k) => keys.includes(k));
  const rest = keys.filter((k) => !SCALAR_FIELD_PRIORITY.includes(k)).sort();
  return [...priority, ...rest];
}

export function collectLineItemKeys(items) {
  const set = new Set();
  (items || []).forEach((row) => {
    Object.keys(row || {}).forEach((k) => {
      if (k === INTERNAL_LINE_ITEM_KEY) return;
      set.add(k);
    });
  });
  const preferred = [
    'description',
    'quantity',
    'unitPrice',
    'totalPrice',
    'cgstPercent',
    'sgstPercent',
    'igstPercent',
    'taxRate',
    'taxAmount',
  ];
  const rest = [...set].filter((k) => !preferred.includes(k)).sort();
  return [...preferred.filter((k) => set.has(k)), ...rest];
}

export function scalarUsesNumberInput(key, value) {
  if (typeof value === 'number') return true;
  const k = String(key).toLowerCase();
  return /^(subtotal|taxtotal|totalamount|amount|quantity|price|rate|percent|tax)$/i.test(k) || k.endsWith('amount') || k.endsWith('total');
}

export function scalarUsesTextarea(key, value) {
  if (key === 'notes' || key.endsWith('Notes')) return true;
  if (typeof value === 'string' && value.length > 120) return true;
  return false;
}

export function lineItemFieldIsNumeric(key, sample) {
  if (typeof sample === 'number') return true;
  const k = String(key).toLowerCase();
  return /qty|quantity|price|amount|rate|percent|tax|total/.test(k);
}
