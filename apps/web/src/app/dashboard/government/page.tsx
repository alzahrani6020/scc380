'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import api from '@/lib/api';
import { Landmark, FileCheck, Shield, Globe, RefreshCw, AlertTriangle } from 'lucide-react';

const services = [
  { name: 'زاتكا - الفوترة الإلكترونية', desc: 'إدارة شهادة الفوترة الإلكترونية وإعدادات الربط', icon: FileCheck, color: 'from-emerald-500 to-teal-500' },
  { name: 'أبشر - التحقق من الهوية', desc: 'التحقق من هوية الأفراد عبر منصة أبشر', icon: Shield, color: 'from-blue-500 to-indigo-500', status: 'قريباً' },
  { name: 'وزارة الداخلية - السجل التجاري', desc: 'التحقق من السجل التجاري للمنشآت', icon: Landmark, color: 'from-violet-500 to-purple-500', status: 'قريباً' },
  { name: 'نفاذ - التوقيع الرقمي', desc: 'التوقيع الرقمي والمصادقة على المستندات', icon: Globe, color: 'from-amber-500 to-orange-500', status: 'قريباً' },
];

type CredentialStatus = { status?: string; environment?: string };

export default function GovernmentPage() {
  const [zatca, setZatca] = useState<CredentialStatus | null>(null);
  const [pending, setPending] = useState(true);
  const [error, setError] = useState('');

  const refresh = useCallback(async () => {
    setPending(true);
    setError('');
    try {
      const result = await api.get('/zatca/credentials/status');
      setZatca(result.data);
    } catch {
      setZatca(null);
      setError('تعذر التحقق من إعداد شهادة زاتكا. حالة الاتصال غير معروفة.');
    } finally {
      setPending(false);
    }
  }, []);

  useEffect(() => { void refresh(); }, [refresh]);

  const zatcaStatus = pending ? 'جارٍ التحقق' :
    error ? 'غير معروف' :
    zatca?.status === 'ACTIVE' ? 'شهادة نشطة' :
    zatca?.status === 'PENDING' ? 'بانتظار الشهادة' :
    zatca?.status === 'NOT_CONFIGURED' ? 'غير مهيأ' : 'غير معروف';

  return (
    <div className="space-y-6 animate-fade-in-up">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold text-white">
            <Landmark className="h-6 w-6 text-primary-400" /> التكاملات الحكومية
          </h1>
          <p className="mt-1 text-sm text-slate-300">حالة إعداد التكاملات الحكومية الخاصة بالمنشأة</p>
        </div>
        <button type="button" onClick={() => void refresh()} disabled={pending}
          className="inline-flex items-center gap-2 rounded-lg border border-slate-700 px-3 py-2 text-sm text-slate-200 hover:bg-slate-800 disabled:opacity-50">
          <RefreshCw className={`h-4 w-4 ${pending ? 'animate-spin' : ''}`} /> تحديث الحالة
        </button>
      </div>
      {error && <div role="alert" className="flex items-center gap-2 rounded-lg border border-amber-700 bg-amber-950/40 p-3 text-sm text-amber-200">
        <AlertTriangle className="h-4 w-4" /> {error}
      </div>}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {services.map((svc, index) => {
          const Icon = svc.icon;
          const label = index === 0 ? zatcaStatus : svc.status;
          const active = index === 0 && !pending && !error && zatca?.status === 'ACTIVE';
          return (
            <div key={svc.name} className="scc-card-hover">
              <div className="flex items-start gap-4">
                <div className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br ${svc.color}`}>
                  <Icon className="h-6 w-6 text-white" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <h2 className="font-bold text-white">{svc.name}</h2>
                    <span className={`rounded-full px-2 py-0.5 text-xs ${active ? 'bg-emerald-500/20 text-emerald-300' : 'bg-slate-700 text-slate-200'}`}>
                      {label}
                    </span>
                  </div>
                  <p className="mt-1 text-sm text-slate-300">{svc.desc}</p>
                  {index === 0 && <>
                    <p className="mt-2 text-xs text-slate-400">نشاط الشهادة لا يثبت نجاح إرسال الفواتير أو الاتصال المباشر بالهيئة.</p>
                    <Link href="/dashboard/zatca" className="mt-2 inline-block text-sm text-primary-300 hover:underline">
                      إدارة شهادة زاتكا
                    </Link>
                  </>}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
