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
  Network, UserCog, FileInput, Building, Clock3, CalendarRange,
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
  { name: 'التوظيف', href: '/dashboard/hr/recruitment', icon: Briefcase },
  { name: 'الأداء', href: '/dashboard/hr/performance', icon: ClipboardList },
  { name: 'التدريب', href: '/dashboard/hr/training', icon: FileText },
  { name: 'الحضور', href: '/dashboard/hr/attendance', icon: ClipboardList },
  { name: 'الورديات', href: '/dashboard/hr/shifts', icon: Clock3 },
  { name: 'الإجازات', href: '/dashboard/hr/leaves', icon: CalendarDays },
  { name: 'أرصدة الإجازات', href: '/dashboard/hr/leave-balances', icon: CalendarRange },
  { name: 'العقود', href: '/dashboard/hr/contracts', icon: FileSignature },
  { name: 'مستندات الموظفين', href: '/dashboard/hr/documents', icon: FileText },
  { name: 'العهد والأصول', href: '/dashboard/hr/assets', icon: Package },
  { name: 'السلف والقروض', href: '/dashboard/hr/loans', icon: Coins },
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

export default function Sidebar() {
  const pathname = usePathname();
  const [alertCount, setAlertCount] = useState(0);

  const handleLogout = async () => {
    const refreshToken = getRefreshToken();
    try {
      if (refreshToken) {
        await api.post('/auth/logout', { refreshToken });
      }
    } catch {
      // Local sign-out must still complete if the session is already invalid.
    } finally {
      clearAuth();
      window.location.href = '/auth/login';
    }
  };

  useEffect(() => {
    api.get('/alerts/counts').then(r => setAlertCount(r.data?.total || 0)).catch(() => {});
    const interval = setInterval(() => {
      api.get('/alerts/counts').then(r => setAlertCount(r.data?.total || 0)).catch(() => {});
    }, 60000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="hidden lg:fixed lg:inset-y-0 lg:right-0 lg:z-50 lg:w-72 lg:flex lg:flex-col bg-slate-900/95 backdrop-blur-xl border-l border-slate-800">
      {/* Logo */}
      <div className="flex items-center h-20 px-6 border-b border-slate-800">
        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary-500 to-primary-700 flex items-center justify-center shadow-lg shadow-primary-500/20">
          <Building2 className="h-5 w-5 text-white" />
        </div>
        <div className="mr-3">
          <span className="text-white font-bold text-lg block leading-tight">SCC 380</span>
          <span className="text-slate-500 text-xs">Command Center</span>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-4 py-4 space-y-1 overflow-y-auto">
        {navigation.map((item) => {
          if ('header' in item) {
            return (
              <div
                key={item.header}
                className="px-4 pt-5 pb-1.5 text-[11px] font-bold tracking-wide text-slate-600 first:pt-1"
              >
                {item.header}
              </div>
            );
          }
          const isActive = item.href === '/dashboard'
            ? pathname === item.href
            : pathname === item.href || pathname.startsWith(`${item.href}/`);
          const showBadge = item.badge === 'alerts' && alertCount > 0;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn('scc-sidebar-link', isActive && 'active')}
            >
              <item.icon className={cn('h-5 w-5', isActive ? 'text-primary-400' : 'text-slate-500')} />
              <span className="flex-1">{item.name}</span>
              {showBadge && (
                <span className="bg-red-500 text-white text-[10px] font-bold rounded-full min-w-[20px] h-5 flex items-center justify-center px-1.5">
                  {alertCount}
                </span>
              )}
              {isActive && !showBadge && <ChevronLeft className="h-4 w-4 text-primary-400" />}
            </Link>
          );
        })}
      </nav>

      {/* Logout */}
      <div className="p-4 border-t border-slate-800">
        <button
          onClick={handleLogout}
          className="flex items-center gap-3 w-full px-4 py-3 rounded-xl text-sm font-medium text-red-400 hover:bg-red-500/10 transition-all"
        >
          <LogOut className="h-5 w-5" />
          تسجيل الخروج
        </button>
      </div>
    </div>
  );
}
