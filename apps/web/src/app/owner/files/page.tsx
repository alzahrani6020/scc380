'use client';
import { useCallback, useEffect, useState } from 'react';
import api from '@/lib/api';
import Link from 'next/link';

type AuditRow = { id: string; tenantId: string | null; userId: string | null; entityId: string | null; action: string; createdAt: string };
type RequestRow = {
  id: string; tenantId: string; fileId: string; requesterId: string;
  scope: string; status: string; startLine?: number | null; endLine?: number | null;
  file: { title: string; fileName: string }; createdAt: string;
};
export default function OwnerFilesPage() {
  const [requests, setRequests] = useState<RequestRow[]>([]);
  const [audits, setAudits] = useState<AuditRow[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [reason, setReason] = useState('');
  const load = useCallback(async () => {
    try {
      const [result, auditResult] = await Promise.all([
        api.get<RequestRow[]>('/owner-files/owner/requests'),
        api.get<AuditRow[]>('/owner-files/owner/audit'),
      ]);
      setRequests(Array.isArray(result.data) ? result.data : []);
      setAudits(Array.isArray(auditResult.data) ? auditResult.data : []);
      setError('');
    } catch { setError('تعذر جلب الطلبات؛ لم يتم تغيير الصلاحيات.'); }
  }, []);
  useEffect(() => { void load(); }, [load]);
  async function decide(requestId: string, decision: 'APPROVE' | 'REJECT' | 'REVOKE') {
    setBusy(true);
    try {
      await api.post('/owner-files/owner/decide', { requestId, decision, reason });
      setReason('');
      await load();
    } catch { setError('فشل القرار أو تم اتخاذه من قبل؛ لم يُمنح وصول جديد.'); }
    finally { setBusy(false); }
  }
  return <main dir="rtl" className="mx-auto max-w-6xl space-y-5 px-4 py-8 text-white">
    <h1 className="text-2xl font-bold">مركز ملفات المالك — مراجعة الطلبات</h1>
    <p className="text-sm text-slate-300">الملفات التجارية المستقلة فقط. لا يتم تجاوز صلاحيات مستندات HR أو ERP. إثبات استجابة HTTP ليس إثبات الحفظ على جهاز المستخدم.</p>
    <Link href="/downloads/files" className="text-blue-300 underline">مركز ملفات الشركة وطلب التنزيل</Link>
    <div><label className="block text-sm">سبب القرار
      <input value={reason} maxLength={300} onChange={e => setReason(e.target.value)} className="mt-2 w-full rounded border border-slate-700 bg-slate-900 p-2"/>
    </label></div>
    <button type="button" onClick={() => void load()} className="rounded bg-blue-700 px-4 py-2">تحديث</button>
    {error && <p role="alert" className="text-red-300">{error}</p>}
    <div className="space-y-3">{requests.map(item =>
      <section key={item.id} className="rounded-xl border border-slate-700 bg-slate-900 p-4">
        <strong className="block break-all">{item.file.title} — {item.file.fileName}</strong>
        <p className="mt-1 break-all text-xs text-slate-400">الطلب: {item.id} | الشركة: {item.tenantId} | المستخدم: {item.requesterId}</p>
        <p className="mt-2">النطاق: {item.scope} {item.scope === 'PARTIAL' ? `(${item.startLine}–${item.endLine})` : ''} | الحالة: {item.status}</p>
        {item.status === 'PENDING' && <div className="mt-3 flex gap-2">
          <button type="button" disabled={busy} onClick={() => void decide(item.id, 'APPROVE')} className="rounded bg-blue-600 px-3 py-2 disabled:opacity-50">موافقة</button>
          <button type="button" disabled={busy} onClick={() => void decide(item.id, 'REJECT')} className="rounded border border-red-600 px-3 py-2 text-red-300 disabled:opacity-50">رفض</button>
        </div>}
        {item.status === 'APPROVED' && <button type="button" disabled={busy} onClick={() => void decide(item.id, 'REVOKE')} className="mt-3 rounded border border-amber-600 px-3 py-2 disabled:opacity-50">إلغاء السماح</button>}
      </section>
    )}{!requests.length && <p className="text-slate-300">لا توجد طلبات مسجلة.</p>}</div>
    <section className="space-y-3 rounded-xl border border-slate-700 bg-slate-900 p-4">
      <h2 className="font-semibold">سجل الموافقات ومحاولات التسليم — آخر 100 حدث</h2>
      <p className="text-xs text-slate-400">أحداث API المسجلة؛ اكتمال استجابة HTTP لا يثبت حفظ الملف على جهاز المستخدم.</p>
      <div className="overflow-x-auto"><table className="w-full text-right text-sm">
        <thead><tr><th className="p-2">الوقت</th><th className="p-2">العملية</th><th className="p-2">الطلب</th><th className="p-2">الشركة</th><th className="p-2">المستخدم</th></tr></thead>
        <tbody>{audits.map(a => <tr key={a.id} className="border-t border-slate-700">
          <td className="p-2 whitespace-nowrap">{new Date(a.createdAt).toLocaleString('ar-SA')}</td>
          <td className="p-2">{a.action}</td>
          <td className="p-2 break-all">{a.entityId || '-'}</td>
          <td className="p-2 break-all">{a.tenantId || '-'}</td>
          <td className="p-2 break-all">{a.userId || '-'}</td>
        </tr>)}</tbody>
      </table></div>
      {!audits.length && <p className="text-slate-400">لا توجد أحداث مسجلة.</p>}
    </section>
  </main>;
}
