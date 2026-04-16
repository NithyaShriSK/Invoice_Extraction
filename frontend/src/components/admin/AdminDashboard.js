import React, { useState, useEffect } from 'react';
import { adminService } from '../../services/api';
import { Card, Loading, Button, ErrorAlert } from '../common/Common';

export const AdminDashboard = () => {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    fetchStats();
  }, []);

  const fetchStats = async () => {
    try {
      const response = await adminService.getDashboardStats();
      setStats(response.data);
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to fetch stats');
    } finally {
      setLoading(false);
    }
  };

  if (loading) return <Loading />;

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold">📊 Admin Dashboard</h1>

      {error && <ErrorAlert message={error} onClose={() => setError('')} />}

      {stats && (
        <>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card className="border-l-4 border-blue-500">
              <div className="text-gray-600 text-sm font-semibold">Total Users</div>
              <div className="text-3xl font-bold">{stats.stats.total_users}</div>
            </Card>
            <Card className="border-l-4 border-green-500">
              <div className="text-gray-600 text-sm font-semibold">Total Uploads</div>
              <div className="text-3xl font-bold">{stats.stats.total_uploads}</div>
            </Card>
            <Card className="border-l-4 border-purple-500">
              <div className="text-gray-600 text-sm font-semibold">Total Results</div>
              <div className="text-3xl font-bold">{stats.stats.total_results}</div>
            </Card>
          </div>

          <Card>
            <h3 className="text-lg font-semibold mb-4">📁 Recent Uploads</h3>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-100">
                  <tr>
                    <th className="text-left p-2">Filename</th>
                    <th className="text-left p-2">User</th>
                    <th className="text-left p-2">Date</th>
                    <th className="text-left p-2">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {stats.recent_uploads.map((upload) => (
                    <tr key={upload._id} className="border-t hover:bg-gray-50">
                      <td className="p-2">{upload.filename}</td>
                      <td className="p-2">{upload.user_email}</td>
                      <td className="p-2 text-xs text-gray-600">
                        {new Date(upload.created_at).toLocaleDateString()}
                      </td>
                      <td className="p-2">
                        <span className={`px-2 py-1 rounded text-xs font-semibold ${
                          upload.has_result ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'
                        }`}>
                          {upload.has_result ? '✓ Processed' : '⏳ Pending'}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </>
      )}
    </div>
  );
};
