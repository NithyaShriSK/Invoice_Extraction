import React, { useState } from 'react';
import { resultService } from '../../services/api';
import { Button, Card, ErrorAlert, SuccessAlert } from '../common/Common';

export const ResultDisplay = ({ result, onUpdate }) => {
  const [isEditing, setIsEditing] = useState(false);
  const normalizedResult = result?.result
    ? result.result
    : (result?.data ? { ...result, ...result.data } : result);
  const initialCorrectedJson = normalizedResult?.corrected_json || normalizedResult?.raw_json || {};
  const [correctedData, setCorrectedData] = useState(initialCorrectedJson);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);

  const isObject = (value) => value && typeof value === 'object' && !Array.isArray(value);

  const updateRootField = (key, value) => {
    setCorrectedData((prev) => ({ ...prev, [key]: value }));
  };

  const updateProductField = (index, key, value) => {
    setCorrectedData((prev) => {
      const products = Array.isArray(prev?.Products) ? [...prev.Products] : [];
      const current = isObject(products[index]) ? { ...products[index] } : {};
      current[key] = value;
      products[index] = current;
      return { ...prev, Products: products };
    });
  };

  const handleSave = async () => {
    setLoading(true);
    try {
      const resultId = normalizedResult?._id || normalizedResult?.result_id;
      if (!resultId) {
        throw new Error('Result ID not found');
      }
      await resultService.updateCorrectedText(resultId, JSON.stringify(correctedData, null, 2));
      setSuccess('Result updated successfully!');
      setIsEditing(false);
      if (onUpdate) {
        onUpdate(correctedData);
      }
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to update');
      setTimeout(() => setError(''), 3000);
    } finally {
      setLoading(false);
    }
  };

  const handleDownload = () => {
    const correctedJson = correctedData || {};
    const dataStr = JSON.stringify(correctedJson, null, 2);
    const dataBlob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(dataBlob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `corrected_${new Date().getTime()}.json`;
    link.click();
  };

  if (!result) {
    return <Card>No result available</Card>;
  }

  const displayResult = normalizedResult || result;
  const dataToShow = correctedData || displayResult?.corrected_json || displayResult?.raw_json || {};
  const rootEntries = Object.entries(dataToShow).filter(([key, value]) => key !== 'Products' && !isObject(value));
  const nestedObjectEntries = Object.entries(dataToShow).filter(([key, value]) => key !== 'Products' && isObject(value));
  const products = Array.isArray(dataToShow?.Products) ? dataToShow.Products : [];

  return (
    <div className="space-y-4">
      {displayResult.correction_success === false && displayResult.correction_error && (
        <Card>
          <h3 className="text-lg font-semibold mb-2">Warning</h3>
          <p className="text-sm text-red-700">
            LLM correction failed: {displayResult.correction_error}
          </p>
          <p className="text-xs text-gray-600 mt-1">
            The corrected text panel is showing fallback text because the correction model is unreachable.
          </p>
        </Card>
      )}

      <Card>
        <div className="flex justify-between items-center mb-3">
          <h3 className="text-lg font-semibold">📄 Corrected JSON</h3>
          <Button
            onClick={() => setIsEditing(!isEditing)}
            className="bg-accent hover:bg-opacity-80"
            disabled={loading}
          >
            {isEditing ? '❌ Cancel' : '🔧 Edit'}
          </Button>
        </div>
        
        {isEditing ? (
          <>
            <div className="space-y-4">
              {rootEntries.map(([key, value]) => (
                <div key={key}>
                  <label className="block text-sm font-medium text-gray-700 mb-1">{key}</label>
                  <input
                    type="text"
                    value={value ?? ''}
                    onChange={(e) => updateRootField(key, e.target.value)}
                    className="w-full p-2 border rounded focus:outline-none focus:ring-2 focus:ring-primary"
                  />
                </div>
              ))}

              {products.length > 0 && (
                <div>
                  <h4 className="font-semibold mb-2">Products</h4>
                  <div className="space-y-3">
                    {products.map((product, index) => {
                      const fields = isObject(product) ? Object.entries(product) : [];
                      return (
                        <div key={index} className="border rounded p-3">
                          <p className="font-medium mb-2">Product {index + 1}</p>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                            {fields.map(([fieldKey, fieldValue]) => (
                              <div key={fieldKey}>
                                <label className="block text-xs text-gray-600 mb-1">{fieldKey}</label>
                                <input
                                  type="text"
                                  value={fieldValue ?? ''}
                                  onChange={(e) => updateProductField(index, fieldKey, e.target.value)}
                                  className="w-full p-2 border rounded focus:outline-none focus:ring-2 focus:ring-primary"
                                />
                              </div>
                            ))}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {nestedObjectEntries.length > 0 && (
                <div>
                  <h4 className="font-semibold mb-2">Other Sections</h4>
                  <pre className="bg-gray-100 p-3 rounded max-h-56 overflow-y-auto text-xs">
                    {JSON.stringify(Object.fromEntries(nestedObjectEntries), null, 2)}
                  </pre>
                </div>
              )}
            </div>
            <div className="mt-3 flex gap-2">
              <Button onClick={handleSave} disabled={loading}>
                💾 Save Changes
              </Button>
            </div>
          </>
        ) : (
          <div className="space-y-2">
            {rootEntries.map(([key, value]) => (
              <div key={key} className="flex gap-2 text-sm">
                <span className="font-semibold min-w-[180px]">{key}:</span>
                <span>{String(value ?? '')}</span>
              </div>
            ))}

            {products.length > 0 && (
              <div className="mt-3">
                <h4 className="font-semibold mb-2">Products</h4>
                <div className="space-y-2">
                  {products.map((product, index) => (
                    <div key={index} className="border rounded p-2 text-sm bg-gray-50">
                      <p className="font-medium mb-1">Product {index + 1}</p>
                      {isObject(product) ? Object.entries(product).map(([k, v]) => (
                        <div key={k} className="flex gap-2">
                          <span className="font-semibold min-w-[140px]">{k}:</span>
                          <span>{String(v ?? '')}</span>
                        </div>
                      )) : <span>{String(product)}</span>}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {rootEntries.length === 0 && products.length === 0 && (
              <p className="text-sm text-gray-600">No corrected JSON returned.</p>
            )}
          </div>
        )}
      </Card>

      <div className="flex gap-2">
        <Button onClick={handleDownload} className="flex-1 bg-green-600 hover:bg-green-700">
          ⬇️ Download Result
        </Button>
      </div>

      {error && <ErrorAlert message={error} onClose={() => setError('')} />}
      {success && <SuccessAlert message={success} onClose={() => setSuccess('')} />}
    </div>
  );
};
