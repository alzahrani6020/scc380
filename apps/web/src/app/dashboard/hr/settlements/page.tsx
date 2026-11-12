'use client';

import { useEffect, useMemo, useState } from 'react';
import api from '@/lib/api';
import { Calculator, CheckCircle2, ReceiptText, WalletCards, X } from 'lucide-react';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import Modal from '@/components/ui/Modal';
import Select from '@/components/ui/Select';

const reasons = [
  ['RESIGNATION','استقالة'],
  ['EMPLOYER_TERMINATION','إنهاء من صاحب العمل'],
  ['CONTRACT_EXPIRY','انتهاء العقد'],
  ['MUTUAL','اتفاق الطرفين'],
  ['FORCE_MAJEURE','قوة قاهرة'],
  ['ARTICLE_80','إنهاء وفق المادة 80'],
  ['ARTICLE_81','ترك العمل وفق المادة 81'],
  ['PROBATION','إنهاء أثناء التجربة'],
  ['STATUTORY_FULL_AWARD','استحقاق نظامي كامل'],
  ['OTHER','سبب آخر'],
].map(([value,label]) => ({ value, label }));

export default function EndServiceSettlementsPage() {
  const [items, setItems] = useState<any[]>([]);
  const [employees, setEmployees] = useState<any[]>([]);
  const [preview, setPreview] = useState<any>(null);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState<any>({
    reason: 'RESIGNATION', initiatedBy: 'EMPLOYEE',
    lastWorkingDate: new Date().toISOString().split('T')[0],
    deductOutstandingLoans: true,
  });

  const load = () => Promise.all([
    api.get('/hr/end-service-settlements').then(r => setItems(r.data.data || [])),
    api.get('/hr/employees?limit=200').then(r => setEmployees(r.data.data || [])),
  ]).catch(console.error);
  useEffect(() => { load(); }, []);

  const employeeOptions = useMemo(() => employees.map(e => ({
    value: e.id, label: `${e.firstName} ${e.lastName} · ${e.employeeCode}`
  })), [employees]);

  const payload = () => ({
    employeeId: form.employeeId,
    reason: form.reason,
    initiatedBy: form.initiatedBy,
    lastWorkingDate: form.lastWorkingDate,
    lastWage: form.lastWage === '' || form.lastWage == null ? undefined : Number(form.lastWage),
    leaveEncashment: Number(form.leaveEncashment || 0),
    unpaidSalary: Number(form.unpaidSalary || 0),
    otherEntitlements: Number(form.otherEntitlements || 0),
    compensation: Number(form.compensation || 0),
    otherDeductions: Number(form.otherDeductions || 0),
    deductOutstandingLoans: form.deductOutstandingLoans !== false,
    notes: form.notes || undefined,
  });

  const calculate = async () => {
    setBusy(true);
    try {
      const r = await api.post('/hr/end-service-settlements/preview', payload());
      setPreview(r.data);
    } catch (err: any) {
      alert(err?.response?.data?.message || 'تعذر حساب المخالصة');
    } finally { setBusy(false); }
  };
  const create = async () => {
    setBusy(true);
    try {
      await api.post('/hr/end-service-settlements', payload());
      setOpen(false); setPreview(null); await load();
    } catch (err: any) {
      alert(err?.response?.data?.message || 'تعذر إنشاء المخالصة');
    } finally { setBusy(false); }
  };
  const transition = async (id: string, action: 'approve'|'pay') => {
    const msg = action === 'approve' ? 'اعتماد المخالصة وقفل مبالغها؟' : 'تأكيد دفع المخالصة وإنهاء خدمة الموظف وتسوية القرض المحسوم؟';
    if (!confirm(msg)) return;
    await api.post(`/hr/end-service-settlements/${id}/${action}`, {});
    await load();
  };

  return (
    <div className="space-y-6 animate-fade-in-up">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2"><ReceiptText className="h-6 w-6 text-primary-400" /> نهاية الخدمة والمخالصة</h1>
          <p className="text-slate-400 text-sm mt-1">حساب نظامي للمكافأة، مهلة التصفية، الالتزامات والديون، ثم اعتماد ودفع.</p>
        </div>
        <Button onClick={() => setOpen(true)}><Calculator className="h-4 w-4" /> مخالصة جديدة</Button>
      </div>

      <div className="space-y-3">
        {items.length === 0 ? <div className="scc-card py-12 text-center text-slate-400">لا توجد مخالفات نهاية خدمة.</div> :
          items.map(item => (
            <div key={item.id} className="scc-card-hover flex items-center justify-between gap-4">
              <div>
                <div className="text-white font-semibold">{item.employee?.firstName} {item.employee?.lastName}</div>
                <div className="text-slate-400 text-sm">الصافي {Number(item.netSettlement).toLocaleString('ar-SA')} ر.س · المكافأة {Number(item.eosAward).toLocaleString('ar-SA')} ر.س</div>
                <div className="text-slate-500 text-xs mt-1">آخر يوم {new Date(item.lastWorkingDate).toLocaleDateString('ar-SA')} · الاستحقاق الأقصى {new Date(item.dueDate).toLocaleDateString('ar-SA')}</div>
              </div>
              <div className="flex items-center gap-2">
                <span className="px-2 py-1 rounded-full bg-slate-800 text-slate-300 text-xs">{item.status}</span>
                {item.status === 'DRAFT' && <Button size="sm" onClick={() => transition(item.id,'approve')}><CheckCircle2 className="h-3 w-3" /> اعتماد</Button>}
                {item.status === 'APPROVED' && <Button size="sm" onClick={() => transition(item.id,'pay')}><WalletCards className="h-3 w-3" /> دفع وإنهاء</Button>}
              </div>
            </div>
          ))}
      </div>

      <Modal isOpen={open} onClose={() => { setOpen(false); setPreview(null); }} title="مخالصة نهاية خدمة" size="xl">
        <div className="space-y-4">
          <Select label="الموظف" required options={employeeOptions} value={form.employeeId || ''} onChange={e => { setForm({ ...form, employeeId: e.target.value }); setPreview(null); }} />
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Select label="سبب انتهاء العلاقة" options={reasons} value={form.reason} onChange={e => { setForm({ ...form, reason: e.target.value }); setPreview(null); }} />
            <Select label="من بادر بالإنهاء" options={[{value:'EMPLOYEE',label:'الموظف'},{value:'EMPLOYER',label:'صاحب العمل'},{value:'MUTUAL',label:'اتفاق مشترك'}]} value={form.initiatedBy} onChange={e => setForm({ ...form, initiatedBy: e.target.value })} />
            <Input label="آخر يوم عمل" type="date" value={form.lastWorkingDate} onChange={e => setForm({ ...form, lastWorkingDate: e.target.value })} />
            <Input label="الأجر الأخير (اختياري للتجاوز)" type="number" value={form.lastWage ?? ''} onChange={e => setForm({ ...form, lastWage: e.target.value })} />
            <Input label="بدل رصيد الإجازة" type="number" value={form.leaveEncashment || ''} onChange={e => setForm({ ...form, leaveEncashment: e.target.value })} />
            <Input label="راتب غير مدفوع" type="number" value={form.unpaidSalary || ''} onChange={e => setForm({ ...form, unpaidSalary: e.target.value })} />
            <Input label="استحقاقات أخرى" type="number" value={form.otherEntitlements || ''} onChange={e => setForm({ ...form, otherEntitlements: e.target.value })} />
            <Input label="تعويضات" type="number" value={form.compensation || ''} onChange={e => setForm({ ...form, compensation: e.target.value })} />
            <Input label="خصومات أخرى" type="number" value={form.otherDeductions || ''} onChange={e => setForm({ ...form, otherDeductions: e.target.value })} />
            <Input label="ملاحظات" value={form.notes || ''} onChange={e => setForm({ ...form, notes: e.target.value })} />
          </div>
          <label className="flex items-center gap-2 text-sm text-slate-300">
            <input type="checkbox" checked={form.deductOutstandingLoans !== false} onChange={e => setForm({ ...form, deductOutstandingLoans: e.target.checked })} />
            حسم رصيد السلف والقروض المستحق من المخالصة
          </label>

          {preview && <div className="rounded-xl border border-primary-500/20 bg-primary-500/5 p-4 grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
            <div><span className="text-slate-500 block">مدة الخدمة</span><span className="text-white">{(preview.serviceYears || 0).toFixed(2)} سنة</span></div>
            <div><span className="text-slate-500 block">أصل المكافأة</span><span className="text-white">{Number(preview.baseAward).toLocaleString('ar-SA')} ر.س</span></div>
            <div><span className="text-slate-500 block">نسبة الاستحقاق</span><span className="text-white">{Math.round(Number(preview.awardFactor) * 100)}%</span></div>
            <div><span className="text-slate-500 block">المكافأة</span><span className="text-white">{Number(preview.eosAward).toLocaleString('ar-SA')} ر.س</span></div>
            <div><span className="text-slate-500 block">رصيد القروض</span><span className="text-white">{Number(preview.outstandingLoanBalance).toLocaleString('ar-SA')} ر.س</span></div>
            <div><span className="text-slate-500 block">المحسوم من القرض</span><span className="text-white">{Number(preview.loanDeduction).toLocaleString('ar-SA')} ر.س</span></div>
            <div><span className="text-slate-500 block">موعد التصفية الأقصى</span><span className="text-white">{new Date(preview.dueDate).toLocaleDateString('ar-SA')}</span></div>
            <div><span className="text-slate-500 block">صافي المخالصة</span><span className="text-emerald-400 font-bold">{Number(preview.netSettlement).toLocaleString('ar-SA')} ر.س</span></div>
          </div>}

          <div className="flex justify-end gap-3">
            <Button type="button" variant="ghost" onClick={() => { setOpen(false); setPreview(null); }}><X className="h-4 w-4" /> إلغاء</Button>
            <Button type="button" variant="ghost" isLoading={busy} onClick={calculate}><Calculator className="h-4 w-4" /> معاينة الحساب</Button>
            <Button type="button" isLoading={busy} disabled={!preview} onClick={create}>حفظ المخالصة</Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
