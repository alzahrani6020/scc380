'use client';

import { useEffect, useState } from 'react';
import api from '@/lib/api';
import {
  Store, Plus, Search, Phone, Mail, MapPin, Warehouse, ShoppingCart,
  X, TrendingUp, Check, Trash2, Edit, Star, Monitor, BarChart3,
} from 'lucide-react';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import Modal from '@/components/ui/Modal';

interface Branch {
  id: string;
  name: string;
  code: string;
  address: string | null;
  city: string | null;
  phone: string | null;
  email: string | null;
  managerName: string | null;
  isActive: boolean;
  isMain: boolean;
  _count?: { warehouses: number; posSessions: number; posOrders: number };
}

const emptyForm = {
  name: '', code: '', address: '', city: '', phone: '', email: '', managerName: '', isMain: 'false',
};

export default function BranchesPage() {
  const [branches, setBranches] = useState<Branch[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Branch | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [statsBranch, setStatsBranch] = useState<Branch | null>(null);
  const [stats, setStats] = useState<any>(null);

  useEffect(() => { fetchData(); }, []);

  const fetchData = () => {
    setLoading(true);
    api.get('/branches')
      .then(r => setBranches(r.data || []))
      .catch(console.error)
      .finally(() => setLoading(false));
  };

  const openStats = async (b: Branch) => {
    setStatsBranch(b);
    try {
      const res = await api.get(`/branches/${b.id}/stats`);
      setStats(res.data);
    } catch (e) {
      console.error(e);
    }
  };

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const payload = { ...form, isMain: form.isMain === 'true' };
      if (editing) {
        await api.patch(`/branches/${editing.id}`, payload);
      } else {
        await api.post('/branches', payload);
      }
      setModalOpen(false);
      setEditing(null);
      setForm(emptyForm);
      fetchData();
    } catch (err) {
      alert('حدث خطأ');
    }
  };

  const remove = async (id: string) => {
    if (!confirm('هل أنت متأكد من الحذف؟')) return;
    await api.delete(`/branches/${id}`);
    fetchData();
  };

  const filtered = branches.filter(b =>
    b.name.toLowerCase().includes(search.toLowerCase()) ||
    b.code.toLowerCase().includes(search.toLowerCase()) ||
    (b.city && b.city.includes(search))
  );

  const statsSummary = {
    total: branches.length,
    active: branches.filter(b => b.isActive).length,
    main: branches.filter(b => b.isMain).length,
    totalWarehouses: branches.reduce((sum, b) => sum + (b._count?.warehouses || 0), 0),
  };

  return (
    <div className="space-y-6 animate-fade-in-up">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <Store className="h-6 w-6 text-primary-400" />
            إدارة الفروع
          </h1>
          <p className="text-slate-400 text-sm mt-1">الفروع والمستودعات المرتبطة</p>
        </div>
        <Button size="sm" onClick={() => { setEditing(null); setForm(emptyForm); setModalOpen(true); }}>
          <Plus className="h-4 w-4" /> إضافة فرع
        </Button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'إجمالي الفروع', value: statsSummary.total, icon: Store, color: 'text-primary-400 bg-primary-500/10' },
          { label: 'نشطة', value: statsSummary.active, icon: Check, color: 'text-emerald-400 bg-emerald-500/10' },
          { label: 'رئيسية', value: statsSummary.main, icon: Star, color: 'text-amber-400 bg-amber-500/10' },
          { label: 'المستودعات', value: statsSummary.totalWarehouses, icon: Warehouse, color: 'text-blue-400 bg-blue-500/10' },
        ].map(s => (
          <div key={s.label} className="scc-card flex items-center gap-3">
            <div className={`p-2 rounded-lg ${s.color}`}><s.icon className="h-5 w-5" /></div>
            <div>
              <div className="text-xl font-bold text-white">{s.value}</div>
              <div className="text-xs text-slate-500">{s.label}</div>
            </div>
          </div>
        ))}
      </div>

      <div className="relative">
        <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
        <input
          type="text"
          placeholder="بحث باسم الفرع، الكود، أو المدينة..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="w-full bg-slate-800 border border-slate-700 rounded-xl py-2.5 pr-10 pl-4 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-primary-500"
        />
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-64">
          <div className="w-10 h-10 border-4 border-primary-500/30 border-t-primary-500 rounded-full animate-spin" />
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map(b => (
            <div key={b.id} className="scc-card-hover">
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-2">
                  <div className={`p-2 rounded-lg ${b.isMain ? 'bg-amber-500/10 text-amber-400' : 'bg-slate-800 text-slate-400'}`}>
                    <Store className="h-5 w-5" />
                  </div>
                  <div>
                    <h3 className="font-bold text-white">{b.name}</h3>
                    <p className="text-xs text-slate-500 font-mono">{b.code}</p>
                  </div>
                </div>
                {b.isMain && <span className="text-[10px] bg-amber-500/10 text-amber-400 px-2 py-0.5 rounded-full font-medium">رئيسي</span>}
              </div>

              <div className="space-y-1.5 mb-4">
                {b.address && <div className="flex items-center gap-1.5 text-slate-400 text-xs"><MapPin className="h-3 w-3" /> {b.address}{b.city && `, ${b.city}`}</div>}
                {b.phone && <div className="flex items-center gap-1.5 text-slate-400 text-xs"><Phone className="h-3 w-3" /> {b.phone}</div>}
                {b.managerName && <div className="flex items-center gap-1.5 text-slate-400 text-xs"><Monitor className="h-3 w-3" /> المسؤول: {b.managerName}</div>}
              </div>

              <div className="grid grid-cols-3 gap-2 mb-3">
                <div className="bg-slate-800 rounded-lg p-2 text-center">
                  <div className="text-sm font-bold text-white">{b._count?.warehouses || 0}</div>
                  <div className="text-[10px] text-slate-500">مستودعات</div>
                </div>
                <div className="bg-slate-800 rounded-lg p-2 text-center">
                  <div className="text-sm font-bold text-white">{b._count?.posSessions || 0}</div>
                  <div className="text-[10px] text-slate-500">جلسات</div>
                </div>
                <div className="bg-slate-800 rounded-lg p-2 text-center">
                  <div className="text-sm font-bold text-white">{b._count?.posOrders || 0}</div>
                  <div className="text-[10px] text-slate-500">طلبات</div>
                </div>
              </div>

              <div className="flex items-center justify-between pt-3 border-t border-slate-800">
                <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${b.isActive ? 'bg-emerald-500/10 text-emerald-400' : 'bg-slate-700 text-slate-400'}`}>
                  {b.isActive ? 'نشط' : 'معطل'}
                </span>
                <div className="flex items-center gap-1">
                  <button onClick={() => openStats(b)} className="p-1.5 rounded-lg hover:bg-primary-500/10 text-primary-400" title="إحصائيات"><BarChart3 className="h-4 w-4" /></button>
                  <button onClick={() => { setEditing(b); setForm({ ...emptyForm, ...b, isMain: String(b.isMain) }); setModalOpen(true); }} className="p-1.5 rounded-lg hover:bg-amber-500/10 text-amber-400" title="تعديل"><Edit className="h-4 w-4" /></button>
                  <button onClick={() => remove(b.id)} className="p-1.5 rounded-lg hover:bg-red-500/10 text-red-400" title="حذف"><Trash2 className="h-4 w-4" /></button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <Modal isOpen={modalOpen} onClose={() => setModalOpen(false)} title={editing ? 'تعديل فرع' : 'إضافة فرع جديد'}>
        <form onSubmit={save} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <Input label="الاسم" required value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} />
            <Input label="الكود" required value={form.code} onChange={e => setForm({ ...form, code: e.target.value })} />
            <Input label="المدينة" value={form.city} onChange={e => setForm({ ...form, city: e.target.value })} />
            <Input label="الجوال" value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} />
            <Input label="البريد الإلكتروني" type="email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} />
            <Input label="اسم المسؤول" value={form.managerName} onChange={e => setForm({ ...form, managerName: e.target.value })} />
          </div>
          <Input label="العنوان" value={form.address} onChange={e => setForm({ ...form, address: e.target.value })} />
          <div className="flex items-center gap-2">
            <input type="checkbox" id="isMain" checked={form.isMain === 'true'} onChange={e => setForm({ ...form, isMain: e.target.checked ? 'true' : 'false' })} className="rounded border-slate-600" />
            <label htmlFor="isMain" className="text-sm text-slate-300">فرع رئيسي</label>
          </div>
          <div className="flex justify-end gap-3">
            <Button type="button" variant="ghost" onClick={() => setModalOpen(false)}><X className="h-4 w-4" /> إلغاء</Button>
            <Button type="submit">{editing ? 'حفظ التعديلات' : 'إضافة'}</Button>
          </div>
        </form>
      </Modal>

      <Modal isOpen={!!statsBranch} onClose={() => { setStatsBranch(null); setStats(null); }} title={statsBranch ? `إحصائيات: ${statsBranch.name}` : ''}>
        {stats ? (
          <div className="space-y-4">
            <div className="grid grid-cols-4 gap-3">
              <div className="bg-slate-800 rounded-xl p-3 text-center">
                <div className="text-lg font-bold text-white">{stats.warehouseCount}</div>
                <div className="text-xs text-slate-500">مستودعات</div>
              </div>
              <div className="bg-slate-800 rounded-xl p-3 text-center">
                <div className="text-lg font-bold text-white">{stats.orderCount}</div>
                <div className="text-xs text-slate-500">طلبات</div>
              </div>
              <div className="bg-slate-800 rounded-xl p-3 text-center">
                <div className="text-lg font-bold text-white">{stats.sessionCount}</div>
                <div className="text-xs text-slate-500">جلسات</div>
              </div>
              <div className="bg-slate-800 rounded-xl p-3 text-center">
                <div className="text-lg font-bold text-emerald-400">{stats.totalSales.toLocaleString('ar-SA')}</div>
                <div className="text-xs text-slate-500">المبيعات</div>
              </div>
            </div>
            {stats.branch.warehouses?.length > 0 && (
              <div>
                <h4 className="text-sm font-bold text-white mb-2">المستودعات</h4>
                <div className="space-y-2">
                  {stats.branch.warehouses.map((w: any) => (
                    <div key={w.id} className="flex items-center justify-between bg-slate-800 rounded-lg p-2">
                      <span className="text-sm text-white">{w.name}</span>
                      <span className={`text-xs px-2 py-0.5 rounded-full ${w.isActive ? 'bg-emerald-500/10 text-emerald-400' : 'bg-slate-700 text-slate-400'}`}>{w.isActive ? 'نشط' : 'معطل'}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
            {stats.branch.posSessions?.length > 0 && (
              <div>
                <h4 className="text-sm font-bold text-white mb-2">آخر الجلسات</h4>
                <div className="space-y-2">
                  {stats.branch.posSessions.map((s: any) => (
                    <div key={s.id} className="flex items-center justify-between bg-slate-800 rounded-lg p-2">
                      <span className="text-sm text-white">{s.posTerminal || 'كاشير'}</span>
                      <span className={`text-xs px-2 py-0.5 rounded-full ${s.status === 'OPEN' ? 'bg-emerald-500/10 text-emerald-400' : 'bg-slate-700 text-slate-400'}`}>{s.status === 'OPEN' ? 'مفتوحة' : 'مغلقة'}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="flex items-center justify-center h-48"><div className="w-8 h-8 border-4 border-primary-500/30 border-t-primary-500 rounded-full animate-spin" /></div>
        )}
      </Modal>
    </div>
  );
}
