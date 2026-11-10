import axios from 'axios';
import { getToken, getRefreshToken, getTenantSlug, getRememberPreference, setAuth, clearAuth } from './auth';

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
    const url = typeof config.url === 'string' ? config.url : '';
    const publicAuthRequest = [
      '/auth/login',
      '/auth/register',
      '/auth/google',
      '/auth/verify-2fa-login',
      '/auth/forgot-password',
      '/auth/reset-password',
    ].some((path) => url.startsWith(path));

    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    if (tenantSlug && !publicAuthRequest) {
      config.headers['X-Tenant-Slug'] = tenantSlug;
    }
    const branchId = localStorage.getItem('selectedBranchId');
    if (branchId) {
      config.headers['x-branch-id'] = branchId;
    }
  }
  return config;
});

let refreshPromise: Promise<string | null> | null = null;

async function refreshAccessToken(): Promise<string | null> {
  if (typeof window === 'undefined') return null;
  if (refreshPromise) return refreshPromise;

  const refreshToken = getRefreshToken();
  if (!refreshToken) return null;

  refreshPromise = axios
    .post(
      `${api.defaults.baseURL}/auth/refresh`,
      { refreshToken },
      { headers: { 'Content-Type': 'application/json' } },
    )
    .then((res) => {
      const remember = getRememberPreference();
      setAuth(
        {
          accessToken: res.data.accessToken,
          refreshToken: res.data.refreshToken,
          role: res.data.user.role,
          tenantSlug: res.data.user?.tenantSlug || null,
          tenantId: res.data.user?.tenantId || null,
          user: {
            email: res.data.user.email,
          },
        },
        remember,
      );
      return res.data.accessToken as string;
    })
    .catch(() => null)
    .finally(() => {
      refreshPromise = null;
    });

  return refreshPromise;
}

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const original = error.config as any;
    const isAuthEndpoint =
      typeof original?.url === 'string' &&
      ['/auth/login', '/auth/register', '/auth/google', '/auth/verify-2fa-login', '/auth/refresh']
        .some((path) => original.url.startsWith(path));

    if (
      error.response?.status === 401 &&
      typeof window !== 'undefined' &&
      !original?._retry &&
      !isAuthEndpoint
    ) {
      original._retry = true;
      const accessToken = await refreshAccessToken();
      if (accessToken) {
        original.headers = original.headers || {};
        original.headers.Authorization = `Bearer ${accessToken}`;
        return api(original);
      }

      clearAuth();
      window.location.href = '/auth/login';
    }

    return Promise.reject(error);
  }
);

export default api;
