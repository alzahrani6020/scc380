'use client';

import { useEffect, useState } from 'react';
import api from '@/lib/api';
import { Download, RefreshCw, Shield, Eye, LogIn, FileDown, Search } from 'lucide-react';
import Link from 'next/link';
import OwnerInsights from '@/components/owner/OwnerInsights';
import { clearAuth, getRefreshToken } from '@/lib/auth';
import { sessionAuth } from '@/lib/session-auth';

type Activity = {
  id: string;
  action: string;
  httpPath: string | null;
  responseStatus: number | null;
  createdAt: string;
  ipAddress: string | null;
  newValues: { resource?: string; source?: string } | null;
  user: { email: string; firstName: string; lastName: string } | null;
};
type Session = {
  id: string; createdAt: string; lastActiveAt: string; revokedAt: string | null;
  expiresAt: string; ipAddress: string | null;
  user: { email: string; firstName: string; lastName: string };
};
type Login = { id: string; email: string | null; success: boolean; createdAt: string; failureReason: string | null };
type Feed = {
  summary: { recordedEvents: number; pageViews: number; downloadRequests: number; reportExports: number; sessions: number; failedLogins: number; auditedHttpErrors: number };
  events: Activity[]; sessions: Session[]; logins: Login[]; limited: boolean;
};

const readable = (value: string) => new Date(value).toLocaleString('ar-SA');

export default function SiteActivityDashboard() {
  const [role, setRole] = useState<string | null>(null);
  const [identityEmail, setIdentityEmail] = useState<string>('');
  const [authUnavailable, setAuthUnavailable] = useState(false);
  const [ownerAuthorized, setOwnerAuthorized] = useState(false);
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [data, setData] = useState<Feed | null>(null);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [scope, setScope] = useState<'PARTIAL' | 'FULL'>('PARTIAL');
  const [approvalEmail, setApprovalEmail] = useState('');
  const [approvalScope, setApprovalScope] = useState<'PARTIAL' | 'FULL'>('PARTIAL');
  const [approvalBusy, setApprovalBusy] = useState(false);
  const [approvals, setApprovals] = useState<any[]>([]);
  const [pendingRequests, setPendingRequests] = useState<Array<{
    id: string; email: string; tenantId: string; status: string; createdAt: string;
    details: { scope?: string; from?: string; to?: string; reason?: string } | null;
  }>>([]);
  const [decisionReason, setDecisionReason] = useState('');

  const [error, setError] = useState('');
  useEffect(() => {
    let active = true;
    api.get<{ authorized: boolean; accountRole: string; email: string }>('/analytics/activity/owner/status').then(result => {
      if (!active) return;
      setIdentityEmail(typeof result.data?.email === 'string' ? result.data.email : '');
      setRole(typeof result.data?.accountRole === 'string' ? result.data.accountRole : 'UNAUTHORIZED');
      setOwnerAuthorized(result.data?.authorized === true);
    }).catch(() => {
      if (!active) return;
      setAuthUnavailable(true);
      setRole('UNAUTHORIZED');
    });
    return () => { active = false; };
  }, []);

  const switchAccount = async () => {
    try {
      await sessionAuth('logout', { refreshToken: getRefreshToken() || undefined });
    } catch {
      try { await sessionAuth('clear'); } catch {}
    } finally {
      clearAuth();
      window.location.href = '/auth/login';
    }
  };

  const query = () => {
    const params = new URLSearchParams();
    if (from) params.set('from', from);
    if (to) params.set('to', to);
    return params.toString();
  };
  const refresh = async () => {
    setLoading(true);
    setError('');
    try {
      const response = await api.get<Feed>('/analytics/activity?' + query());
      setData(response.data);
      const approvalsResponse = await api.get('/analytics/activity/owner/approvals');
      setApprovals(Array.isArray(approvalsResponse.data) ? approvalsResponse.data : []);
      const requestsResponse = await api.get('/analytics/activity/owner/requests');
      setPendingRequests(Array.isArray(requestsResponse.data) ? requestsResponse.data : []);
    } catch {
      setData(null);
      setError('تعذر قراءة سجل النشاط أو لا تملك صلاحية العرض.');
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => {
    if (!role || !ownerAuthorized) return;
    void refresh();
    // Filters are applied by the explicit "عرض" action.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [role, ownerAuthorized]);

  const approve = async (revoke: boolean) => {
    if (!approvalEmail.trim()) { setError('أدخل البريد الإلكتروني للمستخدم.'); return; }
    setApprovalBusy(true);
    setError('');
    try {
      await api.post('/analytics/activity/owner/approve', {
        email: approvalEmail.trim(), scope: approvalScope, revoke,
      });
      setApprovalEmail('');
      await refresh();
    } catch {
      setError('لم تُسجل الموافقة أو الإلغاء؛ تحقق من البريد والصلاحيات.');
    } finally {
      setApprovalBusy(false);
    }
  };

  const resolveRequest = async (id: string, decision: 'APPROVE' | 'REJECT') => {
    setApprovalBusy(true);
    setError('');
    try {
      const response = await api.post('/analytics/activity/owner/resolve-request', {
        requestId: id, decision, reason: decisionReason,
      });
      if (response.data?.status === 'ALREADY_RESOLVED') {
        setError('تم البت في هذا الطلب من قبل. حدّث القائمة.');
      }
      setDecisionReason('');
      await refresh();
    } catch {
      setError('تعذر توثيق قرار المالك؛ لم تتغير صلاحية الطلب.');
    } finally { setApprovalBusy(false); }
  };

  const download = async () => {
    if (scope === 'PARTIAL' && (!from || !to)) {
      setError('اختر تاريخ البداية والنهاية للتنزيل الجزئي.');
      return;
    }
    setExporting(true);
    setError('');
    try {
      const params = new URLSearchParams(scope === 'PARTIAL' ? query() : '');
      params.set('scope', scope);
      const result = await api.get('/analytics/activity/export?' + params.toString(), { responseType: 'blob' });
      const blob = new Blob([result.data], { type: 'text/csv;charset=utf-8' });
      const url = window.URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = 'scc380-activity-' + scope.toLowerCase() + '.csv';
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      setTimeout(() => window.URL.revokeObjectURL(url), 1000);
      await refresh();
    } catch {
      setError('فشل تنزيل التقرير؛ لم يثبت اكتمال التحميل.');
    } finally {
      setExporting(false);
    }
  };

  if (!role) return <div className="p-6 text-slate-200" dir="rtl">التحقق من الصلاحيات...</div>;
  if (!ownerAuthorized) return (
    <main dir="rtl" className="mx-auto mt-12 max-w-xl rounded-xl border border-slate-700 bg-slate-900 p-6 text-white">
      <h1 className="mb-3 text-xl font-bold">التحقق من صلاحية لوحة المالك</h1>
      {authUnavailable ? (
        <>
          <p className="mb-4 text-slate-300">تعذر إثبات الجلسة الحالية من خادم المصادقة. لم يتم إثبات رفض صلاحية المالك.</p>
          <Link href="/auth/login" className="inline-flex rounded-lg bg-blue-600 px-4 py-2">تسجيل الدخول ثم العودة إلى رابط لوحة المالك</Link>
        </>
      ) : (
        <>
          <p className="mb-2 text-slate-300">الحساب الموثق حاليًا لا يحمل صلاحية مالك النظام المطلوبة لعرض السجلات أو إصدار الموافقات.</p>
          <p className="mb-4 break-all text-sm text-slate-400">الحساب: {identityEmail || 'غير متاح'} — الدور الحالي: {role}</p>
          <button type="button" onClick={switchAccount} className="inline-flex rounded-lg bg-blue-600 px-4 py-2">تبديل الحساب وتسجيل الدخول كمالك</button>
        </>
      )}
      <p className="mt-4 text-xs text-slate-400">لا تُمنح صلاحيات المالك تلقائيًا بالوصول إلى الرابط؛ يجب أن تكون مرتبطة بحساب موثّق ومخوّل على الخادم.</p>
    </main>
  );

  const rows = (data?.events || []).filter(event =>
    [event.user?.email, event.action, event.httpPath, event.ipAddress]
      .some(value => (value || '').toLocaleLowerCase().includes(search.toLocaleLowerCase()))
  );
  const stats = [
    { label: 'أحداث مسجلة', value: data?.summary.recordedEvents, icon: Shield },
    { label: 'زيارات الصفحات المسجلة', value: data?.summary.pageViews, icon: Eye },
    { label: 'طلبات تنزيل مسجلة', value: data?.summary.downloadRequests, icon: FileDown },
    { label: 'جلسات في الفترة', value: data?.summary.sessions, icon: LogIn },
    { label: 'أخطاء طلبات HTTP المسجلة', value: data?.summary.auditedHttpErrors, icon: Shield },
  ];

  return (
    <main dir="rtl" className="mx-auto min-w-0 w-full max-w-screen-2xl space-y-6 overflow-x-hidden px-4 py-6 text-white sm:px-6 lg:px-8">
      <div className="flex min-w-0 flex-wrap items-center justify-between gap-4">
        <div className="min-w-0 flex-1">
          <h1 className="break-words text-xl font-bold sm:text-2xl">لوحة المالك المستقلة — مراقبة نشاط الموقع</h1>
          
          <p className="mt-1 text-sm text-slate-400">المستخدمون المصرح لهم، زيارات لوحة النظام، الجلسات وسجلات التنزيل. لا تشمل الزيارات المجهولة.</p>
        </div>
        <button type="button" onClick={download} disabled={loading || exporting || !data}
          className="inline-flex shrink-0 items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 font-semibold text-white hover:bg-blue-500 disabled:opacity-50">
          <Download className="h-4 w-4" />{exporting ? 'جارٍ التحميل...' : 'تحميل التقرير CSV'}
        </button>
      </div>
      <OwnerInsights />
      <section className="rounded-xl border border-slate-700 bg-slate-900 p-4">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h2 className="font-bold">طلبات التنزيل التي تحتاج قرار المالك</h2>
          <span className="text-sm text-slate-300">بانتظار القرار: {pendingRequests.filter(x => x.status === 'PENDING').length}</span>
        </div>
        <label className="mb-3 block text-sm">سبب القرار (اختياري)
          <input maxLength={300} value={decisionReason} onChange={e => setDecisionReason(e.target.value)}
            className="mt-1 block w-full rounded border border-slate-600 bg-slate-950 px-3 py-2" />
        </label>
        <div className="max-h-96 space-y-3 overflow-y-auto">
          {pendingRequests.map(item => <div key={item.id} className="rounded-lg border border-slate-700 p-3 text-sm">
            <p className="break-all font-semibold">{item.email || 'حساب غير محدد'}</p>
            <p className="mt-1 text-slate-300">النطاق: {item.details?.scope === 'FULL' ? 'كامل' : 'جزئي'} — الحالة: {item.status === 'PENDING' ? 'بانتظار القرار' : item.status === 'APPROVED' ? 'موافق عليه' : 'مرفوض'}</p>
            <p className="mt-1 text-slate-400">{item.details?.from || '—'} إلى {item.details?.to || '—'} — {new Date(item.createdAt).toLocaleString('ar-SA')}</p>
            {item.details?.reason && <p className="mt-1 break-words text-slate-300">السبب: {item.details.reason}</p>}
            {item.status === 'PENDING' && <div className="mt-3 flex flex-wrap gap-2">
              <button type="button" disabled={approvalBusy} onClick={() => void resolveRequest(item.id, 'APPROVE')}
                className="rounded bg-blue-600 px-3 py-2 disabled:opacity-50">موافقة</button>
              <button type="button" disabled={approvalBusy} onClick={() => void resolveRequest(item.id, 'REJECT')}
                className="rounded border border-red-600 px-3 py-2 text-red-300 disabled:opacity-50">رفض</button>
            </div>}
          </div>)}
          {!pendingRequests.length && <p className="text-sm text-slate-400">لا توجد طلبات تنزيل مسجلة.</p>}
        </div>
      </section>
      <section className="rounded-xl border border-slate-700 bg-slate-900 p-4">
        <h2 className="mb-3 font-bold">إدارة صلاحيات التنزيل</h2>
        <p className="mb-3 text-sm text-slate-400">الموافقة تمنح المستخدم المخول تنزيل التقرير الجزئي أو الكامل. جميع القرارات تُحفظ في سجل التدقيق.</p>
        <div className="flex flex-wrap items-end gap-3">
          <label className="text-sm">بريد المستخدم
            <input type="email" value={approvalEmail} onChange={e => setApprovalEmail(e.target.value)}
              placeholder="user@example.com" className="mt-1 block rounded-md border border-slate-700 bg-slate-950 p-2 text-white" />
          </label>
          <label className="text-sm">نطاق الإذن
            <select value={approvalScope} onChange={e => setApprovalScope(e.target.value as 'PARTIAL' | 'FULL')}
              className="mt-1 block rounded-md border border-slate-700 bg-slate-950 p-2 text-white">
              <option value="PARTIAL">جزئي</option><option value="FULL">كامل</option>
            </select>
          </label>
          <button type="button" disabled={approvalBusy} onClick={() => void approve(false)}
            className="rounded-md bg-blue-600 px-4 py-2 text-sm disabled:opacity-50">الموافقة على التنزيل</button>
          <button type="button" disabled={approvalBusy} onClick={() => void approve(true)}
            className="rounded-md border border-red-700 px-4 py-2 text-sm text-red-300 disabled:opacity-50">إلغاء السماح</button>
        </div>
        <h3 className="mt-5 font-semibold">سجل قرارات المالك</h3>
        <div className="mt-2 max-h-48 overflow-auto text-sm">
          {approvals.map(a => <div key={a.id} className="border-b border-slate-800 py-2">
            <span>{a.newValues?.subjectEmail || a.entityId}</span>
            <span className="mr-3 text-slate-400">{a.action === 'DOWNLOAD_ACCESS_APPROVED' ? 'موافقة' : 'إلغاء'} — {a.newValues?.scope || '—'} — {readable(a.createdAt)}</span>
          </div>)}
          {!approvals.length && <p className="text-slate-400">لا توجد قرارات محفوظة بعد.</p>}
        </div>
      </section>
      <div className="flex flex-wrap items-end gap-3 rounded-xl border border-slate-700 bg-slate-900 p-4">
        <label className="text-sm">نوع تنزيل التقرير
          <select value={scope} onChange={e => setScope(e.target.value as 'PARTIAL' | 'FULL')}
            className="mt-1 block rounded-md border border-slate-700 bg-slate-950 p-2 text-white">
            <option value="PARTIAL">جزئي — فترة محددة</option><option value="FULL">كامل — جميع السجلات</option>
          </select>
        </label>
        <label className="text-sm">من تاريخ<input aria-label="من تاريخ" type="date" value={from} onChange={e => setFrom(e.target.value)} className="mt-1 block rounded-md border border-slate-700 bg-slate-950 p-2 text-white" /></label>
        <label className="text-sm">إلى تاريخ<input aria-label="إلى تاريخ" type="date" value={to} onChange={e => setTo(e.target.value)} className="mt-1 block rounded-md border border-slate-700 bg-slate-950 p-2 text-white" /></label>
        <button type="button" onClick={refresh} disabled={loading}
          className="inline-flex items-center gap-2 rounded-lg border border-slate-600 px-4 py-2 text-sm hover:bg-slate-800 disabled:opacity-50"><RefreshCw className="h-4 w-4" />{loading ? 'جارٍ القراءة...' : 'عرض وتحديث'}</button>
      </div>
      {error && <div role="alert" className="rounded-md border border-red-700 bg-red-950 p-3 text-red-200">{error}</div>}
      {data?.limited && <div role="status" className="rounded-md border border-amber-700 bg-amber-950/40 p-3 text-amber-200">المعاينة محدودة بأحدث 1000 حدث و100 جلسة و100 محاولة دخول. التنزيل الكامل يعالج جميع السجلات المصرح بها.</div>}
      <p className="text-sm text-slate-400">أخطاء HTTP مستخرجة من سجل التدقيق، بينما محاولات الدخول الفاشلة تُحسب من سجل تسجيل الدخول المستقل؛ لا يعني رمز 201 نجاح المصادقة.</p>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-5">
        {stats.map(({ label, value, icon: Icon }) => (
          <div key={label} className="rounded-xl border border-slate-700 bg-slate-900 p-4">
            <Icon className="mb-3 h-5 w-5 text-blue-400" />
            <div className="text-2xl font-bold">{value === undefined ? '—' : value.toLocaleString('ar-SA')}</div>
            <div className="mt-1 text-xs text-slate-400">{label}</div>
          </div>
        ))}
      </div>
      <section className="min-w-0 rounded-xl border border-slate-700 bg-slate-900 p-4">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <h2 className="font-bold">سجل النشاط والزيارات</h2>
          <label className="relative"><Search className="absolute right-3 top-2.5 h-4 w-4 text-slate-400" /><input
            type="search" placeholder="بحث في النتائج" value={search} onChange={e => setSearch(e.target.value)}
            className="rounded-md border border-slate-700 bg-slate-950 py-2 pr-9 pl-3 text-sm" /></label>
        </div>
        <div className="overflow-x-auto"><table className="w-full min-w-[640px] text-right text-sm">
          <thead className="text-slate-400"><tr><th className="p-2">التاريخ</th><th className="p-2">المستخدم</th><th className="p-2">الحدث</th><th className="p-2">الصفحة أو المورد</th><th className="p-2">الملف / المورد</th><th className="p-2">حالة HTTP</th></tr></thead>
          <tbody>{rows.map(e => <tr key={e.id} className="border-t border-slate-800"><td className="p-2">{readable(e.createdAt)}</td><td className="p-2">{e.user?.email || 'غير محدد'}</td><td className="p-2">{e.action === "PAGE_VIEW" ? "زيارة صفحة" : e.action === "POST_ERROR" ? "فشل طلب" : e.action}</td><td className="p-2 font-mono text-xs" dir="ltr">{e.httpPath || '—'}</td><td className="max-w-56 break-all p-2 font-mono text-xs" dir="ltr">{e.newValues?.resource || "—"}</td><td className="p-2">{e.responseStatus === null ? "غير منطبق" : e.responseStatus}</td></tr>)}</tbody>
        </table>{!rows.length && <p className="p-4 text-center text-sm text-slate-400">لا توجد أحداث مطابقة محفوظة في هذه الفترة.</p>}</div>
      </section>
      <div className="grid gap-4 lg:grid-cols-2">
        <section className="rounded-xl border border-slate-700 bg-slate-900 p-4">
          <h2 className="mb-3 font-bold">الجلسات المسجلة</h2>
          {(data?.sessions || []).map(s => <div key={s.id} className="border-b border-slate-800 py-2 text-sm">
            <p>{s.user?.email || 'غير محدد'}</p><p className="text-slate-400">بدأت {readable(s.createdAt)} • آخر نشاط {readable(s.lastActiveAt)}</p>
          </div>)}
          {!data?.sessions.length && <p className="text-sm text-slate-400">لا توجد جلسات في الفترة.</p>}
        </section>
        <section className="rounded-xl border border-slate-700 bg-slate-900 p-4">
          <h2 className="mb-3 font-bold">محاولات تسجيل الدخول</h2>
          {(data?.logins || []).map(l => <div key={l.id} className="border-b border-slate-800 py-2 text-sm">
            <p>{l.email || 'غير محدد'} <span className={l.success ? 'text-green-400' : 'text-amber-300'}>({l.success ? 'نجاح' : 'فشل'})</span></p>
            <p className="text-slate-400">{readable(l.createdAt)}</p>
          </div>)}
          {!data?.logins.length && <p className="text-sm text-slate-400">لا توجد محاولات محفوظة في الفترة.</p>}
        </section>
      </div>
      <p className="text-xs text-slate-400">تنزيل CSV يسجل إنشاء التقرير واستجابة الخادم؛ لا يثبت حفظ الملف على جهاز المستخدم. الزيارات لا تشمل صفحات الموقع العامة أو الزوار المجهولين.</p>
    </main>
  );
}
