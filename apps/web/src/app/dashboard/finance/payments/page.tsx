'use client';

import { useEffect, useState } from 'react';
import api from '@/lib/api';
import { CreditCard, Plus, Pencil, Trash2, X } from 'lucide-react';
import Modal from '@/components/ui/Modal';
import Input from '@/components/ui/Input';
import Select from '@/components/ui/Select';
import Button from '@/components/ui/Button';

const methods = [
  { value:'CASH', label:'نقدي' },
  { value:'BANK_TRANSFER', label:'تحويل بنكي' },
  { value:'CREDIT_CARD', label:'بطاقة ائتمان' },
  { value:'DEBIT_CARD', label:'بطاقة خصم' },
  { value:'CHECK', label:'شيك' },
  { value:'ONLINE', label:'إلكتروني' },
  { value:'SADAD', label:'سداد' },
  { value:'APPLE_PAY', label:'Apple Pay' },
  { value:'STC_PAY', label:'STC Pay' },
];

export default function PaymentsPage() {
  const [items,setItems]=useState<any[]>([]);
  const [invoices,setInvoices]=useState<any[]>([]);
  const [loading,setLoading]=useState(true);
  const [open,setOpen]=useState(false);
  const [editing,setEditing]=useState<any>(null);
  const [form,setForm]=useState<any>({method:'CASH',currency:'SAR'});
  const [saving,setSaving]=useState(false);

  const load=()=>Promise.all([
    api.get('/finance/payments').then(r=>setItems(r.data.data||[])),
    api.get('/erp/invoices').then(r=>setInvoices(r.data.data||[])),
  ]).finally(()=>setLoading(false));

  useEffect(()=>{load().catch(console.error)},[]);

  const create=()=>{setEditing(null);setForm({method:'CASH',currency:'SAR',paidAt:new Date().toISOString().split('T')[0]});setOpen(true)};
  const edit=(x:any)=>{setEditing(x);setForm({...x,paidAt:x.paidAt?new Date(x.paidAt).toISOString().split('T')[0]:''});setOpen(true)};
  const submit=async(e:React.FormEvent)=>{e.preventDefault();setSaving(true);try{
    const payload={...form,amount:Number(form.amount)};
    if(editing) await api.patch(`/finance/payments/${editing.id}`,payload); else await api.post('/finance/payments',payload);
    setOpen(false);await load();
  }finally{setSaving(false)}};
  const remove=async(id:string)=>{if(!confirm('حذف الدفعة؟'))return;await api.delete(`/finance/payments/${id}`);await load()};

  const total=items.reduce((s,x)=>s+Number(x.amount||0),0);

  return <div className="space-y-6 animate-fade-in-up">
    <div className="flex items-center justify-between">
      <div><h1 className="text-2xl font-bold text-white flex items-center gap-2"><CreditCard className="h-6 w-6 text-primary-400"/>المدفوعات</h1><p className="text-slate-400 text-sm mt-1">{items.length} عملية · {total.toLocaleString()} ر.س</p></div>
      <Button onClick={create}><Plus className="h-5 w-5"/>تسجيل دفع</Button>
    </div>
    {loading?<div className="h-64 flex items-center justify-center text-slate-400">جاري التحميل...</div>:
      <div className="space-y-3">{items.map(x=><div key={x.id} className="scc-card-hover flex items-center justify-between group">
        <div><p className="text-white font-medium">{methods.find(m=>m.value===x.method)?.label||x.method}</p><p className="text-slate-500 text-xs">{x.reference||'بدون مرجع'} {x.paidAt?'· '+new Date(x.paidAt).toLocaleDateString('ar-SA'):''}</p></div>
        <div className="flex items-center gap-3"><p className="text-emerald-400 font-bold">{Number(x.amount).toLocaleString()} {x.currency||'SAR'}</p><button onClick={()=>edit(x)} className="text-primary-400"><Pencil className="h-4 w-4"/></button><button onClick={()=>remove(x.id)} className="text-red-400"><Trash2 className="h-4 w-4"/></button></div>
      </div>)}</div>}
    <Modal isOpen={open} onClose={()=>setOpen(false)} title={editing?'تعديل دفعة':'دفعة جديدة'}>
      <form onSubmit={submit} className="space-y-4">
        <Select label="الفاتورة" options={invoices.map(i=>({value:i.id,label:i.invoiceNumber||i.id}))} value={form.invoiceId||''} onChange={e=>setForm({...form,invoiceId:e.target.value})}/>
        <Input label="المبلغ" type="number" required value={form.amount||''} onChange={e=>setForm({...form,amount:e.target.value})}/>
        <Select label="طريقة الدفع" options={methods} value={form.method||'CASH'} onChange={e=>setForm({...form,method:e.target.value})}/>
        <Input label="المرجع" value={form.reference||''} onChange={e=>setForm({...form,reference:e.target.value})}/>
        <Input label="تاريخ الدفع" type="date" value={form.paidAt||''} onChange={e=>setForm({...form,paidAt:e.target.value})}/>
        <div className="flex justify-end gap-3"><Button type="button" variant="ghost" onClick={()=>setOpen(false)}><X className="h-4 w-4"/>إلغاء</Button><Button type="submit" isLoading={saving}>{editing?'حفظ':'تسجيل'}</Button></div>
      </form>
    </Modal>
  </div>;
}
