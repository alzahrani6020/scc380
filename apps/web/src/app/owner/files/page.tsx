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
  const [hasMoreRequests, setHasMoreRequests] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [reason, setReason] = useState('');
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [page, setPage] = useState(1);
  const pageSize = 20;
  const filtered = requests.filter(item =>
    (statusFilter === 'ALL' || item.status === statusFilter) &&
    [item.file.title, item.file.fileName, item.id, item.tenantId, item.requesterId]
      .some(value => value.toLowerCase().includes(search.trim().toLowerCase()))
  );
  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const visibleRequests = filtered.slice((Math.min(page, totalPages) - 1) * pageSize, Math.min(page, totalPages) * pageSize);

  const [loading, setLoading] = useState(true);
  const [requestsError, setRequestsError] = useState(false);
  const [auditsError, setAuditsError] = useState(false);
  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    // Audit history is supplementary: failure must not suppress approvable requests.
    const [requestResult, auditResult] = await Promise.allSettled([
      api.get<RequestRow[]>('/owner-files/owner/requests'),
      api.get<AuditRow[]>('/owner-files/owner/audit'),
    ]);
    const loadedRequests = requestResult.status === 'fulfilled' && Array.isArray(requestResult.value.data)
      ? requestResult.value.data : null;
    const loadedAudits = auditResult.status === 'fulfilled' && Array.isArray(auditResult.value.data)
      ? auditResult.value.data : null;
    const requestFailed = loadedRequests === null;
    const auditFailed = loadedAudits === null;
    setRequests(loadedRequests ?? []);
    setHasMoreRequests((loadedRequests?.length ?? 0) === 200);
    setPage(1);
    setAudits(loadedAudits ?? []);
    setRequestsError(requestFailed);
    setAuditsError(auditFailed);
    setLoading(false);
  }, []);
  useEffect(() => { void load(); }, [load]);
  async function loadMoreRequests() {
    if (loadingMore || !hasMoreRequests || requestsError) return;
    setLoadingMore(true);
    try {
      const response = await api.get<RequestRow[]>('/owner-files/owner/requests', { params: { offset: requests.length } });
      if (!Array.isArray(response.data)) throw new Error('Invalid owner requests response');
      setRequests(previous => [...previous, ...response.data.filter(item => !previous.some(old => old.id === item.id))]);
      setHasMoreRequests(response.data.length === 200);
    } catch {
      setError('تعذر تحميل الصفحة التالية من الطلبات؛ لم يُحذف أي طلب من القائمة.');
    } finally {
      setLoadingMore(false);
    }
  }
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
    <nav aria-label="مصادر الملفات والصلاحيات" className="flex flex-wrap gap-4 text-sm">
      <Link href="/downloads/files" className="text-blue-300 underline">ملفات الشركة التجارية وطلب التنزيل</Link>
      <Link href="/dashboard/hr/documents" className="text-blue-300 underline">مستندات الموظفين — بصلاحيات HR المستقلة</Link>
      <Link href="/dashboard/erp" className="text-blue-300 underline">فواتير ERP — طباعة وتصدير حسب الصلاحيات</Link>
    </nav>
    <p className="text-xs text-slate-400">لا يتم نقل مستندات HR أو ERP إلى مركز التنزيل التجاري، ولا تتجاوز هذه الروابط صلاحيات الوصول الأصلية.</p>
    <div><label className="block text-sm">سبب القرار
      <input value={reason} maxLength={300} onChange={e => setReason(e.target.value)} className="mt-2 w-full rounded border border-slate-700 bg-slate-900 p-2"/>
    </label></div>
    <button type="button" onClick={() => void load()} className="rounded bg-blue-700 px-4 py-2">تحديث</button>
    {error && <p role="alert" className="text-red-300">{error}</p>}
    {loading && <p role="status" className="text-slate-300">جارٍ تحميل الطلبات وسجل التدقيق...</p>}
    {requestsError && <p role="alert" className="text-red-300">تعذر تحميل طلبات الموافقة. لا يمكن اعتماد قرارات حتى تتوفر الطلبات؛ أعد المحاولة.</p>}
    {auditsError && <p role="alert" className="text-amber-300">تعذر تحميل سجل التدقيق، لكن عرض الطلبات والقرارات المصرح بها لا يزال متاحًا.</p>}
    <section aria-label="بحث وتصنيف طلبات التنزيل" className="flex flex-wrap items-end gap-3 rounded-xl border border-slate-700 bg-slate-900 p-4">
      <label className="text-sm">البحث في الطلبات
        <input value={search} onChange={event => { setSearch(event.target.value); setPage(1); }}
          placeholder="الملف، الشركة، المستخدم أو رقم الطلب" className="mt-2 block w-full min-w-64 rounded border border-slate-700 bg-slate-950 p-2"/>
      </label>
      <label className="text-sm">حالة الطلب
        <select value={statusFilter} onChange={event => { setStatusFilter(event.target.value); setPage(1); }}
          className="mt-2 block rounded border border-slate-700 bg-slate-950 p-2">
          <option value="ALL">كل الحالات</option>
          <option value="PENDING">قيد الموافقة</option>
          <option value="APPROVED">موافق عليه</option>
          <option value="REJECTED">مرفوض</option>
          <option value="REVOKED">ملغى السماح</option>
        </select>
      </label>
      <p className="text-sm text-slate-300">المعروض: {visibleRequests.length} من {filtered.length} ضمن {requests.length} طلب تم تحميله {hasMoreRequests ? '(توجد طلبات أقدم)' : ''}.</p>
    </section>
    <div className="space-y-3">{visibleRequests.map(item =>
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
    )}{!loading && !requestsError && !requests.length && <p className="text-slate-300">لا توجد طلبات مسجلة.</p>}
    {!loading && !requestsError && requests.length > 0 && !filtered.length && <p className="text-slate-300">لا توجد طلبات مطابقة للبحث أو الحالة المحددة.</p>}</div>
    {!loading && !requestsError && hasMoreRequests && <button type="button" disabled={loadingMore || busy}
      onClick={() => void loadMoreRequests()} className="rounded border border-slate-600 px-3 py-2 disabled:opacity-50">
      {loadingMore ? 'جارٍ تحميل طلبات أقدم...' : 'تحميل 200 طلب أقدم'}
    </button>}
    {!loading && !requestsError && totalPages > 1 && <nav aria-label="صفحات الطلبات" className="flex items-center gap-3">
      <button type="button" disabled={page <= 1} onClick={() => setPage(current => Math.max(1, current - 1))}
        className="rounded border border-slate-600 px-3 py-2 disabled:opacity-50">السابق</button>
      <span>صفحة {Math.min(page, totalPages)} من {totalPages}</span>
      <button type="button" disabled={page >= totalPages} onClick={() => setPage(current => Math.min(totalPages, current + 1))}
        className="rounded border border-slate-600 px-3 py-2 disabled:opacity-50">التالي</button>
    </nav>}
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
      {!loading && !auditsError && !audits.length && <p className="text-slate-400">لا توجد أحداث مسجلة.</p>}
    </section>
  </main>;
}
