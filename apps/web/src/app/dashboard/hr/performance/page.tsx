'use client';

import { useCallback, useEffect, useState } from 'react';
import api from '@/lib/api';
import { Target, Plus, RefreshCw } from 'lucide-react';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import Modal from '@/components/ui/Modal';
import Select from '@/components/ui/Select';

type Employee = { id: string; firstName: string; lastName: string; status?: string };
type Review = {
  id: string; status: string; overallScore: number | null;
  employee?: { firstName: string; lastName: string };
};

function apiError(error: unknown): string {
  const response = error as { response?: { data?: { message?: string | string[] } } };
  const msg = response.response?.data?.message;
  if (typeof msg === 'string') return msg;
  if (Array.isArray(msg)) return msg.join('، ');
  return 'تعذرت العملية. تحقق من الاتصال والصلاحيات ثم أعد المحاولة';
}

export default function PerformancePage() {
  const [items, setItems] = useState<Review[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ employeeId: '', periodStart: '', periodEnd: '' });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [reviews, staff] = await Promise.all([
        api.get('/hr/performance'),
        api.get('/hr/employees?limit=200'),
      ]);
      setItems(reviews.data.data || []);
      setEmployees(staff.data.data || []);
    } catch (cause) {
      setError(apiError(cause));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const run = async (action: () => Promise<unknown>, success: string) => {
    setSaving(true);
    setError('');
    setNotice('');
    try {
      await action();
      setNotice(success);
      await load();
      return true;
    } catch (cause) {
      setError(apiError(cause));
      return false;
    } finally {
      setSaving(false);
    }
  };

  const create = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!form.employeeId || !form.periodStart || !form.periodEnd) {
      setError('جميع حقول إنشاء التقييم مطلوبة');
      return;
    }
    if (form.periodEnd < form.periodStart) {
      setError('يجب أن تكون نهاية فترة التقييم بعد بدايتها');
      return;
    }
    const ok = await run(
      () => api.post('/hr/performance', {
        employeeId: form.employeeId, periodStart: form.periodStart, periodEnd: form.periodEnd,
      }),
      'تم إنشاء مسودة التقييم',
    );
    if (ok) { setOpen(false); setForm({ employeeId: '', periodStart: '', periodEnd: '' }); }
  };

  const score = async (id: string) => {
    const entry = window.prompt('النتيجة من 0 إلى 5:', '4');
    if (entry === null) return;
    const value = Number(entry);
    if (!entry.trim() || !Number.isFinite(value) || value < 0 || value > 5) {
      setError('النتيجة يجب أن تكون من 0 إلى 5');
      return;
    }
    await run(
      () => api.patch(`/hr/performance/${id}`, {
        overallScore: value, goalsScore: value, competenciesScore: value,
      }),
      'حُفظت نتيجة التقييم',
    );
  };

  return (
    <div className="space-y-5">
      {error && <div role="alert" className="rounded-lg border border-red-700 bg-red-950/60 p-3 text-sm text-red-200">
        {error} <button type="button" onClick={() => void load()} className="mr-3 underline">إعادة المحاولة</button>
      </div>}
      {notice && <div role="status" className="rounded-lg border border-emerald-700 bg-emerald-950/40 p-3 text-sm text-emerald-200">{notice}</div>}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold text-white">
            <Target className="h-6 w-6 text-primary-400" /> إدارة الأداء
          </h1>
          <p className="text-sm text-slate-300">تقييمات دورية مع دورة اعتماد وإقرار</p>
        </div>
        <div className="flex gap-2">
          <Button onClick={() => { setError(''); setOpen(true); }} disabled={loading || employees.length === 0 || saving}>
            <Plus className="h-4 w-4" /> تقييم جديد
          </Button>
          <Button variant="ghost" onClick={() => void load()} disabled={loading || saving}>
            <RefreshCw className="h-4 w-4" /> تحديث
          </Button>
        </div>
      </div>
      {loading && <p role="status" className="text-sm text-slate-300">جارٍ تحميل التقييمات والموظفين...</p>}
      {!loading && !error && employees.length === 0 &&
        <p className="rounded-lg border border-amber-700/50 bg-amber-950/30 p-4 text-sm text-amber-200">
          لا يوجد موظفون متاحون للاختيار. أضف موظفًا أولًا أو تحقق من صلاحية الاطلاع على الموظفين.
        </p>}
      {!loading && !error && items.length === 0 && <p className="text-sm text-slate-300">لا توجد تقييمات بعد.</p>}
      <div className="space-y-3">
        {items.map(item => <div key={item.id} className="scc-card flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="font-bold text-white">{item.employee?.firstName} {item.employee?.lastName}</div>
            <div className="text-sm text-slate-300">{item.status} · {item.overallScore ?? '—'} / 5</div>
          </div>
          <div className="flex gap-2">
            {item.status === 'DRAFT' && <>
              <Button size="sm" variant="ghost" onClick={() => void score(item.id)} disabled={saving}>نتيجة</Button>
              <Button size="sm" disabled={saving || item.overallScore === null}
                onClick={() => void run(() => api.post(`/hr/performance/${item.id}/submit`, {}), 'أُرسل التقييم')}>
                إرسال
              </Button>
            </>}
            {item.status === 'SUBMITTED' && <span className="self-center text-xs text-amber-300">بانتظار إقرار الموظف</span>}
          </div>
        </div>)}
      </div>
      <Modal isOpen={open} onClose={() => { if (!saving) setOpen(false); }} title="تقييم جديد">
        <form onSubmit={event => void create(event)} className="space-y-3">
          <Select label="الموظف" required
            options={[{ value: '', label: employees.length ? 'اختر الموظف' : 'لا يوجد موظفون' },
              ...employees.map(employee => ({ value: employee.id, label: `${employee.firstName} ${employee.lastName}` }))]}
            value={form.employeeId}
            onChange={event => setForm({ ...form, employeeId: event.target.value })} />
          <Input label="بداية الفترة" type="date" required dir="ltr"
            value={form.periodStart} onChange={event => setForm({ ...form, periodStart: event.target.value })} />
          <Input label="نهاية الفترة" type="date" required dir="ltr" min={form.periodStart || undefined}
            value={form.periodEnd} onChange={event => setForm({ ...form, periodEnd: event.target.value })} />
          <Button type="submit" disabled={saving || !employees.length}>
            {saving ? 'جارٍ الحفظ' : 'إنشاء'}
          </Button>
        </form>
      </Modal>
    </div>
  );
}
