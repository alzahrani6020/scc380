'use client';

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import api from '@/lib/api';
import { Lock, Eye, EyeOff, CheckCircle2, Loader2, ArrowRight } from 'lucide-react';
import Link from 'next/link';

function ResetPasswordForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get('token');

  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    if (!token) {
      setError('رابط غير صالح — لم يتم العثور على token');
    }
  }, [token]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password !== confirmPassword) {
      setError('كلمتا المرور غير متطابقتين');
      return;
    }
    if (password.length < 6) {
      setError('كلمة المرور يجب أن تكون 6 أحرف على الأقل');
      return;
    }

    setLoading(true); setError('');
    try {
      await api.post('/auth/reset-password', { token, newPassword: password });
      setSuccess(true);
      setTimeout(() => router.push('/auth/login'), 3000);
    } catch (err: any) {
      setError(err.response?.data?.message || 'فشل إعادة تعيين كلمة المرور');
    } finally { setLoading(false); }
  };

  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center relative overflow-hidden">
      <div className="absolute top-0 right-0 w-[600px] h-[600px] bg-primary-600/10 rounded-full blur-[120px] -translate-y-1/2 translate-x-1/3" />
      <div className="relative z-10 w-full max-w-md mx-4">
        <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-8 shadow-2xl shadow-black/50">
          <div className="text-center mb-6">
            <h1 className="text-2xl font-bold text-white mb-1">إعادة تعيين كلمة المرور</h1>
            <p className="text-slate-400 text-sm">أدخل كلمة المرور الجديدة</p>
          </div>

          {error && (
            <div className="mb-4 p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm text-center">{error}</div>
          )}

          {success ? (
            <div className="text-center space-y-4">
              <CheckCircle2 className="h-16 w-16 text-emerald-400 mx-auto" />
              <p className="text-white font-medium">تم إعادة تعيين كلمة المرور بنجاح!</p>
              <p className="text-slate-400 text-sm">جاري التحويل إلى صفحة تسجيل الدخول...</p>
              <Link href="/auth/login" className="inline-flex items-center justify-center gap-2 text-primary-400 hover:text-primary-300 text-sm transition-colors">
                <ArrowRight className="h-4 w-4" /> تسجيل الدخول الآن
              </Link>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="relative">
                <Lock className="absolute right-3 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-500" />
                <input
                  type={showPassword ? 'text' : 'password'} required placeholder="كلمة المرور الجديدة"
                  className="w-full bg-slate-800 border border-slate-700 text-white rounded-xl py-3 pr-10 pl-12 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500/50 focus:border-primary-500 transition-all placeholder:text-slate-500"
                  value={password} onChange={(e) => setPassword(e.target.value)}
                />
                <button type="button" onClick={() => setShowPassword(!showPassword)}
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 transition-colors">
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              <div className="relative">
                <Lock className="absolute right-3 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-500" />
                <input
                  type={showPassword ? 'text' : 'password'} required placeholder="تأكيد كلمة المرور"
                  className="w-full bg-slate-800 border border-slate-700 text-white rounded-xl py-3 pr-10 pl-4 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500/50 focus:border-primary-500 transition-all placeholder:text-slate-500"
                  value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)}
                />
              </div>
              <button type="submit" disabled={loading || !token}
                className="w-full bg-primary-600 hover:bg-primary-500 text-white font-bold py-3 px-4 rounded-xl transition-all shadow-lg shadow-primary-600/20 flex items-center justify-center gap-2 disabled:opacity-50">
                {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : 'إعادة تعيين كلمة المرور'}
              </button>
              <div className="text-center">
                <Link href="/auth/login" className="text-sm text-primary-400 hover:text-primary-300 transition-colors flex items-center justify-center gap-1">
                  <ArrowRight className="h-3 w-3" /> العودة لتسجيل الدخول
                </Link>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <div className="w-12 h-12 border-4 border-primary-500/30 border-t-primary-500 rounded-full animate-spin" />
      </div>
    }>
      <ResetPasswordForm />
    </Suspense>
  );
}
