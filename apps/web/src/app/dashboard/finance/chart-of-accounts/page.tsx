'use client';

import { useEffect, useState } from 'react';
import api from '@/lib/api';
import { Landmark, Plus, Pencil, Trash2, X } from 'lucide-react';
import Modal from '@/components/ui/Modal';
import Input from '@/components/ui/Input';
import Select from '@/components/ui/Select';
import Button from '@/components/ui/Button';

const accountTypes = [
  { value: 'ASSET', label: 'أصل' },
  { value: 'LIABILITY', label: 'خصم' },
  { value: 'EQUITY', label: 'حقوق ملكية' },
  { value: 'REVENUE', label: 'إيراد' },
  { value: 'EXPENSE', label: 'مصروف' },
];

const typeColors: Record<string, string> = {
  ASSET: 'bg-blue-500/20 text-blue-400',
  LIABILITY: 'bg-red-500/20 text-red-400',
  EQUITY: 'bg-green-500/20 text-green-400',
  REVENUE: 'bg-emerald-500/20 text-emerald-400',
  EXPENSE: 'bg-amber-500/20 text-amber-400',
};

const typeLabels: Record<string, string> = {
  ASSET: 'أصل',
  LIABILITY: 'خصم',
  EQUITY: 'حقوق ملكية',
  REVENUE: 'إيراد',
  EXPENSE: 'مصروف',
};

export default function ChartOfAccountsPage() {
  const [accounts, setAccounts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [formLoading, setFormLoading] = useState(false);
  const [formData, setFormData] = useState<any>({});

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = () => {
    api.get('/finance/chart-of-accounts')
      .then(r => setAccounts(r.data?.data || []))
      .catch(console.error)
      .finally(() => setLoading(false));
  };

  const openCreate = () => {
    setEditing(null);
    setFormData({ type: 'ASSET', isActive: true, balance: 0 });
    setIsModalOpen(true);
  };

  const openEdit = (item: any) => {
    setEditing(item);
    setFormData({ ...item, balance: item.balance || 0 });
    setIsModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormLoading(true);
    try {
      const payload = {
        ...formData,
        balance: parseFloat(formData.balance) || 0,
      };
      if (editing) {
        await api.patch(`/finance/chart-of-accounts/${editing.id}`, payload);
      } else {
        await api.post('/finance/chart-of-accounts', payload);
      }
      setIsModalOpen(false);
      fetchData();
    } catch (err: any) {
      alert(err.response?.data?.message || 'حدث خطأ');
    } finally {
      setFormLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('هل أنت متأكد من حذف هذا الحساب؟')) return;
    await api.delete(`/finance/chart-of-accounts/${id}`);
    fetchData();
  };

  const parentOptions = accounts.filter(a => a.id !== editing?.id).map(a => ({ value: a.id, label: `${a.code} — ${a.name}` }));

  return (
    <div className="space-y-6 animate-fade-in-up">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <Landmark className="h-6 w-6 text-primary-400" />
            دليل الحسابات
          </h1>
          <p className="text-slate-400 text-sm mt-1">شجرة الحسابات المحاسبية</p>
        </div>
        <Button onClick={openCreate}><Plus className="h-5 w-5" /> حساب جديد</Button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-64">
          <div className="w-10 h-10 border-4 border-primary-500/30 border-t-primary-500 rounded-full animate-spin" />
        </div>
      ) : (
        <div className="bg-slate-900 rounded-xl border border-slate-800 overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-700 text-slate-400 bg-slate-800/50">
                <th className="text-right p-3">الكود</th>
                <th className="text-right p-3">اسم الحساب</th>
                <th className="text-center p-3">النوع</th>
                <th className="text-left p-3">الرصيد</th>
                <th className="text-center p-3">الحالة</th>
                <th className="text-center p-3"></th>
              </tr>
            </thead>
            <tbody>
              {accounts.map((acc) => (
                <tr key={acc.id} className="border-b border-slate-800/50 hover:bg-slate-800/30">
                  <td className="p-3 font-mono text-primary-400">{acc.code}</td>
                  <td className="p-3">
                    <span className="font-medium">{acc.name}</span>
                    {acc.parentId && <span className="text-slate-500 text-xs mr-2">(فرعي)</span>}
                  </td>
                  <td className="p-3 text-center">
                    <span className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-medium ${typeColors[acc.type] || 'bg-slate-500/20 text-slate-400'}`}>
                      {typeLabels[acc.type] || acc.type}
                    </span>
                  </td>
                  <td className="p-3 text-left">{Number(acc.balance || 0).toLocaleString()}</td>
                  <td className="p-3 text-center">
                    <span className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-medium ${
                      acc.isActive !== false ? 'bg-emerald-500/20 text-emerald-400' : 'bg-slate-500/20 text-slate-400'
                    }`}>{acc.isActive !== false ? 'نشط' : 'معطل'}</span>
                  </td>
                  <td className="p-3 text-center">
                    <div className="flex items-center justify-center gap-1">
                      <button onClick={() => openEdit(acc)} className="p-1.5 rounded-lg hover:bg-primary-500/10 text-primary-400"><Pencil className="h-4 w-4" /></button>
                      <button onClick={() => handleDelete(acc.id)} className="p-1.5 rounded-lg hover:bg-red-500/10 text-red-400"><Trash2 className="h-4 w-4" /></button>
                    </div>
                  </td>
                </tr>
              ))}
              {accounts.length === 0 && (
                <tr><td colSpan={6} className="p-8 text-center text-slate-500">لا توجد حسابات</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title={editing ? 'تعديل حساب' : 'حساب جديد'}>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Input label="الكود" required value={formData.code || ''} onChange={e => setFormData({ ...formData, code: e.target.value })} />
            <Input label="اسم الحساب" required value={formData.name || ''} onChange={e => setFormData({ ...formData, name: e.target.value })} />
          </div>
          <Select label="النوع" required options={accountTypes} value={formData.type || 'ASSET'} onChange={e => setFormData({ ...formData, type: e.target.value })} />
          <Select label="الحساب الأب (اختياري)" options={[{ value: '', label: 'لا يوجد' }, ...parentOptions]} value={formData.parentId || ''} onChange={e => setFormData({ ...formData, parentId: e.target.value || undefined })} />
          <Input label="الرصيد الافتتاحي" type="number" value={formData.balance || ''} onChange={e => setFormData({ ...formData, balance: e.target.value })} />
          <div className="flex items-center gap-2">
            <input type="checkbox" id="isActive" checked={formData.isActive !== false} onChange={e => setFormData({ ...formData, isActive: e.target.checked })} className="rounded" />
            <label htmlFor="isActive" className="text-sm text-slate-300">حساب نشط</label>
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <Button type="button" variant="ghost" onClick={() => setIsModalOpen(false)}><X className="h-4 w-4" /> إلغاء</Button>
            <Button type="submit" isLoading={formLoading}>{editing ? 'حفظ' : 'إنشاء'}</Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
