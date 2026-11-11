'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Activity,
  Building2,
  Gauge,
  GitBranch,
  Handshake,
  RefreshCw,
  TrendingUp,
  Users,
} from 'lucide-react';
import api from '@/lib/api';
import Button from '@/components/ui/Button';

const stageLabels: Record<string, string> = {
  LEAD: 'محتمل',
  QUALIFIED: 'مؤهل',
  PROPOSAL: 'عرض',
  NEGOTIATION: 'تفاوض',
  CLOSED_WON: 'مغلق - ربح',
  CLOSED_LOST: 'مغلق - خسارة',
};

const sourceLabels: Record<string, string> = {
  WEBSITE: 'الموقع',
  REFERRAL: 'إحالة',
  SOCIAL_MEDIA: 'التواصل الاجتماعي',
  EMAIL: 'البريد',
  PHONE: 'الهاتف',
  TRADE_SHOW: 'فعالية',
  OTHER: 'أخرى',
};

const quickLinks = [
  { href: '/dashboard/crm/contacts', label: 'جهات الاتصال', icon: Users },
  { href: '/dashboard/crm/companies', label: 'الشركات', icon: Building2 },
  { href: '/dashboard/crm/deals', label: 'الصفقات', icon: Handshake },
  { href: '/dashboard/crm/pipelines', label: 'مسارات المبيعات', icon: GitBranch },
  { href: '/dashboard/crm/activities', label: 'الأنشطة', icon: Activity },
];

export default function CrmOverviewPage() {
  const [dashboard, setDashboard] = useState<any>(null);
  const [crmStats, setCrmStats] = useState<any>(null);
  const [companiesCount, setCompaniesCount] = useState(0);
  const [pipelinesCount, setPipelinesCount] = useState(0);
  const [activities, setActivities] = useState<any[]>([]);
  const [activitiesCount, setActivitiesCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [dashboardRes, crmRes, companiesRes, pipelinesRes, activitiesRes] = await Promise.all([
        api.get('/analytics/dashboard'),
        api.get('/analytics/crm'),
        api.get('/crm/companies?limit=1'),
        api.get('/crm/pipelines'),
        api.get('/crm/activities?limit=5&sort=recent'),
      ]);

      setDashboard(dashboardRes.data);
      setCrmStats(crmRes.data);
      setCompaniesCount(Number(companiesRes.data?.count || 0));
      setPipelinesCount(Array.isArray(pipelinesRes.data) ? pipelinesRes.data.length : 0);
      setActivities(activitiesRes.data?.data || []);
      setActivitiesCount(Number(activitiesRes.data?.count ?? activitiesRes.data?.data?.length ?? 0));
    } catch (err) {
      console.error(err);
      setError('تعذر تحميل نظرة CRM. تحقق من الاتصال بالخادم ثم أعد المحاولة.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const stageRows = useMemo(() => {
    const unified = Array.isArray(crmStats?.stageBreakdown) ? crmStats.stageBreakdown : [];
    if (unified.length > 0) {
      const max = Math.max(1, ...unified.map((row: any) => Number(row?.count || 0)));
      return unified.map((row: any) => ({
        key: row.key,
        label: row.source === 'legacy' ? (stageLabels[row.label] || row.label || 'غير محدد') : row.label,
        count: Number(row?.count || 0),
        width: Math.max(4, Math.round((Number(row?.count || 0) / max) * 100)),
      }));
    }

    const rows = Array.isArray(crmStats?.byStage) ? crmStats.byStage : [];
    const max = Math.max(1, ...rows.map((row: any) => Number(row?._count?.id || 0)));
    return rows.map((row: any) => ({
      key: row.stage,
      label: stageLabels[row.stage] || row.stage || 'غير محدد',
      count: Number(row?._count?.id || 0),
      width: Math.max(4, Math.round((Number(row?._count?.id || 0) / max) * 100)),
    }));
  }, [crmStats]);

  const sourceRows = useMemo(() => {
    const rows = Array.isArray(crmStats?.bySource) ? crmStats.bySource : [];
    const max = Math.max(1, ...rows.map((row: any) => Number(row?._count?.id || 0)));
    return rows.map((row: any) => ({
      key: row.source || 'UNKNOWN',
      label: sourceLabels[row.source] || row.source || 'غير محدد',
      count: Number(row?._count?.id || 0),
      width: Math.max(4, Math.round((Number(row?._count?.id || 0) / max) * 100)),
    }));
  }, [crmStats]);

  const cards = [
    {
      label: 'جهات الاتصال',
      value: Number(dashboard?.counts?.contacts || 0),
      href: '/dashboard/crm/contacts',
      icon: Users,
    },
    {
      label: 'الشركات',
      value: companiesCount,
      href: '/dashboard/crm/companies',
      icon: Building2,
    },
    {
      label: 'الصفقات',
      value: Number(dashboard?.counts?.deals || 0),
      href: '/dashboard/crm/deals',
      icon: Handshake,
    },
    {
      label: 'مسارات المبيعات',
      value: pipelinesCount,
      href: '/dashboard/crm/pipelines',
      icon: GitBranch,
    },
    {
      label: 'الأنشطة',
      value: activitiesCount,
      href: '/dashboard/crm/activities',
      icon: Activity,
    },
  ];

  if (loading) {
    return (
      <div className="h-72 flex items-center justify-center">
        <RefreshCw className="h-9 w-9 animate-spin text-primary-400" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="scc-card min-h-64 flex flex-col items-center justify-center gap-4 text-center">
        <Gauge className="h-10 w-10 text-red-400" />
        <p className="text-slate-300">{error}</p>
        <Button onClick={load}><RefreshCw className="h-4 w-4" /> إعادة المحاولة</Button>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in-up">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <Gauge className="h-6 w-6 text-primary-400" />
            نظرة عامة على CRM
          </h1>
          <p className="text-slate-400 text-sm mt-1">
            ملخص حي لجهات الاتصال والشركات والصفقات ومسارات المبيعات والأنشطة.
          </p>
        </div>
        <Button variant="ghost" onClick={load}>
          <RefreshCw className="h-4 w-4" /> تحديث
        </Button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-5 gap-4">
        {cards.map((card) => (
          <Link key={card.label} href={card.href} className="scc-card-hover">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-xs text-slate-500">{card.label}</p>
                <p className="text-2xl font-bold text-white mt-1">{card.value.toLocaleString('ar-SA')}</p>
              </div>
              <div className="w-10 h-10 rounded-xl bg-primary-500/10 flex items-center justify-center">
                <card.icon className="h-5 w-5 text-primary-400" />
              </div>
            </div>
          </Link>
        ))}
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-5">
        <div className="scc-card xl:col-span-2">
          <div className="flex items-center justify-between gap-3 mb-5">
            <div>
              <h2 className="text-white font-bold">توزيع الصفقات حسب المرحلة</h2>
              <p className="text-xs text-slate-500 mt-1">من بيانات CRM الحية</p>
            </div>
            <Link href="/dashboard/crm/deals" className="text-xs text-primary-400 hover:text-primary-300">
              فتح الصفقات
            </Link>
          </div>

          {stageRows.length === 0 ? (
            <p className="text-sm text-slate-500 py-8 text-center">لا توجد صفقات حتى الآن.</p>
          ) : (
            <div className="space-y-4">
              {stageRows.map((row: any) => (
                <div key={row.key}>
                  <div className="flex items-center justify-between text-sm mb-1.5">
                    <span className="text-slate-300">{row.label}</span>
                    <span className="text-white font-semibold">{row.count}</span>
                  </div>
                  <div className="h-2 rounded-full bg-slate-800 overflow-hidden">
                    <div className="h-full rounded-full bg-primary-500" style={{ width: `${row.width}%` }} />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="scc-card">
          <div className="flex items-center justify-between gap-3 mb-5">
            <div>
              <h2 className="text-white font-bold">قيمة الصفقات الرابحة</h2>
              <p className="text-xs text-slate-500 mt-1">إجمالي CLOSED_WON</p>
            </div>
            <TrendingUp className="h-5 w-5 text-emerald-400" />
          </div>
          <p className="text-3xl font-bold text-white">
            {Number(dashboard?.revenue?.deals || 0).toLocaleString('ar-SA')}
          </p>
          <p className="text-sm text-slate-500 mt-1">ر.س</p>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
        <div className="scc-card">
          <h2 className="text-white font-bold mb-5">مصادر جهات الاتصال</h2>
          {sourceRows.length === 0 ? (
            <p className="text-sm text-slate-500 py-8 text-center">لا توجد بيانات مصادر حتى الآن.</p>
          ) : (
            <div className="space-y-4">
              {sourceRows.map((row: any) => (
                <div key={row.key}>
                  <div className="flex items-center justify-between text-sm mb-1.5">
                    <span className="text-slate-300">{row.label}</span>
                    <span className="text-white font-semibold">{row.count}</span>
                  </div>
                  <div className="h-2 rounded-full bg-slate-800 overflow-hidden">
                    <div className="h-full rounded-full bg-emerald-500" style={{ width: `${row.width}%` }} />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="scc-card">
          <div className="flex items-center justify-between gap-3 mb-5">
            <h2 className="text-white font-bold">أحدث الأنشطة</h2>
            <Link href="/dashboard/crm/activities" className="text-xs text-primary-400 hover:text-primary-300">
              عرض الكل
            </Link>
          </div>

          {activities.length === 0 ? (
            <p className="text-sm text-slate-500 py-8 text-center">لا توجد أنشطة حتى الآن.</p>
          ) : (
            <div className="space-y-3">
              {activities.slice(0, 5).map((item: any) => (
                <div key={item.id} className="rounded-xl border border-slate-800 p-3">
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-sm font-medium text-white truncate">{item.subject}</p>
                    <span className="text-[10px] px-2 py-1 rounded-full bg-primary-500/10 text-primary-300">
                      {item.type}
                    </span>
                  </div>
                  {item.scheduledAt && (
                    <p className="text-xs text-slate-500 mt-1">
                      {new Date(item.scheduledAt).toLocaleString('ar-SA')}
                    </p>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="scc-card">
        <h2 className="text-white font-bold mb-4">وصول سريع</h2>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          {quickLinks.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="rounded-xl border border-slate-800 p-3 hover:border-primary-500/50 hover:bg-primary-500/5 transition-colors"
            >
              <item.icon className="h-5 w-5 text-primary-400 mb-2" />
              <span className="text-sm text-slate-300">{item.label}</span>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
