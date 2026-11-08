import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  try {
    const { password } = await request.json();
    const configuredPassword = process.env.SCC_GATE_PASSWORD;

    if (!configuredPassword) {
      return NextResponse.json(
        { success: false, message: 'Authentication gate is not configured' },
        { status: 503 }
      );
    }

    if (password !== configuredPassword) {
      return NextResponse.json(
        { success: false, message: 'باسورد غلط' },
        { status: 401 }
      );
    }

    const response = NextResponse.json({ success: true });
    
    // Session cookie — ينتهي عند إغلاق المتصفح
    response.cookies.set('scc_session', crypto.randomUUID(), {
      httpOnly: true,
      secure: true,
      sameSite: 'strict',
      path: '/',
    });

    return response;
  } catch {
    return NextResponse.json(
      { success: false, message: 'خطأ' },
      { status: 500 }
    );
  }
}
