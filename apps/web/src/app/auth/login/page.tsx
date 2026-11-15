'use client';

import { useState, useEffect } from 'react';
import axios from 'axios';
import { useRouter } from 'next/navigation';
import api from '@/lib/api';
import { sessionAuth } from '@/lib/session-auth';
import { clearAuth, getToken, setAuth } from '@/lib/auth';
import { GoogleLogin, googleLogout } from '@react-oauth/google';
import {
  Building2, Lock, Mail, ChevronLeft,
  Eye, EyeOff, ArrowRight,
} from 'lucide-react';
import Link from 'next/link';

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [retrySeconds, setRetrySeconds] = useState(0);
  const [diagnosticId, setDiagnosticId] = useState('');

  // Prefill the remembered email when the user chose "تذكرني" previously
  useEffect(() => {
    const saved = localStorage.getItem('rememberedEmail');
    if (saved) {
      setEmail(saved);
      setRememberMe(true);
    }
  }, []);

  useEffect(() => {
    const token = getToken();
    if (!token) return;

    api.get('/auth/me')
      .then(() => router.replace('/dashboard'))
      .catch(() => clearAuth());
  }, [router]);

  useEffect(() => {
    if (retrySeconds <= 0) return;
    const timer = window.setTimeout(() => setRetrySeconds(seconds => Math.max(0, seconds - 1)), 1000);
    return () => window.clearTimeout(timer);
  }, [retrySeconds]);

  const handleLogin = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (loading || retrySeconds > 0) return;
    // Read submitted DOM values rather than relying solely on React state:
    // browser/password-manager autofill may not fire React onChange.
    const submitted = new FormData(e.currentTarget);
    const submittedEmail = String(submitted.get('email') || '').trim().toLowerCase();
    const submittedPassword = String(submitted.get('password') || '');
    if (!submittedEmail || !submittedPassword) {
      setError('يرجى إدخال البريد الإلكتروني وكلمة المرور.');
      return;
    }
    setLoading(true); setError(''); setDiagnosticId('');
    try {
      // Avoid the same-origin Next.js proxy for the initial login request.
      // This endpoint is HTTPS and permits this web origin via API CORS policy.
      const initial = await axios.post('https://scc380-api.onrender.com/auth/login', {
        email: submittedEmail,
        password: submittedPassword,
      }, { headers: { 'Content-Type': 'application/json' } });
      const loginResult = initial.data;

      if (loginResult.requires2FA) {
        sessionStorage.setItem('scc_2fa_temp_token', loginResult.tempToken);
        window.location.href = '/auth/verify-2fa';
        return;
      }

      const data = await sessionAuth('migrate', { refreshToken: loginResult.refreshToken, remember: rememberMe });
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
      setAuth(authData, rememberMe);
      if (rememberMe) {
        localStorage.setItem('rememberedEmail', submittedEmail);
      } else {
        localStorage.removeItem('rememberedEmail');
      }
      // Full navigation (not client-side router.push) so the browser's
      // password manager reliably detects the successful login and offers
      // to save/fill the credentials on the next visit
      window.location.href = '/dashboard';
    } catch (err: any) {
      const traceId = err?.response?.headers?.['x-scc-auth-request-id'];
      if (typeof traceId === 'string' && /^[0-9a-f-]{36}$/i.test(traceId)) {
        setDiagnosticId(traceId);
      }
      if (err?.response?.status === 429) {
        const serverDelay = Number(err.response?.data?.retryAfter ?? err.response?.headers?.['retry-after']);
        const seconds = Number.isFinite(serverDelay) && serverDelay > 0
          ? Math.min(Math.ceil(serverDelay), 3600) : 0;
        setRetrySeconds(seconds);
        const source = err.response?.headers?.['x-scc-auth-origin'];
        const reason = err.response?.data?.errorCode || err.response?.headers?.['x-scc-auth-error-code'];
        const details = source === 'nest-api'
          ? reason === 'LOGIN_CONCURRENT_LIMIT' ? 'حدّ المحاولات المتزامنة في خدمة المصادقة.'
          : reason === 'LOGIN_FAILED_ATTEMPTS' ? 'حدّ المحاولات الفاشلة في خدمة المصادقة.'
          : 'رفض صادر من خدمة المصادقة.'
          : 'لم تؤكد الخدمة مصدر التقييد؛ قد تكون الاستجابة من طبقة وسيطة.';
        setError(`تعذر تسجيل الدخول (429). ${details} ${seconds > 0
          ? `مدة الانتظار الواردة من الخادم: ${Math.floor(seconds / 60)} دقيقة و${seconds % 60} ثانية.`
          : 'لم يرسل الخادم مدة انتظار قابلة للتحقق.'}`);
      } else if (err?.response?.status === 401) {
        setError('البريد الإلكتروني أو كلمة المرور غير صحيحة.');
      } else {
        const detail = err?.response?.data?.message;
        // ValidationPipe returns message[]; never render its array as
        // concatenated English fragments or reveal submitted credentials.
        setError(Array.isArray(detail)
          ? 'لم يستقبل الخادم بيانات الدخول بالشكل المطلوب. تحقق من الحقول ثم حاول لاحقًا.'
          : typeof detail === 'string' ? detail
          : 'تعذر تسجيل الدخول. تحقق من الاتصال وحاول لاحقًا.');
      }
    } finally { setLoading(false); }
  };

  const handleGoogleSuccess = async (credentialResponse: any) => {
    setLoading(true); setError('');
    try {
      const initial = await api.post('/auth/google', { credential: credentialResponse.credential });
      if (initial.data.requires2FA) {
        sessionStorage.setItem('scc_2fa_temp_token', initial.data.tempToken);
        window.location.href = '/auth/verify-2fa';
        return;
      }
      const data = await sessionAuth('migrate', { refreshToken: initial.data.refreshToken, remember: true });
      const authData = {
        accessToken: data.accessToken,
        role: data.user.role,
        tenantSlug: data.user?.tenantSlug || null,
        tenantId: data.user?.tenantId || null,
        user: { email: data.user.email, firstName: data.user.firstName, lastName: data.user.lastName },
      };
      setAuth(authData, true);
      router.push('/dashboard');
    } catch (err: any) {
      setError(err.response?.data?.message || err.message || 'فشل تسجيل الدخول بـ Google');
      googleLogout();
    } finally { setLoading(false); }
  };

  const handleGoogleError = () => {
    setError('فشل تسجيل الدخول بـ Google — حاول مرة أخرى');
  };

  const googleClientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;

  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center relative overflow-hidden">
      <div className="absolute top-0 right-0 w-[600px] h-[600px] bg-primary-600/10 rounded-full blur-[120px] -translate-y-1/2 translate-x-1/3" />
      <div className="absolute bottom-0 left-0 w-[500px] h-[500px] bg-purple-600/10 rounded-full blur-[100px] translate-y-1/3 -translate-x-1/4" />
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-amber-500/5 rounded-full blur-[150px]" />

      <div className="relative z-10 w-full max-w-md mx-4">
        <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-8 shadow-2xl shadow-black/50 animate-fade-in-up">
          <div className="text-center mb-6">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-primary-500 to-primary-700 mb-4 shadow-lg shadow-primary-500/30">
              <Building2 className="h-8 w-8 text-white" />
            </div>
            <h1 className="text-2xl font-bold text-white mb-1">مركز القيادة الذكي</h1>
            <p className="text-slate-400 text-sm">Smart Command Center Platform</p>
          </div>

          {error && (
            <div className="mb-4 p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm text-center">
              {error}
              {retrySeconds > 0 && <p className="mt-2" role="status">يمكن إعادة المحاولة بعد {Math.floor(retrySeconds / 60)} دقيقة و{retrySeconds % 60} ثانية.</p>}
              {diagnosticId && <p className="mt-2 text-xs select-all" dir="ltr">Request ID: {diagnosticId}</p>}
            </div>
          )}

          {/* Google OAuth */}
          {googleClientId ? (
            <div className="mb-4 flex justify-center">
              <GoogleLogin
                onSuccess={handleGoogleSuccess}
                onError={handleGoogleError}
                text="signin_with"
                shape="pill"
              />
            </div>
          ) : (
            <div className="mb-4 p-3 bg-slate-800/50 rounded-xl text-center text-slate-400 text-xs">
              تسجيل الدخول بـ Google غير مفعل — أضف NEXT_PUBLIC_GOOGLE_CLIENT_ID في الإعدادات
            </div>
          )}

          <div className="relative my-5">
            <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-slate-700" /></div>
            <div className="relative flex justify-center text-xs"><span className="px-3 bg-slate-900 text-slate-500">أو</span></div>
          </div>

          {/* Form */}
          <form onSubmit={handleLogin} className="space-y-4">
            <div className="relative">
              <Mail className="absolute right-3 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-500" />
              <input
                type="email"
                name="email"
                required
                autoComplete="username"
                placeholder="البريد الإلكتروني"
                className="w-full bg-slate-800 border border-slate-700 text-white rounded-xl py-3 pr-10 pl-4 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500/50 focus:border-primary-500 transition-all placeholder:text-slate-500"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>

            <div className="relative">
              <Lock className="absolute right-3 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-500" />
              <input
                type={showPassword ? 'text' : 'password'}
                name="password"
                required
                autoComplete="current-password"
                placeholder="كلمة المرور"
                className="w-full bg-slate-800 border border-slate-700 text-white rounded-xl py-3 pr-10 pl-12 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500/50 focus:border-primary-500 transition-all placeholder:text-slate-500"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 transition-colors"
              >
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>

            {/* Remember Me + Forgot Password */}
            <div className="flex items-center justify-between">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                  className="w-4 h-4 rounded border-slate-600 bg-slate-800 text-primary-500 focus:ring-primary-500/50"
                />
                <span className="text-slate-400 text-sm">تذكرني</span>
              </label>
              <Link href="/auth/forgot-password" className="text-primary-400 hover:text-primary-300 text-sm transition-colors">
                نسيت كلمة المرور؟
              </Link>
            </div>

            <button type="submit" disabled={loading || retrySeconds > 0} className="w-full bg-primary-600 hover:bg-primary-500 text-white font-bold py-3 px-4 rounded-xl transition-all shadow-lg shadow-primary-600/20 flex items-center justify-center gap-2">
              {loading ? 'جاري الدخول...' : retrySeconds > 0 ? 'تسجيل الدخول متاح بعد انتهاء الانتظار' : 'تسجيل الدخول'}
              <ChevronLeft className="h-4 w-4" />
            </button>
          </form>

          <div className="mt-6 text-center">
            <Link href="/auth/register" className="text-sm text-primary-400 hover:text-primary-300 transition-colors flex items-center justify-center gap-1">
              ليس لديك حساب؟ سجل الآن
              <ArrowRight className="h-3 w-3" />
            </Link>
          </div>
        </div>

        <p className="text-center text-slate-600 text-xs mt-6">
          © 2026 Smart Command Center 380 — جميع الحقوق محفوظة
        </p>
      </div>
    </div>
  );
}
