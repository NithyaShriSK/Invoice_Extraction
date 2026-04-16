import React, { useState, useRef } from 'react';
import { uploadService } from '../../services/api';
import { Button, Loading, ErrorAlert, SuccessAlert } from '../common/Common';

export const CameraCapture = ({ onCaptureSuccess }) => {
  const [loading, setLoading] = useState(false);
  const [cameraActive, setCameraActive] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const videoRef = useRef(null);
  const canvasRef = useRef(null);

  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment' }
      });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        setCameraActive(true);
      }
    } catch (err) {
      setError('Could not access camera');
    }
  };

  const capturePhoto = async () => {
    if (!videoRef.current || !canvasRef.current) return;

    const context = canvasRef.current.getContext('2d');
    canvasRef.current.width = videoRef.current.videoWidth;
    canvasRef.current.height = videoRef.current.videoHeight;
    context.drawImage(videoRef.current, 0, 0);

    setLoading(true);
    try {
      const imageBase64 = canvasRef.current.toDataURL('image/png').split(',')[1];
      const response = await uploadService.uploadFromCamera(imageBase64);
      setSuccess('Photo captured and processed successfully!');
      setCameraActive(false);
      onCaptureSuccess(response.data);
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      setError(err.response?.data?.detail || 'Capture failed');
      setTimeout(() => setError(''), 3000);
    } finally {
      setLoading(false);
    }
  };

  const stopCamera = () => {
    if (videoRef.current && videoRef.current.srcObject) {
      videoRef.current.srcObject.getTracks().forEach(track => track.stop());
    }
    setCameraActive(false);
  };

  if (loading) return <Loading />;

  return (
    <div className="space-y-4">
      {!cameraActive ? (
        <Button onClick={startCamera} className="w-full">
          📷 Start Camera
        </Button>
      ) : (
        <>
          <video
            ref={videoRef}
            autoPlay
            playsInline
            className="w-full rounded-lg bg-black"
          />
          <canvas ref={canvasRef} className="hidden" />
          <div className="flex gap-2">
            <Button onClick={capturePhoto} className="flex-1">
              📸 Capture
            </Button>
            <Button onClick={stopCamera} className="flex-1 bg-red-600 hover:bg-red-700">
              ❌ Cancel
            </Button>
          </div>
        </>
      )}
      
      {error && <ErrorAlert message={error} onClose={() => setError('')} />}
      {success && <SuccessAlert message={success} onClose={() => setSuccess('')} />}
    </div>
  );
};
