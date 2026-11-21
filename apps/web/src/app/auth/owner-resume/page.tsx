'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { sessionAuth } from '@/lib/session-auth';
import { setAuth, getRememberPreference, clearAuth } from '@/lib/auth';

// Public recovery UI: it does not expose owner data or accept arbitrary destinations.
// The protected owner layout will re-validate the new access token at the API.
export default function OwnerSessionRecovery() {
  const [state, setState] = useState<'checking' | 'expired' | 'failed'>('checking');
  useEffect(() => {
    let mounted = true;
    const restore = async () => {
      try {
        const result = await sessionAuth('refresh', { remember: getRememberPreference() });
        if (!result?.accessToken || !result.user?.role) throw new Error('Invalid refresh response');
        setAuth({
          accessToken: result.accessToken,
          role: result.user.role,
          tenantSlug: result.user.tenantSlug || null,
          tenantId: result.user.tenantId || null,
          user: { email: result.user.email },
        }, getRememberPreference());
        if (mounted) window.location.replace('/owner/activity');
      } catch {
        // A failed refresh does not prove a fresh login will succeed.
        // Keep the page unprivileged and offer normal sign-in.
        if (mounted) setState('expired');
      }
    };
    void restore();
    return () => { mounted = false; };
  }, []);

  return (
    <main dir="rtl" className="mx-auto mt-24 max-w-lg rounded-xl border border-slate-700 bg-slate-900 p-6 text-white">
      <h1 className="text-xl font-bold">استعادة جلسة لوحة المالك</h1>
      {state === 'checking' ? (
        <p className="mt-3 text-slate-300" role="status">جارٍ التحقق من إمكانية استعادة جلستك الحالية...</p>
      ) : (
        <>
          <p className="mt-3 text-slate-300" role="alert">لم تنجح استعادة الجلسة. يجب تسجيل الدخول من المسار الرسمي للوصول إلى لوحة المالك.</p>
          <Link className="mt-5 inline-block rounded-lg bg-blue-600 px-4 py-2" href="/auth/login">تسجيل الدخول</Link>
        </>
      )}
    </main>
  );
}
