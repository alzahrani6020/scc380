'use client';

import { useEffect, useMemo, useState } from 'react';
import { CalendarRange, Pause, Play, Plus, RotateCcw, Trash2 } from 'lucide-react';
import api from '@/lib/api';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import Select from '@/components/ui/Select';

const kindOptions = [
  { value: 'RECURRING', label: 'قيد دوري' },
  { value: 'ACCRUAL', label: 'استحقاق' },
  { value: 'PREPAID', label: 'مصروف مقدم' },
];

const frequencyOptions = [
  { value: 'MONTHLY', label: 'شهري' },
  { value: 'QUARTERLY', label: 'ربع سنوي' },
  { value: 'YEARLY', label: 'سنوي' },
];

const emptyLine = () => ({
  accountId: '',
  debitAmount: '',
  creditAmount: '',
  description: '',
});

export default function AccountingSchedulesPage() {
  const [items, setItems] = useState<any[]>([]);
  const [runs, setRuns] = useState<any[]>([]);
  const [accounts, setAccounts] = useState<any[]>([]);
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState<any>({
    name: '',
    kind: 'RECURRING',
    frequency: 'MONTHLY',
    startDate: new Date().toISOString().slice(0, 10),
    endDate: '',
    autoReverse: false,
    reverseAfterDays: 1,
    entryPrefix: '',
    description: '',
    lines: [emptyLine(), emptyLine()],
  });

  const activeAccounts = useMemo(
    () => accounts.filter((account) => account.isActive !== false),
    [accounts],
  );

  const load = async () => {
    const [schedules, history, coa] = await Promise.all([
      api.get('/finance/accounting-schedules'),
      api.get('/finance/accounting-schedules/runs'),
      api.get('/finance/chart-of-accounts'),
    ]);
    setItems(schedules.data || []);
    setRuns(history.data || []);
    setAccounts(coa.data?.data || []);
  };

  useEffect(() => {
    load().catch((err) =>
      alert(err.response?.data?.message || 'تعذر تحميل القيود الدورية والاستحقاقات'),
    );
  }, []);

  const execute = async (fn: () => Promise<any>) => {
    setBusy(true);
    try {
      await fn();
      await load();
    } catch (err: any) {
      alert(err.response?.data?.message || 'تعذر تنفيذ العملية');
    } finally {
      setBusy(false);
    }
  };

  const updateLine = (index: number, patch: any) => {
    setForm((old: any) => ({
      ...old,
      lines: old.lines.map((line: any, i: number) =>
        i === index ? { ...line, ...patch } : line,
      ),
    }));
  };

  const addLine = () =>
    setForm((old: any) => ({ ...old, lines: [...old.lines, emptyLine()] }));

  const removeLine = (index: number) =>
    setForm((old: any) => ({
      ...old,
      lines: old.lines.filter((_: any, i: number) => i !== index),
    }));

  const create = (e: React.FormEvent) => {
    e.preventDefault();
    const payload = {
      ...form,
      endDate: form.endDate || undefined,
      autoReverse: form.kind === 'ACCRUAL' ? true : form.kind === 'PREPAID' ? false : form.autoReverse,
      reverseAfterDays: Number(form.reverseAfterDays || 1),
      lines: form.lines.map((line: any) => ({
        accountId: line.accountId,
        debitAmount: line.debitAmount === '' ? 0 : Number(line.debitAmount),
        creditAmount: line.creditAmount === '' ? 0 : Number(line.creditAmount),
        description: line.description || undefined,
      })),
    };

    return execute(async () => {
      await api.post('/finance/accounting-schedules', payload);
      setForm({
        name: '',
        kind: 'RECURRING',
        frequency: 'MONTHLY',
        startDate: new Date().toISOString().slice(0, 10),
        endDate: '',
        autoReverse: false,
        reverseAfterDays: 1,
        entryPrefix: '',
        description: '',
        lines: [emptyLine(), emptyLine()],
      });
    });
  };

  const runDue = () => execute(() => api.post('/finance/accounting-schedules/run-due', {}));

  const money = (value: any) =>
    Number(value || 0).toLocaleString('ar-SA', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });

  return (
    <div className="space-y-6 animate-fade-in-up">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <CalendarRange className="h-6 w-6 text-primary-400" />
            القيود الدورية والاستحقاقات والمقدمات
          </h1>
          <p className="text-slate-400 text-sm mt-1">
            تشغيل دوري idempotent مع سجل مستقل لكل قيد وعكس تلقائي للاستحقاقات.
          </p>
        </div>
        <Button type="button" onClick={runDue} isLoading={busy}>
          <Play className="h-4 w-4" /> تشغيل المستحق الآن
        </Button>
      </div>

      <section className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-4">
        <h2 className="text-white font-bold">جدول محاسبي جديد</h2>
        <form onSubmit={create} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <Input
              label="الاسم"
              required
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
            />
            <Select
              label="النوع"
              required
              value={form.kind}
              onChange={(e) =>
                setForm({
                  ...form,
                  kind: e.target.value,
                  autoReverse: e.target.value === 'ACCRUAL' ? true : e.target.value === 'PREPAID' ? false : form.autoReverse,
                })
              }
              options={kindOptions}
            />
            <Select
              label="التكرار"
              required
              value={form.frequency}
              onChange={(e) => setForm({ ...form, frequency: e.target.value })}
              options={frequencyOptions}
            />
            <Input
              label="بادئة رقم القيد"
              required
              placeholder="ACCR-RENT"
              value={form.entryPrefix}
              onChange={(e) => setForm({ ...form, entryPrefix: e.target.value.toUpperCase() })}
            />
            <Input
              label="تاريخ البداية"
              type="date"
              required
              value={form.startDate}
              onChange={(e) => setForm({ ...form, startDate: e.target.value })}
            />
            <Input
              label="تاريخ النهاية (اختياري)"
              type="date"
              value={form.endDate}
              onChange={(e) => setForm({ ...form, endDate: e.target.value })}
            />
          </div>

          <Input
            label="وصف القيد"
            required
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
          />

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 items-end">
            <label className="flex items-center gap-3 h-10 text-sm text-slate-300">
              <input
                type="checkbox"
                checked={form.kind === 'ACCRUAL' ? true : form.kind === 'PREPAID' ? false : form.autoReverse}
                disabled={form.kind !== 'RECURRING'}
                onChange={(e) => setForm({ ...form, autoReverse: e.target.checked })}
              />
              عكس تلقائي بعد الترحيل
              {form.kind === 'ACCRUAL' && <span className="text-xs text-amber-400">(إلزامي للاستحقاق)</span>}
              {form.kind === 'PREPAID' && <span className="text-xs text-slate-500">(غير مستخدم للمقدم)</span>}
            </label>
            {(form.kind === 'ACCRUAL' || form.autoReverse) && (
              <Input
                label="العكس بعد عدد أيام"
                type="number"
                min="1"
                max="31"
                value={form.reverseAfterDays}
                onChange={(e) => setForm({ ...form, reverseAfterDays: e.target.value })}
              />
            )}
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-white">سطور القيد</h3>
              <Button type="button" variant="ghost" onClick={addLine}>
                <Plus className="h-4 w-4" /> سطر
              </Button>
            </div>
            {form.lines.map((line: any, index: number) => (
              <div key={index} className="grid grid-cols-1 lg:grid-cols-[1fr_160px_160px_1fr_44px] gap-2 items-end">
                <Select
                  label={index === 0 ? 'الحساب' : ''}
                  required
                  value={line.accountId}
                  onChange={(e) => updateLine(index, { accountId: e.target.value })}
                  options={activeAccounts.map((a) => ({
                    value: a.id,
                    label: `${a.code} — ${a.name}`,
                  }))}
                />
                <Input
                  label={index === 0 ? 'مدين' : ''}
                  type="number"
                  step="0.01"
                  min="0"
                  value={line.debitAmount}
                  onChange={(e) =>
                    updateLine(index, {
                      debitAmount: e.target.value,
                      creditAmount: e.target.value ? '' : line.creditAmount,
                    })
                  }
                />
                <Input
                  label={index === 0 ? 'دائن' : ''}
                  type="number"
                  step="0.01"
                  min="0"
                  value={line.creditAmount}
                  onChange={(e) =>
                    updateLine(index, {
                      creditAmount: e.target.value,
                      debitAmount: e.target.value ? '' : line.debitAmount,
                    })
                  }
                />
                <Input
                  label={index === 0 ? 'الوصف' : ''}
                  value={line.description}
                  onChange={(e) => updateLine(index, { description: e.target.value })}
                />
                <button
                  type="button"
                  disabled={form.lines.length <= 2}
                  onClick={() => removeLine(index)}
                  className="h-10 rounded-lg text-red-400 hover:bg-red-500/10 disabled:opacity-30"
                >
                  <Trash2 className="h-4 w-4 mx-auto" />
                </button>
              </div>
            ))}
          </div>

          <div className="flex justify-end">
            <Button type="submit" isLoading={busy}>إنشاء الجدول</Button>
          </div>
        </form>
      </section>

      <section className="space-y-3">
        {items.length === 0 ? (
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-8 text-center text-slate-500">
            لا توجد جداول محاسبية بعد.
          </div>
        ) : items.map((item) => (
          <div key={item.id} className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-3">
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="text-white font-bold">{item.name}</h3>
                  <span className="text-xs rounded-full bg-slate-800 px-2 py-1 text-slate-300">
                    {kindOptions.find((x) => x.value === item.kind)?.label || item.kind}
                  </span>
                  <span className="text-xs rounded-full bg-slate-800 px-2 py-1 text-slate-300">
                    {frequencyOptions.find((x) => x.value === item.frequency)?.label || item.frequency}
                  </span>
                  <span className={`text-xs rounded-full px-2 py-1 ${item.status === 'ACTIVE' ? 'bg-emerald-500/10 text-emerald-400' : 'bg-slate-800 text-slate-400'}`}>
                    {item.status}
                  </span>
                </div>
                <p className="text-sm text-slate-400 mt-1">{item.description}</p>
                <p className="text-xs text-slate-500 mt-1">
                  القيد التالي: {new Date(item.nextRunDate).toLocaleDateString('ar-SA')} · البادئة: {item.entryPrefix}
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                {item.status === 'ACTIVE' ? (
                  <Button type="button" variant="ghost" onClick={() => execute(() => api.post(`/finance/accounting-schedules/${item.id}/pause`))}>
                    <Pause className="h-4 w-4" /> إيقاف
                  </Button>
                ) : item.status === 'PAUSED' ? (
                  <Button type="button" variant="ghost" onClick={() => execute(() => api.post(`/finance/accounting-schedules/${item.id}/resume`))}>
                    <Play className="h-4 w-4" /> استئناف
                  </Button>
                ) : null}
                {item.runs?.length === 0 && (
                  <Button type="button" variant="ghost" onClick={() => execute(() => api.delete(`/finance/accounting-schedules/${item.id}`))}>
                    <Trash2 className="h-4 w-4" /> حذف
                  </Button>
                )}
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
              {item.lines?.map((line: any) => (
                <div key={line.id} className="rounded-lg bg-slate-800/40 p-3 text-sm flex justify-between gap-3">
                  <span className="text-slate-300">
                    {activeAccounts.find((a) => a.id === line.accountId)?.name || line.accountId}
                  </span>
                  <span className="text-white">
                    {Number(line.debitAmount) > 0 ? `مدين ${money(line.debitAmount)}` : `دائن ${money(line.creditAmount)}`}
                  </span>
                </div>
              ))}
            </div>

            {item.runs?.length > 0 && (
              <div className="border-t border-slate-800 pt-3">
                <p className="text-xs text-slate-500 mb-2">آخر التشغيلات</p>
                <div className="flex flex-wrap gap-2">
                  {item.runs.slice(0, 6).map((run: any) => (
                    <span key={run.id} className="text-xs rounded-lg bg-slate-800 px-2 py-1 text-slate-300">
                      {new Date(run.scheduledDate).toLocaleDateString('ar-SA')} · {run.status}
                      {run.reversalJournalId ? ' · معكوس' : ''}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        ))}
      </section>

      {runs.some((run) => run.status === 'POSTED' && run.reversalDueDate) && (
        <section className="bg-slate-900 border border-slate-800 rounded-xl p-5">
          <h2 className="text-white font-bold flex items-center gap-2">
            <RotateCcw className="h-5 w-5" /> عكوس مستحقة
          </h2>
          <p className="text-sm text-slate-400 mt-1">
            تُنفذ تلقائيًا بواسطة المجدول، ويمكن تشغيل المستحق الآن من أعلى الصفحة.
          </p>
        </section>
      )}
    </div>
  );
}
