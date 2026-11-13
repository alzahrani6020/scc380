'use client';

import { useEffect,useState } from 'react';
import api from '@/lib/api';
import { DoorOpen,Plus,Pencil,Trash2,X } from 'lucide-react';
import Modal from '@/components/ui/Modal';
import Input from '@/components/ui/Input';
import Select from '@/components/ui/Select';
import Button from '@/components/ui/Button';

const unitTypes=[{value:'APARTMENT',label:'شقة'},{value:'VILLA',label:'فيلا'},{value:'OFFICE',label:'مكتب'},{value:'SHOP',label:'محل'},{value:'WAREHOUSE',label:'مستودع'},{value:'LAND_PLOT',label:'أرض'},{value:'STUDIO',label:'استوديو'},{value:'DUPLEX',label:'دوبلكس'},{value:'PENTHOUSE',label:'بنتهاوس'}];
const statuses=[{value:'VACANT',label:'شاغرة'},{value:'OCCUPIED',label:'مشغولة'},{value:'RESERVED',label:'محجوزة'},{value:'UNDER_MAINTENANCE',label:'تحت الصيانة'},{value:'SOLD',label:'مباعة'}];

export default function UnitsPage(){
 const [items,setItems]=useState<any[]>([]);
 const [properties,setProperties]=useState<any[]>([]);
 const [loading,setLoading]=useState(true);
 const [open,setOpen]=useState(false);
 const [editing,setEditing]=useState<any>(null);
 const [saving,setSaving]=useState(false);
 const [form,setForm]=useState<any>({unitType:'APARTMENT',status:'VACANT'});
 const load=()=>Promise.all([
   api.get('/real-estate/units').then(r=>setItems(r.data.data||[])),
   api.get('/real-estate/properties').then(r=>setProperties(r.data.data||[])),
 ]).finally(()=>setLoading(false));
 useEffect(()=>{load().catch(console.error)},[]);
 const create=()=>{setEditing(null);setForm({unitType:'APARTMENT',status:'VACANT'});setOpen(true)};
 const edit=(x:any)=>{setEditing(x);setForm({...x});setOpen(true)};
 const submit=async(e:React.FormEvent)=>{e.preventDefault();setSaving(true);try{
   const fields=['propertyId','unitNumber','floor','unitType','status','areaSqm','bedrooms','bathrooms','rentAmountMonthly'];
   const p:any=Object.fromEntries(fields.filter(k=>form[k]!==undefined&&form[k]!==null&&form[k]!=='').map(k=>[k,form[k]]));
   if(p.floor!=='') p.floor=p.floor===undefined?undefined:Number(p.floor);
   if(p.bedrooms!=='') p.bedrooms=p.bedrooms===undefined?undefined:Number(p.bedrooms);
   if(p.bathrooms!=='') p.bathrooms=p.bathrooms===undefined?undefined:Number(p.bathrooms);
   if(p.areaSqm!==undefined&&p.areaSqm!=='') p.areaSqm=String(p.areaSqm);
   if(p.rentAmountMonthly!==undefined&&p.rentAmountMonthly!=='') p.rentAmountMonthly=String(p.rentAmountMonthly);
   if(editing) await api.patch('/real-estate/units/'+editing.id,p); else await api.post('/real-estate/units',p);
   setOpen(false);await load();
 }finally{setSaving(false)}};
 const remove=async(id:string)=>{if(!confirm('حذف الوحدة؟'))return;await api.delete('/real-estate/units/'+id);await load()};
 return <div className="space-y-6 animate-fade-in-up">
  <div className="flex items-center justify-between"><div><h1 className="text-2xl font-bold text-white flex items-center gap-2"><DoorOpen className="h-6 w-6 text-primary-400"/>الوحدات</h1><p className="text-slate-400 text-sm mt-1">{items.length} وحدة</p></div><Button onClick={create}><Plus className="h-5 w-5"/>وحدة جديدة</Button></div>
  {loading?<div className="h-64 flex items-center justify-center text-slate-400">جاري التحميل...</div>:<div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">{items.map(x=><div key={x.id} className="scc-card-hover">
    <div className="flex justify-between"><div><p className="text-white font-bold">وحدة {x.unitNumber}</p><p className="text-slate-400 text-sm">{x.property?.name||'—'}</p></div><span className="text-xs text-primary-300">{statuses.find(s=>s.value===x.status)?.label||x.status}</span></div>
    <div className="mt-4 text-sm text-slate-400 space-y-1"><p>النوع: {unitTypes.find(t=>t.value===x.unitType)?.label||x.unitType}</p><p>المساحة: {x.areaSqm||'—'} م²</p><p>الإيجار الشهري: {Number(x.rentAmountMonthly||0).toLocaleString()} ر.س</p></div>
    <div className="mt-4 flex gap-3"><button onClick={()=>edit(x)} className="text-primary-400"><Pencil className="h-4 w-4"/></button><button onClick={()=>remove(x.id)} className="text-red-400"><Trash2 className="h-4 w-4"/></button></div>
  </div>)}</div>}
  <Modal isOpen={open} onClose={()=>setOpen(false)} title={editing?'تعديل وحدة':'وحدة جديدة'} size="lg"><form onSubmit={submit} className="space-y-4">
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      <Select label="العقار" required options={properties.map(p=>({value:p.id,label:p.name}))} value={form.propertyId||''} onChange={e=>setForm({...form,propertyId:e.target.value})}/>
      <Input label="رقم الوحدة" required value={form.unitNumber||''} onChange={e=>setForm({...form,unitNumber:e.target.value})}/>
      <Select label="نوع الوحدة" options={unitTypes} value={form.unitType||'APARTMENT'} onChange={e=>setForm({...form,unitType:e.target.value})}/>
      <Select label="الحالة" options={statuses} value={form.status||'VACANT'} onChange={e=>setForm({...form,status:e.target.value})}/>
      <Input label="الطابق" type="number" value={form.floor??''} onChange={e=>setForm({...form,floor:e.target.value})}/>
      <Input label="المساحة م²" type="number" value={form.areaSqm||''} onChange={e=>setForm({...form,areaSqm:e.target.value})}/>
      <Input label="غرف النوم" type="number" value={form.bedrooms??''} onChange={e=>setForm({...form,bedrooms:e.target.value})}/>
      <Input label="الحمامات" type="number" value={form.bathrooms??''} onChange={e=>setForm({...form,bathrooms:e.target.value})}/>
      <Input label="الإيجار الشهري" type="number" value={form.rentAmountMonthly||''} onChange={e=>setForm({...form,rentAmountMonthly:e.target.value})}/>
    </div>
    <div className="flex justify-end gap-3"><Button type="button" variant="ghost" onClick={()=>setOpen(false)}><X className="h-4 w-4"/>إلغاء</Button><Button type="submit" isLoading={saving}>{editing?'حفظ':'إنشاء'}</Button></div>
  </form></Modal>
 </div>;
}
