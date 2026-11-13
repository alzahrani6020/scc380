'use client';

import { useEffect, useState } from 'react';
import { BarChart3, Pencil, Plus, Target, Trash2, X } from 'lucide-react';
import api from '@/lib/api';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import Modal from '@/components/ui/Modal';
import Select from '@/components/ui/Select';

type CostCenter = {
  id: string;
  name: string;
  code?: string | null;
  type: string;
  budget?: number | string | null;
  isActive: boolean;
};

export default function CostCentersPage() {
  const [items, setItems] = useState<CostCenter[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<CostCenter | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [formLoading, setFormLoading] = useState(false);
  const [form, setForm] = useState<any>({});
  const [report, setReport] = useState<any>(null);
  const [reportLoading, setReportLoading] = useState('');

  const load = () => {
    setLoading(true);
    api.get('/finance/cost-centers')
      .then((r) => setItems(r.data?.data || []))
      .catch((err) => alert(err.response?.data?.message || 'تعذر تحميل مراكز التكلفة'))
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const openCreate = () => {
    setEditing(null);
    setForm({ name: '', code: '', type: 'DEPARTMENT', budget: '', isActive: true });
    setFormOpen(true);
  };

  const openEdit = (item: CostCenter) => {
    setEditing(item);
    setForm({
      name: item.name,
      code: item.code || '',
      type: item.type || 'DEPARTMENT',
      budget: item.budget ?? '',
      isActive: item.isActive,
    });
    setFormOpen(true);
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormLoading(true);
    try {
      const payload = {
        name: form.name,
        code: form.code || undefined,
        type: form.type || 'DEPARTMENT',
        budget: form.budget === '' ? null : Number(form.budget),
        isActive: Boolean(form.isActive),
      };
      if (editing) {
        await api.patch(`/finance/cost-centers/${editing.id}`, payload);
      } else {
        await api.post('/finance/cost-centers', payload);
      }
      setFormOpen(false);
      load();
    } catch (err: any) {
      alert(err.response?.data?.message || 'تعذر حفظ مركز التكلفة');
    } finally {
      setFormLoading(false);
    }
  };

  const remove = async (item: CostCenter) => {
    if (!confirm(`حذف مركز التكلفة "${item.name}"؟ لا يمكن حذف مركز له تاريخ محاسبي.`)) return;
    try {
      await api.delete(`/finance/cost-centers/${item.id}`);
      load();
    } catch (err: any) {
      alert(err.response?.data?.message || 'تعذر حذف مركز التكلفة');
    }
  };

  const loadReport = async (item: CostCenter) => {
    setReportLoading(item.id);
    try {
      const r = await api.get(`/finance/cost-centers/${item.id}/report`);
      setReport(r.data);
    } catch (err: any) {
      alert(err.response?.data?.message || 'تعذر تحميل تقرير مركز التكلفة');
    } finally {
      setReportLoading('');
    }
  };

  return (
    <div className="space-y-6 animate-fade-in-up">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <Target className="h-6 w-6 text-primary-400" />
            مراكز التكلفة
          </h1>
          <p className="text-slate-400 text-sm mt-1">
            إدارة الأبعاد المحاسبية وقياس المصروف الفعلي مقابل الميزانية
          </p>
        </div>
        <Button onClick={openCreate}><Plus className="h-5 w-5" /> مركز جديد</Button>
      </div>

      <div className="bg-slate-900 rounded-xl border border-slate-800 overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-700 bg-slate-800/50 text-slate-400">
              <th className="p-3 text-right">المركز</th>
              <th className="p-3 text-center">الرمز</th>
              <th className="p-3 text-center">النوع</th>
              <th className="p-3 text-center">الميزانية</th>
              <th className="p-3 text-center">الحالة</th>
              <th className="p-3 text-center">الإجراءات</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={6} className="p-8 text-center text-slate-500">جارٍ التحميل...</td></tr>
            ) : items.length === 0 ? (
              <tr><td colSpan={6} className="p-8 text-center text-slate-500">لا توجد مراكز تكلفة</td></tr>
            ) : items.map((item) => (
              <tr key={item.id} className="border-b border-slate-800/50">
                <td className="p-3 text-white font-medium">{item.name}</td>
                <td className="p-3 text-center text-slate-300">{item.code || '—'}</td>
                <td className="p-3 text-center text-slate-300">{item.type}</td>
                <td className="p-3 text-center text-slate-300">
                  {item.budget == null ? '—' : `${Number(item.budget).toLocaleString()} ر.س`}
                </td>
                <td className="p-3 text-center">
                  <span className={`px-2 py-1 rounded-full text-xs ${item.isActive ? 'bg-emerald-500/15 text-emerald-400' : 'bg-slate-700 text-slate-400'}`}>
                    {item.isActive ? 'نشط' : 'غير نشط'}
                  </span>
                </td>
                <td className="p-3">
                  <div className="flex justify-center gap-2">
                    <button onClick={() => loadReport(item)} disabled={reportLoading === item.id} className="p-2 text-cyan-400 hover:bg-cyan-500/10 rounded-lg" title="التقرير"><BarChart3 className="h-4 w-4" /></button>
                    <button onClick={() => openEdit(item)} className="p-2 text-primary-400 hover:bg-primary-500/10 rounded-lg" title="تعديل"><Pencil className="h-4 w-4" /></button>
                    <button onClick={() => remove(item)} className="p-2 text-red-400 hover:bg-red-500/10 rounded-lg" title="حذف"><Trash2 className="h-4 w-4" /></button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {report && (
        <div className="bg-slate-900 rounded-xl border border-slate-800 p-5 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-white font-bold">تقرير: {report.costCenter?.name}</h2>
              <p className="text-slate-400 text-sm">{report.lineCount} سطر محاسبي مرحّل</p>
            </div>
            <button onClick={() => setReport(null)} className="text-slate-400 hover:text-white"><X className="h-5 w-5" /></button>
          </div>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <div className="scc-card-hover"><p className="text-slate-400 text-xs">المصروف الفعلي</p><p className="text-white font-bold">{Number(report.totals?.expenseActual || 0).toLocaleString()} ر.س</p></div>
            <div className="scc-card-hover"><p className="text-slate-400 text-xs">الميزانية</p><p className="text-white font-bold">{report.totals?.budget == null ? '—' : `${Number(report.totals.budget).toLocaleString()} ر.س`}</p></div>
            <div className="scc-card-hover"><p className="text-slate-400 text-xs">المتبقي / الانحراف</p><p className="text-white font-bold">{report.totals?.budgetVariance == null ? '—' : `${Number(report.totals.budgetVariance).toLocaleString()} ر.س`}</p></div>
            <div className="scc-card-hover"><p className="text-slate-400 text-xs">نسبة الاستخدام</p><p className="text-white font-bold">{report.totals?.budgetUsagePct == null ? '—' : `${report.totals.budgetUsagePct}%`}</p></div>
          </div>
        </div>
      )}

      <Modal isOpen={formOpen} onClose={() => setFormOpen(false)} title={editing ? 'تعديل مركز التكلفة' : 'مركز تكلفة جديد'}>
        <form onSubmit={submit} className="space-y-4">
          <Input label="الاسم" required value={form.name || ''} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          <Input label="الرمز" value={form.code || ''} onChange={(e) => setForm({ ...form, code: e.target.value })} />
          <Select label="النوع" value={form.type || 'DEPARTMENT'} onChange={(e) => setForm({ ...form, type: e.target.value })} options={[
            { value: 'DEPARTMENT', label: 'إدارة / قسم' },
            { value: 'PROJECT', label: 'مشروع' },
            { value: 'BRANCH', label: 'فرع' },
            { value: 'ACTIVITY', label: 'نشاط' },
          ]} />
          <Input label="الميزانية" type="number" value={form.budget ?? ''} onChange={(e) => setForm({ ...form, budget: e.target.value })} />
          <label className="flex items-center gap-2 text-sm text-slate-300">
            <input type="checkbox" checked={Boolean(form.isActive)} onChange={(e) => setForm({ ...form, isActive: e.target.checked })} />
            نشط
          </label>
          <div className="flex justify-end gap-3">
            <Button type="button" variant="ghost" onClick={() => setFormOpen(false)}>إلغاء</Button>
            <Button type="submit" isLoading={formLoading}>حفظ</Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
