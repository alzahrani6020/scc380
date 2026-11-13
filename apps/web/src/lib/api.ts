import axios from 'axios';
import { getToken, getRefreshToken, getTenantSlug, getRememberPreference, setAuth, clearAuth } from './auth';
import { sessionAuth } from './session-auth';

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

  refreshPromise = (async () => {
    try {
      // Serialize refreshes across same-origin tabs where Web Locks is
      // available. API rotation remains atomic when Web Locks is unsupported.
      const rotate = async (): Promise<string | null> => {
        // Read browser storage after obtaining the cross-tab lock.
        const legacyToken = getRefreshToken();
        let res: any;
      // One-time migration for existing signed-in users. Rotate the old
      // credential server-side, then remove it from browser storage.
      if (legacyToken) {
        res = await sessionAuth('migrate', { refreshToken: legacyToken, remember: getRememberPreference() });
      } else {
        res = await sessionAuth('refresh', { remember: getRememberPreference() });
      }
      const remember = getRememberPreference();
      setAuth({
        accessToken: res.accessToken,
        role: res.user.role,
        tenantSlug: res.user?.tenantSlug || null,
        tenantId: res.user?.tenantId || null,
        user: { email: res.user.email },
      }, remember);
      return res.accessToken as string;
      };
      if (typeof navigator !== 'undefined' && navigator.locks?.request) {
        return await navigator.locks.request('scc380-refresh-token', { mode: 'exclusive' }, rotate);
      }
      return await rotate();
    } catch {
      return null;
    } finally {
      refreshPromise = null;
    }
  })();
  return refreshPromise;
}

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const original = error.config as any;
    const isAuthEndpoint =
      typeof original?.url === 'string' &&
      [
        '/auth/login',
        '/auth/register',
        '/auth/google',
        '/auth/verify-2fa-login',
        '/auth/refresh',
        '/auth/logout',
        '/auth/logout-all',
      ].some((path) => original.url.startsWith(path));

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

      // A revoked session can leave an HttpOnly cookie in the browser.
      // Clear it on the same origin before redirecting so middleware will
      // not treat the stale cookie as a resumable session.
      try { await sessionAuth('clear'); } catch {
        // Network failure cannot be mistaken for successful server revocation.
      }
      clearAuth();
      window.location.href = '/auth/login';
    }

    return Promise.reject(error);
  }
);

export default api;
