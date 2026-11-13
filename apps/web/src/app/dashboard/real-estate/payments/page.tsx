'use client';

import { useEffect,useState } from 'react';
import api from '@/lib/api';
import { Banknote,CheckCircle2,RefreshCw } from 'lucide-react';
import Modal from '@/components/ui/Modal';
import Input from '@/components/ui/Input';
import Select from '@/components/ui/Select';
import Button from '@/components/ui/Button';

const methods=[{value:'BANK_TRANSFER',label:'تحويل بنكي'},{value:'CASH',label:'نقدي'},{value:'CHECK',label:'شيك'},{value:'ONLINE',label:'إلكتروني'}];

export default function RentPaymentsPage(){
 const [items,setItems]=useState<any[]>([]);
 const [loading,setLoading]=useState(true);
 const [loadError,setLoadError]=useState(false);
 const [formError,setFormError]=useState(false);
 const [recording,setRecording]=useState<any>(null);
 const [saving,setSaving]=useState(false);
 const [form,setForm]=useState<any>({paymentMethod:'BANK_TRANSFER',paidDate:new Date().toISOString().split('T')[0]});
 const [overdueOnly,setOverdueOnly]=useState(false);

 const load=()=>api.get('/real-estate/payments'+(overdueOnly?'?overdue=true':'')).then(r=>{setItems(r.data.data||[]);setLoadError(false)}).catch(err=>{setLoadError(true);throw err}).finally(()=>setLoading(false));
 useEffect(()=>{setLoading(true);load().catch(console.error)},[overdueOnly]);

 const openRecord=(x:any)=>{setFormError(false);setRecording(x);setForm({amount:String(x.amount),paymentMethod:'BANK_TRANSFER',paidDate:new Date().toISOString().split('T')[0]})};
 const submit=async(e:React.FormEvent)=>{e.preventDefault();if(!recording)return;setSaving(true);setFormError(false);try{await api.post('/real-estate/payments/'+recording.id+'/record',{...form,amount:String(form.amount)});setRecording(null);await load()}catch(err){console.error(err);setFormError(true)}finally{setSaving(false)}};

 const totalPending=items.filter(x=>x.status==='PENDING').reduce((s,x)=>s+Number(x.amount||0),0);

 return <div className="space-y-6 animate-fade-in-up">
  <div className="flex items-center justify-between flex-wrap gap-3">
   <div><h1 className="text-2xl font-bold text-white flex items-center gap-2"><Banknote className="h-6 w-6 text-primary-400"/>دفعات الإيجار</h1><p className="text-slate-400 text-sm mt-1">{items.length} دفعة · المعلق {totalPending.toLocaleString()} ر.س</p></div>
   <Button variant={overdueOnly?'primary':'ghost'} onClick={()=>setOverdueOnly(v=>!v)}>{overdueOnly?'عرض الكل':'المتأخرات فقط'}</Button>
  </div>
  {loading?<div className="h-64 flex items-center justify-center"><RefreshCw className="h-8 w-8 animate-spin text-primary-400"/></div>:loadError?<div role="alert" className="rounded-lg border border-red-800 p-4 text-red-200">تعذر تحميل الاستحقاقات. تحقق من الاتصال والصلاحيات ثم أعد تحميل الصفحة.</div>:<div className="space-y-3">{items.map(x=><div key={x.id} className="scc-card-hover flex flex-col md:flex-row md:items-center md:justify-between gap-3">
   <div><p className="text-white font-medium">{x.contract?.lesseeName||'—'}</p><p className="text-slate-500 text-xs">استحقاق {new Date(x.dueDate).toLocaleDateString('ar-SA')} · {x.status}</p></div>
   <div className="flex items-center gap-3"><p className="text-primary-400 font-bold">{Number(x.amount).toLocaleString()} ر.س</p>{x.status==='PENDING'&&<button onClick={()=>openRecord(x)} className="inline-flex items-center gap-1 text-emerald-400 text-sm"><CheckCircle2 className="h-4 w-4"/>تسجيل سداد</button>}</div>
  </div>)}</div>}
  <Modal isOpen={!!recording} onClose={()=>setRecording(null)} title="تسجيل سداد"><form onSubmit={submit} className="space-y-4">{formError&&<div role="alert" className="rounded-lg border border-red-800 p-4 text-red-200">تعذر تأكيد تسجيل السداد. تحقق من المبلغ وحالة الاستحقاق، وراجع سجل الدفعات قبل إعادة المحاولة.</div>}
   <Input label="المبلغ المدفوع" type="number" required value={form.amount||''} onChange={e=>setForm({...form,amount:e.target.value})}/>
   <Input label="تاريخ السداد" type="date" required value={form.paidDate||''} onChange={e=>setForm({...form,paidDate:e.target.value})}/>
   <Select label="طريقة السداد" options={methods} value={form.paymentMethod||'BANK_TRANSFER'} onChange={e=>setForm({...form,paymentMethod:e.target.value})}/>
   <Input label="مرجع العملية" value={form.transactionRef||''} onChange={e=>setForm({...form,transactionRef:e.target.value})}/>
   <Input label="مرجع البنك" value={form.bankReference||''} onChange={e=>setForm({...form,bankReference:e.target.value})}/>
   <div className="flex justify-end"><Button type="submit" isLoading={saving}>تسجيل السداد</Button></div>
  </form></Modal>
 </div>;
}
