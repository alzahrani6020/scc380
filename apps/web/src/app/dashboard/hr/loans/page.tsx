'use client';

import { useEffect, useMemo, useState } from 'react';
import api from '@/lib/api';
import { Banknote, CheckCircle2, Plus, RotateCcw, X } from 'lucide-react';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import Modal from '@/components/ui/Modal';
import Select from '@/components/ui/Select';

export default function EmployeeLoansPage() {
  const [items, setItems] = useState<any[]>([]);
  const [employees, setEmployees] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<any>({ type: 'LOAN', startDate: new Date().toISOString().split('T')[0] });

  const load = () => {
    setLoading(true);
    Promise.all([
      api.get('/hr/employee-loans').then(r => setItems(r.data.data || [])),
      api.get('/hr/employees?limit=200').then(r => setEmployees(r.data.data || [])),
    ]).catch(console.error).finally(() => setLoading(false));
  };
  useEffect(() => { load(); }, []);

  const employeeOptions = useMemo(() => employees.map(e => ({
    value: e.id, label: `${e.firstName} ${e.lastName} · ${e.employeeCode}`
  })), [employees]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await api.post('/hr/employee-loans', {
        employeeId: form.employeeId,
        type: form.type,
        principal: Number(form.principal),
        installmentAmount: Number(form.installmentAmount),
        startDate: form.startDate,
        notes: form.notes || undefined,
      });
      setOpen(false);
      setForm({ type: 'LOAN', startDate: new Date().toISOString().split('T')[0] });
      load();
    } catch (err: any) {
      alert(err?.response?.data?.message || 'تعذر إنشاء السلفة/القرض');
    } finally { setSaving(false); }
  };

  const approve = async (id: string) => {
    if (!confirm('اعتماد القرض وبدء الخصم من مسيرات الرواتب اللاحقة؟')) return;
    await api.post(`/hr/employee-loans/${id}/approve`, {});
    load();
  };
  const repay = async (item: any) => {
    const raw = prompt(`قيمة السداد اليدوي — الرصيد الحالي ${Number(item.balance).toLocaleString('ar-SA')} ر.س`);
    if (!raw) return;
    const amount = Number(raw);
    if (!Number.isFinite(amount) || amount <= 0) return alert('أدخل مبلغًا صحيحًا');
    await api.post(`/hr/employee-loans/${item.id}/repay`, { amount });
    load();
  };

  return (
    <div className="space-y-6 animate-fade-in-up">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2"><Banknote className="h-6 w-6 text-primary-400" /> السلف والقروض</h1>
          <p className="text-slate-400 text-sm mt-1">أقساط مرتبطة آليًا بمسير الرواتب مع سجل سداد ورصيد فعلي.</p>
        </div>
        <Button onClick={() => setOpen(true)}><Plus className="h-4 w-4" /> طلب جديد</Button>
      </div>

      {loading ? <div className="scc-card py-12 text-center text-slate-400">جاري التحميل...</div> :
        items.length === 0 ? <div className="scc-card py-12 text-center text-slate-400">لا توجد سلف أو قروض.</div> :
        <div className="space-y-3">
          {items.map(item => (
            <div key={item.id} className="scc-card-hover flex items-center justify-between gap-4">
              <div>
                <div className="text-white font-semibold">{item.employee?.firstName} {item.employee?.lastName}</div>
                <div className="text-slate-400 text-sm">{item.type === 'ADVANCE' ? 'سلفة' : 'قرض'} · الأصل {Number(item.principal).toLocaleString('ar-SA')} ر.س</div>
                <div className="text-slate-500 text-xs mt-1">القسط {Number(item.installmentAmount).toLocaleString('ar-SA')} · الرصيد {Number(item.balance).toLocaleString('ar-SA')} ر.س</div>
              </div>
              <div className="flex items-center gap-2 flex-wrap justify-end">
                <span className="px-2 py-1 rounded-full bg-slate-800 text-slate-300 text-xs">{item.status}</span>
                {item.status === 'DRAFT' && <Button size="sm" onClick={() => approve(item.id)}><CheckCircle2 className="h-3 w-3" /> اعتماد</Button>}
                {item.status === 'ACTIVE' && <Button size="sm" variant="ghost" onClick={() => repay(item)}><RotateCcw className="h-3 w-3" /> سداد يدوي</Button>}
              </div>
            </div>
          ))}
        </div>
      }

      <Modal isOpen={open} onClose={() => setOpen(false)} title="سلفة / قرض موظف" size="lg">
        <form onSubmit={submit} className="space-y-4">
          <Select label="الموظف" required options={employeeOptions} value={form.employeeId || ''} onChange={e => setForm({ ...form, employeeId: e.target.value })} />
          <Select label="النوع" options={[{ value: 'LOAN', label: 'قرض' }, { value: 'ADVANCE', label: 'سلفة' }]} value={form.type} onChange={e => setForm({ ...form, type: e.target.value })} />
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Input label="المبلغ الأصلي" type="number" required value={form.principal || ''} onChange={e => setForm({ ...form, principal: e.target.value })} />
            <Input label="قيمة القسط" type="number" required value={form.installmentAmount || ''} onChange={e => setForm({ ...form, installmentAmount: e.target.value })} />
            <Input label="تاريخ بدء الخصم" type="date" required value={form.startDate || ''} onChange={e => setForm({ ...form, startDate: e.target.value })} />
            <Input label="ملاحظات" value={form.notes || ''} onChange={e => setForm({ ...form, notes: e.target.value })} />
          </div>
          <div className="flex justify-end gap-3">
            <Button type="button" variant="ghost" onClick={() => setOpen(false)}><X className="h-4 w-4" /> إلغاء</Button>
            <Button type="submit" isLoading={saving}>حفظ كمسودة</Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
