'use client';

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import api from '@/lib/api';
import { setAuth } from '@/lib/auth';
import { Shield, ArrowRight, Loader2 } from 'lucide-react';
import Link from 'next/link';

function Verify2FAForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const tempToken = searchParams.get('token');

  useEffect(() => {
    if (!tempToken) {
      setError('رابط غير صالح — جرب تسجيل الدخول مرة أخرى');
    }
  }, [tempToken]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!tempToken) return;
    setLoading(true); setError('');
    try {
      const res = await api.post('/auth/verify-2fa-login', { tempToken, code });
      const authData = {
        accessToken: res.data.accessToken,
        refreshToken: res.data.refreshToken,
        role: res.data.user.role,
        tenantSlug: res.data.user?.tenantSlug || null,
        tenantId: res.data.user?.tenantId || null,
        user: {
          email: res.data.user.email,
          firstName: res.data.user.firstName,
          lastName: res.data.user.lastName,
        },
      };
      setAuth(authData, true);
      router.push('/dashboard');
    } catch (err: any) {
      setError(err.response?.data?.message || 'كود التحقق غير صحيح');
    } finally { setLoading(false); }
  };

  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center relative overflow-hidden p-4">
      <div className="absolute top-0 right-0 w-[600px] h-[600px] bg-primary-600/10 rounded-full blur-[120px] -translate-y-1/2 translate-x-1/3" />
      <div className="relative z-10 w-full max-w-md mx-4">
        <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-8 shadow-2xl shadow-black/50">
          <div className="text-center mb-6">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-600 mb-4 shadow-lg shadow-emerald-500/30">
              <Shield className="h-8 w-8 text-white" />
            </div>
            <h1 className="text-2xl font-bold text-white mb-1">التحقق الثنائي</h1>
            <p className="text-slate-400 text-sm">أدخل كود المصادقة من تطبيقك</p>
          </div>

          {error && (
            <div className="mb-4 p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm text-center">{error}</div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <input
              type="text"
              required
              placeholder="أدخل كود التحقق (6 أرقام)"
              maxLength={6}
              autoFocus
              className="w-full bg-slate-800 border border-slate-700 text-white rounded-xl py-4 px-4 text-lg text-center tracking-[0.5em] font-mono focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500 transition-all placeholder:text-slate-500 placeholder:tracking-normal placeholder:text-sm"
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
            />
            <button
              type="submit"
              disabled={loading || !tempToken || code.length !== 6}
              className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-3 px-4 rounded-xl transition-all shadow-lg shadow-emerald-600/20 flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : 'تحقق وتسجيل الدخول'}
            </button>
          </form>

          <div className="mt-6 text-center">
            <Link href="/auth/login" className="text-sm text-primary-400 hover:text-primary-300 transition-colors flex items-center justify-center gap-1">
              <ArrowRight className="h-3 w-3" /> العودة لتسجيل الدخول
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function Verify2FAPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <div className="w-12 h-12 border-4 border-primary-500/30 border-t-primary-500 rounded-full animate-spin" />
      </div>
    }>
      <Verify2FAForm />
    </Suspense>
  );
}
