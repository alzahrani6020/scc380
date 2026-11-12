'use client';

import { useEffect, useState } from 'react';
import api from '@/lib/api';
import { CalendarRange, Plus, SlidersHorizontal, X } from 'lucide-react';
import Modal from '@/components/ui/Modal';
import Input from '@/components/ui/Input';
import Select from '@/components/ui/Select';
import Button from '@/components/ui/Button';

const leaveTypes = [
  { value: 'ANNUAL', label: 'سنوية' },
  { value: 'SICK', label: 'مرضية' },
  { value: 'EMERGENCY', label: 'طارئة' },
  { value: 'UNPAID', label: 'بدون راتب' },
  { value: 'MATERNITY', label: 'أمومة' },
  { value: 'PATERNITY', label: 'أبوة' },
  { value: 'HAJJ', label: 'حج' },
  { value: 'STUDY', label: 'دراسية' },
  { value: 'COMPASSIONATE', label: 'استثنائية' },
];

export default function LeaveBalancesPage() {
  const year = new Date().getFullYear();
  const [balances, setBalances] = useState<any[]>([]);
  const [policies, setPolicies] = useState<any[]>([]);
  const [employees, setEmployees] = useState<any[]>([]);
  const [employeeId, setEmployeeId] = useState('');
  const [loading, setLoading] = useState(true);
  const [policyOpen, setPolicyOpen] = useState(false);
  const [policyData, setPolicyData] = useState<any>({ type: 'ANNUAL', annualEntitlement: 21, maxCarryForward: 0, requiresApproval: true });
  const [adjusting, setAdjusting] = useState<any>(null);
  const [adjustData, setAdjustData] = useState<any>({ amount: 0, reason: '' });

  useEffect(() => {
    Promise.all([
      api.get('/hr/leave-policies').then(r => setPolicies(r.data.data || [])),
      api.get('/hr/employees?limit=200').then(r => setEmployees(r.data.data || [])),
    ]).catch(console.error).finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (!employeeId) { setBalances([]); return; }
    api.get(`/hr/leave-balances?employeeId=${encodeURIComponent(employeeId)}&year=${year}`)
      .then(r => setBalances(r.data.data || []))
      .catch(console.error);
  }, [employeeId, year]);

  const refreshBalances = async () => {
    if (!employeeId) return;
    const r = await api.get(`/hr/leave-balances?employeeId=${encodeURIComponent(employeeId)}&year=${year}`);
    setBalances(r.data.data || []);
  };

  const initialize = async () => {
    if (!employeeId) return alert('اختر موظفًا أولًا');
    try {
      await api.post('/hr/leave-balances/initialize', { employeeId, year });
      await refreshBalances();
    } catch {
      alert('تعذر تهيئة الأرصدة. تأكد من وجود سياسات إجازات نشطة.');
    }
  };

  const savePolicy = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api.post('/hr/leave-policies', {
        type: policyData.type,
        name: policyData.name || leaveTypes.find(t => t.value === policyData.type)?.label || policyData.type,
        annualEntitlement: Number(policyData.annualEntitlement),
        maxCarryForward: Number(policyData.maxCarryForward || 0),
        requiresApproval: !!policyData.requiresApproval,
        isActive: true,
      });
      const r = await api.get('/hr/leave-policies');
      setPolicies(r.data.data || []);
      setPolicyOpen(false);
    } catch {
      alert('تعذر إنشاء السياسة أو توجد سياسة لنفس النوع بالفعل');
    }
  };

  const adjust = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api.post(`/hr/leave-balances/${adjusting.id}/adjust`, {
        amount: Number(adjustData.amount),
        reason: adjustData.reason,
      });
      setAdjusting(null);
      await refreshBalances();
    } catch {
      alert('تعذر تعديل الرصيد');
    }
  };

  const employeeOptions = employees.map(e => ({ value: e.id, label: `${e.firstName} ${e.lastName} · ${e.employeeCode}` }));

  return (
    <div className="space-y-6 animate-fade-in-up">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2"><CalendarRange className="h-6 w-6 text-primary-400" /> أرصدة وسياسات الإجازات</h1>
          <p className="text-slate-400 text-sm mt-1">رصيد فعلي لكل موظف وسنة ونوع إجازة</p>
        </div>
        <Button onClick={() => setPolicyOpen(true)}><Plus className="h-4 w-4" /> سياسة إجازة</Button>
      </div>

      <div className="scc-card">
        <div className="grid grid-cols-1 md:grid-cols-[1fr_auto] gap-3 items-end">
          <Select label="الموظف" options={[{ value: '', label: 'اختر موظفًا' }, ...employeeOptions]} value={employeeId} onChange={e => setEmployeeId(e.target.value)} />
          <Button onClick={initialize} disabled={!employeeId}>تهيئة أرصدة {year}</Button>
        </div>
      </div>

      <div className="scc-card">
        <h2 className="text-white font-semibold mb-4">السياسات النشطة</h2>
        {policies.length === 0 ? <p className="text-slate-500 text-sm">لا توجد سياسات بعد.</p> :
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {policies.map(p => (
              <div key={p.id} className="rounded-xl border border-slate-800 p-4">
                <p className="text-white font-medium">{p.name}</p>
                <p className="text-slate-400 text-sm mt-1">{p.annualEntitlement} يوم سنويًا</p>
                <p className="text-slate-500 text-xs mt-1">ترحيل أقصى: {p.maxCarryForward} · {p.requiresApproval ? 'يتطلب اعتماد' : 'اعتماد تلقائي'}</p>
              </div>
            ))}
          </div>
        }
      </div>

      <div className="scc-card">
        <h2 className="text-white font-semibold mb-4">أرصدة {year}</h2>
        {loading ? <p className="text-slate-400">جاري التحميل...</p> :
          !employeeId ? <p className="text-slate-500 text-sm">اختر موظفًا لعرض الأرصدة.</p> :
          balances.length === 0 ? <p className="text-slate-500 text-sm">لا توجد أرصدة مهيأة لهذا الموظف.</p> :
          <div className="space-y-3">
            {balances.map(b => (
              <div key={b.id} className="rounded-xl border border-slate-800 p-4 flex items-center justify-between gap-4">
                <div>
                  <p className="text-white font-medium">{leaveTypes.find(t => t.value === b.type)?.label || b.type}</p>
                  <p className="text-slate-500 text-xs mt-1">استحقاق {b.entitlement} · مرحّل {b.carriedForward} · تسويات {b.adjustment}</p>
                </div>
                <div className="flex items-center gap-5">
                  <div className="text-center"><p className="text-emerald-400 font-bold text-xl">{b.available}</p><p className="text-slate-500 text-xs">متاح</p></div>
                  <div className="text-center"><p className="text-white font-bold">{b.used}</p><p className="text-slate-500 text-xs">مستخدم</p></div>
                  <div className="text-center"><p className="text-amber-400 font-bold">{b.pending}</p><p className="text-slate-500 text-xs">معلق</p></div>
                  <button onClick={() => { setAdjusting(b); setAdjustData({ amount: 0, reason: '' }); }} className="p-2 text-primary-400" title="تسوية الرصيد"><SlidersHorizontal className="h-4 w-4" /></button>
                </div>
              </div>
            ))}
          </div>
        }
      </div>

      <Modal isOpen={policyOpen} onClose={() => setPolicyOpen(false)} title="سياسة إجازة جديدة">
        <form onSubmit={savePolicy} className="space-y-4">
          <Select label="نوع الإجازة" options={leaveTypes} value={policyData.type} onChange={e => setPolicyData({ ...policyData, type: e.target.value })} />
          <Input label="اسم السياسة" value={policyData.name || ''} onChange={e => setPolicyData({ ...policyData, name: e.target.value })} />
          <Input label="الاستحقاق السنوي بالأيام" type="number" required value={policyData.annualEntitlement} onChange={e => setPolicyData({ ...policyData, annualEntitlement: e.target.value })} />
          <Input label="الحد الأقصى للترحيل" type="number" value={policyData.maxCarryForward} onChange={e => setPolicyData({ ...policyData, maxCarryForward: e.target.value })} />
          <label className="flex items-center gap-2 text-slate-300 text-sm"><input type="checkbox" checked={!!policyData.requiresApproval} onChange={e => setPolicyData({ ...policyData, requiresApproval: e.target.checked })} /> يتطلب اعتمادًا</label>
          <div className="flex justify-end gap-3">
            <Button type="button" variant="ghost" onClick={() => setPolicyOpen(false)}><X className="h-4 w-4" /> إلغاء</Button>
            <Button type="submit">حفظ السياسة</Button>
          </div>
        </form>
      </Modal>

      <Modal isOpen={!!adjusting} onClose={() => setAdjusting(null)} title="تسوية رصيد الإجازة">
        <form onSubmit={adjust} className="space-y-4">
          <Input label="عدد الأيام (+/-)" type="number" required value={adjustData.amount} onChange={e => setAdjustData({ ...adjustData, amount: e.target.value })} />
          <Input label="سبب التسوية" required value={adjustData.reason} onChange={e => setAdjustData({ ...adjustData, reason: e.target.value })} />
          <div className="flex justify-end gap-3">
            <Button type="button" variant="ghost" onClick={() => setAdjusting(null)}><X className="h-4 w-4" /> إلغاء</Button>
            <Button type="submit">تسجيل التسوية</Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
