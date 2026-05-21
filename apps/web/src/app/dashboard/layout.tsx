'use client';

import Sidebar from '@/components/layout/Sidebar';
import Header from '@/components/layout/Header';

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-slate-950">
      <Sidebar />
      <div className="lg:mr-72">
        <Header user={{ firstName: 'مطور', lastName: 'النظام', role: 'SUPER_ADMIN' }} />
        <main className="p-8">{children}</main>
      </div>
    </div>
  );
}
