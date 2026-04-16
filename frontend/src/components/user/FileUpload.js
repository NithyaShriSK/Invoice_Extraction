import React, { useState } from 'react';
import { uploadService } from '../../services/api';
import { Button, Loading, ErrorAlert, SuccessAlert } from '../common/Common';

export const FileUpload = ({ onUploadSuccess }) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const handleFileChange = async (event) => {
    const file = event.target.files[0];
    if (!file) return;

    // Validate file size (max 10MB)
    if (file.size > 10 * 1024 * 1024) {
      setError('File size must be less than 10MB');
      return;
    }

    setLoading(true);
    try {
      const response = await uploadService.uploadFile(file);
      setSuccess('File uploaded and processed successfully!');
      onUploadSuccess(response.data);
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      setError(err.response?.data?.detail || 'Upload failed');
      setTimeout(() => setError(''), 3000);
    } finally {
      setLoading(false);
    }
  };

  if (loading) return <Loading />;

  return (
    <div className="space-y-4">
      <div className="border-2 border-dashed border-primary rounded-lg p-8 text-center cursor-pointer hover:bg-blue-50">
        <label className="cursor-pointer">
          <input
            type="file"
            accept="image/*"
            onChange={handleFileChange}
            className="hidden"
          />
          <div className="text-center">
            <p className="text-2xl mb-2">📤</p>
            <p className="text-lg font-semibold">Click to upload image</p>
            <p className="text-gray-500 text-sm">or drag and drop</p>
            <p className="text-gray-400 text-xs mt-2">JPG, PNG, GIF, TIFF (max 10MB)</p>
          </div>
        </label>
      </div>
      
      {error && <ErrorAlert message={error} onClose={() => setError('')} />}
      {success && <SuccessAlert message={success} onClose={() => setSuccess('')} />}
    </div>
  );
};
