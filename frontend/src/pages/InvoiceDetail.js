import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { invoiceAPI } from '../services/api';
import toast from 'react-hot-toast';
import {
  FileText,
  ArrowLeft,
  Edit3,
  Save,
  X,
  Eye,
  EyeOff,
  Download,
  CheckCircle,
  AlertCircle,
  Clock,
  User,
  Calendar,
  DollarSign,
  Building,
  Mail
} from 'lucide-react';
import { format } from 'date-fns';

const InvoiceDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  
  const [invoice, setInvoice] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const [editedData, setEditedData] = useState(null);
  const [showOriginal, setShowOriginal] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchInvoice();
  }, [id]);

  const fetchInvoice = async () => {
    try {
      setLoading(true);
      const response = await invoiceAPI.getById(id);
      setInvoice(response.invoice);
      setEditedData(response.invoice.correctedData);
    } catch (error) {
      toast.error(error.message || 'Failed to fetch invoice');
      navigate('/history');
    } finally {
      setLoading(false);
    }
  };

  const handleFieldChange = (field, value) => {
    setEditedData({
      ...editedData,
      [field]: value,
    });
  };

  const handleItemChange = (index, field, value) => {
    const updatedItems = [...(editedData.items || [])];
    updatedItems[index] = {
      ...updatedItems[index],
      [field]: value,
    };
    setEditedData({
      ...editedData,
      items: updatedItems,
    });
  };

  const addItem = () => {
    const newItem = {
      description: '',
      quantity: 1,
      unitPrice: 0,
      totalPrice: 0,
      taxRate: 0,
      taxAmount: 0,
    };
    setEditedData({
      ...editedData,
      items: [...(editedData.items || []), newItem],
    });
  };

  const removeItem = (index) => {
    const updatedItems = editedData.items.filter((_, i) => i !== index);
    setEditedData({
      ...editedData,
      items: updatedItems,
    });
  };

  const saveChanges = async () => {
    try {
      setSaving(true);
      await invoiceAPI.save(id, {
        correctedData: editedData,
        extractedFields: editedData,
      });
      
      // Refresh invoice data
      await fetchInvoice();
      setIsEditing(false);
      toast.success('Invoice saved successfully!');
    } catch (error) {
      toast.error(error.message || 'Failed to save invoice');
    } finally {
      setSaving(false);
    }
  };

  const cancelEdit = () => {
    setEditedData(invoice.correctedData);
    setIsEditing(false);
  };

  const formatCurrency = (amount, currency = 'USD') => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency,
    }).format(amount || 0);
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case 'completed':
        return <CheckCircle className="h-5 w-5 text-green-500" />;
      case 'failed':
        return <AlertCircle className="h-5 w-5 text-red-500" />;
      case 'processing':
        return <Clock className="h-5 w-5 text-yellow-500" />;
      default:
        return <Clock className="h-5 w-5 text-gray-500" />;
    }
  };

  const exportToPDF = () => {
    // This would typically use a library like jsPDF
    // For now, we'll create a simple text export
    const content = `
INVOICE
=======
Invoice Number: ${editedData.invoiceNumber || 'N/A'}
Date: ${editedData.invoiceDate || 'N/A'}
Due Date: ${editedData.dueDate || 'N/A'}

VENDOR:
${editedData.vendorName || 'N/A'}
${editedData.vendorAddress || ''}
Tax ID: ${editedData.vendorTaxId || 'N/A'}

CUSTOMER:
${editedData.customerName || 'N/A'}
${editedData.customerAddress || ''}
Tax ID: ${editedData.customerTaxId || 'N/A'}

ITEMS:
${editedData.items?.map((item, index) => 
  `${index + 1}. ${item.description} - Qty: ${item.quantity} x ${formatCurrency(item.unitPrice)} = ${formatCurrency(item.totalPrice)}`
).join('\n') || 'No items'}

SUBTOTAL: ${formatCurrency(editedData.subtotal)}
TAX: ${formatCurrency(editedData.taxTotal)}
TOTAL: ${formatCurrency(editedData.totalAmount)}

Notes: ${editedData.notes || 'N/A'}
Payment Terms: ${editedData.paymentTerms || 'N/A'}
    `;

    const blob = new Blob([content], { type: 'text/plain' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `invoice_${editedData.invoiceNumber || 'export'}.txt`;
    a.click();
    window.URL.revokeObjectURL(url);
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (!invoice) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <FileText className="mx-auto h-12 w-12 text-gray-400 mb-4" />
          <h2 className="text-lg font-medium text-gray-900 mb-2">Invoice not found</h2>
          <button
            onClick={() => navigate('/history')}
            className="btn btn-primary"
          >
            Back to History
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <button
              onClick={() => navigate('/history')}
              className="btn btn-outline"
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back
            </button>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">
                Invoice Details
              </h1>
              <p className="text-sm text-gray-600">
                {editedData.invoiceNumber || 'No Invoice Number'}
              </p>
            </div>
          </div>
          
          <div className="flex items-center space-x-4">
            <div className="flex items-center space-x-2">
              {getStatusIcon(invoice.status)}
              <span className="text-sm font-medium capitalize">{invoice.status}</span>
            </div>
            
            <div className="flex items-center space-x-2 text-sm">
              <CheckCircle className="h-4 w-4 text-green-500" />
              <span>Accuracy: {invoice.accuracyScore}%</span>
            </div>

            {!isEditing ? (
              <>
                <button
                  onClick={() => setShowOriginal(!showOriginal)}
                  className="btn btn-outline"
                >
                  {showOriginal ? <EyeOff className="h-4 w-4 mr-2" /> : <Eye className="h-4 w-4 mr-2" />}
                  {showOriginal ? 'Hide' : 'Show'} Original
                </button>
                <button
                  onClick={exportToPDF}
                  className="btn btn-outline"
                >
                  <Download className="h-4 w-4 mr-2" />
                  Export
                </button>
                <button
                  onClick={() => setIsEditing(true)}
                  className="btn btn-primary"
                >
                  <Edit3 className="h-4 w-4 mr-2" />
                  Edit
                </button>
              </>
            ) : (
              <>
                <button
                  onClick={cancelEdit}
                  className="btn btn-secondary"
                >
                  <X className="h-4 w-4 mr-2" />
                  Cancel
                </button>
                <button
                  onClick={saveChanges}
                  disabled={saving}
                  className="btn btn-primary"
                >
                  {saving ? (
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                  ) : (
                    <Save className="h-4 w-4 mr-2" />
                  )}
                  Save
                </button>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Original OCR Text */}
      {showOriginal && (
        <div className="card mb-6">
          <div className="card-header">
            <h3 className="card-title">Original OCR Text</h3>
          </div>
          <div className="card-content">
            <pre className="whitespace-pre-wrap text-sm text-gray-600 bg-gray-50 p-4 rounded-md max-h-64 overflow-y-auto">
              {invoice.originalOCR}
            </pre>
          </div>
        </div>
      )}

      {/* Invoice Content */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Invoice Info */}
        <div className="lg:col-span-2 space-y-6">
          {/* Invoice Details */}
          <div className="card">
            <div className="card-header">
              <h3 className="card-title">Invoice Information</h3>
            </div>
            <div className="card-content space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Invoice Number
                  </label>
                  {isEditing ? (
                    <input
                      type="text"
                      value={editedData.invoiceNumber || ''}
                      onChange={(e) => handleFieldChange('invoiceNumber', e.target.value)}
                      className="input"
                    />
                  ) : (
                    <p className="text-gray-900">{editedData.invoiceNumber || 'N/A'}</p>
                  )}
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Invoice Date
                  </label>
                  {isEditing ? (
                    <input
                      type="date"
                      value={editedData.invoiceDate || ''}
                      onChange={(e) => handleFieldChange('invoiceDate', e.target.value)}
                      className="input"
                    />
                  ) : (
                    <p className="text-gray-900">
                      {editedData.invoiceDate ? format(new Date(editedData.invoiceDate), 'MMM dd, yyyy') : 'N/A'}
                    </p>
                  )}
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Due Date
                  </label>
                  {isEditing ? (
                    <input
                      type="date"
                      value={editedData.dueDate || ''}
                      onChange={(e) => handleFieldChange('dueDate', e.target.value)}
                      className="input"
                    />
                  ) : (
                    <p className="text-gray-900">
                      {editedData.dueDate ? format(new Date(editedData.dueDate), 'MMM dd, yyyy') : 'N/A'}
                    </p>
                  )}
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Payment Terms
                  </label>
                  {isEditing ? (
                    <input
                      type="text"
                      value={editedData.paymentTerms || ''}
                      onChange={(e) => handleFieldChange('paymentTerms', e.target.value)}
                      className="input"
                    />
                  ) : (
                    <p className="text-gray-900">{editedData.paymentTerms || 'N/A'}</p>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Line Items */}
          <div className="card">
            <div className="card-header">
              <div className="flex items-center justify-between">
                <h3 className="card-title">Line Items</h3>
                {isEditing && (
                  <button
                    onClick={addItem}
                    className="btn btn-outline btn-sm"
                  >
                    Add Item
                  </button>
                )}
              </div>
            </div>
            <div className="card-content">
              {editedData.items && editedData.items.length > 0 ? (
                <div className="space-y-4">
                  {editedData.items.map((item, index) => (
                    <div key={index} className="border border-gray-200 rounded-lg p-4">
                      <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
                        <div className="md:col-span-2">
                          <label className="block text-sm font-medium text-gray-700 mb-1">
                            Description
                          </label>
                          {isEditing ? (
                            <input
                              type="text"
                              value={item.description || ''}
                              onChange={(e) => handleItemChange(index, 'description', e.target.value)}
                              className="input"
                            />
                          ) : (
                            <p className="text-gray-900">{item.description || 'N/A'}</p>
                          )}
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">
                            Quantity
                          </label>
                          {isEditing ? (
                            <input
                              type="number"
                              value={item.quantity || 0}
                              onChange={(e) => handleItemChange(index, 'quantity', parseFloat(e.target.value) || 0)}
                              className="input"
                            />
                          ) : (
                            <p className="text-gray-900">{item.quantity || 0}</p>
                          )}
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">
                            Unit Price
                          </label>
                          {isEditing ? (
                            <input
                              type="number"
                              step="0.01"
                              value={item.unitPrice || 0}
                              onChange={(e) => handleItemChange(index, 'unitPrice', parseFloat(e.target.value) || 0)}
                              className="input"
                            />
                          ) : (
                            <p className="text-gray-900">{formatCurrency(item.unitPrice)}</p>
                          )}
                        </div>
                        <div className="flex items-end space-x-2">
                          <div className="flex-1">
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                              Total
                            </label>
                            {isEditing ? (
                              <input
                                type="number"
                                step="0.01"
                                value={item.totalPrice || 0}
                                onChange={(e) => handleItemChange(index, 'totalPrice', parseFloat(e.target.value) || 0)}
                                className="input"
                              />
                            ) : (
                              <p className="text-gray-900 font-medium">{formatCurrency(item.totalPrice)}</p>
                            )}
                          </div>
                          {isEditing && (
                            <button
                              onClick={() => removeItem(index)}
                              className="btn btn-outline btn-sm text-red-600 hover:text-red-700"
                            >
                              <X className="h-4 w-4" />
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-gray-500 text-center py-4">No items found</p>
              )}
            </div>
          </div>

          {/* Notes */}
          <div className="card">
            <div className="card-header">
              <h3 className="card-title">Notes</h3>
            </div>
            <div className="card-content">
              {isEditing ? (
                <textarea
                  value={editedData.notes || ''}
                  onChange={(e) => handleFieldChange('notes', e.target.value)}
                  className="input"
                  rows={4}
                  placeholder="Additional notes..."
                />
              ) : (
                <p className="text-gray-900">{editedData.notes || 'No notes'}</p>
              )}
            </div>
          </div>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Vendor Info */}
          <div className="card">
            <div className="card-header">
              <h3 className="card-title flex items-center">
                <Building className="h-5 w-5 mr-2" />
                Vendor Information
              </h3>
            </div>
            <div className="card-content space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Vendor Name
                </label>
                {isEditing ? (
                  <input
                    type="text"
                    value={editedData.vendorName || ''}
                    onChange={(e) => handleFieldChange('vendorName', e.target.value)}
                    className="input"
                  />
                ) : (
                  <p className="text-gray-900">{editedData.vendorName || 'N/A'}</p>
                )}
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Address
                </label>
                {isEditing ? (
                  <textarea
                    value={editedData.vendorAddress || ''}
                    onChange={(e) => handleFieldChange('vendorAddress', e.target.value)}
                    className="input"
                    rows={3}
                  />
                ) : (
                  <p className="text-gray-900">{editedData.vendorAddress || 'N/A'}</p>
                )}
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Tax ID
                </label>
                {isEditing ? (
                  <input
                    type="text"
                    value={editedData.vendorTaxId || ''}
                    onChange={(e) => handleFieldChange('vendorTaxId', e.target.value)}
                    className="input"
                  />
                ) : (
                  <p className="text-gray-900">{editedData.vendorTaxId || 'N/A'}</p>
                )}
              </div>
            </div>
          </div>

          {/* Totals */}
          <div className="card">
            <div className="card-header">
              <h3 className="card-title flex items-center">
                <DollarSign className="h-5 w-5 mr-2" />
                Totals
              </h3>
            </div>
            <div className="card-content space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Subtotal
                </label>
                {isEditing ? (
                  <input
                    type="number"
                    step="0.01"
                    value={editedData.subtotal || 0}
                    onChange={(e) => handleFieldChange('subtotal', parseFloat(e.target.value) || 0)}
                    className="input"
                  />
                ) : (
                  <p className="text-gray-900">{formatCurrency(editedData.subtotal)}</p>
                )}
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Tax Total
                </label>
                {isEditing ? (
                  <input
                    type="number"
                    step="0.01"
                    value={editedData.taxTotal || 0}
                    onChange={(e) => handleFieldChange('taxTotal', parseFloat(e.target.value) || 0)}
                    className="input"
                  />
                ) : (
                  <p className="text-gray-900">{formatCurrency(editedData.taxTotal)}</p>
                )}
              </div>
              <div className="border-t pt-4">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Total Amount
                </label>
                {isEditing ? (
                  <input
                    type="number"
                    step="0.01"
                    value={editedData.totalAmount || 0}
                    onChange={(e) => handleFieldChange('totalAmount', parseFloat(e.target.value) || 0)}
                    className="input text-lg font-bold"
                  />
                ) : (
                  <p className="text-gray-900 text-lg font-bold">
                    {formatCurrency(editedData.totalAmount)}
                  </p>
                )}
              </div>
            </div>
          </div>

          {/* Metadata */}
          <div className="card">
            <div className="card-header">
              <h3 className="card-title">Processing Information</h3>
            </div>
            <div className="card-content space-y-3">
              <div className="flex items-center justify-between text-sm">
                <span className="text-gray-600">Processing Time:</span>
                <span className="font-medium">{invoice.processingTime}ms</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-gray-600">Language Detected:</span>
                <span className="font-medium">{invoice.languageDetected}</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-gray-600">File Size:</span>
                <span className="font-medium">{(invoice.fileSize / 1024).toFixed(2)} KB</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-gray-600">Created:</span>
                <span className="font-medium">
                  {format(new Date(invoice.createdAt), 'MMM dd, yyyy HH:mm')}
                </span>
              </div>
              {invoice.isEdited && (
                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-600">Last Edited:</span>
                  <span className="font-medium">
                    {format(new Date(invoice.editedAt), 'MMM dd, yyyy HH:mm')}
                  </span>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default InvoiceDetail;
