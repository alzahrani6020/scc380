'use client';

import { useEffect, useMemo, useState } from 'react';
import { ArrowRightLeft, Coins, Plus, RefreshCw, Trash2 } from 'lucide-react';
import api from '@/lib/api';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import Select from '@/components/ui/Select';

export default function ForeignExchangePage() {
  const [baseCurrency, setBaseCurrency] = useState('SAR');
  const [rates, setRates] = useState<any[]>([]);
  const [settlementAccounts, setSettlementAccounts] = useState<any>({
    gainAccountId: '',
    lossAccountId: '',
  });
  const [accounts, setAccounts] = useState<any[]>([]);
  const [busy, setBusy] = useState(false);
  const [rateForm, setRateForm] = useState<any>({
    fromCurrency: 'USD',
    toCurrency: 'SAR',
    rate: '',
    effectiveDate: new Date().toISOString().slice(0, 10),
  });
  const [journal, setJournal] = useState<any>({
    entryNumber: '',
    description: '',
    currency: 'USD',
    date: new Date().toISOString().slice(0, 10),
    lines: [
      { accountId: '', foreignDebitAmount: '', foreignCreditAmount: '' },
      { accountId: '', foreignDebitAmount: '', foreignCreditAmount: '' },
    ],
  });
  const [revaluation, setRevaluation] = useState<any>({
    accountId: '',
    currency: 'USD',
    asOfDate: new Date().toISOString().slice(0, 10),
    gainAccountId: '',
    lossAccountId: '',
  });
  const [lastRevaluation, setLastRevaluation] = useState<any>(null);

  const revenueAccounts = useMemo(
    () => accounts.filter((a) => a.type === 'REVENUE' && a.isActive !== false),
    [accounts],
  );
  const expenseAccounts = useMemo(
    () => accounts.filter((a) => a.type === 'EXPENSE' && a.isActive !== false),
    [accounts],
  );
  const monetaryAccounts = useMemo(
    () => accounts.filter((a) => ['ASSET', 'LIABILITY'].includes(a.type) && a.isActive !== false),
    [accounts],
  );

  const load = () =>
    Promise.all([
      api.get('/finance/fx/config').then((r) => {
        const currency = r.data?.baseCurrency || 'SAR';
        setBaseCurrency(currency);
        setSettlementAccounts({
          gainAccountId: r.data?.fxGainAccountId || '',
          lossAccountId: r.data?.fxLossAccountId || '',
        });
        setRateForm((old: any) => ({ ...old, toCurrency: currency }));
      }),
      api.get('/finance/fx/rates').then((r) => setRates(r.data?.data || [])),
      api.get('/finance/chart-of-accounts').then((r) => setAccounts(r.data?.data || [])),
    ]).catch((err) => alert(err.response?.data?.message || 'تعذر تحميل إعدادات العملات'));

  useEffect(() => { load(); }, []);

  const saveSettlementAccounts = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      await api.patch('/finance/fx/config/settlement-accounts', settlementAccounts);
      await load();
    } catch (err: any) {
      alert(err.response?.data?.message || 'تعذر حفظ حسابات فروق العملة');
    } finally {
      setBusy(false);
    }
  };

  const saveRate = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      await api.post('/finance/fx/rates', {
        ...rateForm,
        fromCurrency: String(rateForm.fromCurrency).toUpperCase(),
        toCurrency: String(rateForm.toCurrency).toUpperCase(),
        rate: Number(rateForm.rate),
      });
      await load();
    } catch (err: any) {
      alert(err.response?.data?.message || 'تعذر حفظ سعر الصرف');
    } finally {
      setBusy(false);
    }
  };

  const updateLine = (index: number, patch: any) => {
    setJournal((old: any) => ({
      ...old,
      lines: old.lines.map((line: any, i: number) => i === index ? { ...line, ...patch } : line),
    }));
  };

  const addLine = () =>
    setJournal((old: any) => ({
      ...old,
      lines: [...old.lines, { accountId: '', foreignDebitAmount: '', foreignCreditAmount: '' }],
    }));

  const removeLine = (index: number) =>
    setJournal((old: any) => ({
      ...old,
      lines: old.lines.filter((_: any, i: number) => i !== index),
    }));

  const postForeignJournal = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      const lines = journal.lines.map((line: any) => ({
        accountId: line.accountId,
        foreignDebitAmount: line.foreignDebitAmount === '' ? undefined : Number(line.foreignDebitAmount),
        foreignCreditAmount: line.foreignCreditAmount === '' ? undefined : Number(line.foreignCreditAmount),
      }));
      const r = await api.post('/finance/fx/journals', {
        entryNumber: journal.entryNumber,
        description: journal.description,
        currency: String(journal.currency).toUpperCase(),
        date: journal.date,
        lines,
      });
      alert(`تم ترحيل القيد بسعر صرف ${r.data?.exchangeRate} إلى ${r.data?.baseCurrency}`);
      setJournal((old: any) => ({
        ...old,
        entryNumber: '',
        description: '',
        lines: [
          { accountId: '', foreignDebitAmount: '', foreignCreditAmount: '' },
          { accountId: '', foreignDebitAmount: '', foreignCreditAmount: '' },
        ],
      }));
    } catch (err: any) {
      alert(err.response?.data?.message || 'تعذر ترحيل القيد الأجنبي');
    } finally {
      setBusy(false);
    }
  };

  const runRevaluation = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      const r = await api.post('/finance/fx/revalue', {
        ...revaluation,
        currency: String(revaluation.currency).toUpperCase(),
      });
      setLastRevaluation(r.data);
    } catch (err: any) {
      alert(err.response?.data?.message || 'تعذر تنفيذ إعادة التقييم');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-6 animate-fade-in-up">
      <div>
        <h1 className="text-2xl font-bold text-white flex items-center gap-2">
          <Coins className="h-6 w-6 text-primary-400" />
          العملات وأسعار الصرف
        </h1>
        <p className="text-slate-400 text-sm mt-1">
          العملة الأساسية: <span className="text-white font-medium">{baseCurrency}</span> — القيود تحفظ المبلغ الأصلي وسعر الصرف والقيمة بالعملة الأساسية
        </p>
      </div>

      <section className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-4">
        <div>
          <h2 className="text-white font-bold">حسابات فروق العملة المحققة</h2>
          <p className="text-xs text-slate-500 mt-1">
            تستخدم تلقائيًا عند تحصيل فاتورة عميل أو سداد فاتورة مورد بسعر مختلف عن سعر إثباتها.
          </p>
        </div>
        <form onSubmit={saveSettlementAccounts} className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <Select label="حساب أرباح فروق العملة" required value={settlementAccounts.gainAccountId} onChange={(e) => setSettlementAccounts({ ...settlementAccounts, gainAccountId: e.target.value })} options={revenueAccounts.map((a) => ({ value: a.id, label: `${a.code} — ${a.name}` }))} />
          <Select label="حساب خسائر فروق العملة" required value={settlementAccounts.lossAccountId} onChange={(e) => setSettlementAccounts({ ...settlementAccounts, lossAccountId: e.target.value })} options={expenseAccounts.map((a) => ({ value: a.id, label: `${a.code} — ${a.name}` }))} />
          <div className="md:col-span-2 flex justify-end"><Button type="submit" isLoading={busy}>حفظ الحسابات</Button></div>
        </form>
      </section>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
        <section className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-4">
          <h2 className="text-white font-bold flex items-center gap-2"><ArrowRightLeft className="h-5 w-5" /> أسعار الصرف</h2>
          <form onSubmit={saveRate} className="grid grid-cols-2 gap-3">
            <Input label="من" maxLength={3} required value={rateForm.fromCurrency} onChange={(e) => setRateForm({ ...rateForm, fromCurrency: e.target.value })} />
            <Input label="إلى" maxLength={3} required value={rateForm.toCurrency} onChange={(e) => setRateForm({ ...rateForm, toCurrency: e.target.value })} />
            <Input label="السعر" type="number" step="0.00000001" required value={rateForm.rate} onChange={(e) => setRateForm({ ...rateForm, rate: e.target.value })} />
            <Input label="تاريخ السريان" type="date" required value={rateForm.effectiveDate} onChange={(e) => setRateForm({ ...rateForm, effectiveDate: e.target.value })} />
            <div className="col-span-2 flex justify-end"><Button type="submit" isLoading={busy}>حفظ السعر</Button></div>
          </form>
          <div className="max-h-64 overflow-auto border-t border-slate-800 pt-3 space-y-2">
            {rates.length === 0 ? (
              <p className="text-slate-500 text-sm">لا توجد أسعار صرف مسجلة</p>
            ) : rates.map((rate) => (
              <div key={rate.id} className="flex justify-between text-sm rounded-lg bg-slate-800/40 p-2">
                <span className="text-white">{rate.fromCurrency}/{rate.toCurrency}</span>
                <span className="text-slate-300">{Number(rate.rate).toLocaleString(undefined, { maximumFractionDigits: 8 })}</span>
                <span className="text-slate-500">{new Date(rate.effectiveDate).toLocaleDateString('ar-SA')}</span>
              </div>
            ))}
          </div>
        </section>

        <section className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-4">
          <h2 className="text-white font-bold">إعادة تقييم رصيد عملة أجنبية</h2>
          <form onSubmit={runRevaluation} className="space-y-3">
            <Select label="الحساب النقدي / الذمم" required value={revaluation.accountId} onChange={(e) => setRevaluation({ ...revaluation, accountId: e.target.value })} options={monetaryAccounts.map((a) => ({ value: a.id, label: `${a.code} — ${a.name}` }))} />
            <div className="grid grid-cols-2 gap-3">
              <Input label="العملة" maxLength={3} required value={revaluation.currency} onChange={(e) => setRevaluation({ ...revaluation, currency: e.target.value })} />
              <Input label="حتى تاريخ" type="date" required value={revaluation.asOfDate} onChange={(e) => setRevaluation({ ...revaluation, asOfDate: e.target.value })} />
            </div>
            <Select label="حساب أرباح فروق العملة" required value={revaluation.gainAccountId} onChange={(e) => setRevaluation({ ...revaluation, gainAccountId: e.target.value })} options={revenueAccounts.map((a) => ({ value: a.id, label: `${a.code} — ${a.name}` }))} />
            <Select label="حساب خسائر فروق العملة" required value={revaluation.lossAccountId} onChange={(e) => setRevaluation({ ...revaluation, lossAccountId: e.target.value })} options={expenseAccounts.map((a) => ({ value: a.id, label: `${a.code} — ${a.name}` }))} />
            <div className="flex justify-end"><Button type="submit" isLoading={busy}><RefreshCw className="h-4 w-4" /> إعادة تقييم</Button></div>
          </form>
          {lastRevaluation && (
            <div className="rounded-lg border border-slate-700 p-3 text-sm grid grid-cols-2 gap-2">
              <span className="text-slate-400">الرصيد الأجنبي</span><span className="text-white text-left">{Number(lastRevaluation.foreignBalance).toLocaleString()}</span>
              <span className="text-slate-400">القيمة الدفترية</span><span className="text-white text-left">{Number(lastRevaluation.carryingBase).toLocaleString()} {baseCurrency}</span>
              <span className="text-slate-400">القيمة بسعر الإقفال</span><span className="text-white text-left">{Number(lastRevaluation.expectedBase).toLocaleString()} {baseCurrency}</span>
              <span className="text-slate-400">فرق العملة</span><span className={`text-left font-bold ${Number(lastRevaluation.difference) >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>{Number(lastRevaluation.difference).toLocaleString()} {baseCurrency}</span>
            </div>
          )}
        </section>
      </div>

      <section className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-white font-bold">قيد بعملة أجنبية</h2>
            <p className="text-xs text-slate-500 mt-1">يُحوّل تلقائيًا إلى {baseCurrency} مع الاحتفاظ بالمبالغ الأصلية.</p>
          </div>
          <Button type="button" variant="ghost" onClick={addLine}><Plus className="h-4 w-4" /> سطر</Button>
        </div>
        <form onSubmit={postForeignJournal} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
            <Input label="رقم القيد" required value={journal.entryNumber} onChange={(e) => setJournal({ ...journal, entryNumber: e.target.value })} />
            <Input label="الوصف" required value={journal.description} onChange={(e) => setJournal({ ...journal, description: e.target.value })} />
            <Input label="العملة" maxLength={3} required value={journal.currency} onChange={(e) => setJournal({ ...journal, currency: e.target.value })} />
            <Input label="التاريخ" type="date" required value={journal.date} onChange={(e) => setJournal({ ...journal, date: e.target.value })} />
          </div>
          <div className="space-y-2">
            {journal.lines.map((line: any, index: number) => (
              <div key={index} className="grid grid-cols-1 md:grid-cols-[1fr_180px_180px_44px] gap-2 items-end">
                <Select label={index === 0 ? 'الحساب' : ''} required value={line.accountId} onChange={(e) => updateLine(index, { accountId: e.target.value })} options={accounts.filter((a) => a.isActive !== false).map((a) => ({ value: a.id, label: `${a.code} — ${a.name}` }))} />
                <Input label={index === 0 ? 'مدين أصلي' : ''} type="number" step="0.0001" value={line.foreignDebitAmount} onChange={(e) => updateLine(index, { foreignDebitAmount: e.target.value, foreignCreditAmount: e.target.value ? '' : line.foreignCreditAmount })} />
                <Input label={index === 0 ? 'دائن أصلي' : ''} type="number" step="0.0001" value={line.foreignCreditAmount} onChange={(e) => updateLine(index, { foreignCreditAmount: e.target.value, foreignDebitAmount: e.target.value ? '' : line.foreignDebitAmount })} />
                <button type="button" disabled={journal.lines.length <= 2} onClick={() => removeLine(index)} className="h-10 rounded-lg text-red-400 hover:bg-red-500/10 disabled:opacity-30"><Trash2 className="h-4 w-4 mx-auto" /></button>
              </div>
            ))}
          </div>
          <div className="flex justify-end"><Button type="submit" isLoading={busy}>ترحيل القيد</Button></div>
        </form>
      </section>
    </div>
  );
}
