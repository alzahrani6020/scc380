'use client';

import { useState, useEffect } from 'react';
import api from '@/lib/api';
import {
  Shield, Key, FileCheck, RefreshCw, AlertTriangle,
  CheckCircle2, Copy, Loader2, ExternalLink, Lock,
} from 'lucide-react';

interface ZatcaStatus {
  status: string;
  environment?: string;
  hasCSR?: boolean;
  hasCSID?: boolean;
  createdAt?: string;
  lastRenewedAt?: string;
  expiresAt?: string;
  message?: string;
}

export default function ZatcaSettingsPage() {
  const [status, setStatus] = useState<ZatcaStatus | null>(null);
  const [otp, setOtp] = useState('');
  const [environment, setEnvironment] = useState<'SANDBOX' | 'PRODUCTION'>('SANDBOX');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => {
    fetchStatus();
  }, []);

  const fetchStatus = async () => {
    try {
      const res = await api.get('/zatca/credentials/status');
      setStatus(res.data);
    } catch {
      setStatus({ status: 'NOT_CONFIGURED', message: 'لم يتم إعداد ZATCA بعد' });
    }
  };

  const handleGenerateCSR = async () => {
    if (!otp) { setError('أدخل OTP من بوابة فاتورة'); return; }
    setLoading(true); setError(''); setSuccess('');
    try {
      const res = await api.post('/zatca/credentials/csr', { otp });
      setSuccess(res.data.message);
      setOtp('');
      fetchStatus();
    } catch (err: any) {
      setError(err.response?.data?.message || 'فشل توليد CSR');
    } finally { setLoading(false); }
  };

  const handleRequestCSID = async () => {
    setLoading(true); setError(''); setSuccess('');
    try {
      const res = await api.post(`/zatca/credentials/csid?environment=${environment}`);
      setSuccess(res.data.message);
      fetchStatus();
    } catch (err: any) {
      setError(err.response?.data?.message || 'فشل طلب CSID');
    } finally { setLoading(false); }
  };

  const handleRenew = async () => {
    setLoading(true); setError(''); setSuccess('');
    try {
      const res = await api.post('/zatca/credentials/renew');
      setSuccess(res.data.message);
      fetchStatus();
    } catch (err: any) {
      setError(err.response?.data?.message || 'فشل التجديد');
    } finally { setLoading(false); }
  };

  const getStatusColor = (s?: string) => {
    switch (s) {
      case 'ACTIVE': return 'text-emerald-400 bg-emerald-500/10 border-emerald-500/30';
      case 'PENDING': return 'text-amber-400 bg-amber-500/10 border-amber-500/30';
      case 'NOT_CONFIGURED': return 'text-slate-400 bg-slate-500/10 border-slate-500/30';
      default: return 'text-red-400 bg-red-500/10 border-red-500/30';
    }
  };

  const getStatusLabel = (s?: string) => {
    switch (s) {
      case 'ACTIVE': return 'نشطة';
      case 'PENDING': return 'بانتظار CSID';
      case 'NOT_CONFIGURED': return 'غير مفعل';
      default: return s || 'غير معروف';
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 p-6" dir="rtl">
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center shadow-lg">
            <Shield className="h-6 w-6 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-white">إعدادات هيئة الزكاة (ZATCA)</h1>
            <p className="text-slate-400 text-sm">إدارة الشهادة الرقمية والفوترة الإلكترونية</p>
          </div>
        </div>

        {error && (
          <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm flex items-center gap-2">
            <AlertTriangle className="h-4 w-4" /> {error}
          </div>
        )}
        {success && (
          <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-sm flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4" /> {success}
          </div>
        )}

        {/* Status Card */}
        <div className="bg-slate-900/50 border border-slate-800 rounded-2xl p-6">
          <h2 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
            <FileCheck className="h-5 w-5 text-primary-400" />
            حالة الشهادة
          </h2>

          {status ? (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className={`p-4 rounded-xl border ${getStatusColor(status.status)}`}>
                <p className="text-xs opacity-70 mb-1">الحالة</p>
                <p className="text-lg font-bold">{getStatusLabel(status.status)}</p>
              </div>
              <div className="p-4 bg-slate-800/50 rounded-xl border border-slate-700">
                <p className="text-xs text-slate-400 mb-1">البيئة</p>
                <p className="text-white font-bold">{status.environment === 'PRODUCTION' ? 'إنتاج' : 'تجريبي'}</p>
              </div>
              <div className="p-4 bg-slate-800/50 rounded-xl border border-slate-700">
                <p className="text-xs text-slate-400 mb-1">تاريخ الانتهاء</p>
                <p className="text-white font-bold">{status.expiresAt ? new Date(status.expiresAt).toLocaleDateString('ar-SA') : '—'}</p>
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 text-primary-400 animate-spin" />
            </div>
          )}

          {status?.status === 'ACTIVE' && (
            <div className="mt-4 flex items-center gap-4 text-sm">
              <span className="text-slate-400">CSR: {status.hasCSR ? '✅' : '❌'}</span>
              <span className="text-slate-400">CSID: {status.hasCSID ? '✅' : '❌'}</span>
              {status.lastRenewedAt && (
                <span className="text-slate-400">آخر تجديد: {new Date(status.lastRenewedAt).toLocaleDateString('ar-SA')}</span>
              )}
            </div>
          )}
        </div>

        {/* Step 1: CSR */}
        <div className="bg-slate-900/50 border border-slate-800 rounded-2xl p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-8 h-8 rounded-lg bg-primary-500/20 flex items-center justify-center text-primary-400 font-bold">1</div>
            <h2 className="text-lg font-bold text-white">توليد CSR</h2>
          </div>

          <p className="text-slate-400 text-sm mb-4">
            1. ادخل إلى <a href="https://sandbox.zatca.gov.sa" target="_blank" rel="noopener noreferrer" className="text-primary-400 hover:underline inline-flex items-center gap-1">بوابة فاتورة <ExternalLink className="h-3 w-3" /></a>
            <br />
            2. انسخ OTP (رمز التفعيل المؤقت)
            <br />
            3. ألصقه هنا واضغط "توليد CSR"
          </p>

          <div className="flex flex-col md:flex-row gap-3">
            <div className="relative flex-1">
              <Lock className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
              <input
                type="text"
                placeholder="أدخل OTP من بوابة فاتورة"
                value={otp}
                onChange={(e) => setOtp(e.target.value)}
                className="w-full bg-slate-800 border border-slate-700 text-white rounded-xl py-3 pr-10 pl-4 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500/50 focus:border-primary-500 transition-all placeholder:text-slate-500"
              />
            </div>
            <button
              onClick={handleGenerateCSR}
              disabled={loading || !otp}
              className="bg-primary-600 hover:bg-primary-500 text-white font-bold py-3 px-6 rounded-xl transition-all shadow-lg shadow-primary-600/20 flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Key className="h-4 w-4" />}
              توليد CSR
            </button>
          </div>
        </div>

        {/* Step 2: CSID */}
        <div className="bg-slate-900/50 border border-slate-800 rounded-2xl p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-8 h-8 rounded-lg bg-primary-500/20 flex items-center justify-center text-primary-400 font-bold">2</div>
            <h2 className="text-lg font-bold text-white">طلب الشهادة الرقمية (CSID)</h2>
          </div>

          <div className="flex flex-col md:flex-row gap-3 mb-4">
            <select
              value={environment}
              onChange={(e) => setEnvironment(e.target.value as any)}
              className="bg-slate-800 border border-slate-700 text-white rounded-xl py-3 px-4 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500/50"
            >
              <option value="SANDBOX">بيئة تجريبية (Sandbox)</option>
              <option value="PRODUCTION">بيئة إنتاج (Production)</option>
            </select>
            <button
              onClick={handleRequestCSID}
              disabled={loading || status?.status !== 'PENDING'}
              className="flex-1 bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-3 px-6 rounded-xl transition-all shadow-lg shadow-emerald-600/20 flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileCheck className="h-4 w-4" />}
              طلب CSID
            </button>
          </div>

          {status?.status === 'NOT_CONFIGURED' && (
            <p className="text-amber-400 text-xs">⚠️ أكمل الخطوة 1 (توليد CSR) أولاً</p>
          )}
        </div>

        {/* Step 3: Renewal */}
        {status?.status === 'ACTIVE' && (
          <div className="bg-slate-900/50 border border-slate-800 rounded-2xl p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-8 h-8 rounded-lg bg-primary-500/20 flex items-center justify-center text-primary-400 font-bold">3</div>
              <h2 className="text-lg font-bold text-white">تجديد الشهادة</h2>
            </div>

            <p className="text-slate-400 text-sm mb-4">
              الشهادة تنتهي صلاحيتها تلقائياً بعد سنة. يمكنك تجديدها من هنا.
            </p>

            <button
              onClick={handleRenew}
              disabled={loading}
              className="bg-slate-800 hover:bg-slate-700 text-white font-bold py-3 px-6 rounded-xl transition-all border border-slate-700 flex items-center gap-2 disabled:opacity-50"
            >
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
              تجديد الشهادة
            </button>
          </div>
        )}

        {/* Info */}
        <div className="bg-slate-900/30 border border-slate-800 rounded-2xl p-6 text-center">
          <p className="text-slate-400 text-sm">
            💡 <span className="text-white">ملاحظة:</span> الشهادة الرقمية مرتبطة برقمك الضريبي. تأكد من تسجيل الرقم الضريبي في{' '}
            <a href="/dashboard/settings" className="text-primary-400 hover:underline">إعدادات المنشأة</a>
          </p>
        </div>
      </div>
    </div>
  );
}
