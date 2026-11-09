import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

const SECRET = process.env.DEMO_TOKEN_SECRET;

async function verifyToken(token: string): Promise<boolean> {
  try {
    if (!SECRET) return false;

    const [payloadEncoded, signatureEncoded] = token.split('.');
    if (!payloadEncoded || !signatureEncoded) return false;

    const data = JSON.parse(Buffer.from(payloadEncoded, 'base64url').toString('utf-8'));
    const expMs =
      typeof data.exp === 'number'
        ? (data.exp > 1_000_000_000_000 ? data.exp : data.exp * 1000)
        : 0;
    if (!expMs || Date.now() > expMs) return false;

    const key = await crypto.subtle.importKey(
      'raw',
      new TextEncoder().encode(SECRET),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['verify'],
    );

    return crypto.subtle.verify(
      'HMAC',
      key,
      Buffer.from(signatureEncoded, 'base64url'),
      new TextEncoder().encode(payloadEncoded),
    );
  } catch {
    return false;
  }
}

export async function middleware(request: NextRequest) {
  const path = request.nextUrl.pathname;
  const demoToken = request.nextUrl.searchParams.get('demo');
  const demoUsed = request.cookies.get('demo_used')?.value;

  // بوابة الديمو التسويقية: صفحة العرض فقط (اختياري — الرابط التجريبي لمرة واحدة)
  if (path === '/preview' && demoToken) {
    if (!(await verifyToken(demoToken)) || demoUsed === demoToken) {
      const r = NextResponse.redirect(new URL('/expired', request.url));
      r.headers.set('Cache-Control', 'no-store');
      return r;
    }
    const response = NextResponse.next();
    response.cookies.set('demo_used', demoToken, {
      httpOnly: true,
      secure: true,
      sameSite: 'strict',
      path: '/',
      maxAge: 60 * 60 * 24,
    });
    return response;
  }

  // مسارات عامة لا تحتاج جلسة
  if (
    path === '/' ||
    path.startsWith('/api/') ||
    path.startsWith('/auth') ||
    path === '/landing' ||
    path === '/expired' ||
    path === '/preview'
  ) {
    return NextResponse.next();
  }

  // حارس الجلسة: الكوكي يجب أن تحمل JWT حقيقياً غير منتهٍ (تُضبط عند تسجيل الدخول).
  // المصادرة الكاملة بالتوقيع تتم دائماً في الـ API على كل طلب بيانات — هذا حارس مسارات UX.
  const accessToken = request.cookies.get('accessToken')?.value;
  let sessionValid = false;
  if (accessToken && accessToken.split('.').length === 3) {
    try {
      const payload = JSON.parse(Buffer.from(accessToken.split('.')[1], 'base64url').toString('utf-8'));
      sessionValid =
        payload?.type === 'access' &&
        typeof payload.exp === 'number' &&
        Date.now() < payload.exp * 1000;
    } catch {
      sessionValid = false;
    }
  }
  if (!sessionValid) {
    const login = NextResponse.redirect(new URL('/auth/login', request.url));
    login.headers.set('Cache-Control', 'no-store');
    return login;
  }
  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
