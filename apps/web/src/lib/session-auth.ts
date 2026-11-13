export async function sessionAuth(action: 'login' | 'google' | 'verify-2fa-login' | 'refresh' | 'logout' | 'migrate', payload: Record<string, unknown> = {}) {
  const response = await fetch('/api/auth/session', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-scc-auth-intent': '1' },
    credentials: 'same-origin',
    cache: 'no-store',
    body: JSON.stringify({ action, ...payload }),
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(typeof result.message === 'string' ? result.message : 'فشل طلب المصادقة');
  }
  return result;
}
