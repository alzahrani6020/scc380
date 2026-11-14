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
 const [summary,setSummary]=useState<any>(null);
 const [loading,setLoading]=useState(true);
 const [loadError,setLoadError]=useState(false);
 const [formError,setFormError]=useState(false);
 const [recording,setRecording]=useState<any>(null);
 const [saving,setSaving]=useState(false);
 const [form,setForm]=useState<any>({paymentMethod:'BANK_TRANSFER',paidDate:new Date().toISOString().split('T')[0]});
 const [overdueOnly,setOverdueOnly]=useState(false);
 const [history,setHistory]=useState<any>(null);
 const [historyError,setHistoryError]=useState(false);
 const [posting,setPosting]=useState(false);

 const load=()=>Promise.all([
   api.get('/real-estate/payments'+(overdueOnly?'?overdue=true':'')),
   api.get('/real-estate/payments/collection-summary'),
 ]).then(([itemsResponse,summaryResponse])=>{setItems(itemsResponse.data.data||[]);setSummary(summaryResponse.data);setLoadError(false)}).catch(err=>{setLoadError(true);setSummary(null);throw err}).finally(()=>setLoading(false));
 useEffect(()=>{setLoading(true);load().catch(console.error)},[overdueOnly]);

 const openRecord=(x:any)=>{setFormError(false);setRecording(x);setForm({amount:String(x.outstandingAmount),idempotencyKey:crypto.randomUUID(),paymentMethod:'BANK_TRANSFER',paidDate:new Date().toISOString().split('T')[0]})};
 const submit=async(e:React.FormEvent)=>{e.preventDefault();if(!recording||saving)return;setSaving(true);setFormError(false);try{await api.post('/real-estate/payments/'+recording.id+'/record',{...form,amount:String(form.amount)});setRecording(null);await load()}catch(err){console.error(err);setFormError(true)}finally{setSaving(false)}};

 const viewHistory=async(id:string)=>{setHistoryError(false);try{const r=await api.get('/real-estate/payments/'+id+'/collections');setHistory(r.data)}catch(err){console.error(err);setHistoryError(true)}};
 const postAccrual=async()=>{if(!history||posting||!confirm('ترحيل قيد استحقاق الإيجار؟ يُطبّق بعد التحقق من دليل الحسابات والفترة المالية.'))return;setPosting(true);setHistoryError(false);try{await api.post('/real-estate/payments/'+history.receivableId+'/post-accrual');await viewHistory(history.receivableId)}catch(err){console.error(err);setHistoryError(true)}finally{setPosting(false)}};
 const postReceipt=async(id:string)=>{if(!history||posting||!confirm('ترحيل قيد تحصيل الإيجار إلى المحاسبة؟'))return;setPosting(true);setHistoryError(false);try{await api.post('/real-estate/payments/collections/'+id+'/post-accounting');await viewHistory(history.receivableId)}catch(err){console.error(err);setHistoryError(true)}finally{setPosting(false)}};

 return <div className="space-y-6 animate-fade-in-up">
  <div className="flex items-center justify-between flex-wrap gap-3">
   <div><h1 className="text-2xl font-bold text-white flex items-center gap-2"><Banknote className="h-6 w-6 text-primary-400"/>دفعات الإيجار</h1><p className="text-slate-400 text-sm mt-1">{items.length} دفعة في القائمة</p></div>
   <Button variant={overdueOnly?'primary':'ghost'} onClick={()=>setOverdueOnly(v=>!v)}>{overdueOnly?'عرض الكل':'المتأخرات فقط'}</Button>
  </div>
  {!loading&&!loadError&&summary&&<div className="grid grid-cols-1 md:grid-cols-3 gap-3" role="region" aria-label="ملخص تحصيل الإيجارات">
    <div className="scc-card-hover"><p className="text-slate-400 text-sm">إجمالي المستحق غير المسدد</p><p className="font-bold text-white">{Number(summary.pendingAmount).toLocaleString()} ر.س</p><p className="text-xs text-slate-400">{summary.pendingCount} استحقاق</p></div>
    <div className="scc-card-hover"><p className="text-slate-400 text-sm">إجمالي المحصّل (كامل وجزئي)</p><p className="font-bold text-emerald-400">{Number(summary.completedAmount).toLocaleString()} ر.س</p><p className="text-xs text-slate-400" >{summary.completedCount} استحقاق مسدد بالكامل</p></div>
    <div className="scc-card-hover"><p className="text-slate-400 text-sm">المستحقات المتأخرة غير المسددة</p><p className="font-bold text-amber-400">{Number(summary.overdueAmount).toLocaleString()} ر.س</p><p className="text-xs text-slate-400">{summary.overdueCount} استحقاق</p></div>
    <p className="text-slate-400 text-xs md:col-span-3">الأرصدة تشمل التحصيلات الجزئية المسجلة، أما حالة الترحيل المحاسبي فتظهر في سجل كل استحقاق. لا تتغير الإجماليات بتفعيل فلتر المتأخرات.</p>
  </div>}
  {loading?<div className="h-64 flex items-center justify-center"><RefreshCw className="h-8 w-8 animate-spin text-primary-400"/></div>:loadError?<div role="alert" className="rounded-lg border border-red-800 p-4 text-red-200">تعذر تحميل الاستحقاقات. تحقق من الاتصال والصلاحيات ثم أعد تحميل الصفحة.</div>:<div className="space-y-3">{items.map(x=><div key={x.id} className="scc-card-hover flex flex-col md:flex-row md:items-center md:justify-between gap-3">
   <div><p className="text-white font-medium">{x.contract?.lesseeName||'—'}</p><p className="text-slate-500 text-xs">استحقاق {new Date(x.dueDate).toLocaleDateString('ar-SA')} · {x.status}</p></div>
   <div className="flex items-center gap-3"><p className="text-primary-400 font-bold">المتبقي {Number(x.outstandingAmount).toLocaleString()} ر.س</p>{x.status==='PENDING'&&<button onClick={()=>openRecord(x)} className="inline-flex items-center gap-1 text-emerald-400 text-sm"><CheckCircle2 className="h-4 w-4"/>تسجيل سداد</button>}<button onClick={()=>viewHistory(x.id)} className="text-primary-400 text-sm">السجل والمحاسبة</button></div>
  </div>)}</div>}
  <Modal isOpen={!!recording} onClose={()=>setRecording(null)} title="تسجيل سداد"><form onSubmit={submit} className="space-y-4">{formError&&<div role="alert" className="rounded-lg border border-red-800 p-4 text-red-200">تعذر تأكيد تسجيل السداد. تحقق من المبلغ وحالة الاستحقاق، وراجع سجل الدفعات قبل إعادة المحاولة.</div>}
   <p className="text-slate-300 text-sm">المستحق {Number(recording?.amount||0).toLocaleString()} ر.س · المحصّل سابقًا {Number(recording?.collectedAmount||0).toLocaleString()} ر.س · المتبقي {Number(recording?.outstandingAmount||0).toLocaleString()} ر.س</p>
   <Input label="المبلغ المدفوع (يقبل السداد الجزئي)" type="number" min="0.01" step="0.01" required value={form.amount||''} onChange={e=>setForm({...form,amount:e.target.value})}/>
   <Input label="تاريخ السداد" type="date" required value={form.paidDate||''} onChange={e=>setForm({...form,paidDate:e.target.value})}/>
   <Select label="طريقة السداد" options={methods} value={form.paymentMethod||'BANK_TRANSFER'} onChange={e=>setForm({...form,paymentMethod:e.target.value})}/>
   <Input label="مرجع العملية" value={form.transactionRef||''} onChange={e=>setForm({...form,transactionRef:e.target.value})}/>
   <Input label="مرجع البنك" value={form.bankReference||''} onChange={e=>setForm({...form,bankReference:e.target.value})}/>
   <div className="flex justify-end"><Button type="submit" isLoading={saving}>تسجيل السداد</Button></div>
  </form></Modal>
  <Modal isOpen={!!history||historyError} onClose={()=>{setHistory(null);setHistoryError(false)}} title="سجل تحصيل الإيجار والترحيل المحاسبي" size="xl">
   <div className="space-y-4">
    {historyError&&<p role="alert" className="text-red-300">تعذر قراءة السجل أو ترحيل القيد. تأكد من صلاحيات المحاسبة وربط الحسابات والفترة المالية، ثم راجع الحالة قبل المحاولة مجددًا.</p>}
    {history&&<>
     <p className="text-slate-300 text-sm">إجمالي الاستحقاق: {Number(history.faceAmount).toLocaleString()} ر.س · عدد عمليات التحصيل: {history.count}</p>
     <div className="flex items-center gap-3"><span className="text-sm text-slate-300">قيد الاستحقاق: {history.accrualJournalId?'مرحّل':'غير مرحّل'}</span>{!history.accrualJournalId&&<Button type="button" disabled={posting} onClick={postAccrual}>ترحيل الاستحقاق</Button>}</div>
     <div className="space-y-2">{history.data.map((item:any)=><div key={item.id} className="rounded-lg border border-slate-700 p-3 flex flex-wrap justify-between gap-2">
      <div><p className="text-white font-medium">{Number(item.amount).toLocaleString()} ر.س</p><p className="text-slate-400 text-xs">{new Date(item.collectedAt).toLocaleDateString('ar-SA')} · {item.paymentMethod||'—'} · {item.transactionRef||'بدون مرجع'}</p></div>
      <div className="flex items-center gap-2"><span className="text-xs text-slate-300">{item.accountingJournalId?'مرحّل محاسبيًا':'غير مرحّل'}</span>{!item.accountingJournalId&&<Button type="button" disabled={posting||!history.accrualJournalId} onClick={()=>postReceipt(item.id)}>ترحيل التحصيل</Button>}</div>
     </div>)}</div>
     <p className="text-slate-400 text-xs">الترحيل يتطلب حساب إيراد الإيجار وحساب الذمم وحساب البنك أو الصندوق، وفق الفترة المحاسبية المفتوحة.</p>
    </>}
   </div>
  </Modal>
 </div>;
}
