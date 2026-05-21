'use client';

import { useEffect, useState } from 'react';
import axios from 'axios';
import { Users, Search, Shield, User, Pencil, Trash2, X } from 'lucide-react';

const api = axios.create({ baseURL: 'http://localhost:3001/api' });
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('accessToken');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

const roles = [
  { value: 'SUPER_ADMIN', label: 'Super Admin' },
  { value: 'ADMIN', label: 'Admin' },
  { value: 'MANAGER', label: 'Manager' },
  { value: 'USER', label: 'User' },
  { value: 'AUDITOR', label: 'Auditor' },
  { value: 'READONLY', label: 'Readonly' },
];

const userStatuses = [
  { value: 'ACTIVE', label: 'نشط' },
  { value: 'INACTIVE', label: 'غير نشط' },
  { value: 'SUSPENDED', label: 'موقوف' },
  { value: 'PENDING_VERIFICATION', label: 'بانتظار التحقق' },
];

export default function AdminUsersPage() {
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
    api.get('/users').then((res) => setItems(res.data.data || [])).catch(console.error).finally(() => setLoading(false));
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
      await api.patch(`/users/${editing.id}`, formData);
      setIsModalOpen(false);
      fetchData();
    } catch (err) {
      alert('حدث خطأ');
    } finally {
      setFormLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('هل أنت متأكد؟')) return;
    await api.delete(`/users/${id}`);
    fetchData();
  };

  const filtered = items.filter((u) =>
    u.firstName?.includes(search) || u.lastName?.includes(search) || u.email?.includes(search)
  );

  return (
    <div className="space-y-6 animate-fade-in-up">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <Users className="h-6 w-6 text-primary-400" />
            المستخدمون
          </h1>
          <p className="text-slate-400 text-sm mt-1">{items.length} مستخدم</p>
        </div>
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
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((u) => (
            <div key={u.id} className="scc-card-hover group">
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-primary-500 to-primary-700 flex items-center justify-center text-white font-bold text-lg shrink-0">
                  {u.firstName?.charAt(0)}
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="font-bold text-white truncate">{u.firstName} {u.lastName}</h3>
                  <p className="text-slate-400 text-sm truncate">{u.email}</p>
                </div>
                <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${
                  u.role === 'SUPER_ADMIN' ? 'bg-amber-500/20 text-amber-400' :
                  u.role === 'ADMIN' ? 'bg-blue-500/20 text-blue-400' :
                  'bg-slate-500/20 text-slate-400'
                }`}>
                  {u.role === 'SUPER_ADMIN' ? <Shield className="h-3 w-3" /> : <User className="h-3 w-3" />}
                  {u.role}
                </span>
              </div>
              <div className="mt-3 flex items-center gap-4 text-xs text-slate-500">
                <span className={`inline-flex px-2 py-0.5 rounded-full ${
                  u.status === 'ACTIVE' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-red-500/20 text-red-400'
                }`}>{u.status}</span>
                <span>آخر دخول: {u.lastLoginAt ? new Date(u.lastLoginAt).toLocaleDateString('ar-SA') : '—'}</span>
              </div>
              <div className="mt-3 flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                <button onClick={() => openEdit(u)} className="scc-btn-ghost text-xs"><Pencil className="h-3 w-3" /> تعديل</button>
                <button onClick={() => handleDelete(u.id)} className="scc-btn-ghost text-xs text-red-400 hover:text-red-300"><Trash2 className="h-3 w-3" /> حذف</button>
              </div>
            </div>
          ))}
        </div>
      )}

      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" onClick={(e) => { if (e.target === e.currentTarget) setIsModalOpen(false); }}>
          <div className="w-full max-w-lg bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl overflow-hidden animate-fade-in-up">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800">
              <h3 className="text-lg font-bold text-white">تعديل مستخدم</h3>
              <button onClick={() => setIsModalOpen(false)} className="w-8 h-8 rounded-lg bg-slate-800 hover:bg-slate-700 flex items-center justify-center text-slate-400 hover:text-white"><X className="h-4 w-4" /></button>
            </div>
            <form onSubmit={handleSubmit} className="px-6 py-5 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="block text-sm font-medium text-slate-300">الاسم الأول</label>
                  <input className="scc-input" value={formData.firstName || ''} onChange={(e) => setFormData({ ...formData, firstName: e.target.value })} />
                </div>
                <div className="space-y-1.5">
                  <label className="block text-sm font-medium text-slate-300">الاسم الأخير</label>
                  <input className="scc-input" value={formData.lastName || ''} onChange={(e) => setFormData({ ...formData, lastName: e.target.value })} />
                </div>
                <div className="space-y-1.5">
                  <label className="block text-sm font-medium text-slate-300">الهاتف</label>
                  <input className="scc-input" value={formData.phone || ''} onChange={(e) => setFormData({ ...formData, phone: e.target.value })} />
                </div>
                <div className="space-y-1.5">
                  <label className="block text-sm font-medium text-slate-300">الدور</label>
                  <select className="scc-input" value={formData.role || 'USER'} onChange={(e) => setFormData({ ...formData, role: e.target.value })}>
                    {roles.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
                  </select>
                </div>
                <div className="space-y-1.5">
                  <label className="block text-sm font-medium text-slate-300">الحالة</label>
                  <select className="scc-input" value={formData.status || 'ACTIVE'} onChange={(e) => setFormData({ ...formData, status: e.target.value })}>
                    {userStatuses.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
                  </select>
                </div>
              </div>
              <div className="flex justify-end gap-3 pt-2">
                <button type="button" onClick={() => setIsModalOpen(false)} className="scc-btn-ghost text-sm"><X className="h-4 w-4" /> إلغاء</button>
                <button type="submit" disabled={formLoading} className="scc-btn-primary text-sm">{formLoading ? '...' : 'حفظ'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
