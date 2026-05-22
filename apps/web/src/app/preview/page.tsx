'use client';

import {
  Users, Briefcase, Truck, FileText, TrendingUp,
  Activity, ArrowUpRight, Wallet, Crown,
} from 'lucide-react';
import {
  ResponsiveContainer, AreaChart, Area, XAxis, YAxis,
  CartesianGrid, Tooltip, BarChart, Bar, PieChart, Pie, Cell,
} from 'recharts';

const CHART_COLORS = {
  deals: ['#0066CC', '#0ea5e9', '#22d3ee', '#34d399', '#a78bfa', '#f472b6'],
  revenue: '#0066CC',
};

const MOCK_STATS = {
  counts: { contacts: 248, deals: 87, employees: 64, vehicles: 42, invoices: 156 },
  revenue: { invoices: 2845000 },
};

const MOCK_REVENUE = [
  { month: 'يناير', revenue: 180000 },
  { month: 'فبراير', revenue: 220000 },
  { month: 'مارس', revenue: 195000 },
  { month: 'أبريل', revenue: 310000 },
  { month: 'مايو', revenue: 285000 },
  { month: 'يونيو', revenue: 420000 },
  { month: 'يوليو', revenue: 380000 },
  { month: 'أغسطس', revenue: 450000 },
  { month: 'سبتمبر', revenue: 510000 },
  { month: 'أكتوبر', revenue: 620000 },
  { month: 'نوفمبر', revenue: 580000 },
  { month: 'ديسمبر', revenue: 710000 },
];

const MOCK_DEALS = [
  { name: 'محتمل', value: 35 },
  { name: 'مؤهل', value: 28 },
  { name: 'عرض', value: 42 },
  { name: 'تفاوض', value: 19 },
  { name: 'مكتسب', value: 56 },
  { name: 'مفقود', value: 12 },
];

const MOCK_INVOICES = [
  { name: 'مدفوعة', value: 89, color: '#10b981' },
  { name: 'مرسلة', value: 32, color: '#0ea5e9' },
  { name: 'متأخرة', value: 18, color: '#ef4444' },
  { name: 'مسودة', value: 14, color: '#64748b' },
  { name: 'جزئي', value: 3, color: '#f59e0b' },
];

const MOCK_VEHICLES = [
  { name: 'نشطة', value: 34, color: '#10b981' },
  { name: 'صيانة', value: 5, color: '#ef4444' },
  { name: 'غير نشطة', value: 2, color: '#64748b' },
  { name: 'محجوزة', value: 1, color: '#f59e0b' },
];

const RECENT_ACTIVITIES = [
  { action: 'فاتورة جديدة', detail: 'INV-2024-156 لـ شركة النورس التجارية', amount: '45,000 ر.س', time: 'منذ 5 دقائق', color: 'text-emerald-400' },
  { action: 'صفقة مكتسبة', detail: 'عقد صيانة سنوي - شركة الرياض للتقنية', amount: '120,000 ر.س', time: 'منذ 23 دقيقة', color: 'text-blue-400' },
  { action: 'موظف جديد', detail: 'فهد عبدالله العتيبي - قسم المبيعات', amount: '-', time: 'منذ ساعة', color: 'text-violet-400' },
  { action: 'فاتورة مدفوعة', detail: 'INV-2024-142 - شركة البستان للمقاولات', amount: '78,500 ر.س', time: 'منذ 3 ساعات', color: 'text-emerald-400' },
  { action: 'مركبة جديدة', detail: 'هونداي H1 - لوحة 1234 أ ب ت', amount: '-', time: 'منذ 5 ساعات', color: 'text-orange-400' },
];

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

export default function PreviewPage() {
  const cards = [
    { label: 'جهات الاتصال', value: MOCK_STATS.counts.contacts, icon: Users, color: 'from-blue-500 to-cyan-500', bg: 'bg-blue-500/10', text: 'text-blue-400' },
    { label: 'الصفقات', value: MOCK_STATS.counts.deals, icon: Briefcase, color: 'from-emerald-500 to-teal-500', bg: 'bg-emerald-500/10', text: 'text-emerald-400' },
    { label: 'الموظفين', value: MOCK_STATS.counts.employees, icon: Activity, color: 'from-violet-500 to-purple-500', bg: 'bg-violet-500/10', text: 'text-violet-400' },
    { label: 'المركبات', value: MOCK_STATS.counts.vehicles, icon: Truck, color: 'from-orange-500 to-amber-500', bg: 'bg-orange-500/10', text: 'text-orange-400' },
    { label: 'الفواتير', value: MOCK_STATS.counts.invoices, icon: FileText, color: 'from-rose-500 to-pink-500', bg: 'bg-rose-500/10', text: 'text-rose-400' },
    { label: 'الإيرادات', value: `${MOCK_STATS.revenue.invoices.toLocaleString()} ر.س`, icon: Wallet, color: 'from-amber-500 to-yellow-500', bg: 'bg-amber-500/10', text: 'text-amber-400' },
  ];

  return (
    <div className="min-h-screen bg-slate-950 p-6 space-y-8" dir="rtl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-white mb-2 flex items-center gap-2">
            <Crown className="h-8 w-8 text-amber-400" />
            معاينة النظام
          </h1>
          <p className="text-slate-400">هذه معاينة تفاعلية — البيانات وهمية للعرض فقط</p>
        </div>
        <span className="px-3 py-1 bg-amber-500/20 text-amber-400 rounded-full text-sm font-medium border border-amber-500/30">
          Demo Mode
        </span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {cards.map((card, i) => (
          <div key={card.label} className="bg-slate-900/50 border border-slate-800 rounded-2xl p-6 hover:border-slate-700 transition-colors">
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

      <div className="bg-slate-900/50 border border-slate-800 rounded-2xl p-6">
        <h3 className="text-lg font-bold text-white mb-4">آخر النشاطات</h3>
        <div className="space-y-3">
          {RECENT_ACTIVITIES.map((item, i) => (
            <div key={i} className="flex items-center justify-between p-3 bg-slate-800/50 rounded-xl">
              <div>
                <p className={`text-sm font-medium ${item.color}`}>{item.action}</p>
                <p className="text-slate-400 text-xs">{item.detail}</p>
              </div>
              <div className="text-right">
                <p className="text-white text-sm font-medium">{item.amount}</p>
                <p className="text-slate-500 text-xs">{item.time}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-slate-900/50 border border-slate-800 rounded-2xl p-6">
          <div className="flex items-center gap-2 mb-4">
            <TrendingUp className="h-5 w-5 text-primary-400" />
            <h3 className="text-lg font-bold text-white">مؤشر الإيرادات الشهرية</h3>
          </div>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={MOCK_REVENUE}>
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
          </div>
        </div>

        <div className="bg-slate-900/50 border border-slate-800 rounded-2xl p-6">
          <div className="flex items-center gap-2 mb-4">
            <Briefcase className="h-5 w-5 text-primary-400" />
            <h3 className="text-lg font-bold text-white">الصفقات حسب المرحلة</h3>
          </div>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={MOCK_DEALS}>
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                <XAxis dataKey="name" stroke="#64748b" tick={{ fontSize: 11 }} />
                <YAxis stroke="#64748b" tick={{ fontSize: 12 }} />
                <Tooltip content={<CustomTooltip />} />
                <Bar dataKey="value" name="عدد الصفقات" radius={[6, 6, 0, 0]}>
                  {MOCK_DEALS.map((_, i) => (
                    <Cell key={i} fill={CHART_COLORS.deals[i % CHART_COLORS.deals.length]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-slate-900/50 border border-slate-800 rounded-2xl p-6">
          <div className="flex items-center gap-2 mb-4">
            <FileText className="h-5 w-5 text-primary-400" />
            <h3 className="text-lg font-bold text-white">الفواتير حسب الحالة</h3>
          </div>
          <div className="h-64 flex items-center">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={MOCK_INVOICES} cx="50%" cy="50%" innerRadius={50} outerRadius={90} paddingAngle={4} dataKey="value" nameKey="name">
                  {MOCK_INVOICES.map((entry, i) => (
                    <Cell key={i} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip content={<CustomTooltip />} />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="flex flex-wrap justify-center gap-3 mt-2">
            {MOCK_INVOICES.map((entry, i) => (
              <div key={i} className="flex items-center gap-1.5">
                <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: entry.color }} />
                <span className="text-slate-400 text-xs">{entry.name} ({entry.value})</span>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-slate-900/50 border border-slate-800 rounded-2xl p-6">
          <div className="flex items-center gap-2 mb-4">
            <Truck className="h-5 w-5 text-primary-400" />
            <h3 className="text-lg font-bold text-white">حالة المركبات</h3>
          </div>
          <div className="h-64 flex items-center">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={MOCK_VEHICLES} cx="50%" cy="50%" innerRadius={50} outerRadius={90} paddingAngle={4} dataKey="value" nameKey="name">
                  {MOCK_VEHICLES.map((entry, i) => (
                    <Cell key={i} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip content={<CustomTooltip />} />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="flex flex-wrap justify-center gap-3 mt-2">
            {MOCK_VEHICLES.map((entry, i) => (
              <div key={i} className="flex items-center gap-1.5">
                <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: entry.color }} />
                <span className="text-slate-400 text-xs">{entry.name} ({entry.value})</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="bg-slate-900/50 border border-slate-800 rounded-2xl p-6">
        <h3 className="text-lg font-bold text-white mb-4">الموديولات المتاحة</h3>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
          {[
            { name: 'CRM', icon: Users, desc: 'جهات الاتصال والصفقات', color: 'text-blue-400' },
            { name: 'ERP', icon: FileText, desc: 'الفواتير والـ ZATCA', color: 'text-emerald-400' },
            { name: 'Finance', icon: Wallet, desc: 'المحاسبة والتقارير', color: 'text-amber-400' },
            { name: 'HR', icon: Activity, desc: 'الموارد البشرية', color: 'text-violet-400' },
            { name: 'Fleet', icon: Truck, desc: 'إدارة المركبات', color: 'text-orange-400' },
            { name: 'Analytics', icon: TrendingUp, desc: 'التحليلات والتقارير', color: 'text-rose-400' },
          ].map((mod) => (
            <div key={mod.name} className="p-4 bg-slate-800/50 rounded-xl text-center hover:bg-slate-800 transition-colors">
              <mod.icon className={`h-8 w-8 mx-auto mb-2 ${mod.color}`} />
              <p className="text-white font-bold text-sm">{mod.name}</p>
              <p className="text-slate-400 text-xs">{mod.desc}</p>
            </div>
          ))}
        </div>
      </div>

      <div className="text-center p-6 bg-slate-900/30 border border-slate-800 rounded-2xl">
        <p className="text-slate-400 text-sm">هذه معاينة تفاعلية — البيانات وهمية للعرض فقط</p>
        <p className="text-slate-500 text-xs mt-1">SCC 380 — Smart Command Center</p>
      </div>
    </div>
  );
}
