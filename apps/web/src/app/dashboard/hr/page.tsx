'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import api from '@/lib/api';
import {
  Briefcase, Users, ClipboardList, CalendarDays, Wallet, Network,
  Clock3, UserCheck, UserX, TimerReset, Home, AlertTriangle, RefreshCw, FileText, Coins, ReceiptText, BriefcaseBusiness, Target, GraduationCap
} from 'lucide-react';

export default function HrDashboardPage() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = () => {
    setLoading(true);
    setError('');
    api.get('/hr/dashboard')
      .then(r => setData(r.data))
      .catch(() => setError('تعذر تحميل مؤشرات مكين'))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
  }, []);

  if (loading) {
    return <div className="h-72 flex items-center justify-center"><RefreshCw className="h-8 w-8 animate-spin text-primary-400" /></div>;
  }

  if (error || !data) {
    return (
      <div className="scc-card text-center py-12">
        <AlertTriangle className="h-10 w-10 text-amber-400 mx-auto mb-3" />
        <p className="text-white font-medium">{error || 'لا تتوفر بيانات مكين'}</p>
        <button onClick={load} className="mt-4 text-primary-400 hover:text-primary-300">إعادة المحاولة</button>
      </div>
    );
  }

  const cards = [
    { label: 'إجمالي الموظفين', value: data.workforce.total, icon: Users, href: '/dashboard/hr/employees' },
    { label: 'نشطون', value: data.workforce.active, icon: UserCheck, href: '/dashboard/hr/employees' },
    { label: 'في إجازة', value: data.workforce.onLeave, icon: CalendarDays, href: '/dashboard/hr/leaves' },
    { label: 'طلبات إجازة معلقة', value: data.pendingLeaves, icon: AlertTriangle, href: '/dashboard/hr/leaves' },
    { label: 'حاضرون اليوم', value: data.attendanceToday.present, icon: ClipboardList, href: '/dashboard/hr/attendance' },
    { label: 'متأخرون اليوم', value: data.attendanceToday.late, icon: TimerReset, href: '/dashboard/hr/attendance' },
    { label: 'غائبون اليوم', value: data.attendanceToday.absent, icon: UserX, href: '/dashboard/hr/attendance' },
    { label: 'عن بعد اليوم', value: data.attendanceToday.remote, icon: Home, href: '/dashboard/hr/attendance' },
  ];

  const quickLinks = [
    { label: 'الموظفون', href: '/dashboard/hr/employees', icon: Users },
    { label: 'الحضور', href: '/dashboard/hr/attendance', icon: ClipboardList },
    { label: 'الورديات', href: '/dashboard/hr/shifts', icon: Clock3 },
    { label: 'الإجازات', href: '/dashboard/hr/leaves', icon: CalendarDays },
    { label: 'الرواتب', href: '/dashboard/hr/payroll', icon: Wallet },
    { label: 'المستندات', href: '/dashboard/hr/documents', icon: FileText },
    { label: 'السلف والقروض', href: '/dashboard/hr/loans', icon: Coins },
    { label: 'المخالصة', href: '/dashboard/hr/settlements', icon: ReceiptText },
    { label: 'التوظيف', href: '/dashboard/hr/recruitment', icon: BriefcaseBusiness },
    { label: 'الأداء', href: '/dashboard/hr/performance', icon: Target },
    { label: 'التدريب', href: '/dashboard/hr/training', icon: GraduationCap },
    { label: 'الإدارات', href: '/dashboard/hr/departments', icon: Network },
  ];

  return (
    <div className="space-y-6 animate-fade-in-up">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <Briefcase className="h-6 w-6 text-primary-400" />
            مكين - مركز قيادة الموارد البشرية
          </h1>
          <p className="text-slate-400 text-sm mt-1">مؤشرات تشغيلية مباشرة · التوقيت: الرياض</p>
        </div>
        <button onClick={load} className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-slate-800 text-slate-300 hover:text-white">
          <RefreshCw className="h-4 w-4" />
          تحديث
        </button>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {cards.map((card) => (
          <Link key={card.label} href={card.href} className="scc-card-hover">
            <card.icon className="h-5 w-5 text-primary-400 mb-3" />
            <p className="text-2xl font-bold text-white">{card.value}</p>
            <p className="text-slate-400 text-sm mt-1">{card.label}</p>
          </Link>
        ))}
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
        <div className="scc-card xl:col-span-2">
          <div className="flex items-center justify-between gap-3 mb-4">
            <h2 className="text-white font-semibold">الرواتب — {data.payroll.month}/{data.payroll.year}</h2>
            <Link href="/dashboard/hr/payroll-runs" className="text-primary-400 text-sm hover:text-primary-300">
              {data.payroll.run ? `مسير الشهر: ${data.payroll.run.status}` : 'إنشاء مسير الشهر'}
            </Link>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            <div className="rounded-xl bg-slate-800/60 p-4">
              <p className="text-slate-500 text-xs">إجمالي الصافي</p>
              <p className="text-white font-bold mt-1">{Number(data.payroll.netTotal).toLocaleString('ar-SA')} ر.س</p>
            </div>
            <div className="rounded-xl bg-slate-800/60 p-4">
              <p className="text-slate-500 text-xs">السجلات</p>
              <p className="text-white font-bold mt-1">{data.payroll.records}</p>
            </div>
            <div className="rounded-xl bg-slate-800/60 p-4">
              <p className="text-slate-500 text-xs">مسودة</p>
              <p className="text-amber-400 font-bold mt-1">{data.payroll.draft}</p>
            </div>
            <div className="rounded-xl bg-slate-800/60 p-4">
              <p className="text-slate-500 text-xs">معتمد</p>
              <p className="text-blue-400 font-bold mt-1">{data.payroll.approved}</p>
            </div>
            <div className="rounded-xl bg-slate-800/60 p-4">
              <p className="text-slate-500 text-xs">مدفوع</p>
              <p className="text-emerald-400 font-bold mt-1">{data.payroll.paid}</p>
            </div>
          </div>
        </div>

        <div className="scc-card">
          <h2 className="text-white font-semibold mb-4">الهيكل والتشغيل</h2>
          <div className="space-y-3">
            <div className="flex items-center justify-between"><span className="text-slate-400">الإدارات</span><span className="text-white font-bold">{data.departments}</span></div>
            <div className="flex items-center justify-between"><span className="text-slate-400">الورديات</span><span className="text-white font-bold">{data.shifts}</span></div>
            <div className="flex items-center justify-between"><span className="text-slate-400">موقوفون</span><span className="text-white font-bold">{data.workforce.suspended}</span></div>
            <div className="flex items-center justify-between"><span className="text-slate-400">منتهية خدمتهم</span><span className="text-white font-bold">{data.workforce.terminated}</span></div>
          </div>
        </div>
      </div>

      <div className="scc-card">
        <h2 className="text-white font-semibold mb-4">الوصول السريع</h2>
        <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-12 gap-3">
          {quickLinks.map((item) => (
            <Link key={item.href} href={item.href} className="rounded-xl border border-slate-800 bg-slate-900/60 p-4 hover:border-primary-500/40 transition-colors">
              <item.icon className="h-5 w-5 text-primary-400 mb-2" />
              <span className="text-slate-200 text-sm">{item.label}</span>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
