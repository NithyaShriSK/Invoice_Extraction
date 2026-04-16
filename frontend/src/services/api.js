import axios from 'axios';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:8000';

const api = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Add token to requests
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers['Authorization'] = `Bearer ${token}`;
  }
  return config;
});

export const authService = {
  register: (email, full_name, password) =>
    api.post('/auth/register', { email, full_name, password }),
  login: (email, password) =>
    api.post('/auth/login', { email, password }),
  getCurrentUser: () =>
    api.get('/auth/me'),
};

export const uploadService = {
  uploadFile: (file) => {
    const formData = new FormData();
    formData.append('file', file);
    return api.post('/upload/file', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
  },
  uploadFromCamera: (imageBase64) =>
    api.post('/upload/camera', { image: imageBase64 }),
  getUploadHistory: () =>
    api.get('/upload/history'),
};

export const resultService = {
  getResult: (uploadId) =>
    api.get(`/results/${uploadId}`),
  getAllResults: () =>
    api.get('/results/'),
  updateCorrectedText: (resultId, correctedText) =>
    api.put(`/results/${resultId}/corrected-text`, { corrected_text: correctedText }),
  downloadResult: (resultId) =>
    api.get(`/results/${resultId}/download`),
};

export const adminService = {
  getDashboardStats: () =>
    api.get('/admin/dashboard/stats'),
  getAllUsers: (skip = 0, limit = 10) =>
    api.get(`/admin/users?skip=${skip}&limit=${limit}`),
  getAllUploads: (skip = 0, limit = 20) =>
    api.get(`/admin/uploads?skip=${skip}&limit=${limit}`),
  getAllResults: (skip = 0, limit = 20) =>
    api.get(`/admin/results?skip=${skip}&limit=${limit}`),
  searchData: (query, searchType = 'all') =>
    api.get(`/admin/search?query=${query}&search_type=${searchType}`),
  deleteResult: (resultId) =>
    api.delete(`/admin/results/${resultId}`),
  toggleAdminStatus: (userId) =>
    api.put(`/admin/users/${userId}/toggle-admin`),
};

export default api;
