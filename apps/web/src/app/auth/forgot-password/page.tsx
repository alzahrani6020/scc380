'use client';

import { useState } from 'react';
import api from '@/lib/api';
import { Mail, ArrowRight, Building2, CheckCircle2, Loader2 } from 'lucide-react';
import Link from 'next/link';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [resetData, setResetData] = useState<any>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true); setError('');
    try {
      const res = await api.post('/auth/forgot-password', { email });
      setSent(true);
      setResetData(res.data);
    } catch (err: any) {
      setError(err.response?.data?.message || 'فشل إرسال الرابط');
    } finally { setLoading(false); }
  };

  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center relative overflow-hidden">
      <div className="absolute top-0 right-0 w-[600px] h-[600px] bg-primary-600/10 rounded-full blur-[120px] -translate-y-1/2 translate-x-1/3" />
      <div className="relative z-10 w-full max-w-md mx-4">
        <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-8 shadow-2xl shadow-black/50">
          <div className="text-center mb-6">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-primary-500 to-primary-700 mb-4 shadow-lg shadow-primary-500/30">
              <Building2 className="h-8 w-8 text-white" />
            </div>
            <h1 className="text-2xl font-bold text-white mb-1">نسيت كلمة المرور؟</h1>
            <p className="text-slate-400 text-sm">أدخل بريدك الإلكتروني وسنرسل لك رابط إعادة التعيين</p>
          </div>

          {error && (
            <div className="mb-4 p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm text-center">{error}</div>
          )}

          {sent ? (
            <div className="text-center space-y-4">
              <CheckCircle2 className="h-16 w-16 text-emerald-400 mx-auto" />
              <p className="text-white font-medium">تم إرسال رابط إعادة التعيين!</p>
              <p className="text-slate-400 text-sm">تحقق من بريدك الإلكتروني (بما فيه مجلد الرسائل غير المرغوب فيها)</p>
              {resetData?.resetUrl && (
                <div className="bg-slate-800/50 rounded-xl p-4 text-left">
                  <p className="text-slate-400 text-xs mb-2">رابط إعادة التعيين (للعرض فقط في Demo):</p>
                  <a href={resetData.resetUrl} className="text-primary-400 text-xs break-all hover:underline">{resetData.resetUrl}</a>
                </div>
              )}
              <Link href="/auth/login" className="inline-flex items-center justify-center gap-2 text-primary-400 hover:text-primary-300 text-sm transition-colors">
                <ArrowRight className="h-4 w-4" /> العودة لتسجيل الدخول
              </Link>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="relative">
                <Mail className="absolute right-3 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-500" />
                <input
                  type="email" required placeholder="البريد الإلكتروني"
                  className="w-full bg-slate-800 border border-slate-700 text-white rounded-xl py-3 pr-10 pl-4 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500/50 focus:border-primary-500 transition-all placeholder:text-slate-500"
                  value={email} onChange={(e) => setEmail(e.target.value)}
                />
              </div>
              <button type="submit" disabled={loading}
                className="w-full bg-primary-600 hover:bg-primary-500 text-white font-bold py-3 px-4 rounded-xl transition-all shadow-lg shadow-primary-600/20 flex items-center justify-center gap-2">
                {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : 'إرسال رابط إعادة التعيين'}
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
