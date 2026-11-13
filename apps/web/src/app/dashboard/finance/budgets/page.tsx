'use client';

import { useEffect, useMemo, useState } from 'react';
import { BarChart3, CheckCircle2, Plus, RotateCcw, WalletCards } from 'lucide-react';
import api from '@/lib/api';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import Modal from '@/components/ui/Modal';
import Select from '@/components/ui/Select';

type Plan = {
  id: string;
  year: number;
  name: string;
  status: 'DRAFT' | 'APPROVED';
  approvedAt?: string | null;
  lines?: any[];
  _count?: { lines: number };
};

export default function BudgetsPage() {
  const [plans, setPlans] = useState<Plan[]>([]);
  const [selected, setSelected] = useState<Plan | null>(null);
  const [accounts, setAccounts] = useState<any[]>([]);
  const [costCenters, setCostCenters] = useState<any[]>([]);
  const [report, setReport] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [planOpen, setPlanOpen] = useState(false);
  const [lineOpen, setLineOpen] = useState(false);
  const [planForm, setPlanForm] = useState<any>({
    year: new Date().getFullYear(),
    name: '',
  });
  const [lineForm, setLineForm] = useState<any>({
    month: new Date().getMonth() + 1,
    accountId: '',
    costCenterId: '',
    amount: '',
  });

  const selectableAccounts = useMemo(
    () => accounts.filter((a) => a.isActive !== false),
    [accounts],
  );

  const loadBase = () => {
    setLoading(true);
    Promise.all([
      api.get('/finance/budgets').then((r) => setPlans(r.data?.data || [])),
      api.get('/finance/chart-of-accounts').then((r) => setAccounts(r.data?.data || [])),
      api.get('/finance/cost-centers').then((r) => setCostCenters(r.data?.data || [])),
    ])
      .catch((err) => alert(err.response?.data?.message || 'تعذر تحميل الموازنات'))
      .finally(() => setLoading(false));
  };

  const loadPlan = async (id: string) => {
    const [planResponse, reportResponse] = await Promise.all([
      api.get(`/finance/budgets/${id}`),
      api.get(`/finance/budgets/${id}/report`),
    ]);
    setSelected(planResponse.data);
    setReport(reportResponse.data);
  };

  useEffect(() => { loadBase(); }, []);

  const createPlan = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      const r = await api.post('/finance/budgets', {
        year: Number(planForm.year),
        name: planForm.name || undefined,
      });
      setPlanOpen(false);
      loadBase();
      await loadPlan(r.data.id);
    } catch (err: any) {
      alert(err.response?.data?.message || 'تعذر إنشاء الموازنة');
    } finally {
      setBusy(false);
    }
  };

  const addLine = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selected) return;
    setBusy(true);
    try {
      await api.post(`/finance/budgets/${selected.id}/lines`, {
        month: Number(lineForm.month),
        accountId: lineForm.accountId,
        costCenterId: lineForm.costCenterId || undefined,
        amount: Number(lineForm.amount),
      });
      setLineOpen(false);
      await loadPlan(selected.id);
      loadBase();
    } catch (err: any) {
      alert(err.response?.data?.message || 'تعذر إضافة بند الموازنة');
    } finally {
      setBusy(false);
    }
  };

  const approve = async () => {
    if (!selected || !confirm('اعتماد الموازنة؟ ستصبح البنود غير قابلة للتعديل حتى إعادة فتحها.')) return;
    setBusy(true);
    try {
      await api.post(`/finance/budgets/${selected.id}/approve`);
      await loadPlan(selected.id);
      loadBase();
    } catch (err: any) {
      alert(err.response?.data?.message || 'تعذر اعتماد الموازنة');
    } finally {
      setBusy(false);
    }
  };

  const reopen = async () => {
    if (!selected || !confirm('إعادة فتح الموازنة المعتمدة للتعديل؟')) return;
    setBusy(true);
    try {
      await api.post(`/finance/budgets/${selected.id}/reopen`);
      await loadPlan(selected.id);
      loadBase();
    } catch (err: any) {
      alert(err.response?.data?.message || 'تعذر إعادة فتح الموازنة');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-6 animate-fade-in-up">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <WalletCards className="h-6 w-6 text-primary-400" />
            الموازنات
          </h1>
          <p className="text-slate-400 text-sm mt-1">
            موازنة سنوية شهرية وربط الفعلي بالحسابات ومراكز التكلفة
          </p>
        </div>
        <Button onClick={() => setPlanOpen(true)}><Plus className="h-4 w-4" /> موازنة جديدة</Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[320px_1fr] gap-5">
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-3 space-y-2">
          {loading ? (
            <div className="p-6 text-center text-slate-500">جارٍ التحميل...</div>
          ) : plans.length === 0 ? (
            <div className="p-6 text-center text-slate-500">لا توجد موازنات</div>
          ) : plans.map((plan) => (
            <button
              key={plan.id}
              onClick={() => loadPlan(plan.id)}
              className={`w-full text-right rounded-lg p-3 border transition-colors ${
                selected?.id === plan.id
                  ? 'border-primary-500/50 bg-primary-500/10'
                  : 'border-slate-800 hover:bg-slate-800/60'
              }`}
            >
              <div className="flex justify-between items-center gap-2">
                <span className="font-bold text-white">{plan.name}</span>
                <span className={`text-xs px-2 py-1 rounded-full ${
                  plan.status === 'APPROVED'
                    ? 'bg-emerald-500/15 text-emerald-400'
                    : 'bg-amber-500/15 text-amber-400'
                }`}>
                  {plan.status === 'APPROVED' ? 'معتمدة' : 'مسودة'}
                </span>
              </div>
              <div className="text-xs text-slate-500 mt-1">
                {plan.year} — {plan._count?.lines || 0} بند
              </div>
            </button>
          ))}
        </div>

        <div className="space-y-5">
          {!selected ? (
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-12 text-center text-slate-500">
              اختر موازنة لعرض البنود والانحرافات
            </div>
          ) : (
            <>
              <div className="flex flex-wrap items-center justify-between gap-3 bg-slate-900 border border-slate-800 rounded-xl p-4">
                <div>
                  <h2 className="text-white font-bold">{selected.name}</h2>
                  <p className="text-slate-400 text-sm">السنة المالية {selected.year}</p>
                </div>
                <div className="flex gap-2">
                  {selected.status === 'DRAFT' ? (
                    <>
                      <Button variant="ghost" onClick={() => setLineOpen(true)}><Plus className="h-4 w-4" /> بند</Button>
                      <Button onClick={approve} isLoading={busy}><CheckCircle2 className="h-4 w-4" /> اعتماد</Button>
                    </>
                  ) : (
                    <Button variant="ghost" onClick={reopen} isLoading={busy}><RotateCcw className="h-4 w-4" /> إعادة فتح</Button>
                  )}
                </div>
              </div>

              {report && (
                <>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="scc-card-hover">
                      <p className="text-slate-400 text-xs">المعتمد</p>
                      <p className="text-xl font-bold text-white">{Number(report.totals?.budget || 0).toLocaleString()} ر.س</p>
                    </div>
                    <div className="scc-card-hover">
                      <p className="text-slate-400 text-xs">الفعلي</p>
                      <p className="text-xl font-bold text-white">{Number(report.totals?.actual || 0).toLocaleString()} ر.س</p>
                    </div>
                    <div className="scc-card-hover">
                      <p className="text-slate-400 text-xs">الاستخدام</p>
                      <p className="text-xl font-bold text-white">{report.totals?.usagePct == null ? '—' : `${report.totals.usagePct}%`}</p>
                    </div>
                  </div>

                  <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="bg-slate-800/50 text-slate-400 border-b border-slate-700">
                          <th className="p-3 text-center">الشهر</th>
                          <th className="p-3 text-right">الحساب</th>
                          <th className="p-3 text-right">مركز التكلفة</th>
                          <th className="p-3 text-left">المعتمد</th>
                          <th className="p-3 text-left">الفعلي</th>
                          <th className="p-3 text-left">الانحراف الملائم</th>
                        </tr>
                      </thead>
                      <tbody>
                        {(report.rows || []).map((row: any) => (
                          <tr key={row.id} className="border-b border-slate-800/50">
                            <td className="p-3 text-center text-slate-300">{row.month}</td>
                            <td className="p-3 text-white">{row.account.code} — {row.account.name}</td>
                            <td className="p-3 text-slate-300">{row.costCenter?.name || 'إجمالي الحساب'}</td>
                            <td className="p-3 text-left text-slate-300">{Number(row.budget).toLocaleString()}</td>
                            <td className="p-3 text-left text-slate-300">{Number(row.actual).toLocaleString()}</td>
                            <td className={`p-3 text-left font-medium ${Number(row.favorableVariance) >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                              {Number(row.favorableVariance).toLocaleString()}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </>
              )}
            </>
          )}
        </div>
      </div>

      <Modal isOpen={planOpen} onClose={() => setPlanOpen(false)} title="موازنة سنوية جديدة">
        <form onSubmit={createPlan} className="space-y-4">
          <Input label="السنة" type="number" required value={planForm.year} onChange={(e) => setPlanForm({ ...planForm, year: e.target.value })} />
          <Input label="اسم الموازنة" value={planForm.name} onChange={(e) => setPlanForm({ ...planForm, name: e.target.value })} />
          <div className="flex justify-end"><Button type="submit" isLoading={busy}>إنشاء</Button></div>
        </form>
      </Modal>

      <Modal isOpen={lineOpen} onClose={() => setLineOpen(false)} title="بند موازنة">
        <form onSubmit={addLine} className="space-y-4">
          <Input label="الشهر" type="number" min="1" max="12" required value={lineForm.month} onChange={(e) => setLineForm({ ...lineForm, month: e.target.value })} />
          <Select label="الحساب" required value={lineForm.accountId} onChange={(e) => setLineForm({ ...lineForm, accountId: e.target.value })} options={selectableAccounts.map((a) => ({ value: a.id, label: `${a.code} — ${a.name}` }))} />
          <Select label="مركز التكلفة (اختياري)" value={lineForm.costCenterId} onChange={(e) => setLineForm({ ...lineForm, costCenterId: e.target.value })} options={[
            { value: '', label: 'إجمالي الحساب' },
            ...costCenters.filter((c) => c.isActive !== false).map((c) => ({ value: c.id, label: `${c.code || ''} ${c.name}`.trim() })),
          ]} />
          <Input label="المبلغ المعتمد" type="number" min="0" required value={lineForm.amount} onChange={(e) => setLineForm({ ...lineForm, amount: e.target.value })} />
          <div className="flex justify-end"><Button type="submit" isLoading={busy}>إضافة</Button></div>
        </form>
      </Modal>
    </div>
  );
}
