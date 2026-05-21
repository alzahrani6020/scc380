import { NextResponse } from 'next/server';

const PASSWORD = 'scc3802024'; // الباسورد — تقدر تغيره

export async function POST(request: Request) {
  try {
    const { password } = await request.json();

    if (password !== PASSWORD) {
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
