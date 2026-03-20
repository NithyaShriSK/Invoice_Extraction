import React, { useState, useEffect } from 'react';
import { adminAPI } from '../services/api';
import toast from 'react-hot-toast';
import {
  Users,
  FileText,
  TrendingUp,
  Activity,
  BarChart3,
  PieChart,
  LineChart,
  Calendar,
  DollarSign,
  Clock,
  CheckCircle,
  AlertTriangle,
  Search,
  Filter,
  ChevronLeft,
  ChevronRight,
  Shield,
  UserCheck,
  UserX,
  RefreshCw
} from 'lucide-react';
import {
  LineChart as RechartsLineChart,
  Line,
  BarChart as RechartsBarChart,
  Bar,
  PieChart as RechartsPieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  Area,
  AreaChart
} from 'recharts';
import { format } from 'date-fns';

const AdminDashboard = () => {
  const [analytics, setAnalytics] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('overview');
  const [users, setUsers] = useState([]);
  const [invoices, setInvoices] = useState([]);
  const [systemHealth, setSystemHealth] = useState(null);
  
  // Pagination and filters
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [searchTerm, setSearchTerm] = useState('');
  const [filters, setFilters] = useState({
    status: '',
    dateRange: ''
  });

  useEffect(() => {
    fetchAnalytics();
    fetchSystemHealth();
  }, []);

  useEffect(() => {
    if (activeTab === 'users') {
      fetchUsers();
    } else if (activeTab === 'invoices') {
      fetchInvoices();
    }
  }, [activeTab, currentPage, searchTerm, filters]);

  const fetchAnalytics = async () => {
    try {
      setLoading(true);
      const response = await adminAPI.getAnalytics();
      setAnalytics(response.analytics);
    } catch (error) {
      toast.error(error.message || 'Failed to fetch analytics');
    } finally {
      setLoading(false);
    }
  };

  const fetchUsers = async () => {
    try {
      const params = {
        page: currentPage,
        limit: 10,
        search: searchTerm
      };
      const response = await adminAPI.getUsers(params);
      setUsers(response.users);
      setTotalPages(response.pagination.pages);
    } catch (error) {
      toast.error(error.message || 'Failed to fetch users');
    }
  };

  const fetchInvoices = async () => {
    try {
      const params = {
        page: currentPage,
        limit: 10,
        search: searchTerm,
        ...filters
      };
      const response = await adminAPI.getInvoices(params);
      setInvoices(response.invoices);
      setTotalPages(response.pagination.pages);
    } catch (error) {
      toast.error(error.message || 'Failed to fetch invoices');
    }
  };

  const fetchSystemHealth = async () => {
    try {
      const response = await adminAPI.getSystemHealth();
      setSystemHealth(response.health);
    } catch (error) {
      console.error('Failed to fetch system health:', error);
    }
  };

  const handleUserStatusToggle = async (userId, isActive) => {
    try {
      await adminAPI.updateUserStatus(userId, { isActive: !isActive });
      toast.success(`User ${!isActive ? 'activated' : 'deactivated'} successfully`);
      fetchUsers();
    } catch (error) {
      toast.error(error.message || 'Failed to update user status');
    }
  };

  const handleUserRoleToggle = async (userId, currentRole) => {
    const newRole = currentRole === 'admin' ? 'user' : 'admin';
    try {
      await adminAPI.updateUserRole(userId, { role: newRole });
      toast.success(`User role updated to ${newRole} successfully`);
      fetchUsers();
    } catch (error) {
      toast.error(error.message || 'Failed to update user role');
    }
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(amount || 0);
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'healthy': return 'text-green-600 bg-green-100';
      case 'warning': return 'text-yellow-600 bg-yellow-100';
      case 'critical': return 'text-red-600 bg-red-100';
      default: return 'text-gray-600 bg-gray-100';
    }
  };

  const getAccuracyColor = (accuracy) => {
    if (accuracy >= 90) return '#10b981';
    if (accuracy >= 70) return '#f59e0b';
    return '#ef4444';
  };

  const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899'];

  const renderOverviewTab = () => {
    if (!analytics) {
      return (
        <div className="text-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading analytics...</p>
        </div>
      );
    }

    // Prepare chart data
    const monthlyData = analytics.monthlyTrends?.map(item => ({
      month: format(new Date(item._id.year, item._id.month - 1), 'MMM yyyy'),
      invoices: item.invoiceCount,
      amount: item.totalAmount,
      accuracy: item.averageAccuracy
    })) || [];

    const accuracyData = analytics.accuracyDistribution?.map(item => {
      const ranges = ['0-50%', '50-70%', '70-85%', '85-95%', '95-100%'];
      const rangeIndex = Math.min(item._id, ranges.length - 1);
      return {
        range: ranges[rangeIndex],
        count: item.count
      };
    }) || [];

    const languageData = analytics.languageDistribution?.map(item => ({
      name: item._id,
      value: item.count
    })) || [];

    const vendorData = analytics.vendorStats?.slice(0, 5).map(item => ({
      name: item._id,
      invoices: item.count,
      amount: item.totalAmount
    })) || [];

    return (
      <div className="space-y-6">
        {/* Key Metrics */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <div className="card">
            <div className="card-content">
              <div className="flex items-center">
                <div className="flex-shrink-0 bg-blue-100 rounded-md p-3">
                  <Users className="h-6 w-6 text-blue-600" />
                </div>
                <div className="ml-5 w-0 flex-1">
                  <dl>
                    <dt className="text-sm font-medium text-gray-500 truncate">
                      Total Users
                    </dt>
                    <dd className="text-lg font-medium text-gray-900">
                      {analytics.userStats.totalUsers}
                    </dd>
                    <dd className="text-xs text-gray-500">
                      {analytics.userStats.newUsersThisMonth} new this month
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
                  <FileText className="h-6 w-6 text-green-600" />
                </div>
                <div className="ml-5 w-0 flex-1">
                  <dl>
                    <dt className="text-sm font-medium text-gray-500 truncate">
                      Total Invoices
                    </dt>
                    <dd className="text-lg font-medium text-gray-900">
                      {analytics.invoiceStats.totalInvoices}
                    </dd>
                    <dd className="text-xs text-gray-500">
                      {analytics.invoiceStats.completedInvoices} completed
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
                  <TrendingUp className="h-6 w-6 text-purple-600" />
                </div>
                <div className="ml-5 w-0 flex-1">
                  <dl>
                    <dt className="text-sm font-medium text-gray-500 truncate">
                      Total Revenue
                    </dt>
                    <dd className="text-lg font-medium text-gray-900">
                      {formatCurrency(analytics.invoiceStats.totalAmount)}
                    </dd>
                    <dd className="text-xs text-gray-500">
                      From all invoices
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
                  <Activity className="h-6 w-6 text-yellow-600" />
                </div>
                <div className="ml-5 w-0 flex-1">
                  <dl>
                    <dt className="text-sm font-medium text-gray-500 truncate">
                      Avg Accuracy
                    </dt>
                    <dd className="text-lg font-medium text-gray-900">
                      {analytics.invoiceStats.averageAccuracy?.toFixed(1)}%
                    </dd>
                    <dd className="text-xs text-gray-500">
                      OCR accuracy rate
                    </dd>
                  </dl>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Charts */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Monthly Trends */}
          <div className="card">
            <div className="card-header">
              <h3 className="card-title">Monthly Trends</h3>
            </div>
            <div className="card-content">
              <ResponsiveContainer width="100%" height={300}>
                <AreaChart data={monthlyData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="month" />
                  <YAxis yAxisId="left" />
                  <YAxis yAxisId="right" orientation="right" />
                  <Tooltip />
                  <Legend />
                  <Area
                    yAxisId="left"
                    type="monotone"
                    dataKey="invoices"
                    stackId="1"
                    stroke="#3b82f6"
                    fill="#3b82f6"
                    name="Invoices"
                  />
                  <Line
                    yAxisId="right"
                    type="monotone"
                    dataKey="accuracy"
                    stroke="#10b981"
                    strokeWidth={2}
                    name="Accuracy %"
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Accuracy Distribution */}
          <div className="card">
            <div className="card-header">
              <h3 className="card-title">Accuracy Distribution</h3>
            </div>
            <div className="card-content">
              <ResponsiveContainer width="100%" height={300}>
                <RechartsBarChart data={accuracyData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="range" />
                  <YAxis />
                  <Tooltip />
                  <Bar dataKey="count" fill="#3b82f6" />
                </RechartsBarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Language Distribution */}
          <div className="card">
            <div className="card-header">
              <h3 className="card-title">Language Distribution</h3>
            </div>
            <div className="card-content">
              <ResponsiveContainer width="100%" height={300}>
                <RechartsPieChart>
                  <Pie
                    data={languageData}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                    outerRadius={80}
                    fill="#8884d8"
                    dataKey="value"
                  >
                    {languageData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                </RechartsPieChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Top Vendors */}
          <div className="card">
            <div className="card-header">
              <h3 className="card-title">Top Vendors</h3>
            </div>
            <div className="card-content">
              <ResponsiveContainer width="100%" height={300}>
                <RechartsBarChart data={vendorData} layout="horizontal">
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis type="number" />
                  <YAxis dataKey="name" type="category" width={80} />
                  <Tooltip />
                  <Bar dataKey="invoices" fill="#3b82f6" name="Invoices" />
                </RechartsBarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>

        {/* System Health */}
        {systemHealth && (
          <div className="card">
            <div className="card-header">
              <div className="flex items-center justify-between">
                <h3 className="card-title">System Health</h3>
                <button
                  onClick={fetchSystemHealth}
                  className="btn btn-outline btn-sm"
                >
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Refresh
                </button>
              </div>
            </div>
            <div className="card-content">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-gray-700">Status</span>
                  <span className={`px-2 py-1 text-xs font-medium rounded-full ${getStatusColor(systemHealth.status)}`}>
                    {systemHealth.status}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-gray-700">Error Rate</span>
                  <span className="text-sm text-gray-900">{systemHealth.metrics.performance.errorRate}%</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-gray-700">Avg Processing Time</span>
                  <span className="text-sm text-gray-900">{systemHealth.metrics.performance.averageProcessingTime}ms</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-gray-700">Recent Invoices</span>
                  <span className="text-sm text-gray-900">{systemHealth.metrics.recentActivity.invoicesLast24Hours}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-gray-700">New Users</span>
                  <span className="text-sm text-gray-900">{systemHealth.metrics.recentActivity.usersLast24Hours}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-gray-700">Uptime</span>
                  <span className="text-sm text-gray-900">{Math.floor(systemHealth.metrics.uptime / 3600)}h</span>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  };

  const renderUsersTab = () => (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-gray-900">User Management</h2>
        <div className="flex items-center space-x-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search users..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="input pl-10"
            />
          </div>
        </div>
      </div>

      <div className="card">
        <div className="card-content">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    User
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Email
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Role
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Joined
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {users.map((user) => (
                  <tr key={user._id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <div className="flex-shrink-0 h-10 w-10">
                          <div className="h-10 w-10 rounded-full bg-blue-100 flex items-center justify-center">
                            <span className="text-sm font-medium text-blue-600">
                              {(user.profile?.firstName || user.username || 'U').charAt(0).toUpperCase()}
                            </span>
                          </div>
                        </div>
                        <div className="ml-4">
                          <div className="text-sm font-medium text-gray-900">
                            {user.profile?.firstName && user.profile?.lastName
                              ? `${user.profile.firstName} ${user.profile.lastName}`
                              : user.username
                            }
                          </div>
                          <div className="text-sm text-gray-500">
                            {user.profile?.company || 'N/A'}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900">{user.email}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`px-2 py-1 text-xs font-medium rounded-full ${
                        user.role === 'admin' 
                          ? 'bg-purple-100 text-purple-800' 
                          : 'bg-gray-100 text-gray-800'
                      }`}>
                        {user.role}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`px-2 py-1 text-xs font-medium rounded-full ${
                        user.isActive 
                          ? 'bg-green-100 text-green-800' 
                          : 'bg-red-100 text-red-800'
                      }`}>
                        {user.isActive ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {format(new Date(user.createdAt), 'MMM dd, yyyy')}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                      <div className="flex items-center space-x-2">
                        <button
                          onClick={() => handleUserStatusToggle(user._id, user.isActive)}
                          className={`${
                            user.isActive 
                              ? 'text-red-600 hover:text-red-900' 
                              : 'text-green-600 hover:text-green-900'
                          }`}
                          title={user.isActive ? 'Deactivate user' : 'Activate user'}
                        >
                          {user.isActive ? <UserX className="h-4 w-4" /> : <UserCheck className="h-4 w-4" />}
                        </button>
                        <button
                          onClick={() => handleUserRoleToggle(user._id, user.role)}
                          className="text-blue-600 hover:text-blue-900"
                          title="Toggle role"
                        >
                          <Shield className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          <div className="mt-6 flex items-center justify-between">
            <div className="text-sm text-gray-700">
              Showing {((currentPage - 1) * 10) + 1} to {Math.min(currentPage * 10, users.length)} of {users.length} results
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
        </div>
      </div>
    </div>
  );

  const renderInvoicesTab = () => (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-gray-900">Invoice Management</h2>
        <div className="flex items-center space-x-4">
          <select
            value={filters.status}
            onChange={(e) => setFilters({ ...filters, status: e.target.value })}
            className="input"
          >
            <option value="">All Status</option>
            <option value="completed">Completed</option>
            <option value="processing">Processing</option>
            <option value="failed">Failed</option>
          </select>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search invoices..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="input pl-10"
            />
          </div>
        </div>
      </div>

      <div className="card">
        <div className="card-content">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Invoice
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    User
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Vendor
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
                    Date
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {invoices.map((invoice) => (
                  <tr key={invoice.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-gray-900">
                        {invoice.invoiceNumber || 'N/A'}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900">
                        {invoice.user?.username || 'N/A'}
                      </div>
                      <div className="text-xs text-gray-500">
                        {invoice.user?.email || ''}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900">
                        {invoice.vendorName || 'N/A'}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-gray-900">
                        {formatCurrency(invoice.totalAmount)}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <span 
                          className="text-sm font-medium"
                          style={{ color: getAccuracyColor(invoice.accuracyScore) }}
                        >
                          {invoice.accuracyScore}%
                        </span>
                        {invoice.isEdited && (
                          <span className="ml-2 text-xs text-blue-500">Edited</span>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`px-2 py-1 text-xs font-medium rounded-full ${
                        invoice.status === 'completed' ? 'bg-green-100 text-green-800' :
                        invoice.status === 'processing' ? 'bg-yellow-100 text-yellow-800' :
                        'bg-red-100 text-red-800'
                      }`}>
                        {invoice.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {format(new Date(invoice.createdAt), 'MMM dd, yyyy')}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
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
        </div>
      </div>
    </div>
  );

  return (
    <div className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">Admin Dashboard</h1>
        <p className="mt-1 text-sm text-gray-600">
          Manage users, invoices, and monitor system performance
        </p>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200 mb-6">
        <nav className="-mb-px flex space-x-8">
          <button
            onClick={() => setActiveTab('overview')}
            className={`${
              activeTab === 'overview'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            } whitespace-nowrap py-2 px-1 border-b-2 font-medium text-sm transition-colors duration-150`}
          >
            <BarChart3 className="h-4 w-4 inline mr-2" />
            Overview
          </button>
          <button
            onClick={() => setActiveTab('users')}
            className={`${
              activeTab === 'users'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            } whitespace-nowrap py-2 px-1 border-b-2 font-medium text-sm transition-colors duration-150`}
          >
            <Users className="h-4 w-4 inline mr-2" />
            Users
          </button>
          <button
            onClick={() => setActiveTab('invoices')}
            className={`${
              activeTab === 'invoices'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            } whitespace-nowrap py-2 px-1 border-b-2 font-medium text-sm transition-colors duration-150`}
          >
            <FileText className="h-4 w-4 inline mr-2" />
            Invoices
          </button>
        </nav>
      </div>

      {/* Tab Content */}
      {activeTab === 'overview' && renderOverviewTab()}
      {activeTab === 'users' && renderUsersTab()}
      {activeTab === 'invoices' && renderInvoicesTab()}
    </div>
  );
};

export default AdminDashboard;
