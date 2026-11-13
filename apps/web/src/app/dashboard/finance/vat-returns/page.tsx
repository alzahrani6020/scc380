'use client';

import { useEffect, useMemo, useState } from 'react';
import { FileCheck2, Plus, RefreshCcw, ShieldCheck, Trash2 } from 'lucide-react';
import api from '@/lib/api';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import Select from '@/components/ui/Select';

export default function VatReturnsPage() {
  const [items, setItems] = useState<any[]>([]);
  const [accounts, setAccounts] = useState<any[]>([]);
  const [config, setConfig] = useState<any>({
    baseCurrency: 'SAR',
    vatSettlementPayableAccountId: '',
    vatSettlementReceivableAccountId: '',
  });
  const [form, setForm] = useState({
    periodStart: new Date().toISOString().slice(0, 8) + '01',
    periodEnd: new Date().toISOString().slice(0, 10),
  });
  const [previews, setPreviews] = useState<Record<string, any>>({});
  const [busy, setBusy] = useState(false);

  const liabilityAccounts = useMemo(
    () => accounts.filter((a) => a.type === 'LIABILITY' && a.isActive !== false),
    [accounts],
  );
  const assetAccounts = useMemo(
    () => accounts.filter((a) => a.type === 'ASSET' && a.isActive !== false),
    [accounts],
  );

  const load = async () => {
    const [returns, cfg, coa] = await Promise.all([
      api.get('/finance/vat-returns'),
      api.get('/finance/vat-returns/config'),
      api.get('/finance/chart-of-accounts'),
    ]);
    setItems(returns.data || []);
    setConfig({
      baseCurrency: cfg.data?.baseCurrency || 'SAR',
      vatSettlementPayableAccountId: cfg.data?.vatSettlementPayableAccountId || '',
      vatSettlementReceivableAccountId: cfg.data?.vatSettlementReceivableAccountId || '',
    });
    setAccounts(coa.data?.data || []);
  };

  useEffect(() => {
    load().catch((err) => alert(err.response?.data?.message || 'تعذر تحميل إقرارات ضريبة القيمة المضافة'));
  }, []);

  const run = async (fn: () => Promise<any>) => {
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

  const create = (e: React.FormEvent) => {
    e.preventDefault();
    return run(() => api.post('/finance/vat-returns', form));
  };

  const saveConfig = (e: React.FormEvent) => {
    e.preventDefault();
    return run(() =>
      api.patch('/finance/vat-returns/config', {
        payableAccountId: config.vatSettlementPayableAccountId,
        receivableAccountId: config.vatSettlementReceivableAccountId,
      }),
    );
  };

  const preview = async (id: string) => {
    try {
      const r = await api.get(`/finance/vat-returns/${id}/preview`);
      setPreviews((old) => ({ ...old, [id]: r.data }));
    } catch (err: any) {
      alert(err.response?.data?.message || 'تعذر احتساب الإقرار');
    }
  };

  const money = (value: any) =>
    Number(value || 0).toLocaleString('ar-SA', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  return (
    <div className="space-y-6 animate-fade-in-up">
      <div>
        <h1 className="text-2xl font-bold text-white flex items-center gap-2">
          <FileCheck2 className="h-6 w-6 text-primary-400" />
          إقرارات ضريبة القيمة المضافة
        </h1>
        <p className="text-slate-400 text-sm mt-1">
          الإقرار يعتمد على القيود المرحلة بالعملة الأساسية، ثم يُقفل ويُسوّى دون حذف الأثر المحاسبي.
        </p>
      </div>

      <section className="bg-slate-900 border border-slate-800 rounded-xl p-5">
        <h2 className="text-white font-bold mb-4">حسابات تسوية الضريبة</h2>
        <form onSubmit={saveConfig} className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <Select
            label="حساب ضريبة مستحقة الدفع"
            required
            value={config.vatSettlementPayableAccountId}
            onChange={(e) => setConfig({ ...config, vatSettlementPayableAccountId: e.target.value })}
            options={liabilityAccounts.map((a) => ({ value: a.id, label: `${a.code} — ${a.name}` }))}
          />
          <Select
            label="حساب ضريبة مستحقة الاسترداد"
            required
            value={config.vatSettlementReceivableAccountId}
            onChange={(e) => setConfig({ ...config, vatSettlementReceivableAccountId: e.target.value })}
            options={assetAccounts.map((a) => ({ value: a.id, label: `${a.code} — ${a.name}` }))}
          />
          <div className="md:col-span-2 flex justify-end">
            <Button type="submit" isLoading={busy}>حفظ الحسابات</Button>
          </div>
        </form>
      </section>

      <section className="bg-slate-900 border border-slate-800 rounded-xl p-5">
        <h2 className="text-white font-bold mb-4">فترة ضريبية جديدة</h2>
        <form onSubmit={create} className="grid grid-cols-1 md:grid-cols-[1fr_1fr_auto] gap-3 items-end">
          <Input
            label="من"
            type="date"
            required
            value={form.periodStart}
            onChange={(e) => setForm({ ...form, periodStart: e.target.value })}
          />
          <Input
            label="إلى"
            type="date"
            required
            value={form.periodEnd}
            onChange={(e) => setForm({ ...form, periodEnd: e.target.value })}
          />
          <Button type="submit" isLoading={busy}><Plus className="h-4 w-4" /> إنشاء</Button>
        </form>
      </section>

      <section className="space-y-3">
        {items.length === 0 ? (
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-8 text-center text-slate-500">
            لا توجد فترات ضريبية بعد.
          </div>
        ) : items.map((item) => {
          const p = previews[item.id] || item;
          const statusLabel =
            item.status === 'DRAFT' ? 'مسودة' :
            item.status === 'FILED' ? 'مُقدَّم' :
            'مُسوّى';
          return (
            <div key={item.id} className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-4">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-white font-bold">
                      {new Date(item.periodStart).toLocaleDateString('ar-SA')} — {new Date(item.periodEnd).toLocaleDateString('ar-SA')}
                    </h3>
                    <span className="text-xs px-2 py-1 rounded-full bg-slate-800 text-slate-300">{statusLabel}</span>
                  </div>
                  <p className="text-xs text-slate-500 mt-1">العملة الأساسية: {config.baseCurrency}</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button type="button" variant="ghost" onClick={() => preview(item.id)}>
                    <RefreshCcw className="h-4 w-4" /> احتساب
                  </Button>
                  {item.status === 'DRAFT' && (
                    <>
                      <Button type="button" onClick={() => run(() => api.post(`/finance/vat-returns/${item.id}/file`))} isLoading={busy}>
                        <ShieldCheck className="h-4 w-4" /> تقديم وإقفال
                      </Button>
                      <Button type="button" variant="ghost" onClick={() => run(() => api.delete(`/finance/vat-returns/${item.id}`))}>
                        <Trash2 className="h-4 w-4" /> حذف
                      </Button>
                    </>
                  )}
                  {item.status === 'FILED' && (
                    <Button type="button" onClick={() => run(() => api.post(`/finance/vat-returns/${item.id}/settle`))} isLoading={busy}>
                      تسوية محاسبية
                    </Button>
                  )}
                  {item.status === 'SETTLED' && (
                    <Button type="button" variant="ghost" onClick={() => run(() => api.post(`/finance/vat-returns/${item.id}/reverse-settlement`))} isLoading={busy}>
                      عكس التسوية
                    </Button>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div className="rounded-lg bg-slate-800/50 p-3">
                  <p className="text-xs text-slate-400">ضريبة المخرجات</p>
                  <p className="text-lg font-bold text-white">{money(p.outputVat)} {config.baseCurrency}</p>
                </div>
                <div className="rounded-lg bg-slate-800/50 p-3">
                  <p className="text-xs text-slate-400">ضريبة المدخلات</p>
                  <p className="text-lg font-bold text-white">{money(p.inputVat)} {config.baseCurrency}</p>
                </div>
                <div className="rounded-lg bg-slate-800/50 p-3">
                  <p className="text-xs text-slate-400">الصافي</p>
                  <p className={`text-lg font-bold ${Number(p.netVat || 0) >= 0 ? 'text-amber-400' : 'text-emerald-400'}`}>
                    {money(p.netVat)} {config.baseCurrency}
                  </p>
                </div>
              </div>
            </div>
          );
        })}
      </section>
    </div>
  );
}
