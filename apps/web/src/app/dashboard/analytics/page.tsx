'use client';

import React, { useState, useEffect } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  PieChart, Pie, Cell, LineChart, Line, AreaChart, Area
} from 'recharts';

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884D8', '#82CA9D'];

export default function AnalyticsDashboard() {
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchStats();
  }, []);

  const fetchStats = async () => {
    try {
      const res = await fetch('http://localhost:3001/analytics/public-summary');
      if (res.ok) {
        const data = await res.json();
        setStats(data);
      }
    } catch (e) {
      // Demo data
      setStats({
        counts: { contacts: 5, deals: 3, employees: 4, vehicles: 3, invoices: 2 },
        revenue: { deals: 450000, invoices: 115000 }
      });
    }
    setLoading(false);
  };

  // Demo chart data
  const salesData = [
    { name: 'يناير', sales: 15000, expenses: 8000 },
    { name: 'فبراير', sales: 22000, expenses: 12000 },
    { name: 'مارس', sales: 18000, expenses: 9000 },
    { name: 'أبريل', sales: 28000, expenses: 15000 },
    { name: 'مايو', sales: 35000, expenses: 18000 },
    { name: 'يونيو', sales: 42000, expenses: 22000 },
  ];

  const categoryData = [
    { name: 'إلكترونيات', value: 45000 },
    { name: 'أثاث', value: 28000 },
    { name: 'مواد غذائية', value: 15000 },
    { name: 'خدمات', value: 22000 },
    { name: 'أخرى', value: 8000 },
  ];

  const dealStages = [
    { name: 'Lead', count: 12 },
    { name: 'Qualified', count: 8 },
    { name: 'Proposal', count: 5 },
    { name: 'Negotiation', count: 3 },
    { name: 'Closed Won', count: 2 },
  ];

  const kpiCards = [
    { label: 'إجمالي المبيعات', value: '115,000 ريال', color: 'bg-green-500' },
    { label: 'صفقات مغلقة', value: '450,000 ريال', color: 'bg-blue-500' },
    { label: 'العملاء', value: '5', color: 'bg-purple-500' },
    { label: 'الموظفين', value: '4', color: 'bg-orange-500' },
    { label: 'المركبات', value: '3', color: 'bg-red-500' },
    { label: 'الفواتير', value: '2', color: 'bg-teal-500' },
  ];

  return (
    <div className="min-h-screen bg-slate-950 text-white p-4" dir="rtl">
      <h1 className="text-2xl font-bold mb-6">📊 لوحة التحليلات</h1>

      {loading ? (
        <div className="text-center py-12 text-slate-500">جاري التحميل...</div>
      ) : (
        <>
          {/* KPI Cards */}
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-6">
            {kpiCards.map((kpi, i) => (
              <div key={i} className="bg-slate-900 rounded-xl p-4 border border-slate-800">
                <div className={`w-3 h-3 rounded-full ${kpi.color} mb-2`} />
                <div className="text-2xl font-bold">{kpi.value}</div>
                <div className="text-sm text-slate-400">{kpi.label}</div>
              </div>
            ))}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
            {/* Sales Chart */}
            <div className="bg-slate-900 rounded-xl p-4 border border-slate-800">
              <h3 className="font-bold mb-4">📈 المبيعات vs المصروفات</h3>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={salesData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                  <XAxis dataKey="name" stroke="#94a3b8" />
                  <YAxis stroke="#94a3b8" />
                  <Tooltip contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #334155' }} />
                  <Legend />
                  <Bar dataKey="sales" name="المبيعات" fill="#0088FE" />
                  <Bar dataKey="expenses" name="المصروفات" fill="#FF8042" />
                </BarChart>
              </ResponsiveContainer>
            </div>

            {/* Category Pie */}
            <div className="bg-slate-900 rounded-xl p-4 border border-slate-800">
              <h3 className="font-bold mb-4">🥧 توزيع المبيعات حسب الفئة</h3>
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie data={categoryData} cx="50%" cy="50%" innerRadius={60} outerRadius={100}
                    paddingAngle={5} dataKey="value" label={({name, percent}) => `${name} ${(percent * 100).toFixed(0)}%`}>
                    {categoryData.map((_, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #334155' }} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
            {/* Revenue Trend */}
            <div className="bg-slate-900 rounded-xl p-4 border border-slate-800">
              <h3 className="font-bold mb-4">📉 اتجاه الإيرادات</h3>
              <ResponsiveContainer width="100%" height={300}>
                <AreaChart data={salesData}>
                  <defs>
                    <linearGradient id="colorSales" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#00C49F" stopOpacity={0.8} />
                      <stop offset="95%" stopColor="#00C49F" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                  <XAxis dataKey="name" stroke="#94a3b8" />
                  <YAxis stroke="#94a3b8" />
                  <Tooltip contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #334155' }} />
                  <Area type="monotone" dataKey="sales" stroke="#00C49F" fillOpacity={1} fill="url(#colorSales)" name="الإيرادات" />
                </AreaChart>
              </ResponsiveContainer>
            </div>

            {/* Deal Pipeline */}
            <div className="bg-slate-900 rounded-xl p-4 border border-slate-800">
              <h3 className="font-bold mb-4">🎯 خط أنابيب الصفقات</h3>
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
