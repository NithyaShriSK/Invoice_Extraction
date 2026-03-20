import React, { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { invoiceAPI } from '../services/api';
import toast from 'react-hot-toast';
import {
  Upload,
  History,
  Camera,
  FileText,
  CheckCircle,
  AlertCircle,
  Clock,
  Edit3,
  Save,
  X,
  Eye,
  EyeOff,
  Loader2
} from 'lucide-react';

const Dashboard = () => {
  const [activeTab, setActiveTab] = useState('upload');
  const [isProcessing, setIsProcessing] = useState(false);
  const [cameraActive, setCameraActive] = useState(false);
  const [capturedImage, setCapturedImage] = useState(null);
  const [uploadedFile, setUploadedFile] = useState(null);
  const [ocrResult, setOcrResult] = useState(null);
  const [editedData, setEditedData] = useState(null);
  const [validatedOutput, setValidatedOutput] = useState(null);
  const [showOriginal, setShowOriginal] = useState(false);
  const [analytics, setAnalytics] = useState(null);
  
  const fileInputRef = useRef(null);
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const streamRef = useRef(null);
  const navigate = useNavigate();

  useEffect(() => {
    fetchAnalytics();
  }, []);

  const fetchAnalytics = async () => {
    try {
      const response = await invoiceAPI.getAnalytics();
      setAnalytics(response.analytics);
    } catch (error) {
      console.error('Failed to fetch analytics:', error);
    }
  };

  const handleFileUpload = (event) => {
    const file = event.target.files[0];
    if (file) {
      setUploadedFile(file);
      setCapturedImage(null);
      setCameraActive(false);
      processFile(file);
    }
  };

  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: { facingMode: 'environment' } 
      });
      videoRef.current.srcObject = stream;
      streamRef.current = stream;
      setCameraActive(true);
    } catch (error) {
      toast.error('Failed to access camera. Please check permissions.');
      console.error('Camera error:', error);
    }
  };

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    setCameraActive(false);
  };

  const capturePhoto = () => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    const context = canvas.getContext('2d');
    
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    context.drawImage(video, 0, 0);
    
    canvas.toBlob((blob) => {
      const file = new File([blob], 'captured-invoice.jpg', { type: 'image/jpeg' });
      setCapturedImage(URL.createObjectURL(blob));
      setUploadedFile(file);
      stopCamera();
      processFile(file);
    }, 'image/jpeg');
  };

  const processFile = async (file) => {
    setIsProcessing(true);
    setOcrResult(null);
    setEditedData(null);
    setValidatedOutput(null);

    try {
      const formData = new FormData();
      formData.append('invoice', file);

      const response = await invoiceAPI.upload(formData);
      setOcrResult(response.invoice);
      setEditedData(response.correctedData || response.invoice.correctedData);
      setValidatedOutput(response.validatedOutput || null);
      setActiveTab('edit');
      toast.success('Invoice processed successfully!');
      fetchAnalytics(); // Refresh analytics
    } catch (error) {
      toast.error(error.message || 'Failed to process invoice');
    } finally {
      setIsProcessing(false);
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
      cgstPercent: 0,
      sgstPercent: 0,
      igstPercent: 0,
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

  const saveInvoice = async () => {
    if (!ocrResult) return;

    try {
      await invoiceAPI.save(ocrResult.id, {
        correctedData: editedData,
        extractedFields: editedData,
      });
      toast.success('Invoice saved successfully!');
      navigate('/history');
    } catch (error) {
      toast.error(error.message || 'Failed to save invoice');
    }
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: editedData?.currency || 'USD',
    }).format(amount || 0);
  };

  const copyExtractedJson = async () => {
    const dataToCopy = validatedOutput || editedData;
    if (!dataToCopy) return;

    try {
      await navigator.clipboard.writeText(JSON.stringify(dataToCopy, null, 2));
      toast.success('Extracted JSON copied to clipboard');
    } catch (error) {
      toast.error('Failed to copy JSON');
    }
  };

  const renderUploadTab = () => (
    <div className="space-y-6">
      <div className="text-center">
        <h2 className="text-2xl font-bold text-gray-900 mb-2">
          Upload Invoice
        </h2>
        <p className="text-gray-600">
          Upload an image or capture a photo of your invoice
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* File Upload */}
        <div className="card">
          <div className="card-header">
            <h3 className="card-title flex items-center">
              <Upload className="h-5 w-5 mr-2" />
              Upload File
            </h3>
          </div>
          <div className="card-content">
            <div
              onClick={() => fileInputRef.current?.click()}
              className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center hover:border-blue-400 transition-colors cursor-pointer"
            >
              <FileText className="mx-auto h-12 w-12 text-gray-400 mb-4" />
              <p className="text-lg font-medium text-gray-900 mb-2">
                Click to upload or drag and drop
              </p>
              <p className="text-sm text-gray-500">
                PNG, JPG, GIF, PDF up to 10MB
              </p>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*,.pdf"
                onChange={handleFileUpload}
                className="hidden"
              />
            </div>
            {uploadedFile && (
              <div className="mt-4 p-3 bg-blue-50 rounded-md">
                <p className="text-sm text-blue-800">
                  Selected: {uploadedFile.name}
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Camera Capture */}
        <div className="card">
          <div className="card-header">
            <h3 className="card-title flex items-center">
              <Camera className="h-5 w-5 mr-2" />
              Camera Capture
            </h3>
          </div>
          <div className="card-content">
            {!cameraActive ? (
              <div
                onClick={startCamera}
                className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center hover:border-blue-400 transition-colors cursor-pointer"
              >
                <Camera className="mx-auto h-12 w-12 text-gray-400 mb-4" />
                <p className="text-lg font-medium text-gray-900 mb-2">
                  Open Camera
                </p>
                <p className="text-sm text-gray-500">
                  Take a photo of your invoice
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="relative">
                  <video
                    ref={videoRef}
                    autoPlay
                    playsInline
                    className="w-full rounded-lg"
                  />
                  <canvas ref={canvasRef} className="hidden" />
                </div>
                <div className="flex space-x-4">
                  <button
                    onClick={capturePhoto}
                    className="flex-1 btn btn-primary"
                  >
                    <Camera className="h-4 w-4 mr-2" />
                    Capture
                  </button>
                  <button
                    onClick={stopCamera}
                    className="flex-1 btn btn-secondary"
                  >
                    <X className="h-4 w-4 mr-2" />
                    Cancel
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {capturedImage && (
        <div className="card">
          <div className="card-header">
            <h3 className="card-title">Captured Image</h3>
          </div>
          <div className="card-content">
            <img
              src={capturedImage}
              alt="Captured invoice"
              className="w-full max-w-md mx-auto rounded-lg"
            />
          </div>
        </div>
      )}

      {isProcessing && (
        <div className="card">
          <div className="card-content">
            <div className="flex items-center justify-center space-x-3">
              <Loader2 className="h-6 w-6 animate-spin text-blue-600" />
              <span className="text-lg font-medium">Processing invoice...</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );

  const renderEditTab = () => {
    if (!ocrResult || !editedData) {
      return (
        <div className="text-center py-12">
          <FileText className="mx-auto h-12 w-12 text-gray-400 mb-4" />
          <p className="text-gray-600">No invoice data to edit</p>
        </div>
      );
    }

    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h2 className="text-2xl font-bold text-gray-900">
            Edit Invoice Details
          </h2>
          <div className="flex items-center space-x-4">
            <button
              onClick={() => setShowOriginal(!showOriginal)}
              className="btn btn-outline btn-sm"
            >
              {showOriginal ? <EyeOff className="h-4 w-4 mr-2" /> : <Eye className="h-4 w-4 mr-2" />}
              {showOriginal ? 'Hide' : 'Show'} Original
            </button>
            <div className="flex items-center space-x-2 text-sm">
              <CheckCircle className="h-4 w-4 text-green-500" />
              <span>Accuracy: {ocrResult.accuracyScore}%</span>
            </div>
          </div>
        </div>

        {showOriginal && (
          <div className="card">
            <div className="card-header">
              <h3 className="card-title">Original OCR Text</h3>
            </div>
            <div className="card-content">
              <pre className="whitespace-pre-wrap text-sm text-gray-600 bg-gray-50 p-4 rounded-md">
                {ocrResult.originalOCR}
              </pre>
            </div>
          </div>
        )}

        <div className="card">
          <div className="card-header">
            <div className="flex items-center justify-between">
              <h3 className="card-title">Extracted JSON Output</h3>
              <button
                onClick={copyExtractedJson}
                className="btn btn-outline btn-sm"
                type="button"
              >
                Copy JSON
              </button>
            </div>
          </div>
          <div className="card-content">
            <pre className="whitespace-pre-wrap text-sm text-gray-700 bg-gray-50 p-4 rounded-md overflow-x-auto">
              {JSON.stringify(validatedOutput || editedData, null, 2)}
            </pre>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Invoice Details */}
          <div className="card">
            <div className="card-header">
              <h3 className="card-title">Invoice Information</h3>
            </div>
            <div className="card-content space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Invoice Number
                </label>
                <input
                  type="text"
                  value={editedData.invoiceNumber || ''}
                  onChange={(e) => handleFieldChange('invoiceNumber', e.target.value)}
                  className="input"
                />
              </div>
              <div className="grid grid-cols-1 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Invoice Date
                  </label>
                  <input
                    type="date"
                    value={editedData.invoiceDate || ''}
                    onChange={(e) => handleFieldChange('invoiceDate', e.target.value)}
                    className="input"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Seller/Buyer Information */}
          <div className="card">
            <div className="card-header">
              <h3 className="card-title">Seller/Buyer Information</h3>
            </div>
            <div className="card-content space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Seller Name
                </label>
                <input
                  type="text"
                  value={editedData.vendorName || ''}
                  onChange={(e) => handleFieldChange('vendorName', e.target.value)}
                  className="input"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Seller GST No
                </label>
                <input
                  type="text"
                  value={editedData.vendorTaxId || ''}
                  onChange={(e) => handleFieldChange('vendorTaxId', e.target.value)}
                  className="input"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Buyer Name
                </label>
                <input
                  type="text"
                  value={editedData.customerName || ''}
                  onChange={(e) => handleFieldChange('customerName', e.target.value)}
                  className="input"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Buyer GST No
                </label>
                <input
                  type="text"
                  value={editedData.customerTaxId || ''}
                  onChange={(e) => handleFieldChange('customerTaxId', e.target.value)}
                  className="input"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Items */}
        <div className="card">
          <div className="card-header">
            <div className="flex items-center justify-between">
              <h3 className="card-title">Line Items</h3>
              <button
                onClick={addItem}
                className="btn btn-outline btn-sm"
              >
                <Edit3 className="h-4 w-4 mr-2" />
                Add Item
              </button>
            </div>
          </div>
          <div className="card-content">
            {editedData.items && editedData.items.length > 0 ? (
              <div className="space-y-4">
                {editedData.items.map((item, index) => (
                  <div key={index} className="border border-gray-200 rounded-lg p-4">
                    <div className="grid grid-cols-1 md:grid-cols-9 gap-4">
                      <div className="md:col-span-2">
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Description
                        </label>
                        <input
                          type="text"
                          value={item.description || ''}
                          onChange={(e) => handleItemChange(index, 'description', e.target.value)}
                          className="input"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Quantity
                        </label>
                        <input
                          type="number"
                          value={item.quantity || 0}
                          onChange={(e) => handleItemChange(index, 'quantity', parseFloat(e.target.value) || 0)}
                          className="input"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Unit Price
                        </label>
                        <input
                          type="number"
                          step="0.01"
                          value={item.unitPrice || 0}
                          onChange={(e) => handleItemChange(index, 'unitPrice', parseFloat(e.target.value) || 0)}
                          className="input"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          CGST %
                        </label>
                        <input
                          type="number"
                          step="0.01"
                          value={item.cgstPercent || 0}
                          onChange={(e) => handleItemChange(index, 'cgstPercent', parseFloat(e.target.value) || 0)}
                          className="input"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          SGST %
                        </label>
                        <input
                          type="number"
                          step="0.01"
                          value={item.sgstPercent || 0}
                          onChange={(e) => handleItemChange(index, 'sgstPercent', parseFloat(e.target.value) || 0)}
                          className="input"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          IGST %
                        </label>
                        <input
                          type="number"
                          step="0.01"
                          value={item.igstPercent || 0}
                          onChange={(e) => handleItemChange(index, 'igstPercent', parseFloat(e.target.value) || 0)}
                          className="input"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Amount
                        </label>
                        <input
                          type="number"
                          step="0.01"
                          value={item.totalPrice || 0}
                          onChange={(e) => handleItemChange(index, 'totalPrice', parseFloat(e.target.value) || 0)}
                          className="input"
                        />
                      </div>
                      <div className="flex items-end">
                        <button
                          onClick={() => removeItem(index)}
                          className="btn btn-outline btn-sm text-red-600 hover:text-red-700"
                        >
                          <X className="h-4 w-4" />
                        </button>
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

        {/* Totals */}
        <div className="card">
          <div className="card-header">
            <h3 className="card-title">Totals</h3>
          </div>
          <div className="card-content">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Subtotal
                </label>
                <input
                  type="number"
                  step="0.01"
                  value={editedData.subtotal || 0}
                  onChange={(e) => handleFieldChange('subtotal', parseFloat(e.target.value) || 0)}
                  className="input"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Tax Total
                </label>
                <input
                  type="number"
                  step="0.01"
                  value={editedData.taxTotal || 0}
                  onChange={(e) => handleFieldChange('taxTotal', parseFloat(e.target.value) || 0)}
                  className="input"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Total Amount
                </label>
                <input
                  type="number"
                  step="0.01"
                  value={editedData.totalAmount || 0}
                  onChange={(e) => handleFieldChange('totalAmount', parseFloat(e.target.value) || 0)}
                  className="input"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Notes */}
        <div className="card">
          <div className="card-header">
            <h3 className="card-title">Notes</h3>
          </div>
          <div className="card-content">
            <textarea
              value={editedData.notes || ''}
              onChange={(e) => handleFieldChange('notes', e.target.value)}
              className="input"
              rows={4}
              placeholder="Additional notes..."
            />
          </div>
        </div>

        {/* Actions */}
        <div className="flex justify-end space-x-4">
          <button
            onClick={() => setActiveTab('upload')}
            className="btn btn-secondary"
          >
            Back to Upload
          </button>
          <button
            onClick={saveInvoice}
            className="btn btn-primary"
          >
            <Save className="h-4 w-4 mr-2" />
            Save Invoice
          </button>
        </div>
      </div>
    );
  };

  const renderAnalyticsTab = () => {
    if (!analytics) {
      return (
        <div className="text-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading analytics...</p>
        </div>
      );
    }

    return (
      <div className="space-y-6">
        <h2 className="text-2xl font-bold text-gray-900">Your Analytics</h2>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <div className="card">
            <div className="card-content">
              <div className="flex items-center">
                <div className="flex-shrink-0 bg-blue-100 rounded-md p-3">
                  <FileText className="h-6 w-6 text-blue-600" />
                </div>
                <div className="ml-5 w-0 flex-1">
                  <dl>
                    <dt className="text-sm font-medium text-gray-500 truncate">
                      Total Invoices
                    </dt>
                    <dd className="text-lg font-medium text-gray-900">
                      {analytics.totalInvoices || 0}
                    </dd>
                  </dl>
                </div>
              </div>
            </div>
          </div>

          <div className="card">
            <div className="card-content">
              <div className="flex items-center">
                <div className="flex-shrink-0 bg-green-100 rounded-md p-3">
                  <CheckCircle className="h-6 w-6 text-green-600" />
                </div>
                <div className="ml-5 w-0 flex-1">
                  <dl>
                    <dt className="text-sm font-medium text-gray-500 truncate">
                      Average Accuracy
                    </dt>
                    <dd className="text-lg font-medium text-gray-900">
                      {analytics.averageAccuracy || 0}%
                    </dd>
                  </dl>
                </div>
              </div>
            </div>
          </div>

          <div className="card">
            <div className="card-content">
              <div className="flex items-center">
                <div className="flex-shrink-0 bg-yellow-100 rounded-md p-3">
                  <Clock className="h-6 w-6 text-yellow-600" />
                </div>
                <div className="ml-5 w-0 flex-1">
                  <dl>
                    <dt className="text-sm font-medium text-gray-500 truncate">
                      Avg Processing Time
                    </dt>
                    <dd className="text-lg font-medium text-gray-900">
                      {analytics.averageProcessingTime || 0}ms
                    </dd>
                  </dl>
                </div>
              </div>
            </div>
          </div>

          <div className="card">
            <div className="card-content">
              <div className="flex items-center">
                <div className="flex-shrink-0 bg-purple-100 rounded-md p-3">
                  <AlertCircle className="h-6 w-6 text-purple-600" />
                </div>
                <div className="ml-5 w-0 flex-1">
                  <dl>
                    <dt className="text-sm font-medium text-gray-500 truncate">
                      Unique Vendors
                    </dt>
                    <dd className="text-lg font-medium text-gray-900">
                      {analytics.uniqueVendorsCount || 0}
                    </dd>
                  </dl>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="card">
            <div className="card-header">
              <h3 className="card-title">Total Spending</h3>
            </div>
            <div className="card-content">
              <p className="text-3xl font-bold text-gray-900">
                {formatCurrency(analytics.totalAmount)}
              </p>
              <p className="text-sm text-gray-500 mt-2">
                Across all invoices
              </p>
            </div>
          </div>

          <div className="card">
            <div className="card-header">
              <h3 className="card-title">Quick Actions</h3>
            </div>
            <div className="card-content space-y-3">
              <button
                onClick={() => setActiveTab('upload')}
                className="w-full btn btn-primary"
              >
                <Upload className="h-4 w-4 mr-2" />
                Upload New Invoice
              </button>
              <button
                onClick={() => navigate('/history')}
                className="w-full btn btn-secondary"
              >
                <History className="h-4 w-4 mr-2" />
                View All Invoices
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
      {/* Tabs */}
      <div className="border-b border-gray-200 mb-6">
        <nav className="-mb-px flex space-x-8">
          <button
            onClick={() => setActiveTab('upload')}
            className={`${
              activeTab === 'upload'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            } whitespace-nowrap py-2 px-1 border-b-2 font-medium text-sm transition-colors duration-150`}
          >
            <Upload className="h-4 w-4 inline mr-2" />
            Upload
          </button>
          <button
            onClick={() => setActiveTab('edit')}
            className={`${
              activeTab === 'edit'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            } whitespace-nowrap py-2 px-1 border-b-2 font-medium text-sm transition-colors duration-150`}
            disabled={!ocrResult}
          >
            <Edit3 className="h-4 w-4 inline mr-2" />
            Edit
          </button>
          <button
            onClick={() => setActiveTab('analytics')}
            className={`${
              activeTab === 'analytics'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            } whitespace-nowrap py-2 px-1 border-b-2 font-medium text-sm transition-colors duration-150`}
          >
            <AlertCircle className="h-4 w-4 inline mr-2" />
            Analytics
          </button>
        </nav>
      </div>

      {/* Tab Content */}
      {activeTab === 'upload' && renderUploadTab()}
      {activeTab === 'edit' && renderEditTab()}
      {activeTab === 'analytics' && renderAnalyticsTab()}
    </div>
  );
};

export default Dashboard;
