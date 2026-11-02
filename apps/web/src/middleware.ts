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

  // السماح بالوصول لـ API routes وصفحة expired و admin و landing و preview والجذر (يحوّله page.tsx إلى /landing)
  if (
    path === '/' ||
    path.startsWith('/api/') ||
    path === '/expired' ||
    path.startsWith('/admin/') ||
    path === '/landing' ||
    path === '/preview'
  ) {
    // بالنسبة لـ preview: إذا جاء مع demo token نتحقق منه ونضع cookie
    if (path === '/preview' && demoToken) {
      if (!verifyToken(demoToken)) {
        const r = NextResponse.redirect(new URL('/expired', request.url));
        r.headers.set('Cache-Control', 'no-store');
        return r;
      }
      if (demoUsed === demoToken) {
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
    return NextResponse.next();
  }

  // إذا كان هناك token في الرابط
  if (demoToken) {
    if (!verifyToken(demoToken)) {
      const r = NextResponse.redirect(new URL('/expired', request.url));
      r.headers.set('Cache-Control', 'no-store');
      return r;
    }
    if (demoUsed === demoToken) {
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

  // إذا ما فيه token → expired (بدون تخزين في الـ cache لتفادي الردود القديمة)
  const expiredRedirect = NextResponse.redirect(new URL('/expired', request.url));
  expiredRedirect.headers.set('Cache-Control', 'no-store');
  return expiredRedirect;
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
