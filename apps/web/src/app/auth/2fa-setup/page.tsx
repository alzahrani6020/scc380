'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import api from '@/lib/api';
import { Shield, QrCode, Copy, CheckCircle2, Eye, EyeOff, ArrowRight, Loader2 } from 'lucide-react';
import Link from 'next/link';

export default function TwoFactorSetupPage() {
  const router = useRouter();
  const [step, setStep] = useState<'loading' | 'setup' | 'verify' | 'done'>('loading');
  const [qrCode, setQrCode] = useState('');
  const [secret, setSecret] = useState('');
  const [code, setCode] = useState('');
  const [backupCodes, setBackupCodes] = useState<string[]>([]);
  const [showSecret, setShowSecret] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    api.post('/auth/2fa/setup')
      .then((res) => {
        setQrCode(res.data.qrCode);
        setSecret(res.data.secret);
        setStep('setup');
      })
      .catch((err) => {
        setError(err.response?.data?.message || 'فشل تحميل إعداد 2FA');
        setStep('setup');
      });
  }, []);

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true); setError('');
    try {
      const res = await api.post('/auth/2fa/verify-setup', { code });
      setBackupCodes(res.data.backupCodes);
      setStep('done');
    } catch (err: any) {
      setError(err.response?.data?.message || 'كود غير صحيح');
    } finally { setLoading(false); }
  };

  const copySecret = () => {
    navigator.clipboard.writeText(secret);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (step === 'loading') {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <div className="w-12 h-12 border-4 border-primary-500/30 border-t-primary-500 rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center relative overflow-hidden p-4">
      <div className="absolute top-0 right-0 w-[600px] h-[600px] bg-primary-600/10 rounded-full blur-[120px] -translate-y-1/2 translate-x-1/3" />
      <div className="relative z-10 w-full max-w-md mx-4">
        <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-8 shadow-2xl shadow-black/50">
          <div className="text-center mb-6">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-600 mb-4 shadow-lg shadow-emerald-500/30">
              <Shield className="h-8 w-8 text-white" />
            </div>
            <h1 className="text-2xl font-bold text-white mb-1">المصادقة الثنائية (2FA)</h1>
            <p className="text-slate-400 text-sm">أضف طبقة أمان إضافية لحسابك</p>
          </div>

          {error && (
            <div className="mb-4 p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm text-center">{error}</div>
          )}

          {step === 'setup' && (
            <div className="space-y-5">
              <div className="bg-slate-800/50 rounded-xl p-4 text-center">
                <p className="text-slate-300 text-sm mb-3">امسح QR Code بتطبيق المصادقة (Google Authenticator / Microsoft Authenticator)</p>
                {qrCode && (
                  <img src={qrCode} alt="2FA QR Code" className="w-48 h-48 mx-auto rounded-xl" />
                )}
              </div>

              <div className="bg-slate-800/50 rounded-xl p-4">
                <p className="text-slate-400 text-xs mb-2">أو أدخل السر يدوياً:</p>
                <div className="flex items-center gap-2">
                  <code className="flex-1 bg-slate-900 rounded-lg px-3 py-2 text-sm text-white font-mono truncate">
                    {showSecret ? secret : '••••••••••••••••'}
                  </code>
                  <button onClick={() => setShowSecret(!showSecret)} className="p-2 text-slate-400 hover:text-white transition-colors">
                    {showSecret ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                  <button onClick={copySecret} className="p-2 text-slate-400 hover:text-emerald-400 transition-colors">
                    {copied ? <CheckCircle2 className="h-4 w-4 text-emerald-400" /> : <Copy className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              <form onSubmit={handleVerify} className="space-y-3">
                <input
                  type="text" required placeholder="أدخل كود التحقق (6 أرقام)"
                  maxLength={6}
                  className="w-full bg-slate-800 border border-slate-700 text-white rounded-xl py-3 px-4 text-sm text-center tracking-[0.5em] font-mono focus:outline-none focus:ring-2 focus:ring-primary-500/50 focus:border-primary-500 transition-all placeholder:text-slate-500 placeholder:tracking-normal"
                  value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
                />
                <button type="submit" disabled={loading || code.length !== 6}
                  className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-3 px-4 rounded-xl transition-all shadow-lg shadow-emerald-600/20 flex items-center justify-center gap-2 disabled:opacity-50">
                  {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : 'تفعيل 2FA'}
                </button>
              </form>
            </div>
          )}

          {step === 'done' && (
            <div className="space-y-5 text-center">
              <CheckCircle2 className="h-16 w-16 text-emerald-400 mx-auto" />
              <div>
                <p className="text-white font-bold text-lg">تم تفعيل 2FA بنجاح!</p>
                <p className="text-slate-400 text-sm mt-1">احفظ رموز الاسترداد في مكان آمن</p>
              </div>

              <div className="bg-slate-800/50 rounded-xl p-4 text-left">
                <p className="text-amber-400 text-sm font-medium mb-2">⚠️ رموز الاسترداد (استخدمها مرة واحدة فقط):</p>
                <div className="grid grid-cols-2 gap-2">
                  {backupCodes.map((c, i) => (
                    <code key={i} className="bg-slate-900 rounded-lg px-3 py-2 text-xs text-white font-mono text-center">{c}</code>
                  ))}
                </div>
                <button onClick={() => { navigator.clipboard.writeText(backupCodes.join('\n')); }}
                  className="mt-3 text-xs text-primary-400 hover:text-primary-300 flex items-center gap-1">
                  <Copy className="h-3 w-3" /> نسخ جميع الرموز
                </button>
              </div>

              <button onClick={() => router.push('/dashboard')}
                className="w-full bg-primary-600 hover:bg-primary-500 text-white font-bold py-3 px-4 rounded-xl transition-all shadow-lg shadow-primary-600/20">
                الانتقال للوحة التحكم
              </button>
            </div>
          )}

          <div className="mt-6 text-center">
            <Link href="/dashboard/settings" className="text-sm text-slate-400 hover:text-slate-300 transition-colors flex items-center justify-center gap-1">
              <ArrowRight className="h-3 w-3" /> رجوع للإعدادات
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
