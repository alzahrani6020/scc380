'use client';

import { useEffect, useMemo, useState } from 'react';
import api from '@/lib/api';
import { FileText, Plus, Trash2, CreditCard, X } from 'lucide-react';
import Modal from '@/components/ui/Modal';
import Input from '@/components/ui/Input';
import Select from '@/components/ui/Select';
import Button from '@/components/ui/Button';

const methods = [
  { value: 'BANK_TRANSFER', label: 'تحويل بنكي' },
  { value: 'CASH', label: 'نقدي' },
  { value: 'CHECK', label: 'شيك' },
  { value: 'ONLINE', label: 'إلكتروني' },
];

export default function SupplierInvoicesPage() {
  const [items, setItems] = useState<any[]>([]);
  const [suppliers, setSuppliers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [invoiceOpen, setInvoiceOpen] = useState(false);
  const [paymentInvoice, setPaymentInvoice] = useState<any>(null);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<any>({
    invoiceNumber: '',
    supplierId: '',
    dueDate: '',
    notes: '',
    lines: [{ description: '', quantity: 1, unitPrice: '' }],
  });
  const [payment, setPayment] = useState<any>({
    amount: '',
    method: 'BANK_TRANSFER',
    paymentDate: new Date().toISOString().split('T')[0],
    reference: '',
  });

  const load = () => Promise.all([
    api.get('/supplier-invoices').then((r) => setItems(Array.isArray(r.data) ? r.data : (r.data?.data || []))),
    api.get('/suppliers').then((r) => setSuppliers(Array.isArray(r.data) ? r.data : (r.data?.data || []))),
  ]).finally(() => setLoading(false));

  useEffect(() => { load().catch(console.error); }, []);

  const totals = useMemo(() => ({
    total: items.reduce((s, x) => s + Number(x.total || 0), 0),
    paid: items.reduce((s, x) => s + Number(x.paidAmount || 0), 0),
  }), [items]);

  const openCreate = () => {
    setForm({
      invoiceNumber: '',
      supplierId: '',
      dueDate: '',
      notes: '',
      lines: [{ description: '', quantity: 1, unitPrice: '' }],
    });
    setInvoiceOpen(true);
  };

  const updateLine = (index: number, key: string, value: any) => {
    setForm((current: any) => ({
      ...current,
      lines: current.lines.map((line: any, i: number) => i === index ? { ...line, [key]: value } : line),
    }));
  };

  const addLine = () => setForm((current: any) => ({
    ...current,
    lines: [...current.lines, { description: '', quantity: 1, unitPrice: '' }],
  }));

  const removeLine = (index: number) => setForm((current: any) => ({
    ...current,
    lines: current.lines.filter((_: any, i: number) => i !== index),
  }));

  const createInvoice = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const payload: any = {
        invoiceNumber: form.invoiceNumber,
        supplierId: form.supplierId,
        notes: form.notes || undefined,
        items: form.lines.map((line: any) => ({
          description: line.description,
          quantity: Number(line.quantity),
          unitPrice: Number(line.unitPrice),
        })),
      };
      if (form.dueDate) payload.dueDate = new Date(form.dueDate).toISOString();
      await api.post('/supplier-invoices', payload);
      setInvoiceOpen(false);
      await load();
    } finally {
      setSaving(false);
    }
  };

  const openPayment = (invoice: any) => {
    const remaining = Math.max(0, Number(invoice.total || 0) - Number(invoice.paidAmount || 0));
    setPaymentInvoice(invoice);
    setPayment({
      amount: String(remaining),
      method: 'BANK_TRANSFER',
      paymentDate: new Date().toISOString().split('T')[0],
      reference: '',
    });
  };

  const recordPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!paymentInvoice) return;
    setSaving(true);
    try {
      await api.post('/supplier-invoices/' + paymentInvoice.id + '/payments', {
        amount: Number(payment.amount),
        method: payment.method,
        paymentDate: payment.paymentDate ? new Date(payment.paymentDate).toISOString() : undefined,
        reference: payment.reference || undefined,
      });
      setPaymentInvoice(null);
      await load();
    } finally {
      setSaving(false);
    }
  };

  const remove = async (id: string) => {
    if (!confirm('حذف فاتورة المورد؟')) return;
    await api.delete('/supplier-invoices/' + id);
    await load();
  };

  return <div className="space-y-6 animate-fade-in-up">
    <div className="flex items-center justify-between gap-4 flex-wrap">
      <div>
        <h1 className="text-2xl font-bold text-white flex items-center gap-2"><FileText className="h-6 w-6 text-primary-400"/>فواتير الموردين</h1>
        <p className="text-slate-400 text-sm mt-1">{items.length} فاتورة · الإجمالي {totals.total.toLocaleString()} ر.س · المدفوع {totals.paid.toLocaleString()} ر.س</p>
      </div>
      <Button onClick={openCreate}><Plus className="h-5 w-5"/>فاتورة مورد</Button>
    </div>

    {loading ? <div className="h-64 flex items-center justify-center text-slate-400">جاري التحميل...</div> :
      <div className="space-y-3">
        {items.map((x) => {
          const remaining = Math.max(0, Number(x.total || 0) - Number(x.paidAmount || 0));
          return <div key={x.id} className="scc-card-hover flex flex-col md:flex-row md:items-center md:justify-between gap-3">
            <div>
              <p className="text-white font-bold">{x.invoiceNumber}</p>
              <p className="text-slate-400 text-sm">{x.supplier?.name || '—'} · {x.status}</p>
              {x.dueDate && <p className="text-slate-500 text-xs mt-1">الاستحقاق {new Date(x.dueDate).toLocaleDateString('ar-SA')}</p>}
            </div>
            <div className="flex items-center gap-4 flex-wrap">
              <div className="text-left">
                <p className="text-primary-400 font-bold">{Number(x.total).toLocaleString()} ر.س</p>
                <p className="text-slate-500 text-xs">متبقي {remaining.toLocaleString()} ر.س</p>
              </div>
              {remaining > 0 && <button onClick={() => openPayment(x)} className="inline-flex items-center gap-1 text-emerald-400 text-sm"><CreditCard className="h-4 w-4"/>تسجيل دفع</button>}
              <button onClick={() => remove(x.id)} className="text-red-400"><Trash2 className="h-4 w-4"/></button>
            </div>
          </div>;
        })}
      </div>}

    <Modal isOpen={invoiceOpen} onClose={() => setInvoiceOpen(false)} title="فاتورة مورد جديدة" size="xl">
      <form onSubmit={createInvoice} className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Input label="رقم الفاتورة" required value={form.invoiceNumber} onChange={(e) => setForm({ ...form, invoiceNumber: e.target.value })}/>
          <Select label="المورد" required options={suppliers.map((s) => ({ value: s.id, label: s.name }))} value={form.supplierId} onChange={(e) => setForm({ ...form, supplierId: e.target.value })}/>
          <Input label="تاريخ الاستحقاق" type="date" value={form.dueDate} onChange={(e) => setForm({ ...form, dueDate: e.target.value })}/>
        </div>
        <div className="space-y-3">
          {form.lines.map((line: any, index: number) => <div key={index} className="grid grid-cols-12 gap-2 items-end">
            <div className="col-span-6"><Input label={index === 0 ? 'البيان' : undefined} required value={line.description} onChange={(e) => updateLine(index, 'description', e.target.value)}/></div>
            <div className="col-span-2"><Input label={index === 0 ? 'الكمية' : undefined} type="number" required value={line.quantity} onChange={(e) => updateLine(index, 'quantity', e.target.value)}/></div>
            <div className="col-span-3"><Input label={index === 0 ? 'سعر الوحدة' : undefined} type="number" required value={line.unitPrice} onChange={(e) => updateLine(index, 'unitPrice', e.target.value)}/></div>
            <button type="button" onClick={() => removeLine(index)} disabled={form.lines.length === 1} className="col-span-1 h-10 text-red-400 disabled:opacity-30"><Trash2 className="h-4 w-4 mx-auto"/></button>
          </div>)}
          <Button type="button" variant="ghost" size="sm" onClick={addLine}><Plus className="h-4 w-4"/>إضافة بند</Button>
        </div>
        <Input label="ملاحظات" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })}/>
        <div className="flex justify-end gap-3"><Button type="button" variant="ghost" onClick={() => setInvoiceOpen(false)}><X className="h-4 w-4"/>إلغاء</Button><Button type="submit" isLoading={saving}>إنشاء الفاتورة</Button></div>
      </form>
    </Modal>

    <Modal isOpen={!!paymentInvoice} onClose={() => setPaymentInvoice(null)} title="تسجيل دفعة للمورد">
      <form onSubmit={recordPayment} className="space-y-4">
        <Input label="المبلغ" type="number" required value={payment.amount} onChange={(e) => setPayment({ ...payment, amount: e.target.value })}/>
        <Select label="طريقة الدفع" options={methods} value={payment.method} onChange={(e) => setPayment({ ...payment, method: e.target.value })}/>
        <Input label="تاريخ الدفع" type="date" value={payment.paymentDate} onChange={(e) => setPayment({ ...payment, paymentDate: e.target.value })}/>
        <Input label="المرجع" value={payment.reference} onChange={(e) => setPayment({ ...payment, reference: e.target.value })}/>
        <div className="flex justify-end"><Button type="submit" isLoading={saving}>تسجيل الدفع</Button></div>
      </form>
    </Modal>
  </div>;
}
