'use client';

import { useEffect, useMemo, useState } from 'react';
import api from '@/lib/api';
import { Clock3, RefreshCw, Users, Truck } from 'lucide-react';
import Input from '@/components/ui/Input';
import Button from '@/components/ui/Button';

type AgingBucket = {
  current: number;
  days1to30: number;
  days31to60: number;
  days61to90: number;
  days91plus: number;
};

type AgingReport = {
  asOfDate: string;
  totalOutstanding: number;
  buckets: AgingBucket;
  parties: Array<{
    partyId: string;
    partyName: string;
    invoiceCount: number;
    outstanding: number;
    buckets: AgingBucket;
  }>;
  invoices: Array<{
    id: string;
    invoiceNumber: string;
    partyId: string;
    partyName: string;
    issueDate: string;
    dueDate: string | null;
    currency: string;
    originalAmount: number;
    paidAmount: number;
    outstanding: number;
    overdueDays: number;
    bucket: keyof AgingBucket;
  }>;
};

const empty: AgingReport = {
  asOfDate: '',
  totalOutstanding: 0,
  buckets: { current: 0, days1to30: 0, days31to60: 0, days61to90: 0, days91plus: 0 },
  parties: [],
  invoices: [],
};

const bucketLabels: Record<keyof AgingBucket, string> = {
  current: 'غير مستحق',
  days1to30: '1–30 يومًا',
  days31to60: '31–60 يومًا',
  days61to90: '61–90 يومًا',
  days91plus: 'أكثر من 90 يومًا',
};

export default function AgingPage() {
  const [mode, setMode] = useState<'AR' | 'AP'>('AR');
  const [asOfDate, setAsOfDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [ar, setAr] = useState<AgingReport>(empty);
  const [ap, setAp] = useState<AgingReport>(empty);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    try {
      const params = { asOfDate };
      const [arRes, apRes] = await Promise.all([
        api.get('/reports/receivables-aging', { params }),
        api.get('/reports/payables-aging', { params }),
      ]);
      setAr(arRes.data);
      setAp(apRes.data);
    } catch (err: any) {
      alert(err.response?.data?.message || 'تعذر تحميل أعمار الذمم');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const report = mode === 'AR' ? ar : ap;
  const title = mode === 'AR' ? 'أعمار الذمم المدينة' : 'أعمار الذمم الدائنة';
  const entityLabel = mode === 'AR' ? 'العميل' : 'المورد';

  const bucketCards = useMemo(
    () => (Object.keys(bucketLabels) as Array<keyof AgingBucket>).map(key => ({
      key,
      label: bucketLabels[key],
      value: report.buckets?.[key] || 0,
    })),
    [report],
  );

  return (
    <div className="space-y-6 animate-fade-in-up">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <Clock3 className="h-6 w-6 text-primary-400" />
            {title}
          </h1>
          <p className="text-slate-400 text-sm mt-1">
            تحليل المبالغ المستحقة حسب تاريخ الاستحقاق كما في التاريخ المحدد
          </p>
        </div>
        <div className="flex flex-wrap items-end gap-3">
          <div className="flex rounded-lg border border-slate-700 overflow-hidden">
            <button
              onClick={() => setMode('AR')}
              className={`px-4 py-2 text-sm flex items-center gap-2 ${mode === 'AR' ? 'bg-primary-600 text-white' : 'bg-slate-900 text-slate-300'}`}
            >
              <Users className="h-4 w-4" /> مدينة
            </button>
            <button
              onClick={() => setMode('AP')}
              className={`px-4 py-2 text-sm flex items-center gap-2 ${mode === 'AP' ? 'bg-primary-600 text-white' : 'bg-slate-900 text-slate-300'}`}
            >
              <Truck className="h-4 w-4" /> دائنة
            </button>
          </div>
          <Input label="كما في تاريخ" type="date" value={asOfDate} onChange={e => setAsOfDate(e.target.value)} />
          <Button onClick={load} isLoading={loading}><RefreshCw className="h-4 w-4" /> تحديث</Button>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3">
        <div className="scc-card">
          <p className="text-xs text-slate-500">إجمالي المستحق</p>
          <p className="text-xl font-bold text-white mt-2">{Number(report.totalOutstanding || 0).toLocaleString('ar-SA', { maximumFractionDigits: 2 })}</p>
        </div>
        {bucketCards.map(card => (
          <div key={card.key} className="scc-card">
            <p className="text-xs text-slate-500">{card.label}</p>
            <p className={`text-xl font-bold mt-2 ${card.key === 'days91plus' ? 'text-red-400' : card.key === 'current' ? 'text-emerald-400' : 'text-amber-400'}`}>
              {Number(card.value).toLocaleString('ar-SA', { maximumFractionDigits: 2 })}
            </p>
          </div>
        ))}
      </div>

      <div className="bg-slate-900 rounded-xl border border-slate-800 overflow-hidden">
        <div className="p-4 border-b border-slate-800">
          <h2 className="font-bold text-white">حسب {entityLabel}</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-800/50 text-slate-400">
                <th className="p-3 text-right">{entityLabel}</th>
                <th className="p-3 text-center">عدد الفواتير</th>
                <th className="p-3 text-left">غير مستحق</th>
                <th className="p-3 text-left">1–30</th>
                <th className="p-3 text-left">31–60</th>
                <th className="p-3 text-left">61–90</th>
                <th className="p-3 text-left">+90</th>
                <th className="p-3 text-left">الإجمالي</th>
              </tr>
            </thead>
            <tbody>
              {report.parties.map(party => (
                <tr key={party.partyId} className="border-t border-slate-800/60">
                  <td className="p-3 text-white font-medium">{party.partyName}</td>
                  <td className="p-3 text-center text-slate-300">{party.invoiceCount}</td>
                  <td className="p-3 text-left text-slate-300">{party.buckets.current.toLocaleString()}</td>
                  <td className="p-3 text-left text-slate-300">{party.buckets.days1to30.toLocaleString()}</td>
                  <td className="p-3 text-left text-slate-300">{party.buckets.days31to60.toLocaleString()}</td>
                  <td className="p-3 text-left text-slate-300">{party.buckets.days61to90.toLocaleString()}</td>
                  <td className="p-3 text-left text-red-400">{party.buckets.days91plus.toLocaleString()}</td>
                  <td className="p-3 text-left text-white font-bold">{party.outstanding.toLocaleString()}</td>
                </tr>
              ))}
              {!loading && report.parties.length === 0 && (
                <tr><td colSpan={8} className="p-8 text-center text-slate-500">لا توجد أرصدة مستحقة في هذا التاريخ</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="bg-slate-900 rounded-xl border border-slate-800 overflow-hidden">
        <div className="p-4 border-b border-slate-800">
          <h2 className="font-bold text-white">تفاصيل الفواتير المفتوحة</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-800/50 text-slate-400">
                <th className="p-3 text-right">الفاتورة</th>
                <th className="p-3 text-right">{entityLabel}</th>
                <th className="p-3 text-center">الاستحقاق</th>
                <th className="p-3 text-center">أيام التأخر</th>
                <th className="p-3 text-left">الأصل</th>
                <th className="p-3 text-left">مدفوع حتى التاريخ</th>
                <th className="p-3 text-left">المتبقي</th>
                <th className="p-3 text-center">الشريحة</th>
              </tr>
            </thead>
            <tbody>
              {report.invoices.map(invoice => (
                <tr key={invoice.id} className="border-t border-slate-800/60">
                  <td className="p-3 text-white font-medium">{invoice.invoiceNumber}</td>
                  <td className="p-3 text-slate-300">{invoice.partyName}</td>
                  <td className="p-3 text-center text-slate-300">{invoice.dueDate ? new Date(invoice.dueDate).toLocaleDateString('ar-SA') : 'غير محدد'}</td>
                  <td className="p-3 text-center text-slate-300">{invoice.overdueDays}</td>
                  <td className="p-3 text-left text-slate-300">{invoice.originalAmount.toLocaleString()}</td>
                  <td className="p-3 text-left text-emerald-400">{invoice.paidAmount.toLocaleString()}</td>
                  <td className="p-3 text-left text-white font-bold">{invoice.outstanding.toLocaleString()}</td>
                  <td className="p-3 text-center text-slate-300">{bucketLabels[invoice.bucket]}</td>
                </tr>
              ))}
              {!loading && report.invoices.length === 0 && (
                <tr><td colSpan={8} className="p-8 text-center text-slate-500">لا توجد فواتير مفتوحة</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
