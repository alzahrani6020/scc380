'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import api from '@/lib/api';
import { clearAuth } from '@/lib/auth';
import { cn } from '@scc/utils';
import {
  LayoutDashboard, Users, FileText, Briefcase, Truck,
  BarChart3, Landmark, Bot, Settings, Building2, LogOut,
  ChevronLeft, FolderKanban, Receipt, Shield, CreditCard, Bell,
  FileStack, ShoppingCart, Package, BookOpen, ArrowLeftRight, Store,
  Route, Wrench, Fuel,
} from 'lucide-react';

const navigation = [
  { name: 'لوحة التحكم', href: '/dashboard', icon: LayoutDashboard },
  { name: 'CRM', href: '/dashboard/crm', icon: Users },
  { name: 'ERP - الفواتير', href: '/dashboard/erp', icon: FileText },
  { name: 'المشاريع', href: '/dashboard/projects', icon: FolderKanban },
  { name: 'الموارد البشرية', href: '/dashboard/hr', icon: Briefcase },
  { name: 'إدارة الأسطول', href: '/dashboard/fleet', icon: Truck },
  { name: '├── الرحلات', href: '/dashboard/fleet/trips', icon: Route },
  { name: '├── السائقون', href: '/dashboard/fleet/drivers', icon: Users },
  { name: '├── الصيانة', href: '/dashboard/fleet/maintenance', icon: Wrench },
  { name: '├── الوقود', href: '/dashboard/fleet/fuel', icon: Fuel },
  { name: 'المالية', href: '/dashboard/finance', icon: Receipt },
  { name: '├── القيود اليومية', href: '/dashboard/finance/journal-entries', icon: Receipt },
  { name: '├── دفتر الأستاذ', href: '/dashboard/finance/general-ledger', icon: Receipt },
  { name: '├── دليل الحسابات', href: '/dashboard/finance/chart-of-accounts', icon: Receipt },
  { name: '🛒 الكاشير', href: '/dashboard/pos', icon: ShoppingCart },
  { name: '📦 المخزون', href: '/dashboard/inventory', icon: Package },
  { name: '🔄 تحويلات المخزون', href: '/dashboard/stock-transfers', icon: ArrowLeftRight },
  { name: '📊 التقارير المالية', href: '/dashboard/financial-reports', icon: BookOpen },
  { name: '🏢 الموردين', href: '/dashboard/suppliers', icon: Building2 },
  { name: '🏪 الفروع', href: '/dashboard/branches', icon: Store },
  { name: 'التحليلات', href: '/dashboard/analytics', icon: BarChart3 },
  { name: 'التكاملات الحكومية', href: '/dashboard/government', icon: Landmark },
  { name: 'المساعد الذكي', href: '/dashboard/ai', icon: Bot },
  { name: 'التنبيهات والإشعارات', href: '/dashboard/notifications', icon: Bell, badge: 'alerts' },
  { name: 'الأمان', href: '/dashboard/security', icon: Shield },
  { name: 'الاشتراكات', href: '/dashboard/billing', icon: CreditCard },
  { name: 'المستخدمون', href: '/dashboard/users', icon: Users },
  { name: 'النماذج الإلكترونية', href: '/dashboard/templates', icon: FileStack },
  { name: 'الإعدادات', href: '/dashboard/settings', icon: Settings },
];

export default function Sidebar() {
  const pathname = usePathname();
  const [alertCount, setAlertCount] = useState(0);

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
      <nav className="flex-1 px-4 py-6 space-y-1 overflow-y-auto">
        {navigation.map((item) => {
          const isActive = pathname === item.href || pathname.startsWith(`${item.href}/`);
          const showBadge = item.badge === 'alerts' && alertCount > 0;
          return (
            <Link
              key={item.name}
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
          onClick={() => { clearAuth(); window.location.href = '/auth/login'; }}
          className="flex items-center gap-3 w-full px-4 py-3 rounded-xl text-sm font-medium text-red-400 hover:bg-red-500/10 transition-all"
        >
          <LogOut className="h-5 w-5" />
          تسجيل الخروج
        </button>
      </div>
    </div>
  );
}
