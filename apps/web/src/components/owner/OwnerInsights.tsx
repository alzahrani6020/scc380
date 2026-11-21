'use client';

import { useEffect, useState } from 'react';
import api from '@/lib/api';
import { Activity, ArrowDownToLine, AlertTriangle, BarChart3, Eye, FileCheck2, RefreshCw, ShieldCheck, Users } from 'lucide-react';

type Insights = {
  period: { since: string; until: string; days: number };
  summary: {
    recordedEvents: number; pageViews: number; downloadRequests: number;
    streamedExports: number; downloadApprovalRequests: number; grantedApprovals: number;
    rejectedRequests: number; auditedHttpErrors: number; activeSessions: number;
    loginFailures: number; successfulLogins: number; identifiedActiveUsers: number; hrDocumentDeliveryStarts: number; storedHrDocuments: number;
  };
  resourceInventory: Array<{ type: string; route?: string; availability: string; downloadPolicy: string; supportedScopes: string[]; documentCount?: number; deliveriesLoggedInPeriod?: number }>;
  pages: Array<{ path: string; visits: number }>;
  actors: Array<{ userId: string | null; email: string; tenantId: string | null; events: number }>;
  recentErrors: Array<{
    id: string; createdAt: string; httpPath: string | null; httpMethod: string | null;
    responseStatus: number | null; action: string;
  }>;
  coverage: {
    pageViews: string; anonymousVisitors: string; fileDownloads: string;
    deviceDownloadCompletion: string; periodCounts: string;
  };
};

function Metric({ label, value, icon: Icon }: { label: string; value: number; icon: typeof Activity }) {
  return <div className="min-w-0 rounded-xl border border-slate-700 bg-slate-900 p-4">
    <Icon className="mb-3 h-5 w-5 text-blue-400" aria-hidden="true" />
    <p className="text-2xl font-semibold tabular-nums">{value.toLocaleString('ar-SA')}</p>
    <p className="mt-1 text-xs text-slate-400">{label}</p>
  </div>;
}

export default function OwnerInsights() {
  const [days, setDays] = useState(30);
  const [data, setData] = useState<Insights | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = async (period: number) => {
    setLoading(true);
    setError('');
    try {
      const response = await api.get<Insights>('/analytics/activity/owner/insights?days=' + period);
      setData(response.data);
    } catch {
      setError('تعذر قراءة المؤشرات من الخادم؛ لم تُستخدم أرقام تقديرية.');
      setData(null);
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => { void load(days); }, [days]);

  const entries = data ? [
    { label: 'الأحداث المسجلة', value: data.summary.recordedEvents, icon: Activity },
    { label: 'زيارات لوحة النظام', value: data.summary.pageViews, icon: Eye },
    { label: 'مستخدمون معروفون نشطون', value: data.summary.identifiedActiveUsers, icon: Users },
    { label: 'جلسات نشطة الآن', value: data.summary.activeSessions, icon: ShieldCheck },
    { label: 'طلبات تنزيل التقارير', value: data.summary.downloadRequests, icon: ArrowDownToLine },
    { label: 'محاولات تسليم مستندات HR', value: data.summary.hrDocumentDeliveryStarts, icon: FileCheck2 },
    { label: 'مستندات HR المحفوظة', value: data.summary.storedHrDocuments, icon: FileCheck2 },
    { label: 'تصديرات أُرسلت من الخادم', value: data.summary.streamedExports, icon: FileCheck2 },
    { label: 'طلبات موافقة تنزيل', value: data.summary.downloadApprovalRequests, icon: FileCheck2 },
    { label: 'موافقات المالك المسجلة', value: data.summary.grantedApprovals, icon: ShieldCheck },
    { label: 'طلبات تم رفضها', value: data.summary.rejectedRequests, icon: AlertTriangle },
    { label: 'أخطاء HTTP المسجلة', value: data.summary.auditedHttpErrors, icon: AlertTriangle },
    { label: 'محاولات دخول ناجحة مسجلة', value: data.summary.successfulLogins, icon: Users },
    { label: 'محاولات دخول فاشلة مسجلة', value: data.summary.loginFailures, icon: ShieldCheck },
  ] : [];

  return <section aria-labelledby="owner-insights-heading" className="space-y-4">
    <header className="flex flex-wrap items-center justify-between gap-3">
      <div>
        <h2 id="owner-insights-heading" className="flex items-center gap-2 text-lg font-bold">
          <BarChart3 className="h-5 w-5 text-blue-400" /> مركز المؤشرات التشغيلية
        </h2>
        <p className="mt-1 text-sm text-slate-400">عدادات من قاعدة البيانات كاملة للفترة المحددة، وليست عينة آخر 1000 حدث.</p>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <label htmlFor="owner-period" className="text-sm text-slate-300">الفترة</label>
        <select id="owner-period" value={days} onChange={e => setDays(Number(e.target.value))}
          className="rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-sm">
          <option value={1}>آخر 24 ساعة</option>
          <option value={7}>آخر 7 أيام</option>
          <option value={30}>آخر 30 يومًا</option>
          <option value={90}>آخر 90 يومًا</option>
        </select>
        <button type="button" onClick={() => void load(days)} disabled={loading}
          className="inline-flex items-center gap-2 rounded-md border border-slate-700 px-3 py-2 text-sm disabled:opacity-50">
          <RefreshCw className="h-4 w-4" /> تحديث المؤشرات
        </button>
      </div>
    </header>
    {loading && <p role="status" className="text-sm text-slate-400">قراءة المؤشرات...</p>}
    {error && <p role="alert" className="rounded-md border border-red-700 bg-red-950/40 p-3 text-red-200">{error}</p>}
    {data && <>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {entries.map(item => <Metric key={item.label} {...item} />)}
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <div className="min-w-0 rounded-xl border border-slate-700 bg-slate-900 p-4">
          <h3 className="mb-3 font-bold">أكثر صفحات لوحة النظام زيارة</h3>
          <div className="max-h-80 overflow-auto">
            <table className="w-full text-right text-sm">
              <thead><tr className="border-b border-slate-700 text-slate-400"><th className="py-2">الصفحة</th><th>الزيارات</th></tr></thead>
              <tbody>{data.pages.map(p => <tr key={p.path} className="border-b border-slate-800">
                <td dir="ltr" className="break-all py-2 text-left font-mono text-xs">{p.path}</td>
                <td className="pr-2 tabular-nums">{p.visits.toLocaleString('ar-SA')}</td>
              </tr>)}</tbody>
            </table>
            {!data.pages.length && <p className="py-3 text-sm text-slate-400">لا توجد زيارات محفوظة لهذه الفترة.</p>}
          </div>
        </div>
        <div className="min-w-0 rounded-xl border border-slate-700 bg-slate-900 p-4">
          <h3 className="mb-3 font-bold">المستخدمون الأكثر نشاطًا</h3>
          <div className="max-h-80 overflow-auto">
            <table className="w-full text-right text-sm">
              <thead><tr className="border-b border-slate-700 text-slate-400"><th className="py-2">الحساب</th><th>الأحداث</th></tr></thead>
              <tbody>{data.actors.map(a => <tr key={a.userId || a.email} className="border-b border-slate-800">
                <td className="break-all py-2" dir="ltr">{a.email}</td>
                <td className="pr-2 tabular-nums">{a.events.toLocaleString('ar-SA')}</td>
              </tr>)}</tbody>
            </table>
            {!data.actors.length && <p className="py-3 text-sm text-slate-400">لا توجد حسابات معروفة نشطة لهذه الفترة.</p>}
          </div>
        </div>
      </div>
      <div className="rounded-xl border border-slate-700 bg-slate-900 p-4">
        <h3 className="mb-2 font-bold">خريطة موارد الملفات والتنزيل</h3>
        <p className="mb-3 text-sm text-slate-400">تُظهر نوع المورد وسياسة الوصول الموجودة فعليًا. لا يعني وجود الملف أن تنزيله متاح للبيع.</p>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[700px] text-right text-sm">
            <thead><tr className="border-b border-slate-700 text-slate-400"><th className="py-2">نوع المورد</th><th>مسار API</th><th>سياسة الحماية</th><th>التغطية</th></tr></thead>
            <tbody>{data.resourceInventory.map(item => <tr key={item.type} className="border-b border-slate-800">
              <td className="py-3">{item.type === 'ACTIVITY_REPORT' ? 'تقرير نشاط الموقع' : item.type === 'HR_EMPLOYEE_DOCUMENT' ? 'مستندات موظفي الموارد البشرية' : 'ملفات الموقع العامة'}</td>
              <td dir="ltr" className="break-all text-left font-mono text-xs">{item.route || '—'}</td>
              <td className="pr-2">{item.downloadPolicy === 'OWNER_APPROVAL_OR_VERIFIED_PAYMENT' ? 'موافقة المالك أو دفع موثّق' : item.downloadPolicy === 'HR_DOCUMENT_READ_PERMISSION' ? 'صلاحية قراءة مستندات HR' : 'غير مشمول برقابة تنزيل المالك'}</td>
              <td className={item.availability === 'AVAILABLE' ? 'text-green-300' : 'text-amber-300'}>{item.availability === 'AVAILABLE' ? 'مدعوم' : 'غير مشمول'}</td>
            </tr>)}</tbody>
          </table>
        </div>
      </div>
      <div className="rounded-xl border border-slate-700 bg-slate-900 p-4">
        <h3 className="mb-3 font-bold">أحدث أخطاء HTTP في سجل التدقيق</h3>
        <div className="max-h-72 overflow-x-auto overflow-y-auto">
          <table className="w-full min-w-[620px] text-right text-sm">
            <thead><tr className="border-b border-slate-700 text-slate-400"><th>الوقت</th><th>الطريقة</th><th>المسار</th><th>الحالة</th></tr></thead>
            <tbody>{data.recentErrors.map(e => <tr key={e.id} className="border-b border-slate-800">
              <td className="py-2">{new Date(e.createdAt).toLocaleString('ar-SA')}</td>
              <td>{e.httpMethod || '—'}</td>
              <td className="break-all font-mono text-xs" dir="ltr">{e.httpPath || '—'}</td>
              <td className="font-semibold text-amber-300">{e.responseStatus ?? '—'}</td>
            </tr>)}</tbody>
          </table>
          {!data.recentErrors.length && <p className="py-3 text-sm text-slate-400">لا توجد أخطاء HTTP محفوظة في الفترة.</p>}
        </div>
      </div>
      <p className="rounded-md border border-slate-700 p-3 text-xs text-slate-400">
        حدود التغطية: زيارات صفحات لوحة النظام بعد تسجيل الدخول فقط. الزوار المجهولون غير مسجلين في هذه المؤشرات.
        عدد التصديرات يعني إرسال التقرير من الخادم ولا يثبت حفظه على جهاز المستخدم.
        لا يشمل هذا التقرير تنزيل جميع أنواع ملفات الموقع؛ ويُعرض عدد الجلسات النشطة بحسب انتهاء الجلسة وعدم إلغائها.
      </p>
    </>}
  </section>;
}
