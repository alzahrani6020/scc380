'use client';

import { useEffect, useState } from 'react';
import api from '@/lib/api';
import { BookOpen, Plus, Pencil, Trash2, X, Search, Filter } from 'lucide-react';
import Modal from '@/components/ui/Modal';
import Input from '@/components/ui/Input';
import Select from '@/components/ui/Select';
import Button from '@/components/ui/Button';

const jeTypes = [
  { value: 'GENERAL', label: 'عام' },
  { value: 'ADJUSTING', label: 'تسوية' },
  { value: 'CLOSING', label: 'إقفال' },
  { value: 'REVERSING', label: 'عكسي' },
];

const jeStatuses = [
  { value: 'DRAFT', label: 'مسودة' },
  { value: 'POSTED', label: 'مرحّل' },
  { value: 'REVERSED', label: 'مقلوب' },
];

export default function JournalEntriesPage() {
  const [entries, setEntries] = useState<any[]>([]);
  const [accounts, setAccounts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterType, setFilterType] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [formLoading, setFormLoading] = useState(false);
  const [formData, setFormData] = useState<any>({});

  useEffect(() => {
    fetchData();
    api.get('/finance/chart-of-accounts').then(r => setAccounts(r.data?.data || [])).catch(() => {});
  }, []);

  const fetchData = () => {
    const params: any = {};
    if (filterType) params.type = filterType;
    if (filterStatus) params.status = filterStatus;
    api.get('/finance/journal-entries', { params })
      .then(r => setEntries(r.data?.data || []))
      .catch(console.error)
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchData();
  }, [filterType, filterStatus]);

  const openCreate = () => {
    setEditing(null);
    setFormData({ type: 'GENERAL', status: 'DRAFT', date: new Date().toISOString().split('T')[0], debitAmount: 0, creditAmount: 0 });
    setIsModalOpen(true);
  };

  const openEdit = (item: any) => {
    setEditing(item);
    setFormData({
      ...item,
      date: item.date ? new Date(item.date).toISOString().split('T')[0] : '',
      debitAmount: item.debitAmount || 0,
      creditAmount: item.creditAmount || 0,
    });
    setIsModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormLoading(true);
    try {
      const payload = {
        ...formData,
        debitAmount: parseFloat(formData.debitAmount) || 0,
        creditAmount: parseFloat(formData.creditAmount) || 0,
      };
      if (editing) {
        await api.patch(`/finance/journal-entries/${editing.id}`, payload);
      } else {
        await api.post('/finance/journal-entries', payload);
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
    if (!confirm('هل أنت متأكد من حذف هذا القيد؟')) return;
    await api.delete(`/finance/journal-entries/${id}`);
    fetchData();
  };

  const filtered = entries.filter(e =>
    e.entryNumber?.includes(search) ||
    e.description?.includes(search) ||
    e.reference?.includes(search)
  );

  const accountOptions = accounts.map(a => ({ value: a.id, label: `${a.code} — ${a.name}` }));

  return (
    <div className="space-y-6 animate-fade-in-up">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <BookOpen className="h-6 w-6 text-primary-400" />
            القيود اليومية
          </h1>
          <p className="text-slate-400 text-sm mt-1">إدارة القيود المحاسبية والتسويات</p>
        </div>
        <Button onClick={openCreate}><Plus className="h-5 w-5" /> قيد جديد</Button>
      </div>

      <div className="flex flex-col md:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-500" />
          <input type="text" placeholder="بحث برقم القيد أو الوصف..." className="scc-input pr-10 w-full" value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <div className="flex gap-2">
          <select value={filterType} onChange={e => setFilterType(e.target.value)} className="bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white">
            <option value="">كل الأنواع</option>
            {jeTypes.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
          </select>
          <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)} className="bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white">
            <option value="">كل الحالات</option>
            {jeStatuses.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
          </select>
        </div>
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
                <th className="text-right p-3">رقم القيد</th>
                <th className="text-right p-3">التاريخ</th>
                <th className="text-right p-3">الوصف</th>
                <th className="text-right p-3">الحساب</th>
                <th className="text-left p-3">مدين</th>
                <th className="text-left p-3">دائن</th>
                <th className="text-center p-3">الحالة</th>
                <th className="text-center p-3"></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((entry) => {
                const acc = accounts.find(a => a.id === entry.accountId);
                const statusLabel = jeStatuses.find(s => s.value === entry.status)?.label || entry.status;
                return (
                  <tr key={entry.id} className="border-b border-slate-800/50 hover:bg-slate-800/30">
                    <td className="p-3 font-mono text-primary-400">{entry.entryNumber}</td>
                    <td className="p-3">{entry.date ? new Date(entry.date).toLocaleDateString('ar-SA') : '—'}</td>
                    <td className="p-3">{entry.description}</td>
                    <td className="p-3 text-slate-400">{acc ? `${acc.code} ${acc.name}` : '—'}</td>
                    <td className="p-3 text-left text-emerald-400">{entry.debitAmount > 0 ? entry.debitAmount.toLocaleString() : ''}</td>
                    <td className="p-3 text-left text-red-400">{entry.creditAmount > 0 ? entry.creditAmount.toLocaleString() : ''}</td>
                    <td className="p-3 text-center">
                      <span className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-medium ${
                        entry.status === 'POSTED' ? 'bg-emerald-500/20 text-emerald-400' :
                        entry.status === 'DRAFT' ? 'bg-amber-500/20 text-amber-400' :
                        'bg-red-500/20 text-red-400'
                      }`}>{statusLabel}</span>
                    </td>
                    <td className="p-3 text-center">
                      <div className="flex items-center justify-center gap-1">
                        <button onClick={() => openEdit(entry)} className="p-1.5 rounded-lg hover:bg-primary-500/10 text-primary-400"><Pencil className="h-4 w-4" /></button>
                        <button onClick={() => handleDelete(entry.id)} className="p-1.5 rounded-lg hover:bg-red-500/10 text-red-400"><Trash2 className="h-4 w-4" /></button>
                      </div>
                    </td>
                  </tr>
                );
              })}
              {filtered.length === 0 && (
                <tr><td colSpan={8} className="p-8 text-center text-slate-500">لا توجد قيود</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title={editing ? 'تعديل قيد' : 'قيد جديد'} size="xl">
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Input label="رقم القيد" required value={formData.entryNumber || ''} onChange={e => setFormData({ ...formData, entryNumber: e.target.value })} />
            <Input label="التاريخ" type="date" required value={formData.date || ''} onChange={e => setFormData({ ...formData, date: e.target.value })} />
            <Select label="الحالة" options={jeStatuses} value={formData.status || 'DRAFT'} onChange={e => setFormData({ ...formData, status: e.target.value })} />
          </div>
          <Input label="الوصف" required value={formData.description || ''} onChange={e => setFormData({ ...formData, description: e.target.value })} />
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Select label="الحساب" required options={accountOptions} value={formData.accountId || ''} onChange={e => setFormData({ ...formData, accountId: e.target.value })} />
            <Input label="مدين" type="number" value={formData.debitAmount || ''} onChange={e => setFormData({ ...formData, debitAmount: e.target.value })} />
            <Input label="دائن" type="number" value={formData.creditAmount || ''} onChange={e => setFormData({ ...formData, creditAmount: e.target.value })} />
          </div>
          <Input label="المرجع" value={formData.reference || ''} onChange={e => setFormData({ ...formData, reference: e.target.value })} />
          <Select label="نوع القيد" options={jeTypes} value={formData.type || 'GENERAL'} onChange={e => setFormData({ ...formData, type: e.target.value })} />
          <div className="flex justify-end gap-3 pt-2">
            <Button type="button" variant="ghost" onClick={() => setIsModalOpen(false)}><X className="h-4 w-4" /> إلغاء</Button>
            <Button type="submit" isLoading={formLoading}>{editing ? 'حفظ' : 'إنشاء'}</Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
