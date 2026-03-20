import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { invoiceAPI } from '../services/api';
import toast from 'react-hot-toast';
import {
  FileText,
  Edit3,
  Trash2,
  Eye,
  Search,
  Filter,
  ChevronLeft,
  ChevronRight,
  Calendar,
  DollarSign,
  CheckCircle,
  AlertCircle,
  Clock,
  Download
} from 'lucide-react';
import { format } from 'date-fns';

const History = () => {
  const [invoices, setInvoices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [selectedInvoice, setSelectedInvoice] = useState(null);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [filters, setFilters] = useState({
    status: '',
    dateRange: '',
    sortBy: 'createdAt',
    sortOrder: 'desc'
  });

  useEffect(() => {
    fetchInvoices();
  }, [currentPage, searchTerm, filters]);

  const fetchInvoices = async () => {
    try {
      setLoading(true);
      const params = {
        page: currentPage,
        limit: 10,
        search: searchTerm,
        ...filters
      };

      const response = await invoiceAPI.getMyInvoices(params);
      setInvoices(response.invoices);
      setTotalPages(response.pagination.pages);
    } catch (error) {
      toast.error(error.message || 'Failed to fetch invoices');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteInvoice = async (invoiceId) => {
    try {
      await invoiceAPI.delete(invoiceId);
      toast.success('Invoice deleted successfully');
      setShowDeleteModal(false);
      setSelectedInvoice(null);
      fetchInvoices();
    } catch (error) {
      toast.error(error.message || 'Failed to delete invoice');
    }
  };

  const handleSearch = (e) => {
    setSearchTerm(e.target.value);
    setCurrentPage(1);
  };

  const handleFilterChange = (key, value) => {
    setFilters({ ...filters, [key]: value });
    setCurrentPage(1);
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case 'completed':
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'failed':
        return <AlertCircle className="h-4 w-4 text-red-500" />;
      case 'processing':
        return <Clock className="h-4 w-4 text-yellow-500" />;
      default:
        return <Clock className="h-4 w-4 text-gray-500" />;
    }
  };

  const getStatusBadge = (status) => {
    const baseClasses = 'px-2 py-1 text-xs font-medium rounded-full';
    switch (status) {
      case 'completed':
        return `${baseClasses} bg-green-100 text-green-800`;
      case 'failed':
        return `${baseClasses} bg-red-100 text-red-800`;
      case 'processing':
        return `${baseClasses} bg-yellow-100 text-yellow-800`;
      default:
        return `${baseClasses} bg-gray-100 text-gray-800`;
    }
  };

  const formatCurrency = (amount, currency = 'USD') => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency,
    }).format(amount || 0);
  };

  const getAccuracyColor = (accuracy) => {
    if (accuracy >= 90) return 'text-green-600';
    if (accuracy >= 70) return 'text-yellow-600';
    return 'text-red-600';
  };

  const exportInvoiceData = () => {
    const csvContent = [
      ['Invoice Number', 'Vendor', 'Date', 'Total', 'Accuracy', 'Status'].join(','),
      ...invoices.map(invoice => [
        `"${invoice.invoiceNumber || 'N/A'}"`,
        `"${invoice.vendorName || 'N/A'}"`,
        `"${invoice.invoiceDate ? format(new Date(invoice.invoiceDate), 'MM/dd/yyyy') : 'N/A'}"`,
        invoice.totalAmount || 0,
        invoice.accuracyScore || 0,
        invoice.status || 'unknown'
      ].join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `invoices_${format(new Date(), 'yyyy-MM-dd')}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
  };

  return (
    <div className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Invoice History</h1>
            <p className="mt-1 text-sm text-gray-600">
              View and manage all your processed invoices
            </p>
          </div>
          <div className="flex space-x-3">
            <button
              onClick={exportInvoiceData}
              className="btn btn-outline"
            >
              <Download className="h-4 w-4 mr-2" />
              Export CSV
            </button>
            <Link
              to="/dashboard"
              className="btn btn-primary"
            >
              <FileText className="h-4 w-4 mr-2" />
              Upload New
            </Link>
          </div>
        </div>
      </div>

      {/* Filters and Search */}
      <div className="card mb-6">
        <div className="card-content">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            {/* Search */}
            <div className="md:col-span-2">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search invoices..."
                  value={searchTerm}
                  onChange={handleSearch}
                  className="input pl-10"
                />
              </div>
            </div>

            {/* Status Filter */}
            <div>
              <select
                value={filters.status}
                onChange={(e) => handleFilterChange('status', e.target.value)}
                className="input"
              >
                <option value="">All Status</option>
                <option value="completed">Completed</option>
                <option value="processing">Processing</option>
                <option value="failed">Failed</option>
              </select>
            </div>

            {/* Sort */}
            <div>
              <select
                value={`${filters.sortBy}_${filters.sortOrder}`}
                onChange={(e) => {
                  const [sortBy, sortOrder] = e.target.value.split('_');
                  setFilters({ ...filters, sortBy, sortOrder });
                }}
                className="input"
              >
                <option value="createdAt_desc">Newest First</option>
                <option value="createdAt_asc">Oldest First</option>
                <option value="totalAmount_desc">Highest Amount</option>
                <option value="totalAmount_asc">Lowest Amount</option>
                <option value="accuracyScore_desc">Best Accuracy</option>
                <option value="accuracyScore_asc">Worst Accuracy</option>
              </select>
            </div>
          </div>
        </div>
      </div>

      {/* Invoice List */}
      <div className="card">
        <div className="card-content">
          {loading ? (
            <div className="text-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
              <p className="text-gray-600">Loading invoices...</p>
            </div>
          ) : invoices.length === 0 ? (
            <div className="text-center py-12">
              <FileText className="mx-auto h-12 w-12 text-gray-400 mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">No invoices found</h3>
              <p className="text-gray-600 mb-4">
                {searchTerm || filters.status 
                  ? 'Try adjusting your search or filters' 
                  : 'Upload your first invoice to get started'
                }
              </p>
              {!searchTerm && !filters.status && (
                <Link
                  to="/dashboard"
                  className="btn btn-primary"
                >
                  <FileText className="h-4 w-4 mr-2" />
                  Upload Invoice
                </Link>
              )}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Invoice
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Vendor
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Date
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Amount
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Accuracy
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Status
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {invoices.map((invoice) => (
                    <tr key={invoice.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center">
                          <FileText className="h-5 w-5 text-gray-400 mr-3" />
                          <div>
                            <div className="text-sm font-medium text-gray-900">
                              {invoice.invoiceNumber || 'N/A'}
                            </div>
                            <div className="text-xs text-gray-500">
                              {format(new Date(invoice.createdAt), 'MMM dd, yyyy')}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-900">
                          {invoice.vendorName || 'N/A'}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-900">
                          {invoice.invoiceDate 
                            ? format(new Date(invoice.invoiceDate), 'MMM dd, yyyy')
                            : 'N/A'
                          }
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-medium text-gray-900">
                          {formatCurrency(invoice.totalAmount, invoice.currency)}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center">
                          <span className={`text-sm font-medium ${getAccuracyColor(invoice.accuracyScore)}`}>
                            {invoice.accuracyScore}%
                          </span>
                          {invoice.isEdited && (
                            <Edit3 className="h-3 w-3 text-blue-500 ml-2" title="Edited" />
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center">
                          {getStatusIcon(invoice.status)}
                          <span className={`ml-2 ${getStatusBadge(invoice.status)}`}>
                            {invoice.status}
                          </span>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                        <div className="flex items-center space-x-2">
                          <Link
                            to={`/invoice/${invoice.id}`}
                            className="text-blue-600 hover:text-blue-900"
                          >
                            <Eye className="h-4 w-4" />
                          </Link>
                          <button
                            onClick={() => {
                              setSelectedInvoice(invoice);
                              setShowDeleteModal(true);
                            }}
                            className="text-red-600 hover:text-red-900"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Pagination */}
          {invoices.length > 0 && (
            <div className="mt-6 flex items-center justify-between">
              <div className="text-sm text-gray-700">
                Showing {((currentPage - 1) * 10) + 1} to {Math.min(currentPage * 10, invoices.length)} of {invoices.length} results
              </div>
              <div className="flex items-center space-x-2">
                <button
                  onClick={() => setCurrentPage(currentPage - 1)}
                  disabled={currentPage === 1}
                  className="btn btn-outline btn-sm disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <ChevronLeft className="h-4 w-4" />
                  Previous
                </button>
                <span className="px-3 py-1 text-sm text-gray-700">
                  Page {currentPage} of {totalPages}
                </span>
                <button
                  onClick={() => setCurrentPage(currentPage + 1)}
                  disabled={currentPage === totalPages}
                  className="btn btn-outline btn-sm disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Next
                  <ChevronRight className="h-4 w-4" />
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Delete Confirmation Modal */}
      {showDeleteModal && selectedInvoice && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
          <div className="relative top-20 mx-auto p-5 border w-96 shadow-lg rounded-md bg-white">
            <div className="mt-3">
              <div className="flex items-center justify-center w-12 h-12 mx-auto bg-red-100 rounded-full mb-4">
                <Trash2 className="h-6 w-6 text-red-600" />
              </div>
              <h3 className="text-lg font-medium text-gray-900 text-center">
                Delete Invoice
              </h3>
              <div className="mt-2 px-7 py-3">
                <p className="text-sm text-gray-500 text-center">
                  Are you sure you want to delete this invoice? This action cannot be undone.
                </p>
                <div className="mt-4 text-sm text-gray-600 bg-gray-50 p-3 rounded">
                  <p><strong>Invoice:</strong> {selectedInvoice.invoiceNumber || 'N/A'}</p>
                  <p><strong>Vendor:</strong> {selectedInvoice.vendorName || 'N/A'}</p>
                  <p><strong>Amount:</strong> {formatCurrency(selectedInvoice.totalAmount)}</p>
                </div>
              </div>
              <div className="flex items-center justify-center space-x-4 mt-4">
                <button
                  onClick={() => {
                    setShowDeleteModal(false);
                    setSelectedInvoice(null);
                  }}
                  className="btn btn-secondary"
                >
                  Cancel
                </button>
                <button
                  onClick={() => handleDeleteInvoice(selectedInvoice.id)}
                  className="btn bg-red-600 text-white hover:bg-red-700"
                >
                  Delete
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default History;
