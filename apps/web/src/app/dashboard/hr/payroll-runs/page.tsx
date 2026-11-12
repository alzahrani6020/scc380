'use client';

import { useEffect, useState } from 'react';
import api from '@/lib/api';
import { Wallet, Plus, CheckCircle2, CreditCard, Pencil, Trash2, X } from 'lucide-react';
import Modal from '@/components/ui/Modal';
import Input from '@/components/ui/Input';
import Button from '@/components/ui/Button';

export default function PayrollRunsPage() {
  const now = new Date();
  const [runs, setRuns] = useState<any[]>([]);
  const [selected, setSelected] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [createOpen, setCreateOpen] = useState(false);
  const [createData, setCreateData] = useState<any>({ year: now.getFullYear(), month: now.getMonth() + 1, notes: '' });
  const [editingItem, setEditingItem] = useState<any>(null);
  const [itemData, setItemData] = useState<any>({});

  useEffect(() => { refresh(); }, []);

  const refresh = async () => {
    setLoading(true);
    try {
      const r = await api.get('/hr/payroll-runs');
      setRuns(r.data.data || []);
      if (selected?.id) {
        const detail = await api.get(`/hr/payroll-runs/${selected.id}`);
        setSelected(detail.data);
      }
    } finally {
      setLoading(false);
    }
  };

  const openRun = async (id: string) => {
    const r = await api.get(`/hr/payroll-runs/${id}`);
    setSelected(r.data);
  };

  const createRun = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const r = await api.post('/hr/payroll-runs', {
        year: Number(createData.year),
        month: Number(createData.month),
        notes: createData.notes || undefined,
      });
      setCreateOpen(false);
      await refresh();
      setSelected(r.data);
    } catch (err: any) {
      alert(err.response?.data?.message || 'تعذر إنشاء المسير');
    }
  };

  const openEditItem = (item: any) => {
    setEditingItem(item);
    setItemData({
      basicSalary: item.basicSalary,
      housingAllowance: item.housingAllowance,
      transportAllowance: item.transportAllowance,
      otherAllowances: item.otherAllowances,
      gosiDeduction: item.gosiDeduction,
      taxDeduction: item.taxDeduction,
      otherDeductions: item.otherDeductions,
      notes: item.notes || '',
    });
  };

  const saveItem = async (e: React.FormEvent) => {
    e.preventDefault();
    const numeric = (v: any) => Number(v || 0);
    try {
      await api.patch(`/hr/payroll-runs/${selected.id}/items/${editingItem.id}`, {
        basicSalary: numeric(itemData.basicSalary),
        housingAllowance: numeric(itemData.housingAllowance),
        transportAllowance: numeric(itemData.transportAllowance),
        otherAllowances: numeric(itemData.otherAllowances),
        gosiDeduction: numeric(itemData.gosiDeduction),
        taxDeduction: numeric(itemData.taxDeduction),
        otherDeductions: numeric(itemData.otherDeductions),
        notes: itemData.notes || undefined,
      });
      setEditingItem(null);
      await openRun(selected.id);
      await refresh();
    } catch (err: any) {
      alert(err.response?.data?.message || 'تعذر تعديل بند الراتب');
    }
  };

  const approve = async () => {
    if (!confirm('اعتماد المسير سيقفل جميع بنوده. متابعة؟')) return;
    try {
      await api.post(`/hr/payroll-runs/${selected.id}/approve`, {});
      await openRun(selected.id);
      await refresh();
    } catch (err: any) {
      alert(err.response?.data?.message || 'تعذر اعتماد المسير');
    }
  };

  const pay = async () => {
    if (!confirm('سيتم إنشاء سجلات الرواتب الفردية وتسجيل المسير كمدفوع. متابعة؟')) return;
    try {
      await api.post(`/hr/payroll-runs/${selected.id}/pay`, {});
      await openRun(selected.id);
      await refresh();
    } catch (err: any) {
      alert(err.response?.data?.message || 'تعذر تسجيل دفع المسير');
    }
  };

  const remove = async (id: string) => {
    if (!confirm('حذف مسودة المسير؟')) return;
    await api.delete(`/hr/payroll-runs/${id}`);
    if (selected?.id === id) setSelected(null);
    await refresh();
  };

  const money = (v: any) => Number(v || 0).toLocaleString('ar-SA');

  return (
    <div className="space-y-6 animate-fade-in-up">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2"><Wallet className="h-6 w-6 text-primary-400" /> مسيرات الرواتب</h1>
          <p className="text-slate-400 text-sm mt-1">إعداد واعتماد وإقفال مسير شهري لجميع الموظفين المؤهلين</p>
        </div>
        <Button onClick={() => setCreateOpen(true)}><Plus className="h-4 w-4" /> مسير جديد</Button>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-[360px_1fr] gap-4">
        <div className="scc-card space-y-3">
          <h2 className="text-white font-semibold">المسيرات</h2>
          {loading ? <p className="text-slate-500">جاري التحميل...</p> :
            runs.length === 0 ? <p className="text-slate-500 text-sm">لا توجد مسيرات بعد.</p> :
            runs.map(run => (
              <button key={run.id} onClick={() => openRun(run.id)} className={`w-full text-right rounded-xl border p-4 transition-colors ${selected?.id === run.id ? 'border-primary-500/60 bg-primary-500/10' : 'border-slate-800 bg-slate-900/50 hover:border-slate-700'}`}>
                <div className="flex justify-between gap-3">
                  <span className="text-white font-bold">{run.month}/{run.year}</span>
                  <span className="text-xs text-slate-400">{run.status}</span>
                </div>
                <p className="text-slate-400 text-sm mt-2">{run.employeeCount} موظف · صافي {money(run.netTotal)} ر.س</p>
                {run.status === 'DRAFT' && <span onClick={(e) => { e.stopPropagation(); remove(run.id); }} className="inline-flex mt-2 text-red-400 text-xs"><Trash2 className="h-3 w-3 ml-1" /> حذف المسودة</span>}
              </button>
            ))
          }
        </div>

        <div className="scc-card">
          {!selected ? <div className="py-16 text-center text-slate-500">اختر مسيرًا لعرض تفاصيله.</div> :
            <div className="space-y-5">
              <div className="flex items-start justify-between gap-3 flex-wrap">
                <div>
                  <h2 className="text-xl font-bold text-white">مسير {selected.month}/{selected.year}</h2>
                  <p className="text-slate-400 text-sm mt-1">{selected.employeeCount} موظف · الحالة {selected.status}</p>
                </div>
                <div className="flex gap-2">
                  {selected.status === 'DRAFT' && <Button onClick={approve}><CheckCircle2 className="h-4 w-4" /> اعتماد</Button>}
                  {selected.status === 'APPROVED' && <Button onClick={pay}><CreditCard className="h-4 w-4" /> تسجيل الدفع</Button>}
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div className="rounded-xl bg-slate-800/60 p-4"><p className="text-slate-500 text-xs">إجمالي الاستحقاقات</p><p className="text-white font-bold mt-1">{money(selected.grossTotal)} ر.س</p></div>
                <div className="rounded-xl bg-slate-800/60 p-4"><p className="text-slate-500 text-xs">إجمالي الخصومات</p><p className="text-amber-400 font-bold mt-1">{money(selected.deductionTotal)} ر.س</p></div>
                <div className="rounded-xl bg-slate-800/60 p-4"><p className="text-slate-500 text-xs">صافي المسير</p><p className="text-emerald-400 font-bold mt-1">{money(selected.netTotal)} ر.س</p></div>
              </div>

              <div className="overflow-x-auto rounded-xl border border-slate-800">
                <table className="w-full text-sm">
                  <thead><tr className="bg-slate-800/60 text-slate-400">
                    <th className="p-3 text-right">الموظف</th><th className="p-3 text-left">أساسي</th><th className="p-3 text-left">بدلات</th><th className="p-3 text-left">خصومات</th><th className="p-3 text-left">صافي</th><th className="p-3"></th>
                  </tr></thead>
                  <tbody>
                    {(selected.items || []).map((item: any) => (
                      <tr key={item.id} className="border-t border-slate-800">
                        <td className="p-3"><p className="text-white">{item.employeeName}</p><p className="text-slate-500 text-xs">{item.employeeCode}</p></td>
                        <td className="p-3 text-left">{money(item.basicSalary)}</td>
                        <td className="p-3 text-left">{money(Number(item.housingAllowance)+Number(item.transportAllowance)+Number(item.otherAllowances))}</td>
                        <td className="p-3 text-left text-amber-400">{money(item.totalDeductions)}</td>
                        <td className="p-3 text-left text-emerald-400 font-bold">{money(item.netSalary)}</td>
                        <td className="p-3 text-center">{selected.status === 'DRAFT' && <button onClick={() => openEditItem(item)} className="p-2 text-primary-400"><Pencil className="h-4 w-4" /></button>}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p className="text-xs text-slate-500">الخصومات النظامية لا تُحتسب تلقائيًا دون قاعدة معتمدة؛ يجب مراجعتها وتسجيلها قبل اعتماد المسير.</p>
            </div>
          }
        </div>
      </div>

      <Modal isOpen={createOpen} onClose={() => setCreateOpen(false)} title="إنشاء مسير رواتب">
        <form onSubmit={createRun} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <Input label="الشهر" type="number" min="1" max="12" required value={createData.month} onChange={e => setCreateData({ ...createData, month: e.target.value })} />
            <Input label="السنة" type="number" required value={createData.year} onChange={e => setCreateData({ ...createData, year: e.target.value })} />
          </div>
          <Input label="ملاحظات" value={createData.notes} onChange={e => setCreateData({ ...createData, notes: e.target.value })} />
          <div className="flex justify-end gap-3"><Button type="button" variant="ghost" onClick={() => setCreateOpen(false)}><X className="h-4 w-4" /> إلغاء</Button><Button type="submit">إنشاء المسير</Button></div>
        </form>
      </Modal>

      <Modal isOpen={!!editingItem} onClose={() => setEditingItem(null)} title="تعديل بند الراتب" size="lg">
        <form onSubmit={saveItem} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <Input label="الراتب الأساسي" type="number" value={itemData.basicSalary || 0} onChange={e => setItemData({ ...itemData, basicSalary: e.target.value })} />
            <Input label="بدل السكن" type="number" value={itemData.housingAllowance || 0} onChange={e => setItemData({ ...itemData, housingAllowance: e.target.value })} />
            <Input label="بدل النقل" type="number" value={itemData.transportAllowance || 0} onChange={e => setItemData({ ...itemData, transportAllowance: e.target.value })} />
            <Input label="بدلات أخرى" type="number" value={itemData.otherAllowances || 0} onChange={e => setItemData({ ...itemData, otherAllowances: e.target.value })} />
            <Input label="خصم التأمينات" type="number" value={itemData.gosiDeduction || 0} onChange={e => setItemData({ ...itemData, gosiDeduction: e.target.value })} />
            <Input label="خصم الضريبة" type="number" value={itemData.taxDeduction || 0} onChange={e => setItemData({ ...itemData, taxDeduction: e.target.value })} />
            <Input label="خصومات أخرى" type="number" value={itemData.otherDeductions || 0} onChange={e => setItemData({ ...itemData, otherDeductions: e.target.value })} />
            <Input label="ملاحظات" value={itemData.notes || ''} onChange={e => setItemData({ ...itemData, notes: e.target.value })} />
          </div>
          <div className="flex justify-end gap-3"><Button type="button" variant="ghost" onClick={() => setEditingItem(null)}><X className="h-4 w-4" /> إلغاء</Button><Button type="submit">حفظ</Button></div>
        </form>
      </Modal>
    </div>
  );
}
