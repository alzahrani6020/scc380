'use client';

import { useEffect, useState } from 'react';
import api from '@/lib/api';
import { isVIP } from '@/lib/auth';
import AlertsWidget from '@/components/AlertsWidget';
import {
  Users, Briefcase, Truck, FileText, TrendingUp,
  Crown, Activity, ArrowUpRight, Wallet,
} from 'lucide-react';
import {
  ResponsiveContainer, AreaChart, Area, XAxis, YAxis,
  CartesianGrid, Tooltip, BarChart, Bar, PieChart, Pie, Cell,
} from 'recharts';

const CHART_COLORS = {
  deals: ['#0066CC', '#0ea5e9', '#22d3ee', '#34d399', '#a78bfa', '#f472b6'],
  invoices: { PAID: '#10b981', SENT: '#0ea5e9', OVERDUE: '#ef4444', DRAFT: '#64748b', PARTIAL: '#f59e0b', VIEWED: '#8b5cf6', CANCELLED: '#94a3b8' },
  vehicles: { ACTIVE: '#10b981', IN_MAINTENANCE: '#ef4444', INACTIVE: '#64748b', RETIRED: '#94a3b8', RESERVED: '#f59e0b' },
  revenue: '#0066CC',
};

function CustomTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-slate-900 border border-slate-700 rounded-xl px-4 py-3 shadow-xl">
      {label && <p className="text-slate-400 text-xs mb-1">{label}</p>}
      {payload.map((p: any, i: number) => (
        <p key={i} className="text-white text-sm font-medium">
          {p.name}: {Number(p.value).toLocaleString()} {p.name.includes('ر.س') ? 'ر.س' : ''}
        </p>
      ))}
    </div>
  );
}

export default function DashboardPage() {
  const [stats, setStats] = useState<any>(null);
  const [revenueTrend, setRevenueTrend] = useState<any[]>([]);
  const [crmData, setCrmData] = useState<any>(null);
  const [erpData, setErpData] = useState<any>(null);
  const [fleetData, setFleetData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const vip = typeof window !== 'undefined' && isVIP();

  useEffect(() => {
    Promise.all([
      api.get('/analytics/dashboard'),
      api.get('/analytics/revenue-trend'),
      api.get('/analytics/crm'),
      api.get('/analytics/erp'),
      api.get('/analytics/fleet'),
    ])
      .then(([dash, rev, crm, erp, fleet]) => {
        setStats(dash.data);
        setRevenueTrend(rev.data || []);
        setCrmData(crm.data);
        setErpData(erp.data);
        setFleetData(fleet.data);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const cards = [
    { label: 'جهات الاتصال', value: stats?.counts?.contacts ?? 0, icon: Users, color: 'from-blue-500 to-cyan-500', bg: 'bg-blue-500/10', text: 'text-blue-400' },
    { label: 'الصفقات', value: stats?.counts?.deals ?? 0, icon: Briefcase, color: 'from-emerald-500 to-teal-500', bg: 'bg-emerald-500/10', text: 'text-emerald-400' },
    { label: 'الموظفين', value: stats?.counts?.employees ?? 0, icon: Activity, color: 'from-violet-500 to-purple-500', bg: 'bg-violet-500/10', text: 'text-violet-400' },
    { label: 'المركبات', value: stats?.counts?.vehicles ?? 0, icon: Truck, color: 'from-orange-500 to-amber-500', bg: 'bg-orange-500/10', text: 'text-orange-400' },
    { label: 'الفواتير', value: stats?.counts?.invoices ?? 0, icon: FileText, color: 'from-rose-500 to-pink-500', bg: 'bg-rose-500/10', text: 'text-rose-400' },
    { label: 'الإيرادات', value: `${stats?.revenue?.invoices?.toLocaleString?.() ?? 0} ر.س`, icon: Wallet, color: 'from-amber-500 to-yellow-500', bg: 'bg-amber-500/10', text: 'text-amber-400' },
  ];

  const dealsByStage = (crmData?.byStage || []).map((d: any) => ({
    name: translateStage(d.stage),
    value: d._count.id,
  }));

  const invoicesByStatus = (erpData?.byStatus || []).map((d: any) => ({
    name: translateInvoiceStatus(d.status),
    value: d._count.id,
    color: CHART_COLORS.invoices[d.status as keyof typeof CHART_COLORS.invoices] || '#64748b',
  }));

  const vehiclesByStatus = (fleetData?.byStatus || []).map((d: any) => ({
    name: translateVehicleStatus(d.status),
    value: d._count.id,
    color: CHART_COLORS.vehicles[d.status as keyof typeof CHART_COLORS.vehicles] || '#64748b',
  }));

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-10 h-10 border-4 border-primary-500/30 border-t-primary-500 rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-fade-in-up">
      {/* Welcome */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-white mb-2">
            {vip ? (
              <span className="flex items-center gap-2">
                مرحباً <Crown className="h-8 w-8 text-amber-400" /> VIP
              </span>
            ) : 'لوحة التحكم'}
          </h1>
          <p className="text-slate-400">
            {vip ? 'وضع المالك - صلاحيات كاملة بدون قيود' : 'نظرة عامة على أداء منشأتك'}
          </p>
        </div>
        {vip && (
          <span className="badge-vip">
            <Crown className="h-3 w-3" /> SUPER ADMIN MODE
          </span>
        )}
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {cards.map((card, i) => (
          <div key={card.label} className="scc-card-hover group" style={{ animationDelay: `${i * 100}ms` }}>
            <div className="flex items-start justify-between mb-4">
              <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${card.color} flex items-center justify-center shadow-lg`}>
                <card.icon className="h-6 w-6 text-white" />
              </div>
              <span className={`inline-flex items-center gap-1 text-xs font-medium ${card.text}`}>
                <ArrowUpRight className="h-3 w-3" /> +12%
              </span>
            </div>
            <p className="text-slate-400 text-sm mb-1">{card.label}</p>
            <p className="text-2xl font-bold text-white">{card.value}</p>
          </div>
        ))}
      </div>

      {/* Alerts */}
      <AlertsWidget />

      {/* Charts Row 1 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Revenue Trend */}
        <div className="scc-card">
          <div className="flex items-center gap-2 mb-4">
            <TrendingUp className="h-5 w-5 text-primary-400" />
            <h3 className="text-lg font-bold text-white">مؤشر الإيرادات</h3>
          </div>
          <div className="h-64">
            {revenueTrend.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={revenueTrend}>
                  <defs>
                    <linearGradient id="revenueGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor={CHART_COLORS.revenue} stopOpacity={0.3} />
                      <stop offset="95%" stopColor={CHART_COLORS.revenue} stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                  <XAxis dataKey="month" stroke="#64748b" tick={{ fontSize: 12 }} />
                  <YAxis stroke="#64748b" tick={{ fontSize: 12 }} tickFormatter={(v) => `${(v / 1000).toFixed(0)}K`} />
                  <Tooltip content={<CustomTooltip />} />
                  <Area type="monotone" dataKey="revenue" name="الإيرادات (ر.س)" stroke={CHART_COLORS.revenue} fill="url(#revenueGradient)" strokeWidth={2} />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center h-full text-slate-500 text-sm">لا توجد بيانات إيرادات</div>
            )}
          </div>
        </div>

        {/* Deals by Stage */}
        <div className="scc-card">
          <div className="flex items-center gap-2 mb-4">
            <Briefcase className="h-5 w-5 text-primary-400" />
            <h3 className="text-lg font-bold text-white">الصفقات حسب المرحلة</h3>
          </div>
          <div className="h-64">
            {dealsByStage.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={dealsByStage}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                  <XAxis dataKey="name" stroke="#64748b" tick={{ fontSize: 11 }} />
                  <YAxis stroke="#64748b" tick={{ fontSize: 12 }} />
                  <Tooltip content={<CustomTooltip />} />
                  <Bar dataKey="value" name="عدد الصفقات" radius={[6, 6, 0, 0]}>
                    {dealsByStage.map((_: any, i: number) => (
                      <Cell key={i} fill={CHART_COLORS.deals[i % CHART_COLORS.deals.length]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center h-full text-slate-500 text-sm">لا توجد صفقات</div>
            )}
          </div>
        </div>
      </div>

      {/* Charts Row 2 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Invoices by Status */}
        <div className="scc-card">
          <div className="flex items-center gap-2 mb-4">
            <FileText className="h-5 w-5 text-primary-400" />
            <h3 className="text-lg font-bold text-white">الفواتير حسب الحالة</h3>
          </div>
          <div className="h-64 flex items-center">
            {invoicesByStatus.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={invoicesByStatus}
                    cx="50%"
                    cy="50%"
                    innerRadius={50}
                    outerRadius={90}
                    paddingAngle={4}
                    dataKey="value"
                    nameKey="name"
                  >
                    {invoicesByStatus.map((entry: any, i: number) => (
                      <Cell key={i} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip content={<CustomTooltip />} />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center h-full text-slate-500 text-sm w-full">لا توجد فواتير</div>
            )}
          </div>
          <div className="flex flex-wrap justify-center gap-3 mt-2">
            {invoicesByStatus.map((entry: any, i: number) => (
              <div key={i} className="flex items-center gap-1.5">
                <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: entry.color }} />
                <span className="text-slate-400 text-xs">{entry.name} ({entry.value})</span>
              </div>
            ))}
          </div>
        </div>

        {/* Vehicles by Status */}
        <div className="scc-card">
          <div className="flex items-center gap-2 mb-4">
            <Truck className="h-5 w-5 text-primary-400" />
            <h3 className="text-lg font-bold text-white">حالة المركبات</h3>
          </div>
          <div className="h-64 flex items-center">
            {vehiclesByStatus.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={vehiclesByStatus}
                    cx="50%"
                    cy="50%"
                    innerRadius={50}
                    outerRadius={90}
                    paddingAngle={4}
                    dataKey="value"
                    nameKey="name"
                  >
                    {vehiclesByStatus.map((entry: any, i: number) => (
                      <Cell key={i} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip content={<CustomTooltip />} />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center h-full text-slate-500 text-sm w-full">لا توجد مركبات</div>
            )}
          </div>
          <div className="flex flex-wrap justify-center gap-3 mt-2">
            {vehiclesByStatus.map((entry: any, i: number) => (
              <div key={i} className="flex items-center gap-1.5">
                <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: entry.color }} />
                <span className="text-slate-400 text-xs">{entry.name} ({entry.value})</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="scc-card">
        <h3 className="text-lg font-bold text-white mb-4">إجراءات سريعة</h3>
        <div className="flex flex-wrap gap-3">
          <a href="/dashboard/crm" className="scc-btn-ghost text-sm">
            <Users className="h-4 w-4" /> إضافة جهة اتصال
          </a>
          <a href="/dashboard/erp" className="scc-btn-ghost text-sm">
            <FileText className="h-4 w-4" /> إنشاء فاتورة
          </a>
          <a href="/dashboard/hr" className="scc-btn-ghost text-sm">
            <Activity className="h-4 w-4" /> إضافة موظف
          </a>
          <a href="/dashboard/fleet" className="scc-btn-ghost text-sm">
            <Truck className="h-4 w-4" /> تسجيل مركبة
          </a>
        </div>
      </div>
    </div>
  );
}

function translateStage(stage: string): string {
  const map: Record<string, string> = {
    LEAD: ' prospect',
    QUALIFIED: 'مؤهل',
    PROPOSAL: 'عرض',
    NEGOTIATION: 'تفاوض',
    CLOSED_WON: 'مكتسب',
    CLOSED_LOST: 'مفقود',
  };
  return map[stage] || stage;
}

function translateInvoiceStatus(status: string): string {
  const map: Record<string, string> = {
    DRAFT: 'مسودة',
    SENT: 'مرسلة',
    VIEWED: 'مشاهدة',
    PAID: 'مدفوعة',
    PARTIAL: 'جزئي',
    OVERDUE: 'متأخرة',
    CANCELLED: 'ملغاة',
  };
  return map[status] || status;
}

function translateVehicleStatus(status: string): string {
  const map: Record<string, string> = {
    ACTIVE: 'نشطة',
    IN_MAINTENANCE: 'صيانة',
    INACTIVE: 'غير نشطة',
    RETIRED: 'متقاعدة',
    RESERVED: 'محجوزة',
  };
  return map[status] || status;
}
