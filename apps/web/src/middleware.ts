import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
  const session = request.cookies.get('scc_session')?.value;
  const path = request.nextUrl.pathname;

  // السماح بالوصول لصفحة تسجيل الدخول وAPI
  if (path === '/login' || path.startsWith('/api/')) {
    return NextResponse.next();
  }

  // إذا ما فيه session → redirect للـ login
  if (!session) {
    return NextResponse.redirect(new URL('/login', request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
