'use client';

import {
  Users, Briefcase, Truck, FileText, TrendingUp,
  Activity, ArrowUpRight, Wallet, Crown, Bell,
  Calendar, CheckCircle2, AlertTriangle, Clock,
  Building2, Phone, Mail, MapPin, Shield,
  ChevronLeft, Star, Target, Zap, BarChart3,
} from 'lucide-react';
import {
  ResponsiveContainer, AreaChart, Area, XAxis, YAxis,
  CartesianGrid, Tooltip, BarChart, Bar, PieChart, Pie, Cell,
  RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis,
} from 'recharts';

const CHART_COLORS = {
  deals: ['#0066CC', '#0ea5e9', '#22d3ee', '#34d399', '#a78bfa', '#f472b6'],
  revenue: '#0066CC',
  radar: '#0ea5e9',
};

// ─── Stats ───────────────────────────────────────────────────────────
const MOCK_STATS = {
  counts: { contacts: 248, deals: 87, employees: 64, vehicles: 42, invoices: 156 },
  revenue: { invoices: 2845000 },
};

// ─── Revenue Trend ───────────────────────────────────────────────────
const MOCK_REVENUE = [
  { month: 'يناير', revenue: 180000, target: 200000 },
  { month: 'فبراير', revenue: 220000, target: 210000 },
  { month: 'مارس', revenue: 195000, target: 220000 },
  { month: 'أبريل', revenue: 310000, target: 230000 },
  { month: 'مايو', revenue: 285000, target: 240000 },
  { month: 'يونيو', revenue: 420000, target: 250000 },
  { month: 'يوليو', revenue: 380000, target: 260000 },
  { month: 'أغسطس', revenue: 450000, target: 270000 },
  { month: 'سبتمبر', revenue: 510000, target: 280000 },
  { month: 'أكتوبر', revenue: 620000, target: 290000 },
  { month: 'نوفمبر', revenue: 580000, target: 300000 },
  { month: 'ديسمبر', revenue: 710000, target: 310000 },
];

// ─── Deals by Stage ──────────────────────────────────────────────────
const MOCK_DEALS = [
  { name: 'محتمل', value: 35 },
  { name: 'مؤهل', value: 28 },
  { name: 'عرض', value: 42 },
  { name: 'تفاوض', value: 19 },
  { name: 'مكتسب', value: 56 },
  { name: 'مفقود', value: 12 },
];

// ─── Invoices by Status ──────────────────────────────────────────────
const MOCK_INVOICES = [
  { name: 'مدفوعة', value: 89, color: '#10b981' },
  { name: 'مرسلة', value: 32, color: '#0ea5e9' },
  { name: 'متأخرة', value: 18, color: '#ef4444' },
  { name: 'مسودة', value: 14, color: '#64748b' },
  { name: 'جزئي', value: 3, color: '#f59e0b' },
];

// ─── Vehicles by Status ──────────────────────────────────────────────
const MOCK_VEHICLES = [
  { name: 'نشطة', value: 34, color: '#10b981' },
  { name: 'صيانة', value: 5, color: '#ef4444' },
  { name: 'غير نشطة', value: 2, color: '#64748b' },
  { name: 'محجوزة', value: 1, color: '#f59e0b' },
];

// ─── Performance Radar ───────────────────────────────────────────────
const MOCK_PERFORMANCE = [
  { subject: 'المبيعات', A: 90, fullMark: 100 },
  { subject: 'خدمة العملاء', A: 75, fullMark: 100 },
  { subject: 'العمليات', A: 85, fullMark: 100 },
  { subject: 'الموارد البشرية', A: 70, fullMark: 100 },
  { subject: 'المالية', A: 95, fullMark: 100 },
  { subject: 'التقنية', A: 88, fullMark: 100 },
];

// ─── Recent Activities ───────────────────────────────────────────────
const RECENT_ACTIVITIES = [
  { action: 'فاتورة جديدة', detail: 'INV-2024-156 لـ شركة النورس التجارية', amount: '45,000 ر.س', time: 'منذ 5 دقائق', color: 'text-emerald-400', icon: FileText },
  { action: 'صفقة مكتسبة', detail: 'عقد صيانة سنوي - شركة الرياض للتقنية', amount: '120,000 ر.س', time: 'منذ 23 دقيقة', color: 'text-blue-400', icon: Briefcase },
  { action: 'موظف جديد', detail: 'فهد عبدالله العتيبي - قسم المبيعات', amount: '-', time: 'منذ ساعة', color: 'text-violet-400', icon: Users },
  { action: 'فاتورة مدفوعة', detail: 'INV-2024-142 - شركة البستان للمقاولات', amount: '78,500 ر.س', time: 'منذ 3 ساعات', color: 'text-emerald-400', icon: CheckCircle2 },
  { action: 'مركبة جديدة', detail: 'هونداي H1 - لوحة 1234 أ ب ت', amount: '-', time: 'منذ 5 ساعات', color: 'text-orange-400', icon: Truck },
];

// ─── Employees Table ─────────────────────────────────────────────────
const MOCK_EMPLOYEES = [
  { name: 'أحمد خالد السالم', role: 'مدير تنفيذي', dept: 'الإدارة', status: 'نشط', phone: '050-123-4567', email: 'ahmed@demo.sa', color: 'bg-blue-500' },
  { name: 'سارة محمد الشمري', role: 'مديرة مبيعات', dept: 'المبيعات', status: 'نشط', phone: '050-234-5678', email: 'sara@demo.sa', color: 'bg-emerald-500' },
  { name: 'فهد عبدالله العتيبي', role: 'مندوب مبيعات', dept: 'المبيعات', status: 'إجازة', phone: '050-345-6789', email: 'fahd@demo.sa', color: 'bg-amber-500' },
  { name: 'نورة عبدالرحمن القحطاني', role: 'محاسبة', dept: 'المالية', status: 'نشط', phone: '050-456-7890', email: 'noura@demo.sa', color: 'bg-rose-500' },
  { name: 'محمد سعد الحربي', role: 'مهندس IT', dept: 'التقنية', status: 'نشط', phone: '050-567-8901', email: 'moh@demo.sa', color: 'bg-violet-500' },
  { name: 'ليلى سالم الدوسري', role: 'مديرة موارد بشرية', dept: 'الموارد البشرية', status: 'نشط', phone: '050-678-9012', email: 'laila@demo.sa', color: 'bg-cyan-500' },
];

// ─── Recent Invoices Table ───────────────────────────────────────────
const MOCK_INVOICE_LIST = [
  { no: 'INV-2024-156', client: 'شركة النورس التجارية', date: '2024-12-15', amount: 45000, status: 'مسودة', statusColor: 'text-slate-400 bg-slate-400/10' },
  { no: 'INV-2024-155', client: 'شركة الرياض للتقنية', date: '2024-12-14', amount: 120000, status: 'مدفوعة', statusColor: 'text-emerald-400 bg-emerald-400/10' },
  { no: 'INV-2024-154', client: 'مؤسسة الفجر للمقاولات', date: '2024-12-13', amount: 67000, status: 'مرسلة', statusColor: 'text-blue-400 bg-blue-400/10' },
  { no: 'INV-2024-153', client: 'شركة البستان للمقاولات', date: '2024-12-12', amount: 78500, status: 'مدفوعة', statusColor: 'text-emerald-400 bg-emerald-400/10' },
  { no: 'INV-2024-152', client: 'مجموعة الصفوة التجارية', date: '2024-12-11', amount: 234000, status: 'متأخرة', statusColor: 'text-red-400 bg-red-400/10' },
  { no: 'INV-2024-151', client: 'شركة الواحة للاستثمار', date: '2024-12-10', amount: 156000, status: 'جزئي', statusColor: 'text-amber-400 bg-amber-400/10' },
];

// ─── Alerts / Notifications ──────────────────────────────────────────
const MOCK_ALERTS = [
  { type: 'warning', title: 'فاتورة متأخرة', desc: 'INV-2024-152 للصفوة التجارية - 15 يوم متأخرة', time: 'منذ ساعة' },
  { type: 'info', title: 'موعد صيانة دورية', desc: 'مركبة تويوتا هايلوكس (لوحة 5678 هـ) - صيانة 10,000 كم', time: 'منذ 3 ساعات' },
  { type: 'success', title: 'هدف شهري محقق', desc: 'قسم المبيعات حقق 105% من الهدف الشهري', time: 'منذ 6 ساعات' },
  { type: 'error', title: 'إجازة غير مصدقة', desc: 'فهد العتيبي - طلب إجازة عارضة بانتظار موافقة المدير', time: 'منذ 8 ساعات' },
];

// ─── Upcoming Tasks ──────────────────────────────────────────────────
const MOCK_TASKS = [
  { title: 'اجتماع مجلس الإدارة', date: 'اليوم - 2:00 م', done: false, priority: 'عالية' },
  { title: 'مراجعة التقارير المالية', date: 'غداً - 10:00 ص', done: false, priority: 'عالية' },
  { title: 'متابعة فاتورة الصفوة', date: 'غداً - 12:00 م', done: false, priority: 'متوسطة' },
  { title: 'تجديد عقد التأمين', date: 'الخميس - 9:00 ص', done: false, priority: 'عالية' },
  { title: 'تقييم أداء الموظفين', date: 'الأحد القادم', done: true, priority: 'منخفضة' },
];

// ─── Company Info ────────────────────────────────────────────────────
const MOCK_COMPANY = {
  name: 'شركة الرياض للتقنية المحدودة',
  cr: '1010123456',
  vat: '310123456789003',
  address: 'طريق الملك فهد، الرياض 11321',
  phone: '9200-12345',
  email: 'info@riyadhtech.sa',
};

function CustomTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-slate-900 border border-slate-700 rounded-xl px-4 py-3 shadow-xl">
      {label && <p className="text-slate-400 text-xs mb-1">{label}</p>}
      {payload.map((p: any, i: number) => (
        <p key={i} className="text-white text-sm font-medium">
          {p.name}: {Number(p.value).toLocaleString()} {p.name?.includes('ر.س') ? 'ر.س' : ''}
        </p>
      ))}
    </div>
  );
}

function StatusBadge({ text, className }: { text: string; className: string }) {
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${className}`}>
      {text}
    </span>
  );
}

function AlertIcon({ type }: { type: string }) {
  switch (type) {
    case 'warning': return <AlertTriangle className="h-4 w-4 text-amber-400" />;
    case 'info': return <Bell className="h-4 w-4 text-blue-400" />;
    case 'success': return <CheckCircle2 className="h-4 w-4 text-emerald-400" />;
    case 'error': return <AlertTriangle className="h-4 w-4 text-red-400" />;
    default: return <Bell className="h-4 w-4 text-slate-400" />;
  }
}

export default function PreviewPage() {
  const cards = [
    { label: 'جهات الاتصال', value: MOCK_STATS.counts.contacts, icon: Users, color: 'from-blue-500 to-cyan-500', text: 'text-blue-400', change: '+18' },
    { label: 'الصفقات', value: MOCK_STATS.counts.deals, icon: Briefcase, color: 'from-emerald-500 to-teal-500', text: 'text-emerald-400', change: '+7' },
    { label: 'الموظفين', value: MOCK_STATS.counts.employees, icon: Activity, color: 'from-violet-500 to-purple-500', text: 'text-violet-400', change: '+2' },
    { label: 'المركبات', value: MOCK_STATS.counts.vehicles, icon: Truck, color: 'from-orange-500 to-amber-500', text: 'text-orange-400', change: '-1' },
    { label: 'الفواتير', value: MOCK_STATS.counts.invoices, icon: FileText, color: 'from-rose-500 to-pink-500', text: 'text-rose-400', change: '+24' },
    { label: 'الإيرادات', value: `${MOCK_STATS.revenue.invoices.toLocaleString()} ر.س`, icon: Wallet, color: 'from-amber-500 to-yellow-500', text: 'text-amber-400', change: '+12%' },
  ];

  return (
    <div className="min-h-screen bg-slate-950 p-4 md:p-6 space-y-6" dir="rtl">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-white mb-2 flex items-center gap-2">
            <Crown className="h-8 w-8 text-amber-400" />
            معاينة النظام
          </h1>
          <p className="text-slate-400 text-sm">هذه معاينة تفاعلية — البيانات وهمية للعرض فقط</p>
        </div>
        <div className="flex items-center gap-3">
          <span className="px-3 py-1 bg-amber-500/20 text-amber-400 rounded-full text-sm font-medium border border-amber-500/30">
            Demo Mode
          </span>
          <span className="px-3 py-1 bg-emerald-500/20 text-emerald-400 rounded-full text-sm font-medium border border-emerald-500/30 flex items-center gap-1">
            <Shield className="h-3 w-3" /> Online
          </span>
        </div>
      </div>

      {/* Company Info Card */}
      <div className="bg-slate-900/50 border border-slate-800 rounded-2xl p-5">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary-500 to-primary-700 flex items-center justify-center">
            <Building2 className="h-5 w-5 text-white" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-white">{MOCK_COMPANY.name}</h2>
            <p className="text-slate-400 text-xs">سجل تجاري: {MOCK_COMPANY.cr} | الرقم الضريبي: {MOCK_COMPANY.vat}</p>
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-sm">
          <div className="flex items-center gap-2 text-slate-400">
            <MapPin className="h-4 w-4 text-slate-500" />
            {MOCK_COMPANY.address}
          </div>
          <div className="flex items-center gap-2 text-slate-400">
            <Phone className="h-4 w-4 text-slate-500" />
            {MOCK_COMPANY.phone}
          </div>
          <div className="flex items-center gap-2 text-slate-400">
            <Mail className="h-4 w-4 text-slate-500" />
            {MOCK_COMPANY.email}
          </div>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {cards.map((card) => (
          <div key={card.label} className="bg-slate-900/50 border border-slate-800 rounded-2xl p-5 hover:border-slate-700 transition-all hover:shadow-lg hover:shadow-slate-900/50">
            <div className="flex items-start justify-between mb-3">
              <div className={`w-11 h-11 rounded-xl bg-gradient-to-br ${card.color} flex items-center justify-center shadow-lg`}>
                <card.icon className="h-5 w-5 text-white" />
              </div>
              <span className={`inline-flex items-center gap-1 text-xs font-medium ${card.text} bg-slate-800/50 px-2 py-0.5 rounded-full`}>
                <ArrowUpRight className="h-3 w-3" /> {card.change}
              </span>
            </div>
            <p className="text-slate-400 text-sm">{card.label}</p>
            <p className="text-2xl font-bold text-white mt-0.5">{card.value}</p>
          </div>
        ))}
      </div>

      {/* KPI Summary */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'معدل تحويل الصفقات', value: '64%', icon: Target, color: 'text-emerald-400', bg: 'bg-emerald-500/10' },
          { label: 'متوسط قيمة الفاتورة', value: '18,237 ر.س', icon: BarChart3, color: 'text-blue-400', bg: 'bg-blue-500/10' },
          { label: 'الموظفين النشطين', value: '58/64', icon: Users, color: 'text-violet-400', bg: 'bg-violet-500/10' },
          { label: 'المركبات الجاهزة', value: '34/42', icon: Truck, color: 'text-orange-400', bg: 'bg-orange-500/10' },
        ].map((kpi) => (
          <div key={kpi.label} className="bg-slate-900/50 border border-slate-800 rounded-xl p-4 flex items-center gap-3">
            <div className={`w-10 h-10 rounded-lg ${kpi.bg} flex items-center justify-center`}>
              <kpi.icon className={`h-5 w-5 ${kpi.color}`} />
            </div>
            <div>
              <p className="text-white font-bold text-lg">{kpi.value}</p>
              <p className="text-slate-400 text-xs">{kpi.label}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Charts Row 1: Revenue + Deals */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-slate-900/50 border border-slate-800 rounded-2xl p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-primary-400" />
              <h3 className="text-lg font-bold text-white">مؤشر الإيرادات والأهداف</h3>
            </div>
            <span className="text-emerald-400 text-xs font-medium bg-emerald-500/10 px-2 py-1 rounded-full">+14.5% عن العام الماضي</span>
          </div>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={MOCK_REVENUE}>
                <defs>
                  <linearGradient id="revenueGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={CHART_COLORS.revenue} stopOpacity={0.3} />
                    <stop offset="95%" stopColor={CHART_COLORS.revenue} stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                <XAxis dataKey="month" stroke="#64748b" tick={{ fontSize: 11 }} />
                <YAxis stroke="#64748b" tick={{ fontSize: 11 }} tickFormatter={(v) => `${(v / 1000).toFixed(0)}K`} />
                <Tooltip content={<CustomTooltip />} />
                <Area type="monotone" dataKey="revenue" name="الإيرادات (ر.س)" stroke={CHART_COLORS.revenue} fill="url(#revenueGradient)" strokeWidth={2} />
                <Area type="monotone" dataKey="target" name="الهدف (ر.س)" stroke="#22d3ee" strokeDasharray="5 5" fill="transparent" strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-slate-900/50 border border-slate-800 rounded-2xl p-6">
          <div className="flex items-center gap-2 mb-4">
            <Briefcase className="h-5 w-5 text-primary-400" />
            <h3 className="text-lg font-bold text-white">الصفقات حسب المرحلة</h3>
          </div>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={MOCK_DEALS}>
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                <XAxis dataKey="name" stroke="#64748b" tick={{ fontSize: 11 }} />
                <YAxis stroke="#64748b" tick={{ fontSize: 11 }} />
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

      {/* Charts Row 2: Invoices + Vehicles */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-slate-900/50 border border-slate-800 rounded-2xl p-6">
          <div className="flex items-center gap-2 mb-4">
            <FileText className="h-5 w-5 text-primary-400" />
            <h3 className="text-lg font-bold text-white">الفواتير حسب الحالة</h3>
          </div>
          <div className="h-64 flex items-center">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={MOCK_INVOICES} cx="50%" cy="50%" innerRadius={55} outerRadius={95} paddingAngle={4} dataKey="value" nameKey="name">
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
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Zap className="h-5 w-5 text-primary-400" />
              <h3 className="text-lg font-bold text-white">أداء الأقسام</h3>
            </div>
          </div>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <RadarChart data={MOCK_PERFORMANCE}>
                <PolarGrid stroke="#334155" />
                <PolarAngleAxis dataKey="subject" stroke="#94a3b8" tick={{ fontSize: 11 }} />
                <PolarRadiusAxis stroke="#475569" tick={{ fontSize: 9 }} />
                <Radar name="الأداء" dataKey="A" stroke={CHART_COLORS.radar} fill={CHART_COLORS.radar} fillOpacity={0.25} strokeWidth={2} />
                <Tooltip content={<CustomTooltip />} />
              </RadarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Activities + Alerts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-slate-900/50 border border-slate-800 rounded-2xl p-6">
          <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
            <Activity className="h-5 w-5 text-primary-400" />
            آخر النشاطات
          </h3>
          <div className="space-y-3">
            {RECENT_ACTIVITIES.map((item, i) => (
              <div key={i} className="flex items-start gap-3 p-3 bg-slate-800/50 rounded-xl">
                <div className={`w-8 h-8 rounded-lg bg-slate-700/50 flex items-center justify-center shrink-0 mt-0.5`}>
                  <item.icon className={`h-4 w-4 ${item.color}`} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className={`text-sm font-medium ${item.color}`}>{item.action}</p>
                  <p className="text-slate-400 text-xs truncate">{item.detail}</p>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-white text-sm font-medium">{item.amount}</p>
                  <p className="text-slate-500 text-xs">{item.time}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-slate-900/50 border border-slate-800 rounded-2xl p-6">
          <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
            <Bell className="h-5 w-5 text-primary-400" />
            التنبيهات والإشعارات
          </h3>
          <div className="space-y-3">
            {MOCK_ALERTS.map((alert, i) => (
              <div key={i} className="flex items-start gap-3 p-3 bg-slate-800/50 rounded-xl">
                <div className="w-8 h-8 rounded-lg bg-slate-700/50 flex items-center justify-center shrink-0 mt-0.5">
                  <AlertIcon type={alert.type} />
                </div>
                <div className="flex-1">
                  <p className="text-white text-sm font-medium">{alert.title}</p>
                  <p className="text-slate-400 text-xs">{alert.desc}</p>
                </div>
                <p className="text-slate-500 text-xs shrink-0">{alert.time}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Tasks */}
      <div className="bg-slate-900/50 border border-slate-800 rounded-2xl p-6">
        <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
          <Calendar className="h-5 w-5 text-primary-400" />
          المهام القادمة
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {MOCK_TASKS.map((task, i) => (
            <div key={i} className={`p-4 rounded-xl border ${task.done ? 'bg-slate-800/30 border-slate-700/50' : 'bg-slate-800/50 border-slate-700'}`}>
              <div className="flex items-start justify-between mb-2">
                <div className="flex items-center gap-2">
                  {task.done ? (
                    <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                  ) : (
                    <Clock className="h-4 w-4 text-amber-400" />
                  )}
                  <span className={`text-sm font-medium ${task.done ? 'text-slate-500 line-through' : 'text-white'}`}>{task.title}</span>
                </div>
              </div>
              <div className="flex items-center gap-2 mt-2">
                <span className="text-slate-400 text-xs">{task.date}</span>
                <span className={`text-xs px-2 py-0.5 rounded-full ${
                  task.priority === 'عالية' ? 'bg-red-500/10 text-red-400' :
                  task.priority === 'متوسطة' ? 'bg-amber-500/10 text-amber-400' :
                  'bg-slate-500/10 text-slate-400'
                }`}>{task.priority}</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Employees Table */}
      <div className="bg-slate-900/50 border border-slate-800 rounded-2xl p-6 overflow-hidden">
        <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
          <Users className="h-5 w-5 text-primary-400" />
          فريق العمل
        </h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-800">
                <th className="text-right py-3 px-4 text-slate-400 font-medium">الموظف</th>
                <th className="text-right py-3 px-4 text-slate-400 font-medium">الدور</th>
                <th className="text-right py-3 px-4 text-slate-400 font-medium">القسم</th>
                <th className="text-right py-3 px-4 text-slate-400 font-medium">الحالة</th>
                <th className="text-right py-3 px-4 text-slate-400 font-medium">التواصل</th>
              </tr>
            </thead>
            <tbody>
              {MOCK_EMPLOYEES.map((emp, i) => (
                <tr key={i} className="border-b border-slate-800/50 hover:bg-slate-800/30 transition-colors">
                  <td className="py-3 px-4">
                    <div className="flex items-center gap-3">
                      <div className={`w-8 h-8 rounded-full ${emp.color} flex items-center justify-center text-white text-xs font-bold`}>
                        {emp.name.split(' ').map(n => n[0]).join('')}
                      </div>
                      <span className="text-white font-medium">{emp.name}</span>
                    </div>
                  </td>
                  <td className="py-3 px-4 text-slate-300">{emp.role}</td>
                  <td className="py-3 px-4 text-slate-300">{emp.dept}</td>
                  <td className="py-3 px-4">
                    <StatusBadge
                      text={emp.status}
                      className={emp.status === 'نشط' ? 'text-emerald-400 bg-emerald-500/10' : 'text-amber-400 bg-amber-500/10'}
                    />
                  </td>
                  <td className="py-3 px-4">
                    <div className="flex items-center gap-2 text-slate-400">
                      <Phone className="h-3 w-3" />
                      <span className="text-xs">{emp.phone}</span>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Recent Invoices Table */}
      <div className="bg-slate-900/50 border border-slate-800 rounded-2xl p-6 overflow-hidden">
        <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
          <FileText className="h-5 w-5 text-primary-400" />
          أحدث الفواتير
        </h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-800">
                <th className="text-right py-3 px-4 text-slate-400 font-medium">رقم الفاتورة</th>
                <th className="text-right py-3 px-4 text-slate-400 font-medium">العميل</th>
                <th className="text-right py-3 px-4 text-slate-400 font-medium">التاريخ</th>
                <th className="text-right py-3 px-4 text-slate-400 font-medium">المبلغ</th>
                <th className="text-right py-3 px-4 text-slate-400 font-medium">الحالة</th>
              </tr>
            </thead>
            <tbody>
              {MOCK_INVOICE_LIST.map((inv, i) => (
                <tr key={i} className="border-b border-slate-800/50 hover:bg-slate-800/30 transition-colors">
                  <td className="py-3 px-4 text-white font-mono text-xs">{inv.no}</td>
                  <td className="py-3 px-4 text-slate-300">{inv.client}</td>
                  <td className="py-3 px-4 text-slate-400">{inv.date}</td>
                  <td className="py-3 px-4 text-white font-medium">{inv.amount.toLocaleString()} ر.س</td>
                  <td className="py-3 px-4">
                    <StatusBadge text={inv.status} className={inv.statusColor} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modules */}
      <div className="bg-slate-900/50 border border-slate-800 rounded-2xl p-6">
        <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
          <Star className="h-5 w-5 text-primary-400" />
          الموديولات المتاحة
        </h3>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
          {[
            { name: 'CRM', icon: Users, desc: 'جهات الاتصال والصفقات', color: 'text-blue-400', bg: 'bg-blue-500/10' },
            { name: 'ERP', icon: FileText, desc: 'الفواتير والـ ZATCA', color: 'text-emerald-400', bg: 'bg-emerald-500/10' },
            { name: 'Finance', icon: Wallet, desc: 'المحاسبة والتقارير', color: 'text-amber-400', bg: 'bg-amber-500/10' },
            { name: 'HR', icon: Activity, desc: 'الموارد البشرية', color: 'text-violet-400', bg: 'bg-violet-500/10' },
            { name: 'Fleet', icon: Truck, desc: 'إدارة المركبات', color: 'text-orange-400', bg: 'bg-orange-500/10' },
            { name: 'Analytics', icon: TrendingUp, desc: 'التحليلات والتقارير', color: 'text-rose-400', bg: 'bg-rose-500/10' },
          ].map((mod) => (
            <div key={mod.name} className={`p-4 ${mod.bg} rounded-xl text-center hover:bg-slate-800 transition-colors cursor-pointer group`}>
              <mod.icon className={`h-8 w-8 mx-auto mb-2 ${mod.color} group-hover:scale-110 transition-transform`} />
              <p className="text-white font-bold text-sm">{mod.name}</p>
              <p className="text-slate-400 text-xs mt-1">{mod.desc}</p>
            </div>
          ))}
        </div>
      </div>

      {/* CTA */}
      <div className="bg-gradient-to-r from-primary-600/20 to-primary-800/20 border border-primary-500/30 rounded-2xl p-8 text-center">
        <h3 className="text-xl font-bold text-white mb-2">هل تريد تجربة النظام بنفسك؟</h3>
        <p className="text-slate-400 text-sm mb-4">ابدأ نسختك التجريبية المجانية لمدة 14 يوم بدون بطاقة ائتمان</p>
        <button className="bg-primary-600 hover:bg-primary-500 text-white font-bold px-8 py-3 rounded-xl transition-colors shadow-lg shadow-primary-600/20">
          ابدأ التجربة المجانية
        </button>
      </div>

      {/* Footer */}
      <div className="text-center p-6 bg-slate-900/30 border border-slate-800 rounded-2xl">
        <p className="text-slate-400 text-sm">هذه معاينة تفاعلية — البيانات وهمية للعرض فقط</p>
        <p className="text-slate-500 text-xs mt-1">SCC 380 — Smart Command Center © 2024</p>
      </div>
    </div>
  );
}
