import React, { useState, useEffect, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { invoiceAPI } from '../services/api';
import { usePageTitle } from '../hooks/usePageTitle';
import toast from 'react-hot-toast';
import {
  FileText,
  Trash2,
  ChevronLeft,
  ChevronRight,
  CheckCircle,
  AlertCircle,
  Clock,
  Upload,
  Loader2,
} from 'lucide-react';
import { format } from 'date-fns';

const PAGE_SIZE = 10;

function invoiceId(inv) {
  return inv?.id || inv?._id;
}

function displayDate(invoice) {
  const raw = invoice?.correctedData?.invoiceDate || invoice?.createdAt;
  if (!raw) return '—';
  try {
    const d = new Date(raw);
    if (Number.isNaN(d.getTime())) return '—';
    return format(d, 'MMM d, yyyy');
  } catch {
    return '—';
  }
}

function statusIcon(status) {
  switch (status) {
    case 'completed':
      return <CheckCircle className="h-4 w-4 text-emerald-500 shrink-0" aria-hidden />;
    case 'failed':
      return <AlertCircle className="h-4 w-4 text-red-500 shrink-0" aria-hidden />;
    case 'processing':
      return <Clock className="h-4 w-4 text-amber-500 shrink-0" aria-hidden />;
    default:
      return <Clock className="h-4 w-4 text-gray-400 shrink-0" aria-hidden />;
  }
}

function statusBadgeClass(status) {
  const base = 'inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium capitalize';
  switch (status) {
    case 'completed':
      return `${base} bg-emerald-50 text-emerald-800`;
    case 'failed':
      return `${base} bg-red-50 text-red-800`;
    case 'processing':
      return `${base} bg-amber-50 text-amber-800`;
    default:
      return `${base} bg-gray-100 text-gray-700`;
  }
}

function accuracyClass(score) {
  if (score == null) return 'text-gray-500';
  if (score >= 90) return 'text-emerald-600 font-semibold';
  if (score >= 70) return 'text-amber-600 font-semibold';
  return 'text-red-600 font-semibold';
}

const InvoicesPage = () => {
  usePageTitle('Invoices');
  const navigate = useNavigate();

  const [invoices, setInvoices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [deleteTarget, setDeleteTarget] = useState(null);

  const fetchInvoices = useCallback(async () => {
    try {
      setLoading(true);
      const response = await invoiceAPI.getMyInvoices({
        page: currentPage,
        limit: PAGE_SIZE,
      });
      const list = response?.invoices || response?.data?.invoices || [];
      setInvoices(list);
      const pages = response.pagination?.pages ?? 1;
      const total = response.pagination?.total ?? list.length;
      setTotalPages(Math.max(1, pages));
      setTotalCount(total);
    } catch (error) {
      toast.error(error.message || 'Failed to fetch invoices');
      setInvoices([]);
    } finally {
      setLoading(false);
    }
  }, [currentPage]);

  useEffect(() => {
    fetchInvoices();
  }, [fetchInvoices]);

  useEffect(() => {
    if (!loading && totalPages >= 1 && currentPage > totalPages) {
      setCurrentPage(totalPages);
    }
  }, [loading, currentPage, totalPages]);

  useEffect(() => {
    if (!deleteTarget) return;
    const onKey = (e) => {
      if (e.key === 'Escape') setDeleteTarget(null);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [deleteTarget]);

  const handleDelete = async () => {
    if (!deleteTarget) return;
    const id = invoiceId(deleteTarget);
    if (!id) return;
    try {
      await invoiceAPI.delete(id);
      toast.success('Invoice deleted');
      setDeleteTarget(null);
      fetchInvoices();
    } catch (error) {
      toast.error(error.message || 'Failed to delete invoice');
    }
  };

  const goToDetail = (inv) => {
    const id = invoiceId(inv);
    if (id) navigate(`/invoice/${id}`);
  };

  const rangeStart = totalCount === 0 ? 0 : (currentPage - 1) * PAGE_SIZE + 1;
  const rangeEnd = Math.min(currentPage * PAGE_SIZE, totalCount);

  return (
    <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
      <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-gray-900">Invoices</h1>
          <p className="mt-1 text-sm text-gray-600">View and manage your processed invoice uploads.</p>
        </div>
        <Link
          to="/upload"
          className="inline-flex items-center justify-center gap-2 self-start rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-indigo-700 sm:self-auto"
        >
          <Upload className="h-4 w-4" aria-hidden />
          Upload invoice
        </Link>
      </div>

      <div className="rounded-2xl border border-gray-100 bg-white shadow-md">
        {loading ? (
          <div className="flex flex-col items-center justify-center gap-4 py-20">
            <Loader2 className="h-10 w-10 animate-spin text-indigo-600" aria-hidden />
            <p className="text-sm text-gray-600">Loading your invoices…</p>
          </div>
        ) : invoices.length === 0 ? (
          <div className="flex flex-col items-center justify-center px-6 py-16 text-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-indigo-50 text-indigo-600">
              <FileText className="h-8 w-8" aria-hidden />
            </div>
            <h2 className="mt-6 text-lg font-semibold text-gray-900">No invoices yet</h2>
            <p className="mt-2 max-w-sm text-sm text-gray-600">
              When you process invoice images, they will show up here with file name, date, accuracy,
              and status.
            </p>
            <Link
              to="/upload"
              className="mt-8 inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-indigo-700"
            >
              <Upload className="h-4 w-4" aria-hidden />
              Upload your first invoice
            </Link>
          </div>
        ) : (
          <>
            {/* Mobile: cards */}
            <ul className="divide-y divide-gray-100 md:hidden">
              {invoices.map((inv) => {
                const id = invoiceId(inv);
                return (
                  <li key={id}>
                    <div className="flex w-full flex-col gap-3 p-4 transition hover:bg-gray-50/80">
                      <button
                        type="button"
                        onClick={() => goToDetail(inv)}
                        className="flex w-full flex-col gap-3 text-left"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-sm font-semibold text-gray-900">
                              {inv.fileName || 'Untitled file'}
                            </p>
                            {inv.correctedData?.invoiceNumber ? (
                              <p className="mt-0.5 truncate text-xs text-gray-500">
                                #{inv.correctedData.invoiceNumber}
                              </p>
                            ) : null}
                          </div>
                          <span className={statusBadgeClass(inv.status)}>
                            {statusIcon(inv.status)}
                            {inv.status || '—'}
                          </span>
                        </div>
                        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-gray-600">
                          <span>Date · {displayDate(inv)}</span>
                          <span className={accuracyClass(inv.accuracyScore)}>
                            Accuracy · {inv.accuracyScore != null ? `${inv.accuracyScore}%` : '—'}
                          </span>
                        </div>
                        <span className="text-xs font-medium text-indigo-600">View details →</span>
                      </button>
                      <div className="flex justify-end border-t border-gray-50 pt-2">
                        <button
                          type="button"
                          onClick={() => setDeleteTarget(inv)}
                          className="text-xs font-medium text-red-600 hover:text-red-700"
                        >
                          Delete
                        </button>
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>

            {/* Desktop: table */}
            <div className="hidden overflow-x-auto md:block">
              <table className="min-w-full divide-y divide-gray-200">
                <thead>
                  <tr className="bg-gray-50/80 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">
                    <th className="px-6 py-3.5">File name</th>
                    <th className="px-6 py-3.5">Date</th>
                    <th className="px-6 py-3.5">Accuracy</th>
                    <th className="px-6 py-3.5">Status</th>
                    <th className="px-6 py-3.5 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 bg-white">
                  {invoices.map((inv) => {
                    const id = invoiceId(inv);
                    return (
                      <tr
                        key={id}
                        className="cursor-pointer transition hover:bg-indigo-50/30"
                        onClick={() => goToDetail(inv)}
                      >
                        <td className="whitespace-nowrap px-6 py-4">
                          <div className="flex items-center gap-3">
                            <FileText className="h-5 w-5 shrink-0 text-gray-400" aria-hidden />
                            <div className="min-w-0">
                              <p className="truncate text-sm font-medium text-gray-900">
                                {inv.fileName || 'Untitled file'}
                              </p>
                              {inv.correctedData?.invoiceNumber ? (
                                <p className="truncate text-xs text-gray-500">
                                  Invoice #{inv.correctedData.invoiceNumber}
                                </p>
                              ) : null}
                            </div>
                          </div>
                        </td>
                        <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-700">
                          {displayDate(inv)}
                        </td>
                        <td className="whitespace-nowrap px-6 py-4">
                          <span className={`text-sm ${accuracyClass(inv.accuracyScore)}`}>
                            {inv.accuracyScore != null ? `${inv.accuracyScore}%` : '—'}
                          </span>
                        </td>
                        <td className="whitespace-nowrap px-6 py-4">
                          <span className={statusBadgeClass(inv.status)}>
                            {statusIcon(inv.status)}
                            {inv.status || '—'}
                          </span>
                        </td>
                        <td className="whitespace-nowrap px-6 py-4 text-right text-sm">
                          <div className="flex items-center justify-end gap-2">
                            <Link
                              to={`/invoice/${id}`}
                              onClick={(e) => e.stopPropagation()}
                              className="rounded-lg px-2 py-1 font-medium text-indigo-600 hover:bg-indigo-50"
                            >
                              View
                            </Link>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setDeleteTarget(inv);
                              }}
                              className="rounded-lg px-2 py-1 font-medium text-red-600 hover:bg-red-50"
                            >
                              Delete
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <div className="flex flex-col gap-3 border-t border-gray-100 px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
              <p className="text-sm text-gray-600">
                Showing <span className="font-medium text-gray-900">{rangeStart}</span>–
                <span className="font-medium text-gray-900">{rangeEnd}</span> of{' '}
                <span className="font-medium text-gray-900">{totalCount}</span>
              </p>
              {totalPages > 1 ? (
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                    disabled={currentPage <= 1}
                    className="inline-flex items-center gap-1 rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    <ChevronLeft className="h-4 w-4" aria-hidden />
                    Previous
                  </button>
                  <span className="px-2 text-sm text-gray-600">
                    Page {currentPage} of {totalPages}
                  </span>
                  <button
                    type="button"
                    onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                    disabled={currentPage >= totalPages}
                    className="inline-flex items-center gap-1 rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    Next
                    <ChevronRight className="h-4 w-4" aria-hidden />
                  </button>
                </div>
              ) : null}
            </div>
          </>
        )}
      </div>

      {deleteTarget && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-gray-900/40 p-4 sm:items-center"
          role="dialog"
          aria-modal="true"
          aria-labelledby="delete-invoice-title"
          onClick={() => setDeleteTarget(null)}
        >
          <div
            className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-red-100">
              <Trash2 className="h-6 w-6 text-red-600" aria-hidden />
            </div>
            <h2
              id="delete-invoice-title"
              className="mt-4 text-center text-lg font-semibold text-gray-900"
            >
              Delete invoice?
            </h2>
            <p className="mt-2 text-center text-sm text-gray-600">
              This removes the record and uploaded file. You can’t undo this.
            </p>
            <div className="mt-4 rounded-xl bg-gray-50 p-3 text-sm text-gray-700">
              <p className="truncate font-medium">{deleteTarget.fileName || 'File'}</p>
              <p className="mt-1 text-xs text-gray-500">
                {displayDate(deleteTarget)} · {deleteTarget.accuracyScore ?? '—'}% ·{' '}
                {deleteTarget.status}
              </p>
            </div>
            <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <button
                type="button"
                onClick={() => setDeleteTarget(null)}
                className="rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm font-semibold text-gray-800 shadow-sm hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDelete}
                className="rounded-xl bg-red-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-red-700"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default InvoicesPage;
