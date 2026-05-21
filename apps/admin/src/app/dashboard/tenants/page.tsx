'use client';

import { useEffect, useState } from 'react';
import axios from 'axios';
import { Building2, Search, Plus, Crown, CheckCircle2, XCircle, Pencil, Trash2, X } from 'lucide-react';

const api = axios.create({ baseURL: 'http://localhost:3001/api' });
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('accessToken');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

const plans = [
  { value: 'BASIC', label: 'أساسي' },
  { value: 'PROFESSIONAL', label: 'احترافي' },
  { value: 'ENTERPRISE', label: 'مؤسسي' },
  { value: 'GOVERNMENT', label: 'حكومي' },
];

const statuses = [
  { value: 'ACTIVE', label: 'نشط' },
  { value: 'SUSPENDED', label: 'موقوف' },
  { value: 'PENDING', label: 'معلق' },
  { value: 'CANCELLED', label: 'ملغى' },
];

const types = [
  { value: 'SHARED', label: 'مشترك' },
  { value: 'PRIVATE', label: 'خاص' },
];

export default function TenantsPage() {
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [formLoading, setFormLoading] = useState(false);
  const [formData, setFormData] = useState<any>({});

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = () => {
    api.get('/tenants').then((res) => setItems(res.data.data || [])).catch(console.error).finally(() => setLoading(false));
  };

  const openCreate = () => {
    setEditing(null);
    setFormData({ status: 'ACTIVE', plan: 'BASIC', type: 'SHARED' });
    setIsModalOpen(true);
  };

  const openEdit = (item: any) => {
    setEditing(item);
    setFormData({ ...item });
    setIsModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormLoading(true);
    try {
      if (editing) {
        await api.patch(`/tenants/${editing.slug}`, formData);
      } else {
        await api.post('/tenants', formData);
      }
      setIsModalOpen(false);
      fetchData();
    } catch (err) {
      alert('حدث خطأ');
    } finally {
      setFormLoading(false);
    }
  };

  const handleDelete = async (slug: string) => {
    if (!confirm('هل أنت متأكد؟')) return;
    await api.delete(`/tenants/${slug}`);
    fetchData();
  };

  const filtered = items.filter((t) => t.name?.includes(search) || t.slug?.includes(search));

  return (
    <div className="space-y-6 animate-fade-in-up">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <Building2 className="h-6 w-6 text-primary-400" />
            العملاء (Tenants)
          </h1>
          <p className="text-slate-400 text-sm mt-1">{items.length} عميل</p>
        </div>
        <button onClick={openCreate} className="scc-btn-primary"><Plus className="h-5 w-5" /> إضافة عميل</button>
      </div>
      <div className="relative">
        <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-500" />
        <input type="text" placeholder="البحث..." className="scc-input pr-10" value={search} onChange={(e) => setSearch(e.target.value)} />
      </div>
      {loading ? (
        <div className="flex items-center justify-center h-64">
          <div className="w-10 h-10 border-4 border-primary-500/30 border-t-primary-500 rounded-full animate-spin" />
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((t) => (
            <div key={t.id} className="scc-card-hover flex items-center justify-between group">
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-primary-500 to-primary-700 flex items-center justify-center text-white font-bold shrink-0">
                  {t.name?.charAt(0)}
                </div>
                <div>
                  <h3 className="font-bold text-white text-sm">{t.name}</h3>
                  <p className="text-slate-400 text-xs">{t.slug} • {t.domain || '—'}</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${
                  t.plan === 'GOVERNMENT' ? 'bg-amber-500/20 text-amber-400' :
                  t.plan === 'ENTERPRISE' ? 'bg-violet-500/20 text-violet-400' :
                  t.plan === 'PROFESSIONAL' ? 'bg-blue-500/20 text-blue-400' :
                  'bg-slate-500/20 text-slate-400'
                }`}>{t.plan}</span>
                <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${
                  t.status === 'ACTIVE' ? 'bg-emerald-500/20 text-emerald-400' :
                  t.status === 'SUSPENDED' ? 'bg-red-500/20 text-red-400' :
                  'bg-amber-500/20 text-amber-400'
                }`}>
                  {t.status === 'ACTIVE' ? <CheckCircle2 className="h-3 w-3" /> : <XCircle className="h-3 w-3" />}
                  {t.status}
                </span>
                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button onClick={() => openEdit(t)} className="p-1.5 rounded-lg hover:bg-primary-500/10 text-primary-400"><Pencil className="h-4 w-4" /></button>
                  <button onClick={() => handleDelete(t.slug)} className="p-1.5 rounded-lg hover:bg-red-500/10 text-red-400"><Trash2 className="h-4 w-4" /></button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" onClick={(e) => { if (e.target === e.currentTarget) setIsModalOpen(false); }}>
          <div className="w-full max-w-lg bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl overflow-hidden animate-fade-in-up">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800">
              <h3 className="text-lg font-bold text-white">{editing ? 'تعديل عميل' : 'عميل جديد'}</h3>
              <button onClick={() => setIsModalOpen(false)} className="w-8 h-8 rounded-lg bg-slate-800 hover:bg-slate-700 flex items-center justify-center text-slate-400 hover:text-white"><X className="h-4 w-4" /></button>
            </div>
            <form onSubmit={handleSubmit} className="px-6 py-5 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="block text-sm font-medium text-slate-300">الاسم <span className="text-red-400">*</span></label>
                  <input className="scc-input" required value={formData.name || ''} onChange={(e) => setFormData({ ...formData, name: e.target.value })} />
                </div>
                <div className="space-y-1.5">
                  <label className="block text-sm font-medium text-slate-300">الرمز <span className="text-red-400">*</span></label>
                  <input className="scc-input" required value={formData.slug || ''} onChange={(e) => setFormData({ ...formData, slug: e.target.value })} />
                </div>
                <div className="space-y-1.5">
                  <label className="block text-sm font-medium text-slate-300">النطاق</label>
                  <input className="scc-input" value={formData.domain || ''} onChange={(e) => setFormData({ ...formData, domain: e.target.value })} />
                </div>
                <div className="space-y-1.5">
                  <label className="block text-sm font-medium text-slate-300">الرقم الضريبي</label>
                  <input className="scc-input" value={formData.vatNumber || ''} onChange={(e) => setFormData({ ...formData, vatNumber: e.target.value })} />
                </div>
                <div className="space-y-1.5">
                  <label className="block text-sm font-medium text-slate-300">السجل التجاري</label>
                  <input className="scc-input" value={formData.crNumber || ''} onChange={(e) => setFormData({ ...formData, crNumber: e.target.value })} />
                </div>
                <div className="space-y-1.5">
                  <label className="block text-sm font-medium text-slate-300">الباقة</label>
                  <select className="scc-input" value={formData.plan || 'BASIC'} onChange={(e) => setFormData({ ...formData, plan: e.target.value })}>
                    {plans.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
                  </select>
                </div>
                <div className="space-y-1.5">
                  <label className="block text-sm font-medium text-slate-300">النوع</label>
                  <select className="scc-input" value={formData.type || 'SHARED'} onChange={(e) => setFormData({ ...formData, type: e.target.value })}>
                    {types.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                  </select>
                </div>
                <div className="space-y-1.5">
                  <label className="block text-sm font-medium text-slate-300">الحالة</label>
                  <select className="scc-input" value={formData.status || 'ACTIVE'} onChange={(e) => setFormData({ ...formData, status: e.target.value })}>
                    {statuses.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
                  </select>
                </div>
              </div>
              <div className="flex justify-end gap-3 pt-2">
                <button type="button" onClick={() => setIsModalOpen(false)} className="scc-btn-ghost text-sm"><X className="h-4 w-4" /> إلغاء</button>
                <button type="submit" disabled={formLoading} className="scc-btn-primary text-sm">{formLoading ? '...' : editing ? 'حفظ' : 'إنشاء'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
