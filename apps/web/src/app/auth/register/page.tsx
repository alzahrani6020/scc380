'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import api from '@/lib/api';
import {
  Building2, ArrowLeft, ArrowRight, Eye, EyeOff,
  Mail, Lock, User, Phone, Briefcase, Globe,
} from 'lucide-react';
import Link from 'next/link';

export default function RegisterPage() {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [phone, setPhone] = useState('');
  const [tenantName, setTenantName] = useState('');
  const [tenantSlug, setTenantSlug] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true); setError('');
    try {
      const res = await api.post('/auth/register', {
        email, password, firstName, lastName, phone,
        tenantName: step === 2 ? tenantName : undefined,
        tenantSlug: step === 2 ? tenantSlug : undefined,
      });
      if (res.data.id) {
        router.push('/auth/login');
      }
    } catch (err: any) {
      setError(err.response?.data?.message || 'فشل إنشاء الحساب');
    } finally { setLoading(false); }
  };

  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center relative overflow-hidden">
      <div className="absolute top-0 right-0 w-[600px] h-[600px] bg-primary-600/10 rounded-full blur-[120px] -translate-y-1/2 translate-x-1/3" />
      <div className="absolute bottom-0 left-0 w-[500px] h-[500px] bg-purple-600/10 rounded-full blur-[100px] translate-y-1/3 -translate-x-1/4" />

      <div className="relative z-10 w-full max-w-md mx-4">
        <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-8 shadow-2xl shadow-black/50">
          <div className="text-center mb-6">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-primary-500 to-primary-700 mb-4 shadow-lg shadow-primary-500/30">
              <Building2 className="h-8 w-8 text-white" />
            </div>
            <h1 className="text-2xl font-bold text-white mb-1">إنشاء حساب جديد</h1>
            <p className="text-slate-400 text-sm">Smart Command Center Platform</p>
          </div>

          {error && (
            <div className="mb-4 p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm text-center">
              {error}
            </div>
          )}

          {/* Step indicator */}
          <div className="flex items-center justify-center gap-2 mb-6">
            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${step >= 1 ? 'bg-primary-600 text-white' : 'bg-slate-800 text-slate-500'}`}>1</div>
            <div className={`w-12 h-0.5 ${step >= 2 ? 'bg-primary-600' : 'bg-slate-800'}`} />
            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${step >= 2 ? 'bg-primary-600 text-white' : 'bg-slate-800 text-slate-500'}`}>2</div>
          </div>

          <form className="space-y-4" onSubmit={handleSubmit}>
            {step === 1 ? (
              <>
                <div className="grid grid-cols-2 gap-3">
                  <div className="relative">
                    <User className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
                    <input type="text" required placeholder="الاسم الأول"
                      className="w-full bg-slate-800 border border-slate-700 text-white rounded-xl py-3 pr-10 pl-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500/50 focus:border-primary-500 transition-all placeholder:text-slate-500"
                      value={firstName} onChange={(e) => setFirstName(e.target.value)} />
                  </div>
                  <div className="relative">
                    <User className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
                    <input type="text" required placeholder="الاسم الأخير"
                      className="w-full bg-slate-800 border border-slate-700 text-white rounded-xl py-3 pr-10 pl-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500/50 focus:border-primary-500 transition-all placeholder:text-slate-500"
                      value={lastName} onChange={(e) => setLastName(e.target.value)} />
                  </div>
                </div>

                <div className="relative">
                  <Mail className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
                  <input type="email" required placeholder="البريد الإلكتروني"
                    className="w-full bg-slate-800 border border-slate-700 text-white rounded-xl py-3 pr-10 pl-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500/50 focus:border-primary-500 transition-all placeholder:text-slate-500"
                    value={email} onChange={(e) => setEmail(e.target.value)} />
                </div>

                <div className="relative">
                  <Phone className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
                  <input type="tel" placeholder="رقم الجوال (اختياري)"
                    className="w-full bg-slate-800 border border-slate-700 text-white rounded-xl py-3 pr-10 pl-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500/50 focus:border-primary-500 transition-all placeholder:text-slate-500"
                    value={phone} onChange={(e) => setPhone(e.target.value)} />
                </div>

                <div className="relative">
                  <Lock className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
                  <input type={showPassword ? 'text' : 'password'} required placeholder="كلمة المرور"
                    className="w-full bg-slate-800 border border-slate-700 text-white rounded-xl py-3 pr-10 pl-12 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500/50 focus:border-primary-500 transition-all placeholder:text-slate-500"
                    value={password} onChange={(e) => setPassword(e.target.value)} />
                  <button type="button" onClick={() => setShowPassword(!showPassword)}
                    className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 transition-colors">
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>

                <button type="button" onClick={() => setStep(2)}
                  className="w-full bg-primary-600 hover:bg-primary-500 text-white font-bold py-3 px-4 rounded-xl transition-all shadow-lg shadow-primary-600/20 flex items-center justify-center gap-2">
                  التالي
                  <ArrowLeft className="h-4 w-4" />
                </button>
              </>
            ) : (
              <>
                <div className="relative">
                  <Briefcase className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
                  <input type="text" required placeholder="اسم المنشأة"
                    className="w-full bg-slate-800 border border-slate-700 text-white rounded-xl py-3 pr-10 pl-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500/50 focus:border-primary-500 transition-all placeholder:text-slate-500"
                    value={tenantName} onChange={(e) => setTenantName(e.target.value)} />
                </div>

                <div className="relative">
                  <Globe className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
                  <input type="text" required placeholder="معرف المنشأة (Slug)"
                    className="w-full bg-slate-800 border border-slate-700 text-white rounded-xl py-3 pr-10 pl-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500/50 focus:border-primary-500 transition-all placeholder:text-slate-500"
                    value={tenantSlug} onChange={(e) => setTenantSlug(e.target.value.replace(/\s+/g, '-').toLowerCase())} />
                  <p className="text-xs text-slate-500 mt-1 pr-1">مثال: my-company → سيكون الرابط: my-company.scc380.com</p>
                </div>

                <div className="flex gap-3">
                  <button type="button" onClick={() => setStep(1)}
                    className="flex-1 bg-slate-800 hover:bg-slate-700 text-white font-bold py-3 px-4 rounded-xl transition-all flex items-center justify-center gap-2">
                    <ArrowRight className="h-4 w-4" />
                    رجوع
                  </button>
                  <button type="submit" disabled={loading}
                    className="flex-1 bg-primary-600 hover:bg-primary-500 text-white font-bold py-3 px-4 rounded-xl transition-all shadow-lg shadow-primary-600/20 disabled:opacity-50 flex items-center justify-center gap-2">
                    {loading ? 'جاري الإنشاء...' : 'إنشاء الحساب'}
                  </button>
                </div>
              </>
            )}
          </form>

          <div className="mt-6 text-center">
            <Link href="/auth/login" className="text-sm text-primary-400 hover:text-primary-300 transition-colors flex items-center justify-center gap-1">
              لديك حساب؟ تسجيل الدخول
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
