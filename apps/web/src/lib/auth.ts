// Auth helper: supports both localStorage (remember me) and sessionStorage (temporary)

export interface AuthData {
  accessToken: string;
  refreshToken: string;
  role: string;
  tenantSlug?: string | null;
  tenantId?: string | null;
  user?: { email?: string; firstName?: string; lastName?: string };
}

const LS = {
  get: (k: string) => { try { return localStorage.getItem(k); } catch { return null; } },
  set: (k: string, v: string) => { try { localStorage.setItem(k, v); } catch {} },
  remove: (k: string) => { try { localStorage.removeItem(k); } catch {} },
};

const SS = {
  get: (k: string) => { try { return sessionStorage.getItem(k); } catch { return null; } },
  set: (k: string, v: string) => { try { sessionStorage.setItem(k, v); } catch {} },
  remove: (k: string) => { try { sessionStorage.removeItem(k); } catch {} },
};

function getAny(k: string): string | null {
  return LS.get(k) || SS.get(k);
}

export function getToken(): string | null {
  return getAny('accessToken');
}

export function getRefreshToken(): string | null {
  return getAny('refreshToken');
}

export function getTenantSlug(): string | null {
  return getAny('tenantSlug');
}

export function getRole(): string | null {
  return getAny('role');
}

export function getTenantId(): string | null {
  return getAny('tenantId');
}

export function isAuthenticated(): boolean {
  return !!getToken();
}

export function isVIP(): boolean {
  return getRole() === 'SUPER_ADMIN';
}

export function setAuth(data: AuthData, remember: boolean = true) {
  const store = remember ? LS : SS;
  const clear = remember ? SS : LS;

  store.set('accessToken', data.accessToken);
  store.set('refreshToken', data.refreshToken);
  store.set('role', data.role);
  if (data.tenantSlug) store.set('tenantSlug', data.tenantSlug);
  if (data.tenantId) store.set('tenantId', data.tenantId);

  // Ensure the other storage is cleaned so we don't have duplicates
  clear.remove('accessToken');
  clear.remove('refreshToken');
  clear.remove('role');
  clear.remove('tenantSlug');
  clear.remove('tenantId');
}

export function clearAuth() {
  const keys = ['accessToken', 'refreshToken', 'role', 'tenantSlug', 'tenantId'];
  keys.forEach((k) => {
    LS.remove(k);
    SS.remove(k);
  });
}
