'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import api from '@/lib/api';
import { Building2, ArrowLeft } from 'lucide-react';
import Link from 'next/link';

export default function RegisterPage() {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
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
      setError(err.response?.data?.message || 'Registration failed');
    } finally { setLoading(false); }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100">
      <div className="max-w-md w-full space-y-8 p-8 bg-white rounded-xl shadow-lg">
        <div className="text-center">
          <div className="mx-auto h-12 w-12 bg-primary-600 rounded-lg flex items-center justify-center">
            <Building2 className="h-8 w-8 text-white" />
          </div>
          <h2 className="mt-6 text-3xl font-bold text-gray-900">إنشاء حساب جديد</h2>
          <p className="mt-2 text-sm text-gray-600">Smart Command Center Platform</p>
        </div>

        {error && <div className="rounded-md bg-red-50 p-4 text-sm text-red-700">{error}</div>}

        <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
          {step === 1 ? (
            <>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700">الاسم الأول</label>
                  <input type="text" required className="mt-1 input w-full" value={firstName} onChange={(e) => setFirstName(e.target.value)} />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">الاسم الأخير</label>
                  <input type="text" required className="mt-1 input w-full" value={lastName} onChange={(e) => setLastName(e.target.value)} />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">البريد الإلكتروني</label>
                <input type="email" required className="mt-1 input w-full" value={email} onChange={(e) => setEmail(e.target.value)} />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">رقم الجوال</label>
                <input type="tel" className="mt-1 input w-full" value={phone} onChange={(e) => setPhone(e.target.value)} />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">كلمة المرور</label>
                <input type="password" required className="mt-1 input w-full" value={password} onChange={(e) => setPassword(e.target.value)} />
              </div>
              <button type="button" onClick={() => setStep(2)} className="w-full btn-primary">
                التالي
              </button>
            </>
          ) : (
            <>
              <div>
                <label className="block text-sm font-medium text-gray-700">اسم المنشأة</label>
                <input type="text" required className="mt-1 input w-full" value={tenantName} onChange={(e) => setTenantName(e.target.value)} />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">معرف المنشأة (Slug)</label>
                <input type="text" required className="mt-1 input w-full" value={tenantSlug} onChange={(e) => setTenantSlug(e.target.value.replace(/\s+/g, '-').toLowerCase())} />
                <p className="text-xs text-gray-500 mt-1">مثال: my-company</p>
              </div>
              <div className="flex gap-3">
                <button type="button" onClick={() => setStep(1)} className="flex-1 btn-secondary">
                  <ArrowLeft className="inline w-4 h-4 ml-1" /> رجوع
                </button>
                <button type="submit" disabled={loading} className="flex-1 btn-primary disabled:opacity-50">
                  {loading ? 'جاري الإنشاء...' : 'إنشاء الحساب'}
                </button>
              </div>
            </>
          )}
        </form>

        <div className="text-center text-sm">
          <Link href="/auth/login" className="text-primary-600 hover:text-primary-500">
            لديك حساب؟ تسجيل الدخول
          </Link>
        </div>
      </div>
    </div>
  );
}
