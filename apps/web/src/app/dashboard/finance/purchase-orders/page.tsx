'use client';

import { useEffect, useState } from 'react';
import api from '@/lib/api';
import { ShoppingCart, Plus, Pencil, Trash2, X } from 'lucide-react';
import Modal from '@/components/ui/Modal';
import Input from '@/components/ui/Input';
import Select from '@/components/ui/Select';
import Button from '@/components/ui/Button';

const statuses=[
{value:'DRAFT',label:'مسودة'},{value:'SENT',label:'مرسل'},{value:'APPROVED',label:'معتمد'},
{value:'REJECTED',label:'مرفوض'},{value:'PARTIALLY_RECEIVED',label:'استلام جزئي'},
{value:'RECEIVED',label:'مستلم'},{value:'CANCELLED',label:'ملغى'}];

export default function PurchaseOrdersPage(){
 const [items,setItems]=useState<any[]>([]),[suppliers,setSuppliers]=useState<any[]>([]),[loading,setLoading]=useState(true),[open,setOpen]=useState(false),[editing,setEditing]=useState<any>(null),[saving,setSaving]=useState(false),[form,setForm]=useState<any>({});
 const load=()=>Promise.all([api.get('/finance/purchase-orders').then(r=>setItems(r.data.data||[])),api.get('/suppliers').then(r=>setSuppliers(Array.isArray(r.data)?r.data:(r.data?.data||[]))).catch(()=>setSuppliers([]))]).finally(()=>setLoading(false));
 useEffect(()=>{load().catch(console.error)},[]);
 const create=()=>{setEditing(null);setForm({status:'DRAFT',taxAmount:0});setOpen(true)};
 const edit=(x:any)=>{setEditing(x);setForm({...x,expectedDelivery:x.expectedDelivery?new Date(x.expectedDelivery).toISOString().split('T')[0]:''});setOpen(true)};
 const submit=async(e:React.FormEvent)=>{e.preventDefault();setSaving(true);try{const p={...form,subtotal:Number(form.subtotal),taxAmount:Number(form.taxAmount||0),total:Number(form.total)};if(editing)await api.patch(`/finance/purchase-orders/${editing.id}`,p);else await api.post('/finance/purchase-orders',p);setOpen(false);await load()}finally{setSaving(false)}};
 const remove=async(id:string)=>{if(!confirm('حذف أمر الشراء؟'))return;await api.delete(`/finance/purchase-orders/${id}`);await load()};
 return <div className="space-y-6 animate-fade-in-up">
  <div className="flex items-center justify-between"><div><h1 className="text-2xl font-bold text-white flex items-center gap-2"><ShoppingCart className="h-6 w-6 text-primary-400"/>أوامر الشراء</h1><p className="text-slate-400 text-sm mt-1">{items.length} أمر</p></div><Button onClick={create}><Plus className="h-5 w-5"/>أمر شراء</Button></div>
  {loading?<div className="h-64 flex items-center justify-center text-slate-400">جاري التحميل...</div>:<div className="space-y-3">{items.map(x=><div key={x.id} className="scc-card-hover flex items-center justify-between">
   <div><p className="text-white font-bold">{x.poNumber}</p><p className="text-slate-500 text-xs">{statuses.find(s=>s.value===x.status)?.label||x.status}{x.expectedDelivery?' · '+new Date(x.expectedDelivery).toLocaleDateString('ar-SA'):''}</p></div>
   <div className="flex items-center gap-3"><p className="text-primary-400 font-bold">{Number(x.total).toLocaleString()} ر.س</p><button onClick={()=>edit(x)} className="text-primary-400"><Pencil className="h-4 w-4"/></button><button onClick={()=>remove(x.id)} className="text-red-400"><Trash2 className="h-4 w-4"/></button></div>
  </div>)}</div>}
  <Modal isOpen={open} onClose={()=>setOpen(false)} title={editing?'تعديل أمر شراء':'أمر شراء جديد'}><form onSubmit={submit} className="space-y-4">
   {!editing&&<Input label="رقم أمر الشراء" required value={form.poNumber||''} onChange={e=>setForm({...form,poNumber:e.target.value})}/>}
   {!editing&&<Select label="المورد" options={suppliers.map(s=>({value:s.id,label:s.name||s.companyName||s.id}))} value={form.vendorId||''} onChange={e=>setForm({...form,vendorId:e.target.value})}/>}
   <div className="grid grid-cols-3 gap-3"><Input label="قبل الضريبة" type="number" required value={form.subtotal||''} onChange={e=>setForm({...form,subtotal:e.target.value})}/><Input label="الضريبة" type="number" value={form.taxAmount||0} onChange={e=>setForm({...form,taxAmount:e.target.value})}/><Input label="الإجمالي" type="number" required value={form.total||''} onChange={e=>setForm({...form,total:e.target.value})}/></div>
   {editing&&<Select label="الحالة" options={statuses} value={form.status||'DRAFT'} onChange={e=>setForm({...form,status:e.target.value})}/>}
   <Input label="التسليم المتوقع" type="date" value={form.expectedDelivery||''} onChange={e=>setForm({...form,expectedDelivery:e.target.value})}/>
   <Input label="ملاحظات" value={form.notes||''} onChange={e=>setForm({...form,notes:e.target.value})}/>
   <div className="flex justify-end gap-3"><Button type="button" variant="ghost" onClick={()=>setOpen(false)}><X className="h-4 w-4"/>إلغاء</Button><Button type="submit" isLoading={saving}>{editing?'حفظ':'إنشاء'}</Button></div>
  </form></Modal>
 </div>;
}
