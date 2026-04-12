import axios from 'axios';
import { AUTH_TOKEN_KEY, AUTH_USER_KEY } from '../constants/authStorage';

const API = axios.create({
  baseURL: process.env.REACT_APP_API_URL || 'http://localhost:5000/api',
  timeout: 30000,
});

/** Called on 401 (e.g. expired/invalid JWT) so the app can clear auth + redirect without a full reload */
let unauthorizedHandler = () => {};

export function setUnauthorizedHandler(fn) {
  unauthorizedHandler = typeof fn === 'function' ? fn : () => {};
}

API.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem(AUTH_TOKEN_KEY);
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

API.interceptors.response.use(
  (response) => response.data?.data ?? response.data,
  (error) => {
    const status = error.response?.status;
    const reqUrl = error.config?.url || '';
    const skipGlobalUnauthorized =
      reqUrl.includes('/auth/login') ||
      reqUrl.includes('/auth/signup') ||
      reqUrl.includes('/auth/logout');

    if (status === 401 && !skipGlobalUnauthorized) {
      localStorage.removeItem(AUTH_TOKEN_KEY);
      localStorage.removeItem(AUTH_USER_KEY);
      try {
        unauthorizedHandler();
      } catch (e) {
        console.error('Unauthorized handler error:', e);
      }
    }

    const data = error.response?.data;
    const message =
      (typeof data === 'object' && data && data.message) ||
      error.message ||
      'Request failed';

    const err = new Error(message);
    err.status = status;
    if (typeof data === 'object' && data) err.details = data;
    return Promise.reject(err);
  }
);

export const authAPI = {
  signup: (userData) => API.post('/auth/signup', userData),
  login: (credentials) => API.post('/auth/login', credentials),
  getProfile: () => API.get('/auth/profile'),
  updateProfile: (profileData) => API.put('/auth/profile', profileData),
  changePassword: (passwordData) => API.put('/auth/change-password', passwordData),
  logout: () => API.post('/auth/logout'),
};

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

export const adminAPI = {
  getUsers: (params = {}) => API.get('/admin/users', { params }),
  getInvoices: (params = {}) => API.get('/admin/invoices', { params }),
  getAnalytics: (params = {}) => API.get('/admin/analytics', { params }),
  updateUserStatus: (userId, data) => API.put(`/admin/users/${userId}/status`, data),
  updateUserRole: (userId, data) => API.put(`/admin/users/${userId}/role`, data),
  getSystemHealth: () => API.get('/admin/health'),
};

export const healthAPI = {
  check: () => API.get('/health'),
};

export default API;
