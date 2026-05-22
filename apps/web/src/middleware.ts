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

  // السماح بالوصول لـ API routes وصفحة expired و admin و landing و preview
  if (
    path.startsWith('/api/') ||
    path === '/expired' ||
    path.startsWith('/admin/') ||
    path === '/landing' ||
    path === '/preview'
  ) {
    // بالنسبة لـ preview: إذا جاء مع demo token نتحقق منه ونضع cookie
    if (path === '/preview' && demoToken) {
      if (!verifyToken(demoToken)) {
        return NextResponse.redirect(new URL('/expired', request.url));
      }
      if (demoUsed === demoToken) {
        return NextResponse.redirect(new URL('/expired', request.url));
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
      return NextResponse.redirect(new URL('/expired', request.url));
    }
    if (demoUsed === demoToken) {
      return NextResponse.redirect(new URL('/expired', request.url));
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

  // إذا ما فيه token → expired
  return NextResponse.redirect(new URL('/expired', request.url));
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
