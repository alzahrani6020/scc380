'use client';

import { useEffect,useState } from 'react';
import api from '@/lib/api';
import { FileSignature,Plus,Pencil,Trash2,X,RefreshCw } from 'lucide-react';
import Modal from '@/components/ui/Modal';
import Input from '@/components/ui/Input';
import Select from '@/components/ui/Select';
import Button from '@/components/ui/Button';

const statuses=[{value:'DRAFT',label:'مسودة'},{value:'ACTIVE',label:'نشط'},{value:'EXPIRED',label:'منتهي'},{value:'TERMINATED',label:'منهى'},{value:'RENEWED',label:'مجدّد'}];
const frequencies=[{value:'MONTHLY',label:'شهري'},{value:'QUARTERLY',label:'ربع سنوي'},{value:'SEMI_ANNUAL',label:'نصف سنوي'},{value:'ANNUAL',label:'سنوي'}];

export default function ContractsPage(){
 const [items,setItems]=useState<any[]>([]);
 const [properties,setProperties]=useState<any[]>([]);
 const [units,setUnits]=useState<any[]>([]);
 const [loading,setLoading]=useState(true);
 const [open,setOpen]=useState(false);
 const [editing,setEditing]=useState<any>(null);
 const [saving,setSaving]=useState(false);
 const [form,setForm]=useState<any>({contractType:'RESIDENTIAL',paymentFrequency:'MONTHLY'});

 const load=()=>Promise.all([
   api.get('/real-estate/contracts').then(r=>setItems(r.data.data||[])),
   api.get('/real-estate/properties').then(r=>setProperties(r.data.data||[])),
   api.get('/real-estate/units').then(r=>setUnits(r.data.data||[])),
 ]).finally(()=>setLoading(false));

 useEffect(()=>{load().catch(console.error)},[]);

 const create=()=>{setEditing(null);setForm({contractType:'RESIDENTIAL',paymentFrequency:'MONTHLY'});setOpen(true)};
 const edit=(x:any)=>{setEditing(x);setForm({...x,startDate:x.startDate?new Date(x.startDate).toISOString().split('T')[0]:'',endDate:x.endDate?new Date(x.endDate).toISOString().split('T')[0]:''});setOpen(true)};
 const submit=async(e:React.FormEvent)=>{e.preventDefault();setSaving(true);try{
   const fields=['propertyId','unitId','ejarContractNumber','contractType','lessorId','lesseeId','lessorName','lessorIdNumber','lessorPhone','lesseeName','lesseeIdNumber','lesseePhone','startDate','endDate','rentAmount','paymentFrequency','securityDeposit','paymentMethod','bankAccount','autoRenew','renewalNoticeDays'];const p:any=Object.fromEntries(fields.filter(k=>form[k]!==undefined&&form[k]!==null&&form[k]!=='').map(k=>[k,form[k]]));for(const key of ['rentAmount','securityDeposit'])if(p[key]!==undefined)p[key]=String(p[key]);
   if(editing) await api.patch('/real-estate/contracts/'+editing.id,p); else await api.post('/real-estate/contracts',p);
   setOpen(false);await load();
 }finally{setSaving(false)}};
 const remove=async(id:string)=>{if(!confirm('حذف العقد؟'))return;await api.delete('/real-estate/contracts/'+id);await load()};
 const activate=async(id:string)=>{if(!confirm('تفعيل العقد وإنشاء استحقاقاته؟'))return;try{await api.post('/real-estate/contracts/'+id+'/activate');await load()}catch(err){console.error(err);alert('تعذر تفعيل العقد. تحقق من حالة العقد والوحدة ثم أعد تحميل القائمة.')}};
 const terminate=async(id:string)=>{if(!confirm('إنهاء العقد؟'))return;await api.post('/real-estate/contracts/'+id+'/terminate');await load()};
 const syncEjar=async(id:string)=>{await api.post('/real-estate/contracts/'+id+'/ejar-sync');await load()};

 const selectableUnits=units.filter(u=>!form.propertyId||u.propertyId===form.propertyId);

 return <div className="space-y-6 animate-fade-in-up">
  <div className="flex items-center justify-between"><div><h1 className="text-2xl font-bold text-white flex items-center gap-2"><FileSignature className="h-6 w-6 text-primary-400"/>عقود الإيجار</h1><p className="text-slate-400 text-sm mt-1">{items.length} عقد</p></div><Button onClick={create}><Plus className="h-5 w-5"/>عقد جديد</Button></div>
  {loading?<div className="h-64 flex items-center justify-center"><RefreshCw className="h-8 w-8 animate-spin text-primary-400"/></div>:<div className="space-y-3">{items.map(x=><div key={x.id} className="scc-card-hover">
   <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
    <div><p className="text-white font-bold">{x.lesseeName}</p><p className="text-slate-400 text-sm">{x.property?.name||'—'} · وحدة {x.unit?.unitNumber||'—'}</p><p className="text-slate-500 text-xs mt-1">{new Date(x.startDate).toLocaleDateString('ar-SA')} — {new Date(x.endDate).toLocaleDateString('ar-SA')}</p></div>
    <div className="flex items-center gap-3 flex-wrap"><span className="text-primary-400 font-bold">{Number(x.rentAmount).toLocaleString()} ر.س</span><span className="text-xs text-slate-400">{statuses.find(s=>s.value===x.status)?.label||x.status}</span><span className="text-xs text-slate-500">{x._count?.payments||0} دفعة</span></div>
   </div>
   <div className="mt-4 flex gap-3 flex-wrap"><button onClick={()=>edit(x)} className="text-primary-400 text-sm">تعديل</button>{x.status==='DRAFT'&&<button onClick={()=>activate(x.id)} className="text-emerald-400 text-sm">تفعيل العقد</button>}{x.status==='ACTIVE'&&<button onClick={()=>terminate(x.id)} className="text-amber-400 text-sm">إنهاء</button>}<button onClick={()=>syncEjar(x.id)} className="text-emerald-400 text-sm">مزامنة إيجار</button><button onClick={()=>remove(x.id)} className="text-red-400"><Trash2 className="h-4 w-4"/></button></div>
  </div>)}</div>}
  <Modal isOpen={open} onClose={()=>setOpen(false)} title={editing?'تعديل عقد':'عقد جديد'} size="xl"><form onSubmit={submit} className="space-y-4">
   <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
    <Select label="العقار" required options={properties.map(p=>({value:p.id,label:p.name}))} value={form.propertyId||''} onChange={e=>setForm({...form,propertyId:e.target.value,unitId:''})}/>
    <Select label="الوحدة" required options={selectableUnits.map(u=>({value:u.id,label:u.unitNumber}))} value={form.unitId||''} onChange={e=>setForm({...form,unitId:e.target.value})}/>
    <Input label="اسم المؤجر" required value={form.lessorName||''} onChange={e=>setForm({...form,lessorName:e.target.value})}/>
    <Input label="هوية المؤجر" required value={form.lessorIdNumber||''} onChange={e=>setForm({...form,lessorIdNumber:e.target.value})}/>
    <Input label="اسم المستأجر" required value={form.lesseeName||''} onChange={e=>setForm({...form,lesseeName:e.target.value})}/>
    <Input label="هوية المستأجر" required value={form.lesseeIdNumber||''} onChange={e=>setForm({...form,lesseeIdNumber:e.target.value})}/>
    <Input label="من" type="date" required value={form.startDate||''} onChange={e=>setForm({...form,startDate:e.target.value})}/>
    <Input label="إلى" type="date" required value={form.endDate||''} onChange={e=>setForm({...form,endDate:e.target.value})}/>
    <Input label="قيمة الإيجار" type="number" required value={form.rentAmount||''} onChange={e=>setForm({...form,rentAmount:e.target.value})}/>
    <Select label="دورية السداد" options={frequencies} value={form.paymentFrequency||'MONTHLY'} onChange={e=>setForm({...form,paymentFrequency:e.target.value})}/>
    <Input label="التأمين" type="number" value={form.securityDeposit||''} onChange={e=>setForm({...form,securityDeposit:e.target.value})}/>
    <Input label="رقم عقد إيجار" value={form.ejarContractNumber||''} onChange={e=>setForm({...form,ejarContractNumber:e.target.value})}/>
   </div>
   <div className="flex justify-end gap-3"><Button type="button" variant="ghost" onClick={()=>setOpen(false)}><X className="h-4 w-4"/>إلغاء</Button><Button type="submit" isLoading={saving}>{editing?'حفظ':'إنشاء'}</Button></div>
  </form></Modal>
 </div>;
}
