'use client';

import { useEffect, useState } from 'react';
import axios from 'axios';
import { BarChart3, TrendingUp, Users, FileText, Truck, Briefcase } from 'lucide-react';

const api = axios.create({ baseURL: 'http://localhost:3001/api' });
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('accessToken');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

export default function AdminAnalyticsPage() {
  const [stats, setStats] = useState<any>(null);
  const [crmStats, setCrmStats] = useState<any>(null);
  const [erpStats, setErpStats] = useState<any>(null);
  const [fleetStats, setFleetStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      api.get('/analytics/dashboard').then(r => setStats(r.data)),
      api.get('/analytics/crm').then(r => setCrmStats(r.data)),
      api.get('/analytics/erp').then(r => setErpStats(r.data)),
      api.get('/analytics/fleet').then(r => setFleetStats(r.data)),
    ]).catch(console.error).finally(() => setLoading(false));
  }, []);

  const cards = [
    { label: 'جهات الاتصال', value: stats?.counts?.contacts ?? 0, icon: Users, color: 'from-blue-500 to-cyan-500' },
    { label: 'الصفقات', value: stats?.counts?.deals ?? 0, icon: Briefcase, color: 'from-emerald-500 to-teal-500' },
    { label: 'الموظفين', value: stats?.counts?.employees ?? 0, icon: Briefcase, color: 'from-violet-500 to-purple-500' },
    { label: 'المركبات', value: stats?.counts?.vehicles ?? 0, icon: Truck, color: 'from-orange-500 to-amber-500' },
    { label: 'الفواتير', value: stats?.counts?.invoices ?? 0, icon: FileText, color: 'from-rose-500 to-pink-500' },
    { label: 'الإيرادات', value: `${stats?.revenue?.invoices?.toLocaleString?.() ?? 0} ر.س`, icon: TrendingUp, color: 'from-amber-500 to-yellow-500' },
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
        <h1 className="text-2xl font-bold text-white flex items-center gap-2">
          <BarChart3 className="h-6 w-6 text-primary-400" />
          التحليلات العامة
        </h1>
        <p className="text-slate-400 text-sm mt-1">إحصائيات النظام بأكمله</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {cards.map((c) => (
          <div key={c.label} className="scc-card-hover">
            <div className="flex items-start justify-between mb-4">
              <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${c.color} flex items-center justify-center shadow-lg`}>
                <c.icon className="h-6 w-6 text-white" />
              </div>
            </div>
            <p className="text-slate-400 text-sm mb-1">{c.label}</p>
            <p className="text-2xl font-bold text-white">{c.value}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="scc-card">
          <h3 className="text-lg font-bold text-white mb-4">الصفقات حسب المرحلة</h3>
          <div className="space-y-3">
            {crmStats?.byStage?.map((s: any) => (
              <div key={s.stage} className="flex items-center gap-3">
                <span className="text-slate-400 text-sm w-24">{s.stage}</span>
                <div className="flex-1 h-2 bg-slate-800 rounded-full overflow-hidden">
                  <div className="h-full bg-primary-500 rounded-full" style={{ width: `${Math.min((s._count / (crmStats?.byStage?.reduce((a: any, b: any) => a + b._count, 0) || 1)) * 100, 100)}%` }} />
                </div>
                <span className="text-white text-sm font-medium w-8 text-left">{s._count}</span>
              </div>
            ))}
          </div>
        </div>
        <div className="scc-card">
          <h3 className="text-lg font-bold text-white mb-4">الفواتير حسب الحالة</h3>
          <div className="space-y-3">
            {erpStats?.byStatus?.map((s: any) => (
              <div key={s.status} className="flex items-center gap-3">
                <span className="text-slate-400 text-sm w-24">{s.status}</span>
                <div className="flex-1 h-2 bg-slate-800 rounded-full overflow-hidden">
                  <div className="h-full bg-emerald-500 rounded-full" style={{ width: `${Math.min((s._count / (erpStats?.byStatus?.reduce((a: any, b: any) => a + b._count, 0) || 1)) * 100, 100)}%` }} />
                </div>
                <span className="text-white text-sm font-medium w-8 text-left">{s._count}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
