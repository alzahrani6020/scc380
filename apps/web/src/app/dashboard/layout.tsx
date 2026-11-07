'use client';

import { useEffect, useState } from 'react';
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

  useEffect(() => {
    api.get('/auth/me')
      .then((res) => setUser(res.data))
      .catch(() => setUser(null));
  }, []);

  return (
    <div className="min-h-screen bg-slate-950">
      <Sidebar />
      <div className="lg:mr-72">
        <Header user={user} />
        <main className="p-8">{children}</main>
      </div>
    </div>
  );
}
