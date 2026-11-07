'use client';

import { useEffect, useState } from 'react';
import api from '@/lib/api';
import { Receipt, Plus, Pencil, Trash2, X, CheckCircle2 } from 'lucide-react';
import Modal from '@/components/ui/Modal';
import Input from '@/components/ui/Input';
import Select from '@/components/ui/Select';
import Button from '@/components/ui/Button';

const categories=[
{value:'OFFICE',label:'مكتب'},{value:'TRAVEL',label:'سفر'},{value:'MEALS',label:'وجبات'},
{value:'UTILITIES',label:'خدمات'},{value:'MARKETING',label:'تسويق'},{value:'SALARIES',label:'رواتب'},
{value:'RENT',label:'إيجار'},{value:'MAINTENANCE',label:'صيانة'},{value:'INSURANCE',label:'تأمين'},
{value:'TAXES',label:'ضرائب'},{value:'SUPPLIES',label:'مستلزمات'},{value:'OTHER',label:'أخرى'}];

export default function ExpensesPage(){
 const [items,setItems]=useState<any[]>([]),[loading,setLoading]=useState(true),[open,setOpen]=useState(false),[editing,setEditing]=useState<any>(null),[saving,setSaving]=useState(false),[form,setForm]=useState<any>({category:'OTHER'});
 const load=()=>api.get('/finance/expenses').then(r=>setItems(r.data.data||[])).finally(()=>setLoading(false));
 useEffect(()=>{load().catch(console.error)},[]);
 const create=()=>{setEditing(null);setForm({category:'OTHER',incurredAt:new Date().toISOString().split('T')[0]});setOpen(true)};
 const edit=(x:any)=>{setEditing(x);setForm({...x,incurredAt:x.incurredAt?new Date(x.incurredAt).toISOString().split('T')[0]:''});setOpen(true)};
 const submit=async(e:React.FormEvent)=>{e.preventDefault();setSaving(true);try{const p={...form,amount:Number(form.amount)};if(editing)await api.patch(`/finance/expenses/${editing.id}`,p);else await api.post('/finance/expenses',p);setOpen(false);await load()}finally{setSaving(false)}};
 const remove=async(id:string)=>{if(!confirm('حذف المصروف؟'))return;await api.delete(`/finance/expenses/${id}`);await load()};
 const approve=async(id:string)=>{await api.patch(`/finance/expenses/${id}`,{status:'APPROVED'});await load()};
 return <div className="space-y-6 animate-fade-in-up">
  <div className="flex items-center justify-between"><div><h1 className="text-2xl font-bold text-white flex items-center gap-2"><Receipt className="h-6 w-6 text-primary-400"/>المصروفات</h1><p className="text-slate-400 text-sm mt-1">{items.length} مصروف</p></div><Button onClick={create}><Plus className="h-5 w-5"/>مصروف جديد</Button></div>
  {loading?<div className="h-64 flex items-center justify-center text-slate-400">جاري التحميل...</div>:<div className="space-y-3">{items.map(x=><div key={x.id} className="scc-card-hover flex items-center justify-between">
   <div><p className="text-white font-medium">{x.description}</p><p className="text-slate-500 text-xs">{categories.find(c=>c.value===x.category)?.label||x.category} · {x.status}</p></div>
   <div className="flex items-center gap-3"><p className="text-rose-400 font-bold">{Number(x.amount).toLocaleString()} ر.س</p>{x.status==='PENDING'&&<button onClick={()=>approve(x.id)} className="text-emerald-400" title="اعتماد"><CheckCircle2 className="h-4 w-4"/></button>}<button onClick={()=>edit(x)} className="text-primary-400"><Pencil className="h-4 w-4"/></button><button onClick={()=>remove(x.id)} className="text-red-400"><Trash2 className="h-4 w-4"/></button></div>
  </div>)}</div>}
  <Modal isOpen={open} onClose={()=>setOpen(false)} title={editing?'تعديل مصروف':'مصروف جديد'}><form onSubmit={submit} className="space-y-4">
   <Select label="الفئة" options={categories} value={form.category||'OTHER'} onChange={e=>setForm({...form,category:e.target.value})}/>
   <Input label="المبلغ" type="number" required value={form.amount||''} onChange={e=>setForm({...form,amount:e.target.value})}/>
   <Input label="الوصف" required value={form.description||''} onChange={e=>setForm({...form,description:e.target.value})}/>
   <Input label="التاريخ" type="date" value={form.incurredAt||''} onChange={e=>setForm({...form,incurredAt:e.target.value})}/>
   <div className="flex justify-end gap-3"><Button type="button" variant="ghost" onClick={()=>setOpen(false)}><X className="h-4 w-4"/>إلغاء</Button><Button type="submit" isLoading={saving}>{editing?'حفظ':'إنشاء'}</Button></div>
  </form></Modal>
 </div>;
}
