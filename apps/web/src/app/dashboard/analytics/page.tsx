'use client';

import React, { useEffect, useMemo, useState } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  PieChart, Pie, Cell, AreaChart, Area
} from 'recharts';
import api from '@/lib/api';

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884D8', '#82CA9D'];

type DashboardStats = {
  counts: { contacts: number; deals: number; employees: number; vehicles: number; invoices: number };
  revenue: { deals: number | string; invoices: number | string };
};

export default function AnalyticsDashboard() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [crm, setCrm] = useState<any>({ byStage: [], bySource: [] });
  const [finance, setFinance] = useState<any>({ byCategory: [], monthlyPayments: [] });
  const [revenueTrend, setRevenueTrend] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    Promise.all([
      api.get('/analytics/dashboard'),
      api.get('/analytics/crm'),
      api.get('/analytics/finance'),
      api.get('/analytics/revenue-trend'),
    ])
      .then(([dashboardRes, crmRes, financeRes, revenueRes]) => {
        if (!active) return;
        setStats(dashboardRes.data);
        setCrm(crmRes.data || { byStage: [], bySource: [] });
        setFinance(financeRes.data || { byCategory: [], monthlyPayments: [] });
        setRevenueTrend(Array.isArray(revenueRes.data) ? revenueRes.data : []);
        setError(null);
      })
      .catch(() => {
        if (!active) return;
        setError('تعذر تحميل بيانات التحليلات من الخادم.');
        setStats(null);
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, []);

  const dealStages = useMemo(
    () => (crm.byStage || []).map((row: any) => ({
      name: row.stage,
      count: row?._count?.id || 0,
    })),
    [crm],
  );

  const expenseCategories = useMemo(
    () => (finance.byCategory || []).map((row: any) => ({
      name: row.category,
      value: Number(row.amount || 0),
    })),
    [finance],
  );

  const monthlyCash = useMemo(
    () => (finance.monthlyPayments || []).map((row: any) => ({
      name: row.month,
      payments: Number(row.amount || 0),
    })),
    [finance],
  );

  const revenueData = useMemo(
    () => revenueTrend.map((row: any) => ({
      name: row.month,
      revenue: Number(row.revenue || 0),
    })),
    [revenueTrend],
  );

  const kpiCards = stats ? [
    { label: 'إيرادات الفواتير المسددة', value: `${Number(stats.revenue.invoices || 0).toLocaleString('ar-SA')} ريال`, color: 'bg-green-500' },
    { label: 'قيمة الصفقات الرابحة', value: `${Number(stats.revenue.deals || 0).toLocaleString('ar-SA')} ريال`, color: 'bg-blue-500' },
    { label: 'العملاء', value: String(stats.counts.contacts || 0), color: 'bg-purple-500' },
    { label: 'الموظفين', value: String(stats.counts.employees || 0), color: 'bg-orange-500' },
    { label: 'المركبات', value: String(stats.counts.vehicles || 0), color: 'bg-red-500' },
    { label: 'الفواتير', value: String(stats.counts.invoices || 0), color: 'bg-teal-500' },
  ] : [];

  return (
    <div className="min-h-screen bg-slate-950 text-white p-4" dir="rtl">
      <h1 className="text-2xl font-bold mb-6">لوحة التحليلات</h1>

      {loading && <div className="text-center py-12 text-slate-500">جاري التحميل...</div>}

      {!loading && error && (
        <div className="rounded-xl border border-red-900 bg-red-950/40 p-4 text-red-200">
          {error}
        </div>
      )}

      {!loading && !error && stats && (
        <>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-6">
            {kpiCards.map((kpi) => (
              <div key={kpi.label} className="bg-slate-900 rounded-xl p-4 border border-slate-800">
                <div className={`w-3 h-3 rounded-full ${kpi.color} mb-2`} />
                <div className="text-2xl font-bold">{kpi.value}</div>
                <div className="text-sm text-slate-400">{kpi.label}</div>
              </div>
            ))}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
            <div className="bg-slate-900 rounded-xl p-4 border border-slate-800">
              <h3 className="font-bold mb-4">المدفوعات الشهرية</h3>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={monthlyCash}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                  <XAxis dataKey="name" stroke="#94a3b8" />
                  <YAxis stroke="#94a3b8" />
                  <Tooltip contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #334155' }} />
                  <Legend />
                  <Bar dataKey="payments" name="المدفوعات" fill="#0088FE" />
                </BarChart>
              </ResponsiveContainer>
            </div>

            <div className="bg-slate-900 rounded-xl p-4 border border-slate-800">
              <h3 className="font-bold mb-4">المصروفات حسب الفئة</h3>
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={expenseCategories}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={100}
                    paddingAngle={5}
                    dataKey="value"
                    label={({ name, percent }) => `${name} ${((percent || 0) * 100).toFixed(0)}%`}
                  >
                    {expenseCategories.map((_: any, index: number) => (
                      <Cell key={index} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #334155' }} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
            <div className="bg-slate-900 rounded-xl p-4 border border-slate-800">
              <h3 className="font-bold mb-4">اتجاه الإيرادات</h3>
              <ResponsiveContainer width="100%" height={300}>
                <AreaChart data={revenueData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                  <XAxis dataKey="name" stroke="#94a3b8" />
                  <YAxis stroke="#94a3b8" />
                  <Tooltip contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #334155' }} />
                  <Area type="monotone" dataKey="revenue" stroke="#00C49F" fill="#00C49F" fillOpacity={0.25} name="الإيرادات" />
                </AreaChart>
              </ResponsiveContainer>
            </div>

            <div className="bg-slate-900 rounded-xl p-4 border border-slate-800">
              <h3 className="font-bold mb-4">خط أنابيب الصفقات</h3>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={dealStages} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                  <XAxis type="number" stroke="#94a3b8" />
                  <YAxis dataKey="name" type="category" stroke="#94a3b8" />
                  <Tooltip contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #334155' }} />
                  <Bar dataKey="count" name="عدد الصفقات" fill="#8884D8" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
