import React, { useState } from 'react';
import { FileUpload } from '../components/user/FileUpload';
import { CameraCapture } from '../components/user/CameraCapture';
import { ResultDisplay } from '../components/user/ResultDisplay';
import { Card, Button } from '../components/common/Common';

export const DashboardPage = () => {
  const [activeTab, setActiveTab] = useState('upload');
  const [lastResult, setLastResult] = useState(null);

  const handleUploadSuccess = (data) => {
    setLastResult(data?.data || data);
    setActiveTab('result');
  };

  return (
    <div className="max-w-4xl mx-auto p-6">
      <h1 className="text-3xl font-bold mb-6">🎯 Invoice OCR Dashboard</h1>
      
      <div className="flex gap-2 mb-6 border-b">
        <Button
          onClick={() => setActiveTab('upload')}
          className={`px-4 py-2 rounded-t ${activeTab === 'upload' ? 'bg-primary text-white' : 'bg-gray-200'}`}
        >
          📤 Upload File
        </Button>
        <Button
          onClick={() => setActiveTab('camera')}
          className={`px-4 py-2 rounded-t ${activeTab === 'camera' ? 'bg-primary text-white' : 'bg-gray-200'}`}
        >
          📷 Camera
        </Button>
        {lastResult && (
          <Button
            onClick={() => setActiveTab('result')}
            className={`px-4 py-2 rounded-t ${activeTab === 'result' ? 'bg-primary text-white' : 'bg-gray-200'}`}
          >
            📋 Results
          </Button>
        )}
      </div>
      
      <div className="tab-content">
        {activeTab === 'upload' && (
          <Card>
            <FileUpload onUploadSuccess={handleUploadSuccess} />
          </Card>
        )}
        
        {activeTab === 'camera' && (
          <Card>
            <CameraCapture onCaptureSuccess={handleUploadSuccess} />
          </Card>
        )}
        
        {activeTab === 'result' && lastResult && (
          <ResultDisplay result={lastResult} />
        )}
      </div>
    </div>
  );
};
