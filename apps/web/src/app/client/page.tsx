'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import api from '@/lib/api';
import { getToken, clearAuth } from '@/lib/auth';
import { Building2, FileText, FolderKanban, MessageSquare, LogOut, ArrowLeft, TrendingUp, CheckCircle2, Clock } from 'lucide-react';

export default function ClientPortal() {
  const [invoices, setInvoices] = useState<any[]>([]);
  const [projects, setProjects] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<any>(null);

  useEffect(() => {
    const token = getToken();
    if (!token) { window.location.href = '/auth/login'; return; }
    api.get('/auth/me').then((r) => setUser(r.data)).catch(() => { window.location.href = '/auth/login'; });
    Promise.all([
      api.get('/erp/invoices').then((r) => setInvoices(r.data.data || [])),
      api.get('/projects').then((r) => setProjects(r.data.data || [])),
    ]).catch(console.error).finally(() => setLoading(false));
  }, []);

  const paidInvoices = invoices.filter((i) => i.status === 'PAID');
  const totalPaid = paidInvoices.reduce((sum, i) => sum + Number(i.total), 0);
  const activeProjects = projects.filter((p) => p.status === 'ACTIVE');

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-950">
        <div className="w-12 h-12 border-4 border-primary-500/30 border-t-primary-500 rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950">
      {/* Top bar */}
      <div className="h-16 bg-slate-900/80 backdrop-blur-xl border-b border-slate-800 flex items-center justify-between px-6">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-primary-500 to-primary-700 flex items-center justify-center">
            <Building2 className="h-4 w-4 text-white" />
          </div>
          <span className="text-white font-bold">بوابة العميل</span>
        </div>
        <div className="flex items-center gap-4">
          <span className="text-slate-400 text-sm">{user?.email}</span>
          <button onClick={() => { clearAuth(); window.location.href = '/auth/login'; }} className="text-red-400 text-sm hover:underline flex items-center gap-1">
            <LogOut className="h-4 w-4" /> خروج
          </button>
        </div>
      </div>

      <main className="max-w-5xl mx-auto p-8 space-y-8">
        <div>
          <h1 className="text-2xl font-bold text-white">مرحباً {user?.firstName || ''}</h1>
          <p className="text-slate-400 mt-1">نظرة عامة على حسابك</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="scc-card-hover">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 rounded-lg bg-emerald-500/10 flex items-center justify-center"><CheckCircle2 className="h-5 w-5 text-emerald-400" /></div>
              <p className="text-slate-400 text-sm">المدفوعات</p>
            </div>
            <p className="text-2xl font-bold text-white">{totalPaid.toLocaleString()} ر.س</p>
            <p className="text-slate-500 text-xs mt-1">{paidInvoices.length} فاتورة مدفوعة</p>
          </div>
          <div className="scc-card-hover">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 rounded-lg bg-blue-500/10 flex items-center justify-center"><FolderKanban className="h-5 w-5 text-blue-400" /></div>
              <p className="text-slate-400 text-sm">المشاريع النشطة</p>
            </div>
            <p className="text-2xl font-bold text-white">{activeProjects.length}</p>
            <p className="text-slate-500 text-xs mt-1">مشروع قيد التنفيذ</p>
          </div>
          <div className="scc-card-hover">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 rounded-lg bg-amber-500/10 flex items-center justify-center"><FileText className="h-5 w-5 text-amber-400" /></div>
              <p className="text-slate-400 text-sm">الفواتير المعلقة</p>
            </div>
            <p className="text-2xl font-bold text-white">{invoices.filter((i) => i.status === 'SENT' || i.status === 'OVERDUE').length}</p>
            <p className="text-slate-500 text-xs mt-1">تتطلب الدفع</p>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="scc-card">
            <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2"><FileText className="h-5 w-5 text-primary-400" /> الفواتير</h3>
            <div className="space-y-3">
              {invoices.slice(0, 5).map((i) => (
                <div key={i.id} className="flex items-center justify-between py-2 border-b border-slate-800 last:border-0">
                  <div>
                    <p className="text-white text-sm font-medium">{i.invoiceNumber}</p>
                    <p className="text-slate-500 text-xs">{new Date(i.issueDate).toLocaleDateString('ar-SA')}</p>
                  </div>
                  <div className="text-left">
                    <p className="text-white font-bold text-sm">{Number(i.total).toLocaleString()} ر.س</p>
                    <span className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-medium ${
                      i.status === 'PAID' ? 'bg-emerald-500/20 text-emerald-400' :
                      i.status === 'OVERDUE' ? 'bg-red-500/20 text-red-400' :
                      'bg-amber-500/20 text-amber-400'
                    }`}>{i.status}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
          <div className="scc-card">
            <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2"><FolderKanban className="h-5 w-5 text-primary-400" /> المشاريع</h3>
            <div className="space-y-3">
              {projects.slice(0, 5).map((p) => (
                <div key={p.id} className="flex items-center justify-between py-2 border-b border-slate-800 last:border-0">
                  <div>
                    <p className="text-white text-sm font-medium">{p.name}</p>
                    <p className="text-slate-500 text-xs">{p.status}</p>
                  </div>
                  <div className="text-left">
                    <div className="w-24 h-1.5 bg-slate-800 rounded-full overflow-hidden">
                      <div className="h-full bg-primary-500 rounded-full" style={{ width: `${p.progress || 0}%` }} />
                    </div>
                    <p className="text-slate-500 text-xs mt-1">{p.progress || 0}%</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="text-center">
          <Link href="/dashboard" className="inline-flex items-center gap-2 text-primary-400 hover:text-primary-300 text-sm">
            <ArrowLeft className="h-4 w-4" /> الانتقال إلى لوحة التحكم الكاملة
          </Link>
        </div>
      </main>
    </div>
  );
}
