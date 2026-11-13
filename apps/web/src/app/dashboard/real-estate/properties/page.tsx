'use client';

import { useEffect,useState } from 'react';
import api from '@/lib/api';
import { Building2,Plus,Pencil,Trash2,X,Search } from 'lucide-react';
import Modal from '@/components/ui/Modal';
import Input from '@/components/ui/Input';
import Select from '@/components/ui/Select';
import Button from '@/components/ui/Button';

const types=[{value:'RESIDENTIAL',label:'سكني'},{value:'COMMERCIAL',label:'تجاري'},{value:'INDUSTRIAL',label:'صناعي'},{value:'MIXED_USE',label:'متعدد الاستخدام'},{value:'LAND',label:'أرض'}];
const statuses=[{value:'ACTIVE',label:'نشط'},{value:'INACTIVE',label:'غير نشط'},{value:'UNDER_CONSTRUCTION',label:'تحت الإنشاء'},{value:'SOLD',label:'مباع'}];

export default function PropertiesPage(){
 const [items,setItems]=useState<any[]>([]);
 const [loading,setLoading]=useState(true);
 const [loadError,setLoadError]=useState(false);
 const [actionError,setActionError]=useState(false);
 const [open,setOpen]=useState(false);
 const [editing,setEditing]=useState<any>(null);
 const [saving,setSaving]=useState(false);
 const [search,setSearch]=useState('');
 const [form,setForm]=useState<any>({propertyType:'RESIDENTIAL',status:'ACTIVE'});
 const load=()=>api.get('/real-estate/properties').then(r=>{setItems(r.data.data||[]);setLoadError(false)}).catch(err=>{setLoadError(true);throw err}).finally(()=>setLoading(false));
 useEffect(()=>{load().catch(console.error)},[]);
 const create=()=>{setEditing(null);setForm({propertyType:'RESIDENTIAL',status:'ACTIVE'});setOpen(true)};
 const edit=(x:any)=>{setEditing(x);setForm({...x});setOpen(true)};
 const submit=async(e:React.FormEvent)=>{e.preventDefault();setSaving(true);setActionError(false);try{const fields=['name','description','propertyType','status','address','city','district','buildingNumber','latitude','longitude','deedNumber','deedFileUrl','ownerName','ownerIdNumber','ownerPhone','regaLicenseNumber','acquisitionDate','acquisitionCost','totalAreaSqm'];const p:any=Object.fromEntries(fields.filter(k=>form[k]!==undefined&&form[k]!==null&&form[k]!=='').map(k=>[k,form[k]]));for(const key of ['latitude','longitude','acquisitionCost','totalAreaSqm'])if(p[key]!==undefined)p[key]=String(p[key]);if(editing)await api.patch('/real-estate/properties/'+editing.id,p);else await api.post('/real-estate/properties',p);setOpen(false);await load()}catch(err){console.error(err);setActionError(true)}finally{setSaving(false)}};
 const remove=async(id:string)=>{if(!confirm('حذف العقار؟'))return;setActionError(false);try{await api.delete('/real-estate/properties/'+id);await load()}catch(err){console.error(err);setActionError(true)}};
 const filtered=items.filter(x=>[x.name,x.city,x.district,x.deedNumber].some(v=>String(v||'').includes(search)));
 return <div className="space-y-6 animate-fade-in-up">
  <div className="flex items-center justify-between"><div><h1 className="text-2xl font-bold text-white flex items-center gap-2"><Building2 className="h-6 w-6 text-primary-400"/>العقارات</h1><p className="text-slate-400 text-sm mt-1">{items.length} عقار</p></div><Button onClick={create}><Plus className="h-5 w-5"/>عقار جديد</Button></div>
  <div className="relative"><Search className="absolute right-3 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-500"/><input className="scc-input pr-10" placeholder="بحث بالاسم أو المدينة أو الصك..." value={search} onChange={e=>setSearch(e.target.value)}/></div>
  {loading?<div className="h-64 flex items-center justify-center text-slate-400">جاري التحميل...</div>:loadError?<div role="alert" className="rounded-lg border border-red-800 p-4 text-red-200">تعذر تحميل قائمة العقارات. تحقق من الاتصال والصلاحيات وأعد تحميل الصفحة.</div>:<div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">{filtered.map(x=><div key={x.id} className="scc-card-hover">
   <div className="flex items-start justify-between"><div><p className="text-white font-bold">{x.name}</p><p className="text-slate-400 text-sm">{x.city||'—'} {x.district?'· '+x.district:''}</p></div><span className="text-xs text-primary-300">{statuses.find(s=>s.value===x.status)?.label||x.status}</span></div>
   <div className="mt-4 text-sm text-slate-400 space-y-1"><p>النوع: {types.find(t=>t.value===x.propertyType)?.label||x.propertyType}</p><p>الوحدات: {x._count?.units||0}</p><p>العقود: {x._count?.contracts||0}</p><p>رقم الصك: {x.deedNumber||'—'}</p></div>
   <div className="mt-4 flex gap-3"><button onClick={()=>edit(x)} className="text-primary-400"><Pencil className="h-4 w-4"/></button><button onClick={()=>remove(x.id)} className="text-red-400"><Trash2 className="h-4 w-4"/></button></div>
  </div>)}</div>}
  {actionError&&<div role="alert" className="rounded-lg border border-red-800 p-4 text-red-200">فشلت العملية ولم يتم تأكيد حفظ التغييرات. تحقق من المدخلات والصلاحيات وحاول مجددًا.</div>}
  <Modal isOpen={open} onClose={()=>setOpen(false)} title={editing?'تعديل عقار':'عقار جديد'} size="lg"><form onSubmit={submit} className="space-y-4">
   <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
    <Input label="اسم العقار" required value={form.name||''} onChange={e=>setForm({...form,name:e.target.value})}/>
    <Select label="النوع" options={types} value={form.propertyType||'RESIDENTIAL'} onChange={e=>setForm({...form,propertyType:e.target.value})}/>
    <Select label="الحالة" options={statuses} value={form.status||'ACTIVE'} onChange={e=>setForm({...form,status:e.target.value})}/>
    <Input label="المدينة" value={form.city||''} onChange={e=>setForm({...form,city:e.target.value})}/>
    <Input label="الحي" value={form.district||''} onChange={e=>setForm({...form,district:e.target.value})}/>
    <Input label="العنوان" value={form.address||''} onChange={e=>setForm({...form,address:e.target.value})}/>
    <Input label="رقم الصك" value={form.deedNumber||''} onChange={e=>setForm({...form,deedNumber:e.target.value})}/>
    <Input label="المساحة م²" type="number" value={form.totalAreaSqm||''} onChange={e=>setForm({...form,totalAreaSqm:e.target.value})}/>
    <Input label="اسم المالك" value={form.ownerName||''} onChange={e=>setForm({...form,ownerName:e.target.value})}/>
    <Input label="رقم هوية المالك" value={form.ownerIdNumber||''} onChange={e=>setForm({...form,ownerIdNumber:e.target.value})}/>
   </div>
   <div className="flex justify-end gap-3"><Button type="button" variant="ghost" onClick={()=>setOpen(false)}><X className="h-4 w-4"/>إلغاء</Button><Button type="submit" isLoading={saving}>{editing?'حفظ':'إنشاء'}</Button></div>
  </form></Modal>
 </div>;
}
