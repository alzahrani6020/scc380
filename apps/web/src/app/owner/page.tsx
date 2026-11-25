'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import {
  Activity, AlertTriangle, ArrowLeft, Building2, ClipboardCheck, FileCheck2,
  FileDown, HeartPulse, Layers3, LockKeyhole, RefreshCw, ScrollText, ShieldCheck,
  Users, Wallet, Wrench, LifeBuoy, PackageCheck,
} from 'lucide-react';
import api from '@/lib/api';
import OwnerActivityPanel from '@/components/owner/OwnerActivityPanel';
import OwnerFilesPanel from '@/components/owner/OwnerFilesPanel';

type InsightSummary = {
  activeSessions: number;
  auditedHttpErrors: number;
  loginFailures: number;
  recordedEvents: number;
  downloadApprovalRequests: number;
};
type InsightResponse = { summary: InsightSummary; period: { days: number } };
type ReportRequest = { id: string; status: string };
type FileRequest = { id: string; status: string };
type Metric = { label: string; value: number | null; warning?: boolean; href: string };
type Tile = {
  title: string; detail: string; href?: string; state: 'linked' | 'planned';
  icon: typeof Activity;
};

const modules: Tile[] = [
  { title: 'النشاط والتدقيق', detail: 'سجل الأحداث والجلسات وعمليات الدخول', href: '/owner?tab=activity', state: 'linked', icon: Activity },
  { title: 'طلبات الملفات', detail: 'الموافقات وقرارات تنزيل الملفات التجارية', href: '/owner?tab=files', state: 'linked', icon: FileDown },
  { title: 'إدارة الشركات', detail: 'العقود وحالة التفعيل وحدود الخدمات', state: 'planned', icon: Building2 },
  { title: 'إدارة المستخدمين', detail: 'الأدوار والدعوات وإدارة الجلسات', state: 'planned', icon: Users },
  { title: 'صحة المنصة', detail: 'الخدمات والإنذارات وزمن الاستجابة', state: 'planned', icon: HeartPulse },
  { title: 'النسخ الاحتياطي', detail: 'إثبات الاستعادة وخطط التعافي', state: 'planned', icon: ShieldCheck },
  { title: 'الاشتراكات والتراخيص', detail: 'الباقات والتجديد وإصدارات العملاء', state: 'planned', icon: LockKeyhole },
  { title: 'المؤشرات المالية', detail: 'الفوترة والتحصيل على مستوى المنصة', state: 'planned', icon: Wallet },
  { title: 'وحدات النظام', detail: 'حالة CRM وERP وHR وبقية الوحدات', state: 'planned', icon: Layers3 },
  { title: 'الإشعارات', detail: 'تصنيف ومتابعة التنبيهات التشغيلية', state: 'planned', icon: AlertTriangle },
  { title: 'الدعم الفني', detail: 'البلاغات والتصعيد ووقت الاستجابة', state: 'planned', icon: LifeBuoy },
  { title: 'الإصدارات والتسليم', detail: 'حزم العملاء والتحديثات والتحقق', state: 'planned', icon: PackageCheck },
  { title: 'سجل الحوادث', detail: 'السبب الجذري والإغلاق المثبت', state: 'planned', icon: Wrench },
  { title: 'التقارير التنفيذية', detail: 'تقارير مفصّلة من البيانات المصرّح بها', state: 'planned', icon: ScrollText },
];

function MetricCard({ metric }: { metric: Metric }) {
  return (
    <Link href={metric.href} className="rounded-xl border border-slate-700 bg-slate-900 p-4 transition hover:border-blue-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-400">
      <p className="text-sm text-slate-300">{metric.label}</p>
      <p className={`mt-2 text-2xl font-semibold ${metric.warning && metric.value !== null && metric.value > 0 ? 'text-amber-300' : 'text-white'}`}>
        {metric.value === null ? 'غير متاح' : metric.value.toLocaleString('ar-SA')}
      </p>
      <p className="mt-2 text-xs text-blue-300">عرض التفاصيل</p>
    </Link>
  );
}

export default function OwnerCommandCenter() {
  const [tab, setTab] = useState<'overview' | 'activity' | 'files'>('overview');
  useEffect(() => {
    const resolve = () => {
      const requested = new URLSearchParams(window.location.search).get('tab');
      setTab(requested === 'activity' || requested === 'files' ? requested : 'overview');
    };
    resolve();
    window.addEventListener('popstate', resolve);
    return () => window.removeEventListener('popstate', resolve);
  }, []);
  const selectTab = (next: 'overview' | 'activity' | 'files') => {
    setTab(next);
    const url = new URL(window.location.href);
    if (next === 'overview') url.searchParams.delete('tab');
    else url.searchParams.set('tab', next);
    window.history.pushState(null, '', url.pathname + url.search);
  };
  const [loading, setLoading] = useState(true);
  const [insights, setInsights] = useState<InsightSummary | null>(null);
  const [reportPending, setReportPending] = useState<number | null>(null);
  const [filePending, setFilePending] = useState<number | null>(null);
  const [apiReady, setApiReady] = useState<boolean | null>(null);
  const [errors, setErrors] = useState<string[]>([]);
  const [lastChecked, setLastChecked] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    const results = await Promise.allSettled([
      api.get<InsightResponse>('/analytics/activity/owner/insights?days=7'),
      api.get<ReportRequest[]>('/analytics/activity/owner/requests'),
      api.get<FileRequest[]>('/owner-files/owner/requests'),
      api.get<{ status: string }>('/ready'),
    ]);
    const problems: string[] = [];
    if (results[0].status === 'fulfilled' && results[0].value.data?.summary) {
      const summary = results[0].value.data.summary;
      if (['activeSessions', 'auditedHttpErrors', 'loginFailures', 'recordedEvents', 'downloadApprovalRequests'].every(
        key => Number.isFinite(summary[key as keyof InsightSummary])
      )) setInsights(summary);
      else { setInsights(null); problems.push('المؤشرات التشغيلية: استجابة غير مكتملة'); }
    } else { setInsights(null); problems.push('المؤشرات التشغيلية: تعذرت القراءة'); }

    if (results[1].status === 'fulfilled' && Array.isArray(results[1].value.data)) {
      setReportPending(results[1].value.data.filter(r => r.status === 'PENDING').length);
    } else { setReportPending(null); problems.push('طلبات التقارير: تعذرت القراءة'); }

    if (results[2].status === 'fulfilled' && Array.isArray(results[2].value.data)) {
      const requests = results[2].value.data;
      // The owner-files endpoint initially returns up to 200 records.
      // This count is a loaded-page count, not a complete system total.
      setFilePending(requests.filter(r => r.status === 'PENDING').length);
    } else { setFilePending(null); problems.push('طلبات الملفات: تعذرت القراءة'); }
    if (results[3].status === 'fulfilled' && results[3].value.data?.status === 'ready') {
      setApiReady(true);
    } else {
      setApiReady(false);
      problems.push('جاهزية API وقاعدة PostgreSQL: لم تثبت');
    }
    setErrors(problems);
    setLastChecked(new Date().toISOString());
    setLoading(false);
  }, []);

  useEffect(() => { void refresh(); }, [refresh]);

  const metrics: Metric[] = [
    { label: 'جلسات نشطة (آخر 7 أيام)', value: insights?.activeSessions ?? null, href: '/owner/activity' },
    { label: 'أخطاء HTTP مسجلة (7 أيام)', value: insights?.auditedHttpErrors ?? null, warning: true, href: '/owner/activity' },
    { label: 'محاولات دخول فاشلة (7 أيام)', value: insights?.loginFailures ?? null, warning: true, href: '/owner/activity' },
    { label: 'طلبات تقارير معلّقة (المعروض)', value: reportPending, warning: true, href: '/owner/activity' },
    { label: 'طلبات ملفات معلّقة (أول صفحة)', value: filePending, warning: true, href: '/owner/files' },
  ];

  return (
    <main dir="rtl" className="mx-auto max-w-7xl space-y-7 px-4 py-8 text-white">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-medium tracking-wide text-blue-300">SCC380 / OWNER COMMAND CENTER</p>
          <h1 className="mt-2 text-2xl font-bold sm:text-3xl">مركز القيادة الإجرائية للمالك</h1>
          <p className="mt-2 max-w-3xl text-sm text-slate-300">مركز موحد للوحدات المتاحة فعلًا، مع تمييز الوحدات غير المرتبطة. جميع البيانات من خدمات المالك المصرّح بها؛ لا توجد بيانات تجريبية.</p>
        </div>
        <button type="button" disabled={loading} onClick={() => void refresh()}
          className="inline-flex items-center gap-2 rounded-lg border border-blue-600 px-4 py-2 text-sm text-blue-100 disabled:opacity-50">
          <RefreshCw className="h-4 w-4" />{loading ? 'جارٍ التحقق...' : 'تحديث البيانات'}
        </button>
      </header>

      <nav aria-label="أقسام لوحة المالك الموحدة" className="flex flex-wrap gap-2 rounded-xl border border-slate-700 bg-slate-900 p-3">
        {([{id:'overview',name:'نظرة عامة'}, {id:'activity',name:'النشاط والتدقيق والموافقات'}, {id:'files',name:'طلبات الملفات'}] as const).map(item => (
          <button key={item.id} type="button" aria-current={tab === item.id ? 'page' : undefined}
            className={`rounded-lg px-4 py-3 text-sm font-medium focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-400 ${tab === item.id ? 'bg-blue-700 text-white' : 'bg-slate-800 text-slate-200 hover:bg-slate-700'}`}
            onClick={() => selectTab(item.id)}>{item.name}</button>
        ))}
      </nav>
      {tab === 'overview' && <>
      <section aria-label="حالة الاتصال" className="rounded-xl border border-slate-700 bg-slate-900 p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="font-semibold">حالة مصادر بيانات المالك</h2>
          <span className="text-xs text-slate-400">{lastChecked ? `آخر تحقق: ${new Date(lastChecked).toLocaleString('ar-SA')}` : 'لم يكتمل التحقق بعد'}</span>
        </div>
        <p className="mt-2 text-sm text-slate-300">{loading ? 'جارٍ فحص مصادر البيانات...' : errors.length === 0 ? 'اجتازت مصادر البيانات وفحص الجاهزية القراءة. هذه ليست شهادة بصحة جميع خدمات الإنتاج.' : 'بعض المصادر غير متاحة. الأرقام المتأثرة تعرض «غير متاح» بدل الصفر.'}</p>
        <p className="mt-2 text-sm text-slate-300">جاهزية API واتصال PostgreSQL: {apiReady === null ? 'جارٍ الفحص' : apiReady ? 'جاهز وفق /ready' : 'غير جاهز أو تعذر التحقق'}. لا تثبت هذه القراءة وجود نسخة احتياطية أو سلامة جميع الوظائف.</p>
        {errors.length > 0 && <ul role="alert" className="mt-3 list-inside list-disc space-y-1 text-sm text-amber-300">
          {errors.map(error => <li key={error}>{error}</li>)}
        </ul>}
      </section>

      <section aria-labelledby="owner-critical-metrics">
        <h2 id="owner-critical-metrics" className="mb-3 text-lg font-semibold">مؤشرات وإجراءات عاجلة</h2>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-5">
          {metrics.map(metric => <MetricCard key={metric.label} metric={metric} />)}
        </div>
        <p className="mt-2 text-xs text-slate-400">عدد طلبات الملفات يخص الصفحة المحملة فقط وقد توجد طلبات أقدم؛ ولا يُعد رقمًا شاملًا لجميع العملاء.</p>
      </section>

      <section aria-labelledby="owner-modules">
        <h2 id="owner-modules" className="mb-3 text-lg font-semibold">وحدات مركز القيادة</h2>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {modules.map(({ title, detail, href, state, icon: Icon }) => (
            <div key={title} className="rounded-xl border border-slate-700 bg-slate-900 p-4">
              <div className="flex items-center justify-between gap-2">
                <Icon className="h-5 w-5 text-blue-300" aria-hidden="true" />
                <span className={`rounded-full px-2 py-1 text-xs ${state === 'linked' ? 'bg-blue-950 text-blue-200' : 'bg-slate-800 text-slate-300'}`}>
                  {state === 'linked' ? 'مرتبط' : 'غير مرتبط'}
                </span>
              </div>
              <h3 className="mt-3 font-semibold">{title}</h3>
              <p className="mt-1 min-h-[2.5rem] text-sm text-slate-400">{detail}</p>
              {href ? <Link href={href} className="mt-3 inline-flex items-center gap-2 text-sm text-blue-300 hover:underline">
                فتح الوحدة <ArrowLeft className="h-4 w-4" />
              </Link> : <p className="mt-3 text-xs text-slate-500">بانتظار الربط والتحقق من الصلاحيات</p>}
            </div>
          ))}
        </div>
      </section>
      </>}
      {tab === 'activity' && <OwnerActivityPanel />}
      {tab === 'files' && <OwnerFilesPanel />}
      <aside className="rounded-xl border border-slate-700 p-4 text-sm text-slate-300">
        <ClipboardCheck className="mb-2 h-5 w-5 text-blue-300" />
        صلاحية المالك تخضع للتحقق من API قبل عرض هذه الصفحة. لا تمنح هذه اللوحة صلاحيات جديدة للوصول إلى بيانات شركات العملاء أو ملفات HR وERP.
        <Link href="/owner?tab=activity" className="mr-2 text-blue-300 underline">سجل النشاط والقرارات</Link>
        <Link href="/owner?tab=files" className="mr-2 text-blue-300 underline">مركز الملفات</Link>
      </aside>
    </main>
  );
}
