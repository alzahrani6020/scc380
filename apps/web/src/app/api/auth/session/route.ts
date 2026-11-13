import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

const COOKIE = process.env.NODE_ENV === 'production' ? '__Host-scc_refresh' : 'scc_refresh';
const ALLOWED = ['refresh', 'logout', 'migrate', 'clear'] as const;
type Action = typeof ALLOWED[number];

function jsonError(message: string, status: number) {
  return NextResponse.json({ message }, {
    status,
    headers: { 'Cache-Control': 'no-store' },
  });
}

function sameOrigin(request: NextRequest) {
  const origin = request.headers.get('origin');
  const host = request.headers.get('host');
  const site = request.headers.get('sec-fetch-site');
  if (!origin || !host || (site && !['same-origin', 'none'].includes(site))) return false;
  try {
    const url = new URL(origin);
    const local = url.hostname === 'localhost' || url.hostname === '127.0.0.1' || url.hostname === '[::1]';
    return url.host === host && url.protocol === request.nextUrl.protocol
      && (process.env.NODE_ENV !== 'production' || url.protocol === 'https:' || local);
  } catch { return false; }
}

function clearRefreshCookie(response: NextResponse) {
  response.cookies.set(COOKIE, '', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    path: '/',
    maxAge: 0,
  });
  return response;
}

function apiUrl(action: Exclude<Action, 'clear'>) {
  const raw = process.env.API_INTERNAL_URL || process.env.NEXT_PUBLIC_API_URL;
  if (!raw || !/^https?:\/\//.test(raw)) return null;
  const base = raw.replace(/\/+$/, '');
  return base.endsWith('/api') ? `${base}/auth/${action}` : `${base}/api/auth/${action}`;
}

export async function POST(request: NextRequest) {
  // The custom header and strict Origin check block cross-site form / fetch CSRF.
  if (!sameOrigin(request) || request.headers.get('x-scc-auth-intent') !== '1') {
    return jsonError('Invalid auth request origin', 403);
  }
  if (!request.headers.get('content-type')?.startsWith('application/json')) {
    return jsonError('JSON required', 415);
  }
  let body: Record<string, unknown>;
  try {
    const raw = await request.text();
    if (raw.length > 8192) return jsonError('Request too large', 413);
    body = JSON.parse(raw);
    if (!body || typeof body !== 'object' || Array.isArray(body)) throw new Error('bad body');
  } catch { return jsonError('Invalid request body', 400); }

  const action = body.action;
  if (!ALLOWED.includes(action as Action)) return jsonError('Invalid auth operation', 400);
  const name = action as Action;
  // Local cookie cleanup is intentionally separate from server-side revocation.
  // It remains available even when the API is down or a session was revoked.
  if (name === 'clear') {
    return clearRefreshCookie(NextResponse.json(
      { cleared: true, revoked: false },
      { headers: { 'Cache-Control': 'no-store' } },
    ));
  }
  const upstreamAction = name === 'migrate' ? 'refresh' : name;
  const url = apiUrl(upstreamAction);
  if (!url) return jsonError('Auth API not configured', 503);

  const legacy = typeof body.refreshToken === 'string' ? body.refreshToken : undefined;
  // Refresh always reads the HttpOnly cookie; only the explicit one-time
  // migration may supply an old browser-stored credential.
  const cookieToken = request.cookies.get(COOKIE)?.value;
  const refreshToken = name === 'migrate' ? legacy
    : name === 'logout' ? (cookieToken || legacy) : cookieToken;
  if (!refreshToken) return jsonError('No refresh session', 401);
  const payload = { refreshToken };


  let upstream: Response;
  try {
    upstream = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      cache: 'no-store',
      signal: AbortSignal.timeout(10000),
    });
  } catch {
    return jsonError('Authentication service unavailable', 502);
  }

  let result: Record<string, unknown>;
  try { result = await upstream.json(); }
  catch { return jsonError('Invalid authentication response', 502); }

  if (!upstream.ok) {
    // A revoked/expired logout credential cannot be revoked again, but the
    // browser still needs its stale cookie removed. Preserve the failure status
    // so the caller does not mistake local cleanup for server-side revocation.
    const failure = jsonError(
      typeof result.message === 'string' ? result.message : 'Authentication failed',
      upstream.status,
    );
    return name === 'logout' ? clearRefreshCookie(failure) : failure;
  }

  const responseBody = { ...result };
  delete responseBody.refreshToken;
  delete responseBody.token;
  const response = NextResponse.json(responseBody, { headers: { 'Cache-Control': 'no-store' } });
  if (name === 'logout') {
    return clearRefreshCookie(response);
  } else if (typeof result.refreshToken === 'string') {
    const remember = body.remember !== false;
    response.cookies.set(COOKIE, result.refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      path: '/',
      ...(remember ? { maxAge: 7 * 24 * 60 * 60 } : {}),
    });
  }
  return response;
}
