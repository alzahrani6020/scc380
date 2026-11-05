import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

const SECRET = 'scc-demo-secret-2024';

function verifyToken(token: string): boolean {
  try {
    const decoded = Buffer.from(token, 'base64url').toString('utf-8');
    const data = JSON.parse(decoded);
    if (data.exp && Date.now() > data.exp) return false;
    if (data.secret !== SECRET) return false;
    return true;
  } catch {
    return false;
  }
}

export function middleware(request: NextRequest) {
  const path = request.nextUrl.pathname;
  const demoToken = request.nextUrl.searchParams.get('demo');
  const demoUsed = request.cookies.get('demo_used')?.value;

  // بوابة الديمو التسويقية: صفحة العرض فقط (اختياري — الرابط التجريبي لمرة واحدة)
  if (path === '/preview' && demoToken) {
    if (!verifyToken(demoToken) || demoUsed === demoToken) {
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
    path === '/preview' ||
    path.startsWith('/admin/')
  ) {
    return NextResponse.next();
  }

  // حارس الجلسة الحقيقي: لا رمز دخول ← صفحة الدخول.
  // التحقق الفعلي من الصلاحيات يتم في الـ API على كل طلب (هذا حارس تجربة فقط).
  const accessToken = request.cookies.get('accessToken')?.value;
  if (!accessToken) {
    const login = NextResponse.redirect(new URL('/auth/login', request.url));
    login.headers.set('Cache-Control', 'no-store');
    return login;
  }
  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
