'use client';

import { useEffect, useState } from 'react';
import api from '@/lib/api';
import {
  Building2, Plus, Search, Phone, Mail, MapPin, Package, FileText,
  X, ArrowRight, TrendingUp, CreditCard, AlertCircle, Check, Trash2, Edit,
} from 'lucide-react';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import Modal from '@/components/ui/Modal';

interface Supplier {
  id: string;
  name: string;
  nameAr: string | null;
  code: string;
  taxNumber: string | null;
  commercialReg: string | null;
  email: string | null;
  phone: string | null;
  address: string | null;
  city: string | null;
  country: string;
  contactName: string | null;
  contactPhone: string | null;
  paymentTerms: number;
  creditLimit: string | null;
  balance: string;
  isActive: boolean;
  notes: string | null;
  _count?: { products: number; purchaseOrders: number };
}

const emptyForm = {
  name: '', nameAr: '', code: '', taxNumber: '', commercialReg: '',
  email: '', phone: '', address: '', city: '', country: 'SA',
  contactName: '', contactPhone: '', paymentTerms: "30", creditLimit: '', notes: '',
};

export default function SuppliersPage() {
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Supplier | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [statementSupplier, setStatementSupplier] = useState<Supplier | null>(null);
  const [statement, setStatement] = useState<any>(null);
  const [statementLoading, setStatementLoading] = useState(false);

  useEffect(() => { fetchData(); }, []);

  const fetchData = () => {
    setLoading(true);
    api.get('/suppliers')
      .then(r => setSuppliers(r.data || []))
      .catch(console.error)
      .finally(() => setLoading(false));
  };

  const openStatement = async (s: Supplier) => {
    setStatementSupplier(s);
    setStatementLoading(true);
    try {
      const res = await api.get(`/suppliers/${s.id}/statement`);
      setStatement(res.data);
    } catch (e) {
      console.error(e);
    }
    setStatementLoading(false);
  };

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const payload = { ...form, paymentTerms: Number(form.paymentTerms), creditLimit: form.creditLimit ? Number(form.creditLimit) : null };
      if (editing) {
        await api.patch(`/suppliers/${editing.id}`, payload);
      } else {
        await api.post('/suppliers', payload);
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
    await api.delete(`/suppliers/${id}`);
    fetchData();
  };

  const filtered = suppliers.filter(s =>
    s.name.toLowerCase().includes(search.toLowerCase()) ||
    s.code.toLowerCase().includes(search.toLowerCase()) ||
    (s.phone && s.phone.includes(search))
  );

  const stats = {
    total: suppliers.length,
    active: suppliers.filter(s => s.isActive).length,
    totalBalance: suppliers.reduce((sum, s) => sum + Number(s.balance), 0),
    totalProducts: suppliers.reduce((sum, s) => sum + (s._count?.products || 0), 0),
  };

  return (
    <div className="space-y-6 animate-fade-in-up">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <Building2 className="h-6 w-6 text-primary-400" />
            إدارة الموردين
          </h1>
          <p className="text-slate-400 text-sm mt-1">قاعدة بيانات الموردين والمقاولين</p>
        </div>
        <Button size="sm" onClick={() => { setEditing(null); setForm(emptyForm); setModalOpen(true); }}>
          <Plus className="h-4 w-4" /> إضافة مورد
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'إجمالي الموردين', value: stats.total, icon: Building2, color: 'text-primary-400 bg-primary-500/10' },
          { label: 'نشطين', value: stats.active, icon: Check, color: 'text-emerald-400 bg-emerald-500/10' },
          { label: 'إجمالي الرصيد', value: `${stats.totalBalance.toLocaleString('ar-SA')} ر.س`, icon: CreditCard, color: 'text-amber-400 bg-amber-500/10' },
          { label: 'المنتجات المرتبطة', value: stats.totalProducts, icon: Package, color: 'text-blue-400 bg-blue-500/10' },
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

      {/* Search */}
      <div className="relative">
        <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
        <input
          type="text"
          placeholder="بحث باسم المورد، الكود، أو الجوال..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="w-full bg-slate-800 border border-slate-700 rounded-xl py-2.5 pr-10 pl-4 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-primary-500"
        />
      </div>

      {/* Table */}
      {loading ? (
        <div className="flex items-center justify-center h-64">
          <div className="w-10 h-10 border-4 border-primary-500/30 border-t-primary-500 rounded-full animate-spin" />
        </div>
      ) : (
        <div className="scc-card overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-700">
                <th className="text-right py-3 px-4 text-slate-400 font-medium">المورد</th>
                <th className="text-right py-3 px-4 text-slate-400 font-medium">الكود</th>
                <th className="text-right py-3 px-4 text-slate-400 font-medium">التواصل</th>
                <th className="text-right py-3 px-4 text-slate-400 font-medium">الرصيد</th>
                <th className="text-right py-3 px-4 text-slate-400 font-medium">الطلبات</th>
                <th className="text-right py-3 px-4 text-slate-400 font-medium">الحالة</th>
                <th className="text-left py-3 px-4 text-slate-400 font-medium">إجراءات</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(s => (
                <tr key={s.id} className="border-b border-slate-800 hover:bg-slate-800/50 transition-colors">
                  <td className="py-3 px-4">
                    <div className="font-medium text-white">{s.name}</div>
                    {s.nameAr && <div className="text-xs text-slate-500">{s.nameAr}</div>}
                  </td>
                  <td className="py-3 px-4 text-slate-400 font-mono text-xs">{s.code}</td>
                  <td className="py-3 px-4">
                    {s.phone && <div className="flex items-center gap-1 text-slate-400 text-xs"><Phone className="h-3 w-3" /> {s.phone}</div>}
                    {s.email && <div className="flex items-center gap-1 text-slate-400 text-xs"><Mail className="h-3 w-3" /> {s.email}</div>}
                  </td>
                  <td className="py-3 px-4 text-white font-medium">{Number(s.balance).toLocaleString('ar-SA')} ر.س</td>
                  <td className="py-3 px-4">
                    <div className="flex items-center gap-2 text-xs text-slate-400">
                      <Package className="h-3 w-3" /> {s._count?.products || 0}
                      <FileText className="h-3 w-3 mr-2" /> {s._count?.purchaseOrders || 0}
                    </div>
                  </td>
                  <td className="py-3 px-4">
                    <span className={`text-xs px-2 py-1 rounded-full font-medium ${s.isActive ? 'bg-emerald-500/10 text-emerald-400' : 'bg-slate-700 text-slate-400'}`}>
                      {s.isActive ? 'نشط' : 'معطل'}
                    </span>
                  </td>
                  <td className="py-3 px-4">
                    <div className="flex items-center gap-1">
                      <button onClick={() => openStatement(s)} className="p-1.5 rounded-lg hover:bg-primary-500/10 text-primary-400" title="كشف حساب">
                        <FileText className="h-4 w-4" />
                      </button>
                      <button onClick={() => { setEditing(s); setForm({ ...emptyForm, ...s, paymentTerms: String(s.paymentTerms || 30), creditLimit: s.creditLimit || '' }); setModalOpen(true); }} className="p-1.5 rounded-lg hover:bg-amber-500/10 text-amber-400" title="تعديل">
                        <Edit className="h-4 w-4" />
                      </button>
                      <button onClick={() => remove(s.id)} className="p-1.5 rounded-lg hover:bg-red-500/10 text-red-400" title="حذف">
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {filtered.length === 0 && (
            <div className="text-center py-12">
              <Building2 className="h-12 w-12 text-slate-600 mx-auto mb-3" />
              <p className="text-slate-500">لا يوجد موردين</p>
            </div>
          )}
        </div>
      )}

      {/* Add/Edit Modal */}
      <Modal isOpen={modalOpen} onClose={() => setModalOpen(false)} title={editing ? 'تعديل مورد' : 'إضافة مورد جديد'}>
        <form onSubmit={save} className="space-y-4 max-h-[70vh] overflow-y-auto pr-1">
          <div className="grid grid-cols-2 gap-3">
            <Input label="الاسم" required value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} />
            <Input label="الاسم العربي" value={form.nameAr} onChange={e => setForm({ ...form, nameAr: e.target.value })} />
            <Input label="الكود" required value={form.code} onChange={e => setForm({ ...form, code: e.target.value })} />
            <Input label="الرقم الضريبي" value={form.taxNumber} onChange={e => setForm({ ...form, taxNumber: e.target.value })} />
            <Input label="السجل التجاري" value={form.commercialReg} onChange={e => setForm({ ...form, commercialReg: e.target.value })} />
            <Input label="البريد الإلكتروني" type="email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} />
            <Input label="الجوال" value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} />
            <Input label="المدينة" value={form.city} onChange={e => setForm({ ...form, city: e.target.value })} />
            <Input label="اسم المسؤول" value={form.contactName} onChange={e => setForm({ ...form, contactName: e.target.value })} />
            <Input label="جوال المسؤول" value={form.contactPhone} onChange={e => setForm({ ...form, contactPhone: e.target.value })} />
            <Input label="شروط الدفع (يوم)" type="number" value={form.paymentTerms} onChange={e => setForm({ ...form, paymentTerms: e.target.value })} />
            <Input label="حد الائتمان" type="number" value={form.creditLimit} onChange={e => setForm({ ...form, creditLimit: e.target.value })} />
          </div>
          <Input label="العنوان" value={form.address} onChange={e => setForm({ ...form, address: e.target.value })} />
          <div className="flex justify-end gap-3">
            <Button type="button" variant="ghost" onClick={() => setModalOpen(false)}><X className="h-4 w-4" /> إلغاء</Button>
            <Button type="submit">{editing ? 'حفظ التعديلات' : 'إضافة'}</Button>
          </div>
        </form>
      </Modal>

      {/* Statement Modal */}
      <Modal isOpen={!!statementSupplier} onClose={() => { setStatementSupplier(null); setStatement(null); }} title={statementSupplier ? `كشف حساب: ${statementSupplier.name}` : ''}>
        {statementLoading ? (
          <div className="flex items-center justify-center h-48"><div className="w-8 h-8 border-4 border-primary-500/30 border-t-primary-500 rounded-full animate-spin" /></div>
        ) : statement ? (
          <div className="space-y-4">
            <div className="grid grid-cols-3 gap-3">
              <div className="bg-slate-800 rounded-xl p-3 text-center">
                <div className="text-lg font-bold text-white">{Number(statement.totalPurchases).toLocaleString('ar-SA')}</div>
                <div className="text-xs text-slate-500">إجمالي المشتريات</div>
              </div>
              <div className="bg-slate-800 rounded-xl p-3 text-center">
                <div className="text-lg font-bold text-white">{statement.purchaseOrders?.length || 0}</div>
                <div className="text-xs text-slate-500">عدد الطلبات</div>
              </div>
              <div className="bg-slate-800 rounded-xl p-3 text-center">
                <div className="text-lg font-bold text-amber-400">{Number(statement.outstandingBalance).toLocaleString('ar-SA')}</div>
                <div className="text-xs text-slate-500">الرصيد المستحق</div>
              </div>
            </div>
            <div className="scc-card overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-700">
                    <th className="text-right py-2 px-3 text-slate-400">رقم الطلب</th>
                    <th className="text-right py-2 px-3 text-slate-400">التاريخ</th>
                    <th className="text-right py-2 px-3 text-slate-400">المبلغ</th>
                    <th className="text-right py-2 px-3 text-slate-400">الحالة</th>
                  </tr>
                </thead>
                <tbody>
                  {statement.purchaseOrders?.map((po: any) => (
                    <tr key={po.id} className="border-b border-slate-800">
                      <td className="py-2 px-3 text-white font-mono text-xs">{po.poNumber}</td>
                      <td className="py-2 px-3 text-slate-400 text-xs">{new Date(po.createdAt).toLocaleDateString('ar-SA')}</td>
                      <td className="py-2 px-3 text-white">{Number(po.total).toLocaleString('ar-SA')} ر.س</td>
                      <td className="py-2 px-3">
                        <span className={`text-xs px-2 py-0.5 rounded-full ${po.status === 'COMPLETED' ? 'bg-emerald-500/10 text-emerald-400' : po.status === 'DRAFT' ? 'bg-slate-700 text-slate-400' : 'bg-amber-500/10 text-amber-400'}`}>
                          {po.status === 'COMPLETED' ? 'مكتمل' : po.status === 'DRAFT' ? 'مسودة' : 'قيد التنفيذ'}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ) : null}
      </Modal>
    </div>
  );
}
