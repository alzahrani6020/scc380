'use client';

import { useEffect, useState } from 'react';
import api from '@/lib/api';
import EmployeePicker from '@/components/hr/EmployeePicker';
import { Calculator, CheckCircle2, ReceiptText, WalletCards, X, Landmark } from 'lucide-react';
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
  const [preview, setPreview] = useState<any>(null);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [accounts, setAccounts] = useState<any[]>([]);
  const [accountingItem, setAccountingItem] = useState<any>(null);
  const [accountingData, setAccountingData] = useState<any>({});
  const [paymentItem, setPaymentItem] = useState<any>(null);
  const [paymentData, setPaymentData] = useState<any>({});
  const [paymentRecordItem,setPaymentRecordItem] = useState<any>(null);
  const [paymentRecord,setPaymentRecord] = useState({paymentReference:'',paymentMethod:'BANK_TRANSFER'});
  const [form, setForm] = useState<any>({
    reason: 'RESIGNATION', initiatedBy: 'EMPLOYEE',
    lastWorkingDate: new Date().toISOString().split('T')[0],
    deductOutstandingLoans: true,
  });

  const load = () => api.get('/hr/end-service-settlements')
    .then(r=>setItems(r.data.data||[])).catch(console.error);
  useEffect(() => { load(); }, []);

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
  const transition = async (id:string) => {
    if (!confirm('اعتماد المخالصة وقفل مبالغها؟')) return;
    setBusy(true);
    try {
      await api.post(`/hr/end-service-settlements/${id}/approve`,{});
      await load();
    } catch(e:any) { alert(e.response?.data?.message||'تعذر اعتماد المخالصة'); }
    finally { setBusy(false); }
  };

  const recordSettlementPayment = async (e:React.FormEvent) => {
    e.preventDefault();
    if(!paymentRecordItem||paymentRecord.paymentReference.trim().length<6)return;
    if(!confirm('أؤكد توفر إثبات دفع حقيقي مطابق لمرجع العملية المدخل. تسجيل الصرف لا ينهي خدمة الموظف.'))return;
    setBusy(true);
    try {
      await api.post(`/hr/end-service-settlements/${paymentRecordItem.id}/pay`,{
        paymentReference:paymentRecord.paymentReference.trim(),
        paymentMethod:paymentRecord.paymentMethod,
      });
      setPaymentRecordItem(null);
      setPaymentRecord({paymentReference:'',paymentMethod:'BANK_TRANSFER'});
      await load();
    } catch(e:any){ alert(e.response?.data?.message||'تعذر توثيق دفع المخالصة'); }
    finally { setBusy(false); }
  };

  const loadAccounts = async () => {
    const r = await api.get('/finance/chart-of-accounts');
    const active = (r.data?.data || []).filter((account: any) => account.isActive !== false);
    setAccounts(active);
    return active;
  };

  const openAccounting = async (item: any) => {
    setBusy(true);
    try {
      await loadAccounts();
      setAccountingData({});
      setAccountingItem(item);
    } catch (err: any) {
      alert(err?.response?.data?.message || 'تعذر تحميل دليل الحسابات');
    } finally {
      setBusy(false);
    }
  };

  const postAccounting = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!accountingItem) return;

    const dto: any = {
      settlementPayableAccountId: accountingData.settlementPayableAccountId,
    };
    if (Number(accountingItem.eosAward || 0) > 0) dto.eosExpenseAccountId = accountingData.eosExpenseAccountId;
    if (Number(accountingItem.leaveEncashment || 0) > 0) dto.leaveEncashmentAccountId = accountingData.leaveEncashmentAccountId;
    if (Number(accountingItem.unpaidSalary || 0) > 0) dto.unpaidSalaryAccountId = accountingData.unpaidSalaryAccountId;
    if (Number(accountingItem.otherEntitlements || 0) > 0) dto.otherEntitlementsAccountId = accountingData.otherEntitlementsAccountId;
    if (Number(accountingItem.compensation || 0) > 0) dto.compensationAccountId = accountingData.compensationAccountId;
    if (Number(accountingItem.loanDeduction || 0) > 0) dto.loanReceivableAccountId = accountingData.loanReceivableAccountId;
    if (Number(accountingItem.otherDeductions || 0) > 0) dto.otherDeductionAccountId = accountingData.otherDeductionAccountId;

    setBusy(true);
    try {
      await api.post(`/hr/end-service-settlements/${accountingItem.id}/post-accounting`, dto);
      setAccountingItem(null);
      alert('تم ترحيل استحقاق المخالصة إلى المحاسبة بنجاح');
    } catch (err: any) {
      alert(err?.response?.data?.message || 'تعذر ترحيل استحقاق المخالصة');
    } finally {
      setBusy(false);
    }
  };

  const openPaymentAccounting = async (item: any) => {
    setBusy(true);
    try {
      await loadAccounts();
      setPaymentData({});
      setPaymentItem(item);
    } catch (err: any) {
      alert(err?.response?.data?.message || 'تعذر تحميل دليل الحسابات');
    } finally {
      setBusy(false);
    }
  };

  const postPaymentAccounting = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!paymentItem) return;
    setBusy(true);
    try {
      await api.post(`/hr/end-service-settlements/${paymentItem.id}/post-payment-accounting`, {
        cashAccountId: paymentData.cashAccountId,
      });
      setPaymentItem(null);
      alert('تم ترحيل سداد المخالصة إلى المحاسبة بنجاح');
    } catch (err: any) {
      alert(err?.response?.data?.message || 'تعذر ترحيل سداد المخالصة');
    } finally {
      setBusy(false);
    }
  };

  const accountOptions = (type: string) => accounts
    .filter((account: any) => account.type === type)
    .map((account: any) => ({ value: account.id, label: `${account.code} — ${account.name}` }));

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
                {item.status === 'DRAFT' && <Button size="sm" onClick={() => transition(item.id)}><CheckCircle2 className="h-3 w-3" /> اعتماد</Button>}
                {item.status === 'APPROVED' && <Button size="sm" onClick={() => {
                  setPaymentRecordItem(item);
                  setPaymentRecord({paymentReference:'',paymentMethod:'BANK_TRANSFER'});
                }}><WalletCards className="h-3 w-3" /> توثيق السداد</Button>}
                {['APPROVED','PAID'].includes(item.status) && (
                  <Button size="sm" variant="ghost" onClick={() => openAccounting(item)} isLoading={busy}>
                    <Landmark className="h-3 w-3" /> ترحيل الاستحقاق
                  </Button>
                )}
                {item.status === 'PAID' && (
                  <Button size="sm" variant="ghost" onClick={() => openPaymentAccounting(item)} isLoading={busy}>
                    <WalletCards className="h-3 w-3" /> ترحيل السداد
                  </Button>
                )}
              </div>
            </div>
          ))}
      </div>

      <Modal isOpen={open} onClose={() => { setOpen(false); setPreview(null); }} title="مخالصة نهاية خدمة" size="xl">
        <div className="space-y-4">
          <EmployeePicker required value={form.employeeId||''}
            onChange={employeeId=>{setForm((prev:any)=>({...prev,employeeId}));setPreview(null);}}/>
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

      <Modal isOpen={!!accountingItem} onClose={() => setAccountingItem(null)} title="ترحيل استحقاق المخالصة إلى المحاسبة" size="xl">
        <form onSubmit={postAccounting} className="space-y-4">
          <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-4 text-sm text-slate-300">
            ينشئ النظام قيد استحقاق متوازن للمخالصة. يمنع النظام تكرار ترحيل نفس المخالصة.
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Select
              label="حساب المخالصة المستحقة"
              required
              options={accountOptions('LIABILITY')}
              value={accountingData.settlementPayableAccountId || ''}
              onChange={e => setAccountingData({ ...accountingData, settlementPayableAccountId: e.target.value })}
            />
            {Number(accountingItem?.eosAward || 0) > 0 && (
              <Select
                label="حساب مصروف مكافأة نهاية الخدمة"
                required
                options={accountOptions('EXPENSE')}
                value={accountingData.eosExpenseAccountId || ''}
                onChange={e => setAccountingData({ ...accountingData, eosExpenseAccountId: e.target.value })}
              />
            )}
            {Number(accountingItem?.leaveEncashment || 0) > 0 && (
              <Select
                label="حساب بدل رصيد الإجازة"
                required
                options={accountOptions('EXPENSE')}
                value={accountingData.leaveEncashmentAccountId || ''}
                onChange={e => setAccountingData({ ...accountingData, leaveEncashmentAccountId: e.target.value })}
              />
            )}
            {Number(accountingItem?.unpaidSalary || 0) > 0 && (
              <Select
                label="حساب الراتب غير المدفوع"
                required
                options={accountOptions('EXPENSE')}
                value={accountingData.unpaidSalaryAccountId || ''}
                onChange={e => setAccountingData({ ...accountingData, unpaidSalaryAccountId: e.target.value })}
              />
            )}
            {Number(accountingItem?.otherEntitlements || 0) > 0 && (
              <Select
                label="حساب الاستحقاقات الأخرى"
                required
                options={accountOptions('EXPENSE')}
                value={accountingData.otherEntitlementsAccountId || ''}
                onChange={e => setAccountingData({ ...accountingData, otherEntitlementsAccountId: e.target.value })}
              />
            )}
            {Number(accountingItem?.compensation || 0) > 0 && (
              <Select
                label="حساب التعويضات"
                required
                options={accountOptions('EXPENSE')}
                value={accountingData.compensationAccountId || ''}
                onChange={e => setAccountingData({ ...accountingData, compensationAccountId: e.target.value })}
              />
            )}
            {Number(accountingItem?.loanDeduction || 0) > 0 && (
              <Select
                label="حساب سلف وقروض الموظفين"
                required
                options={accountOptions('ASSET')}
                value={accountingData.loanReceivableAccountId || ''}
                onChange={e => setAccountingData({ ...accountingData, loanReceivableAccountId: e.target.value })}
              />
            )}
            {Number(accountingItem?.otherDeductions || 0) > 0 && (
              <Select
                label="حساب الخصومات الأخرى المستحقة"
                required
                options={accountOptions('LIABILITY')}
                value={accountingData.otherDeductionAccountId || ''}
                onChange={e => setAccountingData({ ...accountingData, otherDeductionAccountId: e.target.value })}
              />
            )}
          </div>
          <div className="flex justify-end gap-3">
            <Button type="button" variant="ghost" onClick={() => setAccountingItem(null)}><X className="h-4 w-4" /> إلغاء</Button>
            <Button type="submit" isLoading={busy}><Landmark className="h-4 w-4" /> ترحيل الاستحقاق</Button>
          </div>
        </form>
      </Modal>

      <Modal isOpen={!!paymentRecordItem} onClose={() => setPaymentRecordItem(null)} title="توثيق سداد مخالصة نهاية الخدمة" size="lg">
        <form onSubmit={recordSettlementPayment} className="space-y-4">
          <div className="rounded-lg border border-amber-500/40 p-3 text-sm text-amber-200">
            يتطلب تسجيل السداد مرجع عملية دفع حقيقية. هذا إجراء توثيقي وليس تنفيذ تحويل بنكي أو إنهاء خدمة الموظف.
          </div>
          <p className="text-sm text-slate-300">صافي المخالصة: {Number(paymentRecordItem?.netSettlement||0).toLocaleString('ar-SA')} ر.س</p>
          <Input label="مرجع الدفع البنكي أو رقم سند الصرف" required
            value={paymentRecord.paymentReference} maxLength={160}
            onChange={e=>setPaymentRecord({...paymentRecord,paymentReference:e.target.value})}/>
          <Select label="طريقة الدفع" required options={[
            {value:'BANK_TRANSFER',label:'تحويل بنكي'},
            {value:'CASH',label:'نقدًا'},
            {value:'CHEQUE',label:'شيك'},
            {value:'OTHER',label:'طريقة أخرى موثقة'},
          ]} value={paymentRecord.paymentMethod}
            onChange={e=>setPaymentRecord({...paymentRecord,paymentMethod:e.target.value})}/>
          <div className="flex justify-end gap-3">
            <Button type="button" variant="ghost" onClick={()=>setPaymentRecordItem(null)}>إلغاء</Button>
            <Button type="submit" isLoading={busy} disabled={paymentRecord.paymentReference.trim().length<6}>تسجيل مرجع السداد</Button>
          </div>
        </form>
      </Modal>

      <Modal isOpen={!!paymentItem} onClose={() => setPaymentItem(null)} title="ترحيل سداد المخالصة إلى المحاسبة" size="lg">
        <form onSubmit={postPaymentAccounting} className="space-y-4">
          <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-4 text-sm text-slate-300">
            يستخرج النظام حساب المخالصة المستحقة تلقائيًا من قيد الاستحقاق نفسه، ثم يصفّيه مقابل حساب البنك أو الصندوق. يشترط أن تكون المخالصة مدفوعة وأن يكون قيد الاستحقاق موجودًا.
          </div>
          <Select
            label="حساب البنك / الصندوق"
            required
            options={accountOptions('ASSET')}
            value={paymentData.cashAccountId || ''}
            onChange={e => setPaymentData({ ...paymentData, cashAccountId: e.target.value })}
          />
          <div className="flex justify-end gap-3">
            <Button type="button" variant="ghost" onClick={() => setPaymentItem(null)}><X className="h-4 w-4" /> إلغاء</Button>
            <Button type="submit" isLoading={busy}><WalletCards className="h-4 w-4" /> ترحيل السداد</Button>
          </div>
        </form>
      </Modal>

    </div>
  );
}
