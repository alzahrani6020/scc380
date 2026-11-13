import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

const COOKIE = process.env.NODE_ENV === 'production' ? '__Host-scc_refresh' : 'scc_refresh';
const ALLOWED = ['login', 'google', 'verify-2fa-login', 'refresh', 'logout', 'migrate'] as const;
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
    return url.host === host && url.protocol === (process.env.NODE_ENV === 'production' ? 'https:' : request.nextUrl.protocol);
  } catch { return false; }
}

function apiUrl(action: Action) {
  const raw = process.env.API_INTERNAL_URL || process.env.NEXT_PUBLIC_API_URL;
  if (!raw) return null;
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
  const upstreamAction = name === 'migrate' ? 'refresh' : name;
  const url = apiUrl(upstreamAction);
  if (!url) return jsonError('Auth API not configured', 503);

  const legacy = typeof body.refreshToken === 'string' ? body.refreshToken : undefined;
  const refreshToken = request.cookies.get(COOKIE)?.value || legacy;
  if (['refresh', 'logout', 'migrate'].includes(name) && !refreshToken) {
    return jsonError('No refresh session', 401);
  }
  if (name === 'migrate' && !legacy) return jsonError('Legacy token required', 400);
  const payload: Record<string, unknown> = {};
  if (name === 'login') {
    if (typeof body.email !== 'string' || typeof body.password !== 'string') return jsonError('Invalid login', 400);
    payload.email = body.email;
    payload.password = body.password;
  } else if (name === 'google') {
    if (typeof body.credential !== 'string') return jsonError('Missing Google credential', 400);
    payload.credential = body.credential;
  } else if (name === 'verify-2fa-login') {
    if (typeof body.tempToken !== 'string' || typeof body.code !== 'string') return jsonError('Missing 2FA proof', 400);
    payload.tempToken = body.tempToken;
    payload.code = body.code;
  } else {
    payload.refreshToken = name === 'migrate' ? legacy : refreshToken;
  }

  let upstream: Response;
  try {
    upstream = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(name === 'login' && typeof body.tenantSlug === 'string'
          ? { 'x-tenant-slug': body.tenantSlug } : {}),
      },
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
    // Do not forward upstream cookies, headers, or secrets.
    return jsonError(typeof result.message === 'string' ? result.message : 'Authentication failed', upstream.status);
  }

  const responseBody = { ...result };
  delete responseBody.refreshToken;
  delete responseBody.token;
  const response = NextResponse.json(responseBody, { headers: { 'Cache-Control': 'no-store' } });
  if (name === 'logout') {
    response.cookies.set(COOKIE, '', { httpOnly: true, secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict', path: '/', maxAge: 0 });
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
