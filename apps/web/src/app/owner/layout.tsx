import type { Metadata } from 'next';
import { cookies } from 'next/headers';
import { notFound, redirect } from 'next/navigation';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export const metadata: Metadata = {
  robots: { index: false, follow: false, noarchive: true },
};

function getOwnerApiOrigin(): string {
  const configured = process.env.API_INTERNAL_URL || process.env.NEXT_PUBLIC_API_URL;
  // Never call a relative URL from a server component.
  const origin = configured && /^https?:\/\//.test(configured)
    ? configured
    : 'https://scc380-api.onrender.com';
  return origin.replace(/\/+$/, '').replace(/\/api$/, '');
}

export default async function OwnerLayout({ children }: { children: React.ReactNode }) {
  // The owner page must never render until NestJS authorizes the exact live
  // session. Middleware's unsigned cookie inspection is NOT sufficient.
  const token = cookies().get('accessToken')?.value;
  if (!token || token.split('.').length !== 3) notFound();

  let response: Response;
  try {
    response = await fetch(getOwnerApiOrigin() + '/analytics/activity/owner/status', {
      method: 'GET',
      headers: { Authorization: 'Bearer ' + token },
      cache: 'no-store',
      redirect: 'error',
      signal: AbortSignal.timeout(25000),
    });
  } catch {
    // Backend unavailability is not evidence that the caller is unauthorized.
    // This error component contains no privileged owner data.
    return <main dir="rtl" className="mx-auto mt-24 max-w-lg rounded-xl border border-amber-700 bg-slate-900 p-6 text-white">
      <h1 className="text-xl font-bold">تعذر الاتصال بخدمة التحقق من المالك</h1>
      <p className="mt-3 text-sm text-slate-300">لم يتم إثبات الصلاحية؛ لم تُعرض سجلات خاصة. حاول إعادة فتح الصفحة.</p>
    </main>;
  }
  if (response.status === 401) redirect('/auth/owner-resume');
  if (!response.ok) {
    if (response.status === 403 || response.status === 404) notFound();
    return <main dir="rtl" className="mx-auto mt-24 max-w-lg rounded-xl border border-amber-700 bg-slate-900 p-6 text-white">
      <h1 className="text-xl font-bold">تعذر التحقق من صلاحية المالك</h1>
      <p className="mt-3 text-sm text-slate-300">خدمة التحقق غير متاحة مؤقتًا. لم تُعرض بيانات خاصة.</p>
    </main>;
  }
  let authorized = false;
  try {
    const result = (await response.json()) as { authorized?: boolean };
    authorized = result.authorized === true;
  } catch { /* Invalid upstream response must fail closed. */ }
  if (!authorized) notFound();
  return <>{children}</>;
}
