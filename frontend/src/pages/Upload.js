import React, { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useDropzone } from 'react-dropzone';
import { invoiceAPI } from '../services/api';
import { usePageTitle } from '../hooks/usePageTitle';
import { getApiErrorMessage } from '../utils/parseApiError';
import toast from 'react-hot-toast';
import {
  Upload,
  Image as ImageIcon,
  Loader2,
  CheckCircle2,
  X,
  FileImage,
} from 'lucide-react';
import { cn } from '../utils/cn';

const ACCEPT = {
  'image/jpeg': ['.jpg', '.jpeg'],
  'image/png': ['.png'],
  'image/gif': ['.gif'],
  'image/webp': ['.webp'],
};

const UploadPage = () => {
  usePageTitle('Upload');
  const [file, setFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(null);

  useEffect(() => {
    if (!file) {
      setPreviewUrl(null);
      return undefined;
    }
    const url = URL.createObjectURL(file);
    setPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  const onDrop = useCallback((acceptedFiles) => {
    const next = acceptedFiles[0];
    if (!next) return;
    setError('');
    setSuccess(null);
    setFile(next);
  }, []);

  const onDropRejected = useCallback(() => {
    toast.error('Please choose an image (JPEG, PNG, GIF, or WebP).');
  }, []);

  const { getRootProps, getInputProps, isDragActive, open } = useDropzone({
    onDrop,
    onDropRejected,
    accept: ACCEPT,
    maxFiles: 1,
    multiple: false,
    disabled: isProcessing,
    noClick: true,
    noKeyboard: true,
  });

  const clearFile = () => {
    if (isProcessing) return;
    setFile(null);
    setPreviewUrl(null);
    setError('');
  };

  const handleUpload = async () => {
    if (!file || isProcessing) return;
    setError('');
    setSuccess(null);
    setIsProcessing(true);

    try {
      const formData = new FormData();
      formData.append('invoice', file);

      const response = await invoiceAPI.upload(formData);
      const invoice = response?.invoice;

      setSuccess({
        message: response?.message || 'Invoice processed successfully.',
        invoiceId: invoice?.id || invoice?._id,
        fileName: file.name,
      });
      setFile(null);
      setPreviewUrl(null);
      toast.success('Invoice uploaded successfully');
    } catch (err) {
      const msg = getApiErrorMessage(err);
      setError(msg);
      toast.error(msg);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleUploadAnother = () => {
    setSuccess(null);
    setError('');
  };

  return (
    <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="mb-8">
        <h1 className="text-2xl font-bold tracking-tight text-gray-900">
          Upload invoice
        </h1>
        <p className="mt-1 text-sm text-gray-600">
          Add a clear photo or scan of your invoice. Images only — we&apos;ll extract the
          details for you.
        </p>
      </div>

      <div className="rounded-2xl border border-gray-100 bg-white p-6 shadow-md sm:p-8">
        {success ? (
          <div className="text-center">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-emerald-100">
              <CheckCircle2 className="h-8 w-8 text-emerald-600" aria-hidden />
            </div>
            <h2 className="mt-4 text-lg font-semibold text-gray-900">
              {success.message}
            </h2>
            <p className="mt-2 text-sm text-gray-600">
              {success.fileName ? (
                <>
                  <span className="font-medium text-gray-800">{success.fileName}</span>
                  {' · '}
                </>
              ) : null}
              Your invoice has been saved and processed.
            </p>
            <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
              {success.invoiceId ? (
                <Link
                  to={`/invoice/${success.invoiceId}`}
                  className="inline-flex w-full items-center justify-center rounded-xl bg-indigo-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-700 sm:w-auto"
                >
                  View invoice
                </Link>
              ) : null}
              <Link
                to="/invoices"
                className="inline-flex w-full items-center justify-center rounded-xl border border-gray-200 bg-white px-5 py-2.5 text-sm font-semibold text-gray-800 shadow-sm transition hover:border-indigo-200 hover:bg-indigo-50/40 sm:w-auto"
              >
                All invoices
              </Link>
              <button
                type="button"
                onClick={handleUploadAnother}
                className="inline-flex w-full items-center justify-center rounded-xl border border-transparent px-5 py-2.5 text-sm font-semibold text-indigo-600 hover:bg-indigo-50 sm:w-auto"
              >
                Upload another
              </button>
            </div>
          </div>
        ) : (
          <>
            <div
              {...getRootProps({
                className: cn(
                  'relative rounded-2xl border-2 border-dashed transition-colors',
                  isDragActive
                    ? 'border-indigo-500 bg-indigo-50/60'
                    : 'border-gray-200 bg-gray-50/50 hover:border-indigo-300 hover:bg-indigo-50/30',
                  isProcessing && 'pointer-events-none opacity-60'
                ),
              })}
            >
              <input {...getInputProps()} />

              <div className="flex flex-col items-center justify-center px-6 py-14 text-center">
                {isProcessing ? (
                  <div className="flex flex-col items-center gap-4">
                    <Loader2
                      className="h-12 w-12 animate-spin text-indigo-600"
                      aria-hidden
                    />
                    <div>
                      <p className="text-sm font-semibold text-gray-900">
                        Processing your invoice…
                      </p>
                      <p className="mt-1 text-xs text-gray-500">
                        OCR and validation can take a moment.
                      </p>
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-white shadow-sm ring-1 ring-gray-100">
                      <Upload className="h-7 w-7 text-indigo-600" aria-hidden />
                    </div>
                    <p className="mt-4 text-sm font-medium text-gray-900">
                      {isDragActive ? 'Drop your image here' : 'Drag & drop an invoice image'}
                    </p>
                    <p className="mt-1 max-w-sm text-xs text-gray-500">
                      JPEG, PNG, GIF, or WebP — one file at a time
                    </p>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        open();
                      }}
                      className="mt-6 rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-700"
                    >
                      Choose image
                    </button>
                  </>
                )}
              </div>
            </div>

            {previewUrl && file && !isProcessing ? (
              <div className="mt-8">
                <div className="mb-3 flex items-center justify-between">
                  <h2 className="text-sm font-semibold text-gray-900">Preview</h2>
                  <button
                    type="button"
                    onClick={clearFile}
                    className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-medium text-gray-600 hover:bg-gray-100"
                  >
                    <X className="h-3.5 w-3.5" />
                    Remove
                  </button>
                </div>
                <div className="overflow-hidden rounded-2xl border border-gray-100 bg-gray-50">
                  <img
                    src={previewUrl}
                    alt={`Preview of ${file.name}`}
                    className="mx-auto max-h-80 w-full object-contain"
                  />
                </div>
                <div className="mt-3 flex items-center gap-2 text-xs text-gray-500">
                  <FileImage className="h-4 w-4 shrink-0" aria-hidden />
                  <span className="truncate font-medium text-gray-700">{file.name}</span>
                  <span className="shrink-0">
                    · {(file.size / 1024).toFixed(1)} KB
                  </span>
                </div>
              </div>
            ) : null}

            {error ? (
              <div
                role="alert"
                className="mt-6 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800"
              >
                {error}
              </div>
            ) : null}

            {file && !isProcessing ? (
              <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:justify-end">
                <button
                  type="button"
                  onClick={clearFile}
                  className="rounded-xl border border-gray-200 bg-white px-5 py-2.5 text-sm font-semibold text-gray-700 shadow-sm hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleUpload}
                  className="rounded-xl bg-indigo-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-indigo-700"
                >
                  Upload &amp; process
                </button>
              </div>
            ) : null}

            {!file && !isProcessing ? (
              <p className="mt-6 flex items-center justify-center gap-2 text-center text-xs text-gray-400">
                <ImageIcon className="h-4 w-4" aria-hidden />
                Tip: use good lighting and keep the full receipt in frame.
              </p>
            ) : null}
          </>
        )}
      </div>
    </div>
  );
};

export default UploadPage;
