import axios from 'axios';

// Create axios instance
const API = axios.create({
  baseURL: process.env.REACT_APP_API_URL || 'http://localhost:5000/api',
  timeout: 30000,
});

// Request interceptor to add auth token
API.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response interceptor to handle errors
API.interceptors.response.use(
  (response) => {
    // Backend responses use { success, message, data }.
    // Return the inner payload when present so callers can use response.user/response.token.
    return response.data?.data ?? response.data;
  },
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      window.location.href = '/login';
    }
    return Promise.reject(error.response?.data || error.message);
  }
);

// Auth APIs
export const authAPI = {
  signup: (userData) => API.post('/auth/signup', userData),
  login: (credentials) => API.post('/auth/login', credentials),
  getProfile: () => API.get('/auth/profile'),
  updateProfile: (profileData) => API.put('/auth/profile', profileData),
  changePassword: (passwordData) => API.put('/auth/change-password', passwordData),
  logout: () => API.post('/auth/logout'),
};

// Invoice APIs
export const invoiceAPI = {
  upload: (formData) => {
    const config = {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    };
    return API.post('/invoice/upload', formData, config);
  },
  save: (id, data) => API.put(`/invoice/${id}/save`, data),
  getMyInvoices: (params = {}) => API.get('/invoice/my', { params }),
  getById: (id) => API.get(`/invoice/${id}`),
  delete: (id) => API.delete(`/invoice/${id}`),
  getAnalytics: (params = {}) => API.get('/invoice/analytics/my', { params }),
};

// Admin APIs
export const adminAPI = {
  getUsers: (params = {}) => API.get('/admin/users', { params }),
  getInvoices: (params = {}) => API.get('/admin/invoices', { params }),
  getAnalytics: (params = {}) => API.get('/admin/analytics', { params }),
  updateUserStatus: (userId, data) => API.put(`/admin/users/${userId}/status`, data),
  updateUserRole: (userId, data) => API.put(`/admin/users/${userId}/role`, data),
  getSystemHealth: () => API.get('/admin/health'),
};

// Health check
export const healthAPI = {
  check: () => API.get('/health'),
};

export default API;
