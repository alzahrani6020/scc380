'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import api from '@/lib/api';
import { clearAuth, getRefreshToken } from '@/lib/auth';
import { cn } from '@scc/utils';
import {
  LayoutDashboard, Users, FileText, Briefcase, Truck, Activity,
  BarChart3, Landmark, Bot, Settings, Building2, LogOut,
  ChevronLeft, FolderKanban, Receipt, Shield, CreditCard, Bell,
  FileStack, ShoppingCart, Package, BookOpen, ArrowLeftRight, Store,
  Route, Wrench, Fuel, CalendarDays, ClipboardList, Wallet,
  Contact, Handshake, LayoutGrid, FileSignature, Banknote,
  ReceiptText, ListTree, PiggyBank, NotebookText, GitBranch,
  PackagePlus, Gauge, Globe, ListChecks, Lock, Coins, CarFront,
  Network, UserCog, FileInput, Building, Clock3, CalendarRange, Target, GraduationCap,
  Search, X, ChevronDown,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

interface NavItem {
  name: string;
  href: string;
  icon: LucideIcon;
  badge?: string;
}

type NavEntry = NavItem | { header: string };

const navigation: NavEntry[] = [
  { header: 'الرئيسية' },
  { name: 'لوحة التحكم', href: '/dashboard', icon: LayoutDashboard },
  { name: 'التحليلات', href: '/dashboard/analytics', icon: BarChart3 },
  { name: 'التنبيهات والإشعارات', href: '/dashboard/notifications', icon: Bell, badge: 'alerts' },

  { header: 'العملاء (CRM)' },
  { name: 'نظرة عامة', href: '/dashboard/crm', icon: Gauge },
  { name: 'جهات الاتصال', href: '/dashboard/crm/contacts', icon: Contact },
  { name: 'الشركات', href: '/dashboard/crm/companies', icon: Building2 },
  { name: 'الصفقات', href: '/dashboard/crm/deals', icon: Handshake },
  { name: 'مسارات المبيعات', href: '/dashboard/crm/pipelines', icon: GitBranch },
  { name: 'الأنشطة', href: '/dashboard/crm/activities', icon: Activity },
  { name: 'المشاريع', href: '/dashboard/projects', icon: FolderKanban },

  { header: 'الموارد البشرية (مكين)' },
  { name: 'نظرة عامة', href: '/dashboard/hr', icon: Briefcase },
  { name: 'الخدمة الذاتية', href: '/dashboard/hr/self-service', icon: UserCog },
  { name: 'الموظفون', href: '/dashboard/hr/employees', icon: UserCog },
  { name: 'طلبات الموارد البشرية', href: '/dashboard/hr/requests', icon: ClipboardList },
  { name: 'الانضمام والمغادرة', href: '/dashboard/hr/lifecycle', icon: ListChecks },
  { name: 'الحضور', href: '/dashboard/hr/attendance', icon: ClipboardList },
  { name: 'الورديات', href: '/dashboard/hr/shifts', icon: Clock3 },
  { name: 'الإجازات', href: '/dashboard/hr/leaves', icon: CalendarDays },
  { name: 'أرصدة الإجازات', href: '/dashboard/hr/leave-balances', icon: CalendarRange },
  { name: 'العقود', href: '/dashboard/hr/contracts', icon: FileSignature },
  { name: 'مستندات الموظفين', href: '/dashboard/hr/documents', icon: FileText },
  { name: 'العهد والأصول', href: '/dashboard/hr/assets', icon: Package },
  { name: 'السلف والقروض', href: '/dashboard/hr/loans', icon: Coins },
  { name: 'التوظيف', href: '/dashboard/hr/recruitment', icon: Briefcase },
  { name: 'إدارة الأداء', href: '/dashboard/hr/performance', icon: Target },
  { name: 'التدريب والتطوير', href: '/dashboard/hr/training', icon: GraduationCap },
  { name: 'نهاية الخدمة والمخالصة', href: '/dashboard/hr/settlements', icon: ReceiptText },
  { name: 'مسيرات الرواتب', href: '/dashboard/hr/payroll-runs', icon: Wallet },
  { name: 'سجلات الرواتب', href: '/dashboard/hr/payroll', icon: Receipt },
  { name: 'الإدارات', href: '/dashboard/hr/departments', icon: Network },

  { header: 'العقارات' },
  { name: 'نظرة عامة', href: '/dashboard/real-estate', icon: Building2 },
  { name: 'قائمة العقارات', href: '/dashboard/real-estate/properties', icon: Building },
  { name: 'الوحدات', href: '/dashboard/real-estate/units', icon: LayoutGrid },
  { name: 'العقود', href: '/dashboard/real-estate/contracts', icon: FileSignature },
  { name: 'دفعات الإيجار', href: '/dashboard/real-estate/payments', icon: Banknote },

  { header: 'الأسطول' },
  { name: 'المركبات', href: '/dashboard/fleet', icon: Truck },
  { name: 'الرحلات', href: '/dashboard/fleet/trips', icon: Route },
  { name: 'السائقون', href: '/dashboard/fleet/drivers', icon: CarFront },
  { name: 'الصيانة', href: '/dashboard/fleet/maintenance', icon: Wrench },
  { name: 'الوقود', href: '/dashboard/fleet/fuel', icon: Fuel },

  { header: 'المبيعات' },
  { name: 'الفواتير', href: '/dashboard/erp', icon: FileText },
  { name: 'الكاشير', href: '/dashboard/pos', icon: ShoppingCart },

  { header: 'المشتريات والموردون' },
  { name: 'الموردون', href: '/dashboard/suppliers', icon: Store },
  { name: 'فواتير الموردين', href: '/dashboard/supplier-invoices', icon: FileInput },
  { name: 'أوامر الشراء', href: '/dashboard/finance/purchase-orders', icon: PackagePlus },

  { header: 'المخزون' },
  { name: 'الأصناف والمخزون', href: '/dashboard/inventory', icon: Package },
  { name: 'تحويلات المخزون', href: '/dashboard/stock-transfers', icon: ArrowLeftRight },

  { header: 'المالية' },
  { name: 'نظرة عامة', href: '/dashboard/finance', icon: Landmark },
  { name: 'المدفوعات', href: '/dashboard/finance/payments', icon: Coins },
  { name: 'المصروفات', href: '/dashboard/finance/expenses', icon: ReceiptText },
  { name: 'الحسابات البنكية', href: '/dashboard/finance/bank-accounts', icon: PiggyBank },
  { name: 'التقارير المالية', href: '/dashboard/financial-reports', icon: BookOpen },

  { header: 'المحاسبة' },
  { name: 'القيود اليومية', href: '/dashboard/finance/journal-entries', icon: Receipt },
  { name: 'دفتر الأستاذ', href: '/dashboard/finance/general-ledger', icon: NotebookText },
  { name: 'دليل الحسابات', href: '/dashboard/finance/chart-of-accounts', icon: ListTree },

  { header: 'الفروع' },
  { name: 'إدارة الفروع', href: '/dashboard/branches', icon: GitBranch },

  { header: 'النظام' },
  { name: 'التكاملات الحكومية', href: '/dashboard/government', icon: Globe },
  { name: 'المساعد الذكي', href: '/dashboard/ai', icon: Bot },
  { name: 'طلبات الموافقة', href: '/dashboard/approvals', icon: ListChecks },
  { name: 'الامتثال', href: '/dashboard/compliance', icon: Shield },
  { name: 'الأمان', href: '/dashboard/security', icon: Lock },
  { name: 'المستخدمون', href: '/dashboard/users', icon: Users },
  { name: 'النماذج الإلكترونية', href: '/dashboard/templates', icon: FileStack },
  { name: 'الاشتراكات', href: '/dashboard/billing', icon: CreditCard },
  { name: 'الإعدادات', href: '/dashboard/settings', icon: Settings },
];

export default function Sidebar({
  mobileOpen = false,
  onClose,
}: {
  mobileOpen?: boolean;
  onClose?: () => void;
}) {
  const pathname = usePathname();
  const [alertCount, setAlertCount] = useState(0);
  const [query, setQuery] = useState('');
  const initialSection = navigation.reduce((current, entry) => {
    if ('header' in entry) return current;
    if (pathname === entry.href || pathname.startsWith(entry.href + '/')) {
      return entry.href.length > current.length ? entry.href : current;
    }
    return current;
  }, '');
  const sectionForPath = (href: string) => {
    let section = '';
    for (const entry of navigation) {
      if ('header' in entry) section = entry.header;
      else if (entry.href === href) return section;
    }
    return 'الرئيسية';
  };
  const [expanded, setExpanded] = useState<string[]>([sectionForPath(initialSection)]);
  useEffect(() => {
    const active = navigation
      .filter((entry): entry is NavItem => 'href' in entry)
      .filter(entry => pathname === entry.href || pathname.startsWith(entry.href + '/'))
      .sort((a, b) => b.href.length - a.href.length)[0];
    if (active) {
      const section = sectionForPath(active.href);
      setExpanded(prev => prev.includes(section) ? prev : [...prev, section]);
    }
    onClose?.();
    // Close the mobile drawer only when the route changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname]);

  const handleLogout = async () => {
    const refreshToken = getRefreshToken();
    try {
      if (refreshToken) await api.post('/auth/logout', { refreshToken });
    } catch {
      // A stale session must not prevent local logout.
    } finally {
      clearAuth();
      window.location.href = '/auth/login';
    }
  };

  useEffect(() => {
    const refresh = () => api.get('/alerts/counts')
      .then(r => setAlertCount(r.data?.total || 0)).catch(() => {});
    void refresh();
    const interval = setInterval(refresh, 60000);
    return () => clearInterval(interval);
  }, []);

  const activeHref = navigation
    .filter((entry): entry is NavItem => 'href' in entry)
    .filter(entry => pathname === entry.href || pathname.startsWith(entry.href + '/'))
    .sort((a, b) => b.href.length - a.href.length)[0]?.href;
  const filter = query.trim().toLocaleLowerCase('ar');
  const toggle = (section: string) => setExpanded(prev =>
    prev.includes(section) ? prev.filter(s => s !== section) : [...prev, section]
  );

  const renderMenu = (scope: 'desktop' | 'mobile') => (
    <>
      <div className="flex h-20 shrink-0 items-center justify-between border-b border-slate-700/70 px-5">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-primary-500 to-primary-700">
            <Building2 className="h-5 w-5 text-white" />
          </div>
          <div>
            <span className="block text-lg font-bold text-white">SCC 380</span>
            <span className="text-xs text-slate-400">Command Center</span>
          </div>
        </div>
        <button type="button" onClick={onClose} aria-label="إغلاق القائمة" className="rounded-lg p-2 text-slate-200 hover:bg-slate-800 lg:hidden">
          <X className="h-5 w-5" />
        </button>
      </div>
      <div className="shrink-0 px-3 pt-3">
        <label htmlFor={`scc-nav-search-${scope}`} className="sr-only">البحث في قائمة النظام</label>
        <div className="relative">
          <Search className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            id={`scc-nav-search-${scope}`}
            value={query}
            onChange={e => setQuery(e.target.value)}
            type="search"
            placeholder="ابحث عن صفحة..."
            className="w-full rounded-lg border border-slate-700 bg-slate-800/70 py-2 pr-10 pl-3 text-sm text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-primary-400"
          />
        </div>
      </div>
      <nav aria-label="القائمة الرئيسية" className="scc-sidebar-scroll min-h-0 flex-1 overflow-y-auto overscroll-contain px-3 py-3">
        {navigation.map((entry, index) => {
          if ('header' in entry) {
            const group = navigation.slice(index + 1, navigation.findIndex((next, at) => at > index && 'header' in next) === -1
              ? undefined : navigation.findIndex((next, at) => at > index && 'header' in next));
            const matching = group.filter((item): item is NavItem => 'href' in item && (!filter || item.name.toLocaleLowerCase('ar').includes(filter) || entry.header.toLocaleLowerCase('ar').includes(filter)));
            if (!matching.length) return null;
            const open = !!filter || expanded.includes(entry.header);
            return (
              <div key={entry.header} className="mt-2 first:mt-0">
                <button type="button" aria-expanded={open} onClick={() => toggle(entry.header)}
                  className="flex w-full items-center justify-between rounded-lg px-3 py-2 text-right text-xs font-bold text-slate-300 hover:bg-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-400">
                  <span>{entry.header}</span>
                  <ChevronDown className={cn('h-4 w-4 transition-transform', open && 'rotate-180')} />
                </button>
                {open && (
                  <div className="space-y-0.5">
                    {matching.map(item => {
                      const Icon = item.icon;
                      const active = activeHref === item.href;
                      const showBadge = item.badge === 'alerts' && alertCount > 0;
                      return (
                        <Link key={item.href} href={item.href} aria-current={active ? 'page' : undefined}
                          onClick={onClose} className={cn('scc-sidebar-link', active && 'active')}>
                          <Icon className={cn('h-[18px] w-[18px] shrink-0', active ? 'text-primary-300' : 'text-slate-400')} />
                          <span className="min-w-0 flex-1">{item.name}</span>
                          {showBadge && <span className="rounded-full bg-red-500 px-2 py-0.5 text-xs font-bold text-white">{alertCount}</span>}
                          {active && !showBadge && <ChevronLeft className="h-4 w-4 shrink-0 text-primary-300" />}
                        </Link>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          }
          return null;
        })}
        {filter && !navigation.some((item) => 'name' in item && item.name.toLocaleLowerCase('ar').includes(filter)) &&
          !navigation.some((item) => 'header' in item && item.header.toLocaleLowerCase('ar').includes(filter)) &&
          <p className="px-3 py-6 text-center text-sm text-slate-300">لا توجد صفحات مطابقة</p>}
      </nav>
      <div className="shrink-0 border-t border-slate-700/70 p-3">
        <button onClick={handleLogout} className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-red-300 hover:bg-red-500/10">
          <LogOut className="h-5 w-5" /> تسجيل الخروج
        </button>
      </div>
    </>
  );

  return (
    <>
      <aside className="fixed inset-y-0 right-0 z-50 hidden w-72 flex-col border-l border-slate-800 bg-slate-900 lg:flex">
        {renderMenu('desktop')}
      </aside>
      {mobileOpen && (
        <div className="fixed inset-0 z-[70] lg:hidden">
          <button type="button" aria-label="إغلاق قائمة التنقل" onClick={onClose} className="absolute inset-0 bg-slate-950/75" />
          <aside dir="rtl" role="dialog" aria-modal="true" aria-label="قائمة التنقل" className="absolute inset-y-0 right-0 flex w-[min(19rem,90vw)] flex-col border-l border-slate-700 bg-slate-900 shadow-2xl">
            {renderMenu('mobile')}
          </aside>
        </div>
      )}
    </>
  );
}
