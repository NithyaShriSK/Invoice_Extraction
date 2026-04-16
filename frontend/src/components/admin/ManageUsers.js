import React, { useState, useEffect } from 'react';
import { adminService } from '../../services/api';
import { Card, Loading, Button, ErrorAlert, SuccessAlert } from '../common/Common';

export const ManageUsers = () => {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [pagination, setPagination] = useState({ skip: 0, limit: 10 });

  useEffect(() => {
    fetchUsers();
  }, [pagination]);

  const fetchUsers = async () => {
    try {
      const response = await adminService.getAllUsers(pagination.skip, pagination.limit);
      setUsers(response.data.users);
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to fetch users');
    } finally {
      setLoading(false);
    }
  };

  const toggleAdmin = async (userId) => {
    try {
      await adminService.toggleAdminStatus(userId);
      setSuccess('User admin status updated!');
      fetchUsers();
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to update user');
      setTimeout(() => setError(''), 3000);
    }
  };

  if (loading) return <Loading />;

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold">👥 Manage Users</h2>

      {error && <ErrorAlert message={error} onClose={() => setError('')} />}
      {success && <SuccessAlert message={success} onClose={() => setSuccess('')} />}

      <Card>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-100">
              <tr>
                <th className="text-left p-3">Email</th>
                <th className="text-left p-3">Name</th>
                <th className="text-left p-3">Uploads</th>
                <th className="text-left p-3">Admin</th>
                <th className="text-left p-3">Actions</th>
              </tr>
            </thead>
            <tbody>
              {users.map((user) => (
                <tr key={user._id} className="border-t hover:bg-gray-50">
                  <td className="p-3">{user.email}</td>
                  <td className="p-3">{user.full_name}</td>
                  <td className="p-3">{user.upload_count}</td>
                  <td className="p-3">
                    <span className={`px-2 py-1 rounded text-xs font-semibold ${
                      user.is_admin ? 'bg-purple-100 text-purple-800' : 'bg-gray-100 text-gray-800'
                    }`}>
                      {user.is_admin ? '✓ Admin' : 'User'}
                    </span>
                  </td>
                  <td className="p-3">
                    <Button
                      onClick={() => toggleAdmin(user._id)}
                      className="text-xs py-1 px-2"
                    >
                      {user.is_admin ? 'Revoke' : 'Grant'}
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
};
