'use client';
import { useEffect, useState } from 'react';
import api from '@/lib/api';
import { Download, ShieldCheck } from 'lucide-react';

type Access = { scope: 'PARTIAL' | 'FULL' | null; source: 'PAID' | 'OWNER_APPROVED' | 'OWNER' | null };

export default function DownloadActivityReport() {
  const [scope, setScope] = useState<'PARTIAL' | 'FULL'>('PARTIAL');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [invoiceNumber, setInvoiceNumber] = useState('');
  const [access, setAccess] = useState<Access | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const check = async () => {
    setBusy(true);
    setError('');
    try {
      const params = new URLSearchParams();
      if (invoiceNumber) params.set('invoiceNumber', invoiceNumber.trim());
      const result = await api.get<Access>('/analytics/activity/download-access?' + params.toString());
      setAccess(result.data);
    } catch {
      setAccess(null);
      setError('تعذر إثبات الدفع أو الموافقة. تحقق من تسجيل الدخول ومرجع الفاتورة.');
    } finally {
      setBusy(false);
    }
  };
  useEffect(() => { void check(); /* Check current signed-in entitlement on first visit. */
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const eligible = access?.scope === 'FULL' || (scope === 'PARTIAL' && access?.scope === 'PARTIAL');
  const download = async () => {
    if (!eligible) { setError('هذا النطاق يحتاج إثبات دفع أو موافقة مالك النظام.'); return; }
    if (scope === 'PARTIAL' && (!from || !to)) {
      setError('حدد تاريخ البداية والنهاية للتقرير الجزئي.'); return;
    }
    setBusy(true);
    setError('');
    try {
      const params = new URLSearchParams({ scope });
      if (scope === 'PARTIAL') { params.set('from', from); params.set('to', to); }
      if (invoiceNumber.trim()) params.set('invoiceNumber', invoiceNumber.trim());
      const result = await api.get('/analytics/activity/export?' + params.toString(), { responseType: 'blob' });
      const blob = new Blob([result.data], { type: 'text/csv;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = 'scc380-activity-' + scope.toLowerCase() + '.csv';
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch {
      setError('رفض الخادم الطلب أو تعذر إكمال التنزيل. لم يثبت تسليم التقرير.');
    } finally {
      setBusy(false);
    }
  };
  return <div dir="rtl" className="mx-auto max-w-2xl space-y-5 rounded-xl border border-slate-700 bg-slate-900 p-6 text-white">
    <h1 className="flex items-center gap-2 text-xl font-bold"><Download className="h-5 w-5" />تحميل تقرير نشاط الموقع</h1>
    <p className="text-sm text-slate-400">التنزيل متاح جزئيًا أو كاملًا بعد إثبات دفع فاتورة المنتج المخصص أو موافقة مالك النظام. تُراجع الصلاحية على الخادم عند كل تنزيل.</p>
    <label className="block text-sm">رقم الفاتورة المدفوعة (اختياري عند وجود موافقة)
      <input type="text" value={invoiceNumber} maxLength={80} onChange={e => setInvoiceNumber(e.target.value)}
        className="mt-2 w-full rounded-lg border border-slate-700 bg-slate-950 p-2 text-white" />
    </label>
    <button onClick={check} disabled={busy} className="flex items-center gap-2 rounded-lg border border-slate-500 px-4 py-2 text-sm disabled:opacity-50">
      <ShieldCheck className="h-4 w-4" />تحقق من أهلية التنزيل
    </button>
    {access && <p role="status" className="rounded-lg bg-slate-800 p-3 text-sm">
      {access.scope ? 'النطاق المسموح: ' + (access.scope === 'FULL' ? 'كامل' : 'جزئي') + ' (' + access.source + ')' : 'لا توجد موافقة أو فاتورة مثبتة لهذا التقرير.'}
    </p>}
    <label className="block text-sm">النطاق المطلوب
      <select className="mt-2 w-full rounded-lg border border-slate-700 bg-slate-950 p-2 text-white" value={scope}
        onChange={e => setScope(e.target.value as 'PARTIAL' | 'FULL')}>
        <option value="PARTIAL">جزئي — فترة لا تتجاوز 31 يومًا</option>
        <option value="FULL">كامل — جميع السجلات المصرح بها</option>
      </select>
    </label>
    {scope === 'PARTIAL' && <div className="flex flex-wrap gap-3">
      <label>من<input type="date" className="mt-1 block rounded-lg border border-slate-700 bg-slate-950 p-2 text-white" value={from} onChange={e => setFrom(e.target.value)} /></label>
      <label>إلى<input type="date" className="mt-1 block rounded-lg border border-slate-700 bg-slate-950 p-2 text-white" value={to} onChange={e => setTo(e.target.value)} /></label>
    </div>}
    {error && <p role="alert" className="rounded-lg border border-red-700 p-3 text-sm text-red-300">{error}</p>}
    <button type="button" disabled={!eligible || busy} onClick={download}
      className="flex items-center gap-2 rounded-lg bg-blue-600 px-5 py-3 font-bold text-white disabled:opacity-50">
      <Download className="h-4 w-4" />{busy ? 'جارٍ المعالجة...' : scope === 'FULL' ? 'تحميل كامل' : 'تحميل جزئي'}
    </button>
    <p className="text-xs text-slate-400">هذا المسار مخصص لتقرير نشاط SCC380، وليس بوابة عامة لكل ملفات الموقع. التحقق من الدفع يتطلب فاتورة PAID مرتبطة ببريد المستخدم وصنف التقرير المخصص.</p>
  </div>;
}
