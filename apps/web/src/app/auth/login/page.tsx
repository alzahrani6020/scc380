'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import api from '@/lib/api';
import { Building2, Zap, Shield, Lock, Mail, ChevronLeft } from 'lucide-react';

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const token = localStorage.getItem('accessToken');
    if (token) router.push('/dashboard');
  }, [router]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true); setError('');
    try {
      const res = await api.post('/auth/login', { email, password });
      localStorage.setItem('accessToken', res.data.accessToken);
      localStorage.setItem('refreshToken', res.data.refreshToken);
      localStorage.setItem('role', res.data.user.role);
      if (res.data.user?.tenantSlug) localStorage.setItem('tenantSlug', res.data.user.tenantSlug);
      router.push('/dashboard');
    } catch (err: any) {
      setError(err.response?.data?.message || 'فشل تسجيل الدخول');
    } finally { setLoading(false); }
  };

  const handleVIP = async () => {
    setLoading(true); setError('');
    try {
      const res = await api.post('/auth/login', { email: 'vip@scc.sa', password: 'vip123456' });
      localStorage.setItem('accessToken', res.data.accessToken);
      localStorage.setItem('refreshToken', res.data.refreshToken);
      localStorage.setItem('role', res.data.user.role);
      router.push('/dashboard');
    } catch (err: any) {
      setError(err.response?.data?.message || 'فشل الدخول السريع');
    } finally { setLoading(false); }
  };

  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center relative overflow-hidden">
      {/* Background Effects */}
      <div className="absolute top-0 right-0 w-[600px] h-[600px] bg-primary-600/10 rounded-full blur-[120px] -translate-y-1/2 translate-x-1/3" />
      <div className="absolute bottom-0 left-0 w-[500px] h-[500px] bg-purple-600/10 rounded-full blur-[100px] translate-y-1/3 -translate-x-1/4" />
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-amber-500/5 rounded-full blur-[150px]" />

      <div className="relative z-10 w-full max-w-md mx-4">
        {/* Card */}
        <div className="scc-card scc-glow animate-fade-in-up">
          {/* Header */}
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-primary-500 to-primary-700 mb-4 shadow-lg shadow-primary-500/30">
              <Building2 className="h-8 w-8 text-white" />
            </div>
            <h1 className="text-2xl font-bold text-white mb-1">مركز القيادة الذكي</h1>
            <p className="text-slate-400 text-sm">Smart Command Center Platform</p>
          </div>

          {error && (
            <div className="mb-4 p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm text-center">
              {error}
            </div>
          )}

          {/* VIP Quick Login */}
          <button
            onClick={handleVIP}
            disabled={loading}
            className="w-full scc-btn-gold mb-4 animate-pulse-glow"
          >
            <Zap className="h-5 w-5" />
            دخول سريع VIP
            <Shield className="h-4 w-4 opacity-80" />
          </button>

          <div className="relative my-6">
            <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-slate-700" /></div>
            <div className="relative flex justify-center text-xs"><span className="px-3 bg-slate-900 text-slate-500">أو سجل الدخول</span></div>
          </div>

          {/* Form */}
          <form onSubmit={handleLogin} className="space-y-4">
            <div className="relative">
              <Mail className="absolute right-3 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-500" />
              <input
                type="email"
                required
                placeholder="البريد الإلكتروني"
                className="scc-input pr-10"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
            <div className="relative">
              <Lock className="absolute right-3 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-500" />
              <input
                type="password"
                required
                placeholder="كلمة المرور"
                className="scc-input pr-10"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>
            <button type="submit" disabled={loading} className="w-full scc-btn-primary">
              {loading ? 'جاري الدخول...' : 'تسجيل الدخول'}
              <ChevronLeft className="h-4 w-4" />
            </button>
          </form>

          <div className="mt-6 text-center">
            <a href="/auth/register" className="text-sm text-primary-400 hover:text-primary-300 transition-colors">
              ليس لديك حساب؟ سجل الآن
            </a>
          </div>
        </div>

        {/* Footer */}
        <p className="text-center text-slate-600 text-xs mt-6">
          © 2026 Smart Command Center 380 — جميع الحقوق محفوظة
        </p>
      </div>
    </div>
  );
}
