import axios from 'axios';
import { getToken, getTenantSlug, clearAuth } from './auth';

const api = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api',
  headers: {
    'Content-Type': 'application/json',
  },
});

api.interceptors.request.use((config) => {
  if (typeof window !== 'undefined') {
    const token = getToken();
    const tenantSlug = getTenantSlug();
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    if (tenantSlug) {
      config.headers['X-Tenant-Slug'] = tenantSlug;
    }
    const branchId = localStorage.getItem('selectedBranchId');
    if (branchId) {
      config.headers['x-branch-id'] = branchId;
    }
  }
  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401 && typeof window !== 'undefined') {
      clearAuth();
      window.location.href = '/auth/login';
    }
    return Promise.reject(error);
  }
);

export default api;
