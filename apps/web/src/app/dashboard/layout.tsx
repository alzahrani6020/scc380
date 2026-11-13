'use client';

import { useEffect, useState } from 'react';
import { Menu } from 'lucide-react';
import Sidebar from '@/components/layout/Sidebar';
import Header from '@/components/layout/Header';
import api from '@/lib/api';

interface CurrentUser {
  email?: string;
  role?: string;
  firstName?: string;
  lastName?: string;
}

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<CurrentUser | null>(null);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  useEffect(() => {
    if (!mobileNavOpen) return;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setMobileNavOpen(false);
    };
    window.addEventListener('keydown', closeOnEscape);
    return () => window.removeEventListener('keydown', closeOnEscape);
  }, [mobileNavOpen]);

  useEffect(() => {
    api.get('/auth/me')
      .then((res) => setUser(res.data))
      .catch(() => setUser(null));
  }, []);

  return (
    <div className="min-h-screen bg-slate-950">
      <Sidebar mobileOpen={mobileNavOpen} onClose={() => setMobileNavOpen(false)} />
      <div className="lg:mr-72">
        <div className="flex items-center border-b border-slate-800 bg-slate-900 px-3 py-2 lg:hidden">
          <button type="button" aria-label="فتح القائمة الرئيسية" aria-expanded={mobileNavOpen} onClick={() => setMobileNavOpen(true)}
            className="rounded-lg p-2 text-slate-100 hover:bg-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-400">
            <Menu className="h-6 w-6" />
          </button>
          <span className="mr-3 text-sm font-bold text-white">SCC 380 — القائمة</span>
        </div>
        <Header user={user} />
        <main className="p-4 sm:p-6 xl:p-8">{children}</main>
      </div>
    </div>
  );
}
