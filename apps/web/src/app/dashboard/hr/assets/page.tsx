'use client';

import { useEffect, useMemo, useState } from 'react';
import api from '@/lib/api';
import { CheckCircle2, PackageCheck, Plus, RotateCcw, AlertTriangle, Landmark, X } from 'lucide-react';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import Modal from '@/components/ui/Modal';
import Select from '@/components/ui/Select';

export default function HrAssetsPage() {
  const [assets, setAssets] = useState<any[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [employees, setEmployees] = useState<any[]>([]);
  const [assignments, setAssignments] = useState<any[]>([]);
  const [assetOpen, setAssetOpen] = useState(false);
  const [assignOpen, setAssignOpen] = useState(false);
  const [assetForm, setAssetForm] = useState<any>({ purchaseDate: new Date().toISOString().slice(0,10) });
  const [assignForm, setAssignForm] = useState<any>({});
  const [busy, setBusy] = useState(false);
  const [accounts, setAccounts] = useState<any[]>([]);
  const [closeItem, setCloseItem] = useState<any>(null);
  const [closeStatus, setCloseStatus] = useState<'LOST'|'DAMAGED'|null>(null);
  const [closeData, setCloseData] = useState<any>({});

  const load = () => Promise.all([
    api.get('/hr/assets').then(r => setAssets(r.data.data || [])),
    api.get('/hr/assets/categories').then(r => setCategories(r.data || [])),
    api.get('/hr/employees?limit=200').then(r => setEmployees(r.data.data || [])),
    api.get('/hr/assets/custody/assignments').then(r => setAssignments(r.data.data || [])),
  ]).catch(console.error);
  useEffect(() => { load(); }, []);

  const categoryOptions = categories.map(c => ({ value: c.id, label: c.name }));
  const employeeOptions = employees.filter(e => e.status === 'ACTIVE').map(e => ({
    value: e.id, label: `${e.firstName} ${e.lastName} · ${e.employeeCode}`
  }));
  const assetOptions = useMemo(() => assets
    .filter(a => a.status === 'ACTIVE' && !(a.custodyAssignments || []).length)
    .map(a => ({ value: a.id, label: `${a.name}${a.code ? ' · ' + a.code : ''}` })), [assets]);

  const createCategory = async () => {
    const name = prompt('اسم فئة الأصل');
    if (!name?.trim()) return;
    const code = prompt('رمز الفئة (اختياري)') || undefined;
    try {
      await api.post('/hr/assets/categories', { name: name.trim(), code });
      await load();
    } catch (err: any) { alert(err?.response?.data?.message || 'تعذر إنشاء الفئة'); }
  };

  const createAsset = async () => {
    setBusy(true);
    try {
      await api.post('/hr/assets', {
        name: assetForm.name,
        code: assetForm.code || undefined,
        categoryId: assetForm.categoryId,
        acquisitionCost: Number(assetForm.acquisitionCost),
        salvageValue: Number(assetForm.salvageValue || 0),
        purchaseDate: assetForm.purchaseDate,
        location: assetForm.location || undefined,
        notes: assetForm.notes || undefined,
      });
      setAssetOpen(false);
      setAssetForm({ purchaseDate: new Date().toISOString().slice(0,10) });
      await load();
    } catch (err: any) { alert(err?.response?.data?.message || 'تعذر إنشاء الأصل'); }
    finally { setBusy(false); }
  };

  const assign = async () => {
    setBusy(true);
    try {
      await api.post('/hr/assets/custody/assign', {
        assetId: assignForm.assetId,
        employeeId: assignForm.employeeId,
        expectedReturnAt: assignForm.expectedReturnAt || undefined,
        conditionOut: assignForm.conditionOut || undefined,
        notes: assignForm.notes || undefined,
      });
      setAssignOpen(false); setAssignForm({}); await load();
    } catch (err: any) { alert(err?.response?.data?.message || 'تعذر تسليم العهدة'); }
    finally { setBusy(false); }
  };

  const close = async (item: any, status: 'RETURNED'|'LOST'|'DAMAGED') => {
    if (status === 'RETURNED') {
      const conditionIn = prompt('حالة الأصل عند الاستلام') || '';
      if (!confirm('تأكيد استلام العهدة؟')) return;
      await api.post(`/hr/assets/custody/${item.id}/close`, { status, conditionIn });
      await load();
      return;
    }

    setBusy(true);
    try {
      const r = await api.get('/finance/chart-of-accounts');
      setAccounts((r.data?.data || []).filter((account: any) => account.isActive !== false));
      setCloseItem(item);
      setCloseStatus(status);
      setCloseData({});
    } catch (err: any) {
      alert(err?.response?.data?.message || 'تعذر تحميل دليل الحسابات');
    } finally {
      setBusy(false);
    }
  };

  const submitAccountingClose = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!closeItem || !closeStatus) return;

    const payload: any = {
      status: closeStatus,
      assetAccountId: closeData.assetAccountId,
      lossAccountId: closeData.lossAccountId,
      notes: closeData.notes || undefined,
    };
    if (closeStatus === 'LOST') {
      payload.accumulatedDepreciationAccountId = closeData.accumulatedDepreciationAccountId;
    }
    if (closeStatus === 'DAMAGED') {
      payload.impairmentAmount = Number(closeData.impairmentAmount);
    }

    setBusy(true);
    try {
      await api.post(`/hr/assets/custody/${closeItem.id}/close`, payload);
      setCloseItem(null);
      setCloseStatus(null);
      setCloseData({});
      await load();
      alert(closeStatus === 'LOST'
        ? 'تم استبعاد الأصل المفقود وترحيل الخسارة محاسبيًا'
        : 'تم إثبات انخفاض قيمة الأصل المتضرر محاسبيًا');
    } catch (err: any) {
      alert(err?.response?.data?.message || 'تعذر إغلاق العهدة محاسبيًا');
    } finally {
      setBusy(false);
    }
  };

  const accountOptions = (type: string) => accounts
    .filter((account: any) => account.type === type)
    .map((account: any) => ({ value: account.id, label: `${account.code} — ${account.name}` }));

  return <div className="space-y-6 animate-fade-in-up">
    <div className="flex justify-between gap-4 flex-wrap">
      <div>
        <h1 className="text-2xl font-bold text-white flex items-center gap-2"><PackageCheck className="h-6 w-6 text-primary-400" /> العهد والأصول</h1>
        <p className="text-slate-400 text-sm mt-1">الأصل المالي نفسه مع سجل تسليم واسترداد ومنع عهدتين نشطتين لنفس الأصل.</p>
      </div>
      <div className="flex gap-2">
        <Button variant="ghost" onClick={createCategory}><Plus className="h-4 w-4" /> فئة أصل</Button>
        <Button variant="ghost" onClick={() => setAssetOpen(true)}><Plus className="h-4 w-4" /> أصل</Button>
        <Button onClick={() => setAssignOpen(true)}><PackageCheck className="h-4 w-4" /> تسليم عهدة</Button>
      </div>
    </div>

    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
      <div className="scc-card"><div className="text-slate-500 text-sm">إجمالي الأصول</div><div className="text-2xl font-bold text-white mt-1">{assets.length}</div></div>
      <div className="scc-card"><div className="text-slate-500 text-sm">عهد نشطة</div><div className="text-2xl font-bold text-primary-400 mt-1">{assignments.filter(a=>a.status==='ACTIVE').length}</div></div>
      <div className="scc-card"><div className="text-slate-500 text-sm">مفقود/متضرر</div><div className="text-2xl font-bold text-amber-400 mt-1">{assignments.filter(a=>['LOST','DAMAGED'].includes(a.status)).length}</div></div>
    </div>

    <div className="scc-card">
      <h2 className="font-bold text-white mb-4">العهد الحالية والسجل</h2>
      <div className="space-y-3">
        {assignments.length === 0 ? <p className="text-slate-500 text-sm">لا توجد عهد مسجلة.</p> :
          assignments.map(item => <div key={item.id} className="flex justify-between gap-4 border-b border-slate-800 pb-3">
            <div>
              <div className="text-white font-medium">{item.asset?.name} {item.asset?.code ? '· '+item.asset.code : ''}</div>
              <div className="text-slate-400 text-sm">{item.employee?.firstName} {item.employee?.lastName} · {item.employee?.employeeCode}</div>
              <div className="text-slate-500 text-xs mt-1">من {new Date(item.assignedAt).toLocaleDateString('ar-SA')} · {item.status}</div>
            </div>
            {item.status === 'ACTIVE' && <div className="flex gap-1 items-center">
              <button onClick={() => close(item,'RETURNED')} className="p-2 text-emerald-400" title="استلام"><RotateCcw className="h-4 w-4" /></button>
              <button onClick={() => close(item,'DAMAGED')} className="p-2 text-amber-400" title="متضرر"><AlertTriangle className="h-4 w-4" /></button>
              <button onClick={() => close(item,'LOST')} className="p-2 text-red-400" title="مفقود"><AlertTriangle className="h-4 w-4" /></button>
            </div>}
          </div>)}
      </div>
    </div>

    <Modal isOpen={assetOpen} onClose={() => setAssetOpen(false)} title="إضافة أصل ثابت" size="lg">
      <div className="space-y-4">
        <Input label="اسم الأصل" required value={assetForm.name||''} onChange={e=>setAssetForm({...assetForm,name:e.target.value})} />
        <Input label="رمز الأصل" value={assetForm.code||''} onChange={e=>setAssetForm({...assetForm,code:e.target.value})} />
        <Select label="الفئة" required options={categoryOptions} value={assetForm.categoryId||''} onChange={e=>setAssetForm({...assetForm,categoryId:e.target.value})} />
        <div className="grid grid-cols-2 gap-4">
          <Input label="تكلفة الشراء" type="number" required value={assetForm.acquisitionCost||''} onChange={e=>setAssetForm({...assetForm,acquisitionCost:e.target.value})} />
          <Input label="القيمة التخريدية" type="number" value={assetForm.salvageValue||''} onChange={e=>setAssetForm({...assetForm,salvageValue:e.target.value})} />
          <Input label="تاريخ الشراء" type="date" required value={assetForm.purchaseDate||''} onChange={e=>setAssetForm({...assetForm,purchaseDate:e.target.value})} />
          <Input label="الموقع" value={assetForm.location||''} onChange={e=>setAssetForm({...assetForm,location:e.target.value})} />
        </div>
        <div className="flex justify-end"><Button disabled={!assetForm.name||!assetForm.categoryId||!assetForm.acquisitionCost} isLoading={busy} onClick={createAsset}>حفظ الأصل</Button></div>
      </div>
    </Modal>

    <Modal isOpen={assignOpen} onClose={() => setAssignOpen(false)} title="تسليم عهدة" size="lg">
      <div className="space-y-4">
        <Select label="الأصل المتاح" options={assetOptions} value={assignForm.assetId||''} onChange={e=>setAssignForm({...assignForm,assetId:e.target.value})} />
        <Select label="الموظف" options={employeeOptions} value={assignForm.employeeId||''} onChange={e=>setAssignForm({...assignForm,employeeId:e.target.value})} />
        <Input label="موعد الاسترداد المتوقع" type="date" value={assignForm.expectedReturnAt||''} onChange={e=>setAssignForm({...assignForm,expectedReturnAt:e.target.value})} />
        <Input label="حالة الأصل عند التسليم" value={assignForm.conditionOut||''} onChange={e=>setAssignForm({...assignForm,conditionOut:e.target.value})} />
        <Input label="ملاحظات" value={assignForm.notes||''} onChange={e=>setAssignForm({...assignForm,notes:e.target.value})} />
        <div className="flex justify-end"><Button disabled={!assignForm.assetId||!assignForm.employeeId} isLoading={busy} onClick={assign}><CheckCircle2 className="h-4 w-4" /> تأكيد التسليم</Button></div>
      </div>
    </Modal>

    <Modal isOpen={!!closeItem && !!closeStatus} onClose={() => { setCloseItem(null); setCloseStatus(null); }} title={closeStatus === 'LOST' ? 'استبعاد أصل مفقود' : 'إثبات انخفاض قيمة أصل متضرر'} size="lg">
      <form onSubmit={submitAccountingClose} className="space-y-4">
        <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-4 text-sm text-slate-300">
          {closeStatus === 'LOST'
            ? 'سيتم إغلاق العهدة واستبعاد الأصل من الدفاتر في transaction واحدة. القيد: مدين مجمع الإهلاك + خسارة الاستبعاد، دائن حساب الأصل بالتكلفة التاريخية.'
            : 'سيتم إغلاق العهدة وتخفيض القيمة الدفترية للأصل في transaction واحدة. يبقى الأصل نشطًا ما دامت قيمته الدفترية أكبر من صفر.'}
        </div>
        <Select
          label="حساب الأصل الثابت"
          required
          options={accountOptions('ASSET')}
          value={closeData.assetAccountId || ''}
          onChange={e => setCloseData({ ...closeData, assetAccountId: e.target.value })}
        />
        {closeStatus === 'LOST' && (
          <Select
            label="حساب مجمع الإهلاك"
            required
            options={accountOptions('ASSET')}
            value={closeData.accumulatedDepreciationAccountId || ''}
            onChange={e => setCloseData({ ...closeData, accumulatedDepreciationAccountId: e.target.value })}
          />
        )}
        <Select
          label={closeStatus === 'LOST' ? 'حساب خسارة استبعاد الأصل' : 'حساب خسارة انخفاض القيمة'}
          required
          options={accountOptions('EXPENSE')}
          value={closeData.lossAccountId || ''}
          onChange={e => setCloseData({ ...closeData, lossAccountId: e.target.value })}
        />
        {closeStatus === 'DAMAGED' && (
          <Input
            label={`مبلغ انخفاض القيمة — القيمة الدفترية الحالية ${Number(closeItem?.asset?.currentValue || 0).toLocaleString('ar-SA')} ر.س`}
            type="number"
            required
            value={closeData.impairmentAmount || ''}
            onChange={e => setCloseData({ ...closeData, impairmentAmount: e.target.value })}
          />
        )}
        <Input
          label="ملاحظات"
          value={closeData.notes || ''}
          onChange={e => setCloseData({ ...closeData, notes: e.target.value })}
        />
        <div className="flex justify-end gap-3">
          <Button type="button" variant="ghost" onClick={() => { setCloseItem(null); setCloseStatus(null); }}>
            <X className="h-4 w-4" /> إلغاء
          </Button>
          <Button type="submit" isLoading={busy}>
            <Landmark className="h-4 w-4" /> تنفيذ وإثبات القيد
          </Button>
        </div>
      </form>
    </Modal>

  </div>;
}
