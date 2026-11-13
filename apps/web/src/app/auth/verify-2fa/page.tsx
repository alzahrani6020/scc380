'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import api from '@/lib/api';
import { sessionAuth } from '@/lib/session-auth';
import { setAuth } from '@/lib/auth';
import { Shield, ArrowRight, Loader2 } from 'lucide-react';
import Link from 'next/link';

function Verify2FAForm() {
  const router = useRouter();
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [tempToken, setTempToken] = useState<string | null>(null);

  useEffect(() => {
    const token = sessionStorage.getItem('scc_2fa_temp_token');
    setTempToken(token);
    if (!token) {
      setError('جلسة التحقق غير صالحة — جرب تسجيل الدخول مرة أخرى');
    }
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!tempToken) return;
    setLoading(true); setError('');
    try {
      const initial = await api.post('/auth/verify-2fa-login', { tempToken, code });
      const data = await sessionAuth('migrate', { refreshToken: initial.data.refreshToken, remember: true });
      const authData = {
        accessToken: data.accessToken,
        role: data.user.role,
        tenantSlug: data.user?.tenantSlug || null,
        tenantId: data.user?.tenantId || null,
        user: {
          email: data.user.email,
          firstName: data.user.firstName,
          lastName: data.user.lastName,
        },
      };
      setAuth(authData, true);
      sessionStorage.removeItem('scc_2fa_temp_token');
      router.push('/dashboard');
    } catch (err: any) {
      setError(err.response?.data?.message || err.message || 'كود التحقق غير صحيح');
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
              placeholder="أدخل 6 أرقام أو رمز استرداد"
              maxLength={16}
              autoFocus
              className="w-full bg-slate-800 border border-slate-700 text-white rounded-xl py-4 px-4 text-lg text-center tracking-[0.5em] font-mono focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500 transition-all placeholder:text-slate-500 placeholder:tracking-normal placeholder:text-sm"
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/[^0-9A-Fa-f]/g, '').toUpperCase())}
            />
            <button
              type="submit"
              disabled={loading || !tempToken || !(/^\d{6}$/.test(code) || /^[0-9A-F]{8}$/.test(code) || /^[0-9A-F]{16}$/.test(code))}
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
  return <Verify2FAForm />;
}
