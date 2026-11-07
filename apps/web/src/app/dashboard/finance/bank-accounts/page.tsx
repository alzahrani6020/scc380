'use client';

import { useEffect, useState } from 'react';
import api from '@/lib/api';
import { Landmark, Plus, Pencil, Trash2, X, Star } from 'lucide-react';
import Modal from '@/components/ui/Modal';
import Input from '@/components/ui/Input';
import Button from '@/components/ui/Button';

export default function BankAccountsPage(){
 const [items,setItems]=useState<any[]>([]),[loading,setLoading]=useState(true),[open,setOpen]=useState(false),[editing,setEditing]=useState<any>(null),[saving,setSaving]=useState(false),[form,setForm]=useState<any>({currency:'SAR'});
 const load=()=>api.get('/finance/bank-accounts').then(r=>setItems(r.data.data||[])).finally(()=>setLoading(false));
 useEffect(()=>{load().catch(console.error)},[]);
 const create=()=>{setEditing(null);setForm({currency:'SAR',isDefault:false});setOpen(true)};
 const edit=(x:any)=>{setEditing(x);setForm({...x});setOpen(true)};
 const submit=async(e:React.FormEvent)=>{e.preventDefault();setSaving(true);try{const p={...form};if(p.balance!==undefined&&p.balance!=='')p.balance=Number(p.balance);if(editing)await api.patch(`/finance/bank-accounts/${editing.id}`,p);else await api.post('/finance/bank-accounts',p);setOpen(false);await load()}finally{setSaving(false)}};
 const remove=async(id:string)=>{if(!confirm('حذف الحساب البنكي؟'))return;await api.delete(`/finance/bank-accounts/${id}`);await load()};
 const makeDefault=async(id:string)=>{await api.patch(`/finance/bank-accounts/${id}`,{isDefault:true});await load()};
 return <div className="space-y-6 animate-fade-in-up">
  <div className="flex items-center justify-between"><div><h1 className="text-2xl font-bold text-white flex items-center gap-2"><Landmark className="h-6 w-6 text-primary-400"/>الحسابات البنكية</h1><p className="text-slate-400 text-sm mt-1">{items.length} حساب</p></div><Button onClick={create}><Plus className="h-5 w-5"/>حساب جديد</Button></div>
  {loading?<div className="h-64 flex items-center justify-center text-slate-400">جاري التحميل...</div>:<div className="grid grid-cols-1 md:grid-cols-2 gap-4">{items.map(x=><div key={x.id} className="scc-card-hover">
   <div className="flex justify-between"><div><p className="text-white font-bold">{x.bankName}</p><p className="text-slate-400 text-sm">{x.accountName}</p></div>{x.isDefault&&<Star className="h-5 w-5 text-amber-400 fill-current"/>}</div>
   <div className="mt-4 space-y-1 text-sm text-slate-400"><p>الحساب: <span className="text-white">{x.accountNumber}</span></p><p>IBAN: <span className="text-white">{x.iban||'—'}</span></p><p>الرصيد: <span className="text-primary-400 font-bold">{Number(x.balance||0).toLocaleString()} {x.currency||'SAR'}</span></p></div>
   <div className="mt-4 flex gap-3">{!x.isDefault&&<button onClick={()=>makeDefault(x.id)} className="text-amber-400 text-sm">تعيين افتراضي</button>}<button onClick={()=>edit(x)} className="text-primary-400"><Pencil className="h-4 w-4"/></button><button onClick={()=>remove(x.id)} className="text-red-400"><Trash2 className="h-4 w-4"/></button></div>
  </div>)}</div>}
  <Modal isOpen={open} onClose={()=>setOpen(false)} title={editing?'تعديل حساب':'حساب بنكي جديد'}><form onSubmit={submit} className="space-y-4">
   <Input label="اسم البنك" required value={form.bankName||''} onChange={e=>setForm({...form,bankName:e.target.value})}/>
   <Input label="اسم الحساب" required value={form.accountName||''} onChange={e=>setForm({...form,accountName:e.target.value})}/>
   {!editing&&<Input label="رقم الحساب" required value={form.accountNumber||''} onChange={e=>setForm({...form,accountNumber:e.target.value})}/>}
   {!editing&&<Input label="IBAN" value={form.iban||''} onChange={e=>setForm({...form,iban:e.target.value})}/>}
   {editing&&<Input label="الرصيد" type="number" value={form.balance||''} onChange={e=>setForm({...form,balance:e.target.value})}/>}
   <div className="flex justify-end gap-3"><Button type="button" variant="ghost" onClick={()=>setOpen(false)}><X className="h-4 w-4"/>إلغاء</Button><Button type="submit" isLoading={saving}>{editing?'حفظ':'إنشاء'}</Button></div>
  </form></Modal>
 </div>;
}
