'use client';

import { useEffect, useState } from 'react';
import axios from 'axios';
import { Building2, Users, Wallet, Activity, TrendingUp } from 'lucide-react';

const api = axios.create({
  baseURL: 'http://localhost:3001/api',
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('accessToken');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

export default function AdminDashboard() {
  const [stats, setStats] = useState<any>(null);
  const [tenants, setTenants] = useState<any[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      api.get('/analytics/dashboard').then(r => setStats(r.data)),
      api.get('/tenants').then(r => setTenants(r.data.data || [])),
      api.get('/users').then(r => setUsers(r.data.data || [])),
    ]).catch(console.error).finally(() => setLoading(false));
  }, []);

  const cards = [
    { label: 'إجمالي العملاء', value: tenants.length, icon: Building2, color: 'from-blue-500 to-cyan-500' },
    { label: 'المستخدمون', value: users.length, icon: Users, color: 'from-violet-500 to-purple-500' },
    { label: 'الجهات', value: stats?.counts?.contacts ?? 0, icon: Activity, color: 'from-emerald-500 to-teal-500' },
    { label: 'الفواتير', value: stats?.counts?.invoices ?? 0, icon: Wallet, color: 'from-amber-500 to-yellow-500' },
  ];

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="w-12 h-12 border-4 border-primary-500/30 border-t-primary-500 rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-fade-in-up">
      <div>
        <h1 className="text-3xl font-bold text-white mb-2">لوحة التحكم العليا</h1>
        <p className="text-slate-400">نظرة عامة على النظام بأكمله</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {cards.map((c) => (
          <div key={c.label} className="scc-card-hover">
            <div className="flex items-start justify-between mb-4">
              <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${c.color} flex items-center justify-center shadow-lg`}>
                <c.icon className="h-6 w-6 text-white" />
              </div>
              <span className="text-emerald-400 text-xs flex items-center gap-1"><TrendingUp className="h-3 w-3" /> +5%</span>
            </div>
            <p className="text-slate-400 text-sm mb-1">{c.label}</p>
            <p className="text-2xl font-bold text-white">{c.value}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="scc-card">
          <h3 className="text-lg font-bold text-white mb-4">آخر العملاء</h3>
          <div className="space-y-3">
            {tenants.slice(0, 5).map((t) => (
              <div key={t.id} className="flex items-center justify-between py-2 border-b border-slate-800 last:border-0">
                <div>
                  <p className="text-white text-sm font-medium">{t.name}</p>
                  <p className="text-slate-500 text-xs">{t.slug} • {t.plan}</p>
                </div>
                <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${
                  t.status === 'ACTIVE' ? 'bg-emerald-500/20 text-emerald-400' :
                  t.status === 'SUSPENDED' ? 'bg-red-500/20 text-red-400' :
                  'bg-amber-500/20 text-amber-400'
                }`}>{t.status}</span>
              </div>
            ))}
          </div>
        </div>
        <div className="scc-card">
          <h3 className="text-lg font-bold text-white mb-4">آخر المستخدمين</h3>
          <div className="space-y-3">
            {users.slice(0, 5).map((u) => (
              <div key={u.id} className="flex items-center justify-between py-2 border-b border-slate-800 last:border-0">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-primary-500/20 flex items-center justify-center text-primary-400 font-bold text-sm">{u.firstName?.charAt(0)}</div>
                  <div>
                    <p className="text-white text-sm font-medium">{u.firstName} {u.lastName}</p>
                    <p className="text-slate-500 text-xs">{u.email}</p>
                  </div>
                </div>
                <span className="text-slate-500 text-xs">{u.role}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
