'use client';

import { useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';
import {
  LayoutDashboard, Building2, Users, BarChart3, Shield, LogOut,
  ChevronLeft, Crown,
} from 'lucide-react';

const nav = [
  { name: 'لوحة التحكم', href: '/dashboard', icon: LayoutDashboard },
  { name: 'العملاء (Tenants)', href: '/dashboard/tenants', icon: Building2 },
  { name: 'المستخدمون', href: '/dashboard/users', icon: Users },
  { name: 'التحليلات', href: '/dashboard/analytics', icon: BarChart3 },
  { name: 'سجل العمليات', href: '/dashboard/audit-logs', icon: Shield },
];

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    const token = localStorage.getItem('accessToken');
    const role = localStorage.getItem('role');
    if (!token || role !== 'SUPER_ADMIN') {
      router.push('/auth/login');
    }
  }, [router]);

  return (
    <div className="min-h-screen bg-slate-950 flex">
      <aside className="w-72 bg-slate-900/95 border-l border-slate-800 flex flex-col">
        <div className="flex items-center h-20 px-6 border-b border-slate-800">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-500 to-amber-700 flex items-center justify-center shadow-lg">
            <Crown className="h-5 w-5 text-white" />
          </div>
          <div className="mr-3">
            <span className="text-white font-bold text-lg block leading-tight">SCC Admin</span>
            <span className="text-amber-400 text-xs">Super Admin</span>
          </div>
        </div>
        <nav className="flex-1 px-4 py-6 space-y-1">
          {nav.map((item) => {
            const isActive = pathname === item.href || pathname.startsWith(`${item.href}/`);
            return (
              <Link key={item.name} href={item.href}
                className={`flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all ${
                  isActive ? 'bg-primary-500/10 text-primary-400' : 'text-slate-400 hover:bg-slate-800 hover:text-white'
                }`}
              >
                <item.icon className={`h-5 w-5 ${isActive ? 'text-primary-400' : 'text-slate-500'}`} />
                <span className="flex-1">{item.name}</span>
                {isActive && <ChevronLeft className="h-4 w-4 text-primary-400" />}
              </Link>
            );
          })}
        </nav>
        <div className="p-4 border-t border-slate-800">
          <button onClick={() => { localStorage.clear(); window.location.href = '/auth/login'; }}
            className="flex items-center gap-3 w-full px-4 py-3 rounded-xl text-sm font-medium text-red-400 hover:bg-red-500/10 transition-all">
            <LogOut className="h-5 w-5" /> تسجيل الخروج
          </button>
        </div>
      </aside>
      <main className="flex-1 p-8 overflow-auto">{children}</main>
    </div>
  );
}
