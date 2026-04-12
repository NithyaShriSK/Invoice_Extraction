import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { invoiceAPI } from '../services/api';
import { usePageTitle } from '../hooks/usePageTitle';
import toast from 'react-hot-toast';
import {
  FileText,
  ArrowLeft,
  Save,
  Eye,
  EyeOff,
  Download,
  CheckCircle,
  AlertCircle,
  Clock,
  RotateCcw,
} from 'lucide-react';
import { format } from 'date-fns';
import { InvoiceCorrectedDataForm } from '../components/invoice/InvoiceCorrectedDataForm';
import {
  ensureLineItemIds,
  stripInternalLineItemKeys,
} from '../utils/invoiceDataForm';

const deepClone = (o) => (o == null ? o : JSON.parse(JSON.stringify(o)));

const InvoiceDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();

  const [invoice, setInvoice] = useState(null);
  const [loading, setLoading] = useState(true);
  const [editedData, setEditedData] = useState(null);
  const [baseline, setBaseline] = useState(null);
  const [showOriginal, setShowOriginal] = useState(false);
  const [saving, setSaving] = useState(false);

  const titleNum = editedData?.invoiceNumber || invoice?.correctedData?.invoiceNumber;
  usePageTitle(titleNum ? `Invoice ${titleNum}` : 'Invoice');

  const fetchInvoice = useCallback(async () => {
    try {
      setLoading(true);
      const response = await invoiceAPI.getById(id);
      const inv = response.invoice;
      setInvoice(inv);
      const cd = inv.correctedData && typeof inv.correctedData === 'object' ? inv.correctedData : {};
      const copy = ensureLineItemIds(deepClone(cd));
      setEditedData(copy);
      setBaseline(deepClone(copy));
    } catch (error) {
      toast.error(error.message || 'Failed to fetch invoice');
      navigate('/invoices');
    } finally {
      setLoading(false);
    }
  }, [id, navigate]);

  useEffect(() => {
    fetchInvoice();
  }, [fetchInvoice]);

  const saveChanges = async () => {
    if (!editedData) return;
    try {
      setSaving(true);
      const payload = stripInternalLineItemKeys(editedData);
      await invoiceAPI.save(id, {
        correctedData: payload,
        extractedFields: payload,
      });
      await fetchInvoice();
      toast.success('Invoice saved successfully');
    } catch (error) {
      toast.error(error.message || 'Failed to save invoice');
    } finally {
      setSaving(false);
    }
  };

  const discardChanges = () => {
    if (!baseline) return;
    setEditedData(deepClone(baseline));
  };

  const formatCurrency = (amount, currency = 'INR') => {
    try {
      return new Intl.NumberFormat('en-IN', {
        style: 'currency',
        currency: currency || 'INR',
      }).format(amount || 0);
    } catch {
      return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD',
      }).format(amount || 0);
    }
  };

  const exportToText = () => {
    if (!editedData) return;
    const lines = [
      'INVOICE (export)',
      '================',
      ...Object.entries(editedData)
        .filter(([k]) => k !== 'items')
        .map(([k, v]) => `${k}: ${v}`),
      '',
      'ITEMS:',
      ...(editedData.items || []).map((item, i) =>
        `${i + 1}. ${JSON.stringify(item)}`
      ),
    ];
    const blob = new Blob([lines.join('\n')], { type: 'text/plain' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `invoice_${editedData.invoiceNumber || id}.txt`;
    a.click();
    window.URL.revokeObjectURL(url);
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case 'completed':
        return <CheckCircle className="h-5 w-5 text-emerald-500" />;
      case 'failed':
        return <AlertCircle className="h-5 w-5 text-red-500" />;
      case 'processing':
        return <Clock className="h-5 w-5 text-amber-500" />;
      default:
        return <Clock className="h-5 w-5 text-gray-500" />;
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <div
          className="h-12 w-12 animate-spin rounded-full border-2 border-indigo-600 border-t-transparent"
          aria-label="Loading"
        />
      </div>
    );
  }

  if (!invoice || !editedData) {
    return (
      <div className="flex min-h-[50vh] flex-col items-center justify-center px-4">
        <FileText className="mb-4 h-12 w-12 text-gray-400" />
        <h2 className="text-lg font-medium text-gray-900">Invoice not found</h2>
        <button
          type="button"
          onClick={() => navigate('/invoices')}
          className="btn btn-primary mt-4"
        >
          Back to invoices
        </button>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-4">
          <button
            type="button"
            onClick={() => navigate('/invoices')}
            className="inline-flex w-fit items-center gap-2 rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50"
          >
            <ArrowLeft className="h-4 w-4" aria-hidden />
            Back
          </button>
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-gray-900">
              Invoice details
            </h1>
            <p className="mt-0.5 text-sm text-gray-600">
              Edit extracted data ·{' '}
              <span className="font-medium text-gray-800">
                {editedData.invoiceNumber || 'No number'}
              </span>
              {editedData.totalAmount != null && (
                <span className="text-gray-500">
                  {' '}
                  · Total {formatCurrency(editedData.totalAmount, editedData.currency)}
                </span>
              )}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-2 rounded-xl border border-gray-100 bg-white px-3 py-1.5 text-sm shadow-sm">
            {getStatusIcon(invoice.status)}
            <span className="capitalize text-gray-700">{invoice.status}</span>
          </div>
          <div className="flex items-center gap-1.5 rounded-xl border border-gray-100 bg-white px-3 py-1.5 text-xs text-gray-600 shadow-sm">
            <CheckCircle className="h-3.5 w-3.5 text-emerald-500" aria-hidden />
            Accuracy {invoice.accuracyScore ?? '—'}%
          </div>
          <button
            type="button"
            onClick={() => setShowOriginal((s) => !s)}
            className="inline-flex items-center gap-1.5 rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50"
          >
            {showOriginal ? (
              <EyeOff className="h-4 w-4" aria-hidden />
            ) : (
              <Eye className="h-4 w-4" aria-hidden />
            )}
            {showOriginal ? 'Hide' : 'Show'} OCR
          </button>
          <button
            type="button"
            onClick={exportToText}
            className="inline-flex items-center gap-1.5 rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50"
          >
            <Download className="h-4 w-4" aria-hidden />
            Export
          </button>
        </div>
      </div>

      {showOriginal && (
        <div className="card mb-6">
          <div className="card-header">
            <h3 className="card-title">Original OCR</h3>
          </div>
          <div className="card-content">
            <pre className="max-h-64 overflow-y-auto whitespace-pre-wrap rounded-xl bg-gray-50 p-4 text-sm text-gray-600">
              {invoice.originalOCR}
            </pre>
          </div>
        </div>
      )}

      <div className="rounded-2xl border border-gray-100 bg-white shadow-md">
        <div className="border-b border-gray-100 px-5 py-4 sm:px-8">
          <h2 className="text-lg font-semibold text-gray-900">Extracted data</h2>
          <p className="mt-1 text-sm text-gray-500">
            Fields are generated from <code className="text-xs text-indigo-600">correctedData</code>.
            Changes are saved to the server when you click Save.
          </p>
        </div>

        <div className="px-5 py-6 sm:px-8 sm:py-8">
          <InvoiceCorrectedDataForm
            key={id}
            value={editedData}
            onChange={setEditedData}
            disabled={saving}
          />
        </div>

        <div className="flex flex-col gap-3 border-t border-gray-100 bg-gray-50/80 px-5 py-4 sm:flex-row sm:items-center sm:justify-end sm:px-8">
          <button
            type="button"
            disabled={saving}
            onClick={discardChanges}
            className="inline-flex items-center justify-center gap-2 rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm font-semibold text-gray-700 shadow-sm hover:bg-gray-50 disabled:opacity-50 sm:order-1"
          >
            <RotateCcw className="h-4 w-4" aria-hidden />
            Discard changes
          </button>
          <button
            type="button"
            disabled={saving}
            onClick={saveChanges}
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-indigo-600 px-6 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-indigo-700 disabled:opacity-50 sm:order-2"
          >
            {saving ? (
              <>
                <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                Saving…
              </>
            ) : (
              <>
                <Save className="h-4 w-4" aria-hidden />
                Save invoice
              </>
            )}
          </button>
        </div>
      </div>

      <div className="card mt-6">
        <div className="card-header">
          <h3 className="card-title">Processing</h3>
        </div>
        <div className="card-content grid grid-cols-1 gap-3 text-sm sm:grid-cols-2">
          <div className="flex justify-between gap-4 border-b border-gray-50 pb-2 sm:border-0 sm:pb-0">
            <span className="text-gray-500">Processing time</span>
            <span className="font-medium text-gray-900">
              {invoice.processingTime != null ? `${invoice.processingTime} ms` : '—'}
            </span>
          </div>
          <div className="flex justify-between gap-4 border-b border-gray-50 pb-2 sm:border-0 sm:pb-0">
            <span className="text-gray-500">Language</span>
            <span className="font-medium text-gray-900">
              {invoice.languageDetected || '—'}
            </span>
          </div>
          <div className="flex justify-between gap-4 border-b border-gray-50 pb-2 sm:border-0 sm:pb-0">
            <span className="text-gray-500">File size</span>
            <span className="font-medium text-gray-900">
              {invoice.fileSize != null
                ? `${(invoice.fileSize / 1024).toFixed(1)} KB`
                : '—'}
            </span>
          </div>
          <div className="flex justify-between gap-4">
            <span className="text-gray-500">Created</span>
            <span className="font-medium text-gray-900">
              {invoice.createdAt
                ? format(new Date(invoice.createdAt), 'MMM d, yyyy HH:mm')
                : '—'}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default InvoiceDetail;
