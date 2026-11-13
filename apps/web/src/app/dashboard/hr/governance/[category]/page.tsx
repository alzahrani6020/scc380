'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import api from '@/lib/api';

const SPACES: Record<string, {label: string;category:string}> = {
  violations: {label:'البلاغات والمخالفات',category:'VIOLATIONS'},
  investigations: {label:'التحقيقات الإدارية والمالية',category:'INVESTIGATIONS'},
  evidence: {label:'سجل الأدلة والإفادات',category:'EVIDENCE'},
  discipline: {label:'الإنذارات والجزاءات والتظلمات',category:'DISCIPLINE'},
  conflicts: {label:'تعارض المصالح وعدم المنافسة',category:'CONFLICTS'},
  claims: {label:'المطالبات والتعويضات',category:'CLAIMS'},
  legal: {label:'المنازعات والقضايا',category:'LEGAL'},
  offboarding: {label:'إخلاء الطرف وتسليم الأعمال',category:'OFFBOARDING'},
  compliance: {label:'الرقابة والامتثال الوظيفي',category:'COMPLIANCE'},
};

export default function GovernanceWorkspace() {
  const params = useParams();
  const key = typeof params.category === 'string' ? params.category : '';
  const space = SPACES[key];
  const [records,setRecords] = useState<any[]>([]);
  const [employees,setEmployees] = useState<any[]>([]);
  const [selected,setSelected] = useState<any>(null);
  const [form,setForm] = useState({ employeeId:'',contractId:'',title:'',description:'',priority:'NORMAL' });
  const [note,setNote] = useState('');
  const [resolution,setResolution] = useState('');
  const [saving,setSaving] = useState(false);
  const [error,setError] = useState('');
  const [busy,setBusy] = useState(true);

  const load = async () => {
    if (!space) return;
    setBusy(true); setError('');
    try {
      const [cases,staff] = await Promise.all([
        api.get('/hr/governance?category='+encodeURIComponent(space.category)),
        api.get('/hr/employees?limit=200'),
      ]);
      setRecords(cases.data?.data || []);
      setEmployees(staff.data?.data || []);
    } catch(e:any) { setError(e.response?.data?.message || 'تعذر تحميل البيانات أو لا توجد صلاحية'); }
    finally { setBusy(false); }
  };
  useEffect(()=>{setSelected(null);void load();},[key]);

  const submit = async (e:React.FormEvent) => {
    e.preventDefault();setSaving(true);setError('');
    try {
      await api.post('/hr/governance',{...form,contractId:form.contractId||undefined,category:space.category});
      setForm({employeeId:'',contractId:'',title:'',description:'',priority:'NORMAL'});
      await load();
    } catch(e:any){setError(e.response?.data?.message||'تعذر حفظ القضية');}
    finally{setSaving(false);}
  };
  const openCase=async(id:string)=>{
    try{const r=await api.get('/hr/governance/'+id);setSelected(r.data);setResolution('');setNote('');}
    catch(e:any){setError(e.response?.data?.message||'تعذر فتح القضية');}
  };
  const addNote=async()=>{
    if(!selected||!note.trim())return;
    setSaving(true);try{
      const r=await api.post('/hr/governance/'+selected.id+'/notes',{details:note});
      setSelected(r.data);setNote('');await load();
    }catch(e:any){setError(e.response?.data?.message||'تعذر حفظ الإجراء');}
    finally{setSaving(false);}
  };
  const changeStatus=async(status:string)=>{
    if(!selected)return;
    setSaving(true);try{
      const r=await api.post('/hr/governance/'+selected.id+'/transition',{status,resolution:resolution||undefined});
      setSelected(r.data);setResolution('');await load();
    }catch(e:any){setError(e.response?.data?.message||'تعذر تغيير الحالة');}
    finally{setSaving(false);}
  };

  if(!space)return <div className="scc-card text-white">مساحة عمل غير معروفة. <Link href="/dashboard/hr">العودة إلى مكين</Link></div>;
  const input='w-full rounded-lg border border-slate-700 bg-slate-900 p-2 text-white';
  return <main className="space-y-5" dir="rtl">
    <div><Link href="/dashboard/hr" className="text-primary-400 text-sm">مكين / الموارد البشرية</Link>
      <h1 className="text-2xl font-bold text-white mt-2">{space.label}</h1>
      <p className="text-slate-400 text-sm">مساحة عمل محفوظة بالمنشأة والموظف، مع سجل إجراءات ومراجعة. لا تنفذ جزاءات أو خصومات آلية.</p>
    </div>
    <div className="flex flex-wrap gap-2">{Object.entries(SPACES).map(([slug,s])=>
      <Link key={slug} href={'/dashboard/hr/governance/'+slug} className={'rounded-lg border px-3 py-2 text-xs '+(slug===key?'border-primary-500 text-white bg-primary-500/10':'border-slate-700 text-slate-300')}>{s.label}</Link>)}
    </div>
    {error&&<div role="alert" className="rounded-lg border border-red-500/50 p-3 text-red-300">{String(error)}</div>}
    <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
      <form onSubmit={submit} className="scc-card space-y-3">
        <h2 className="font-semibold text-white">فتح ملف جديد</h2>
        <label className="block text-sm text-slate-300">الموظف
          <select required className={input} value={form.employeeId} onChange={e=>setForm({...form,employeeId:e.target.value})}>
            <option value="">اختر الموظف</option>
            {employees.map(x=><option key={x.id} value={x.id}>{x.employeeCode} — {x.firstName} {x.lastName}</option>)}
          </select>
        </label>
        <label className="block text-sm text-slate-300">معرّف العقد (اختياري؛ يتحقق الخادم من تبعيته للموظف)
          <input className={input} value={form.contractId} onChange={e=>setForm({...form,contractId:e.target.value})}/>
        </label>
        <label className="block text-sm text-slate-300">عنوان القضية
          <input required minLength={5} maxLength={180} className={input} value={form.title} onChange={e=>setForm({...form,title:e.target.value})}/>
        </label>
        <label className="block text-sm text-slate-300">الوقائع الأولية (لا تعني ثبوت المخالفة)
          <textarea required minLength={10} maxLength={4000} rows={4} className={input} value={form.description} onChange={e=>setForm({...form,description:e.target.value})}/>
        </label>
        <label className="block text-sm text-slate-300">الأولوية
          <select className={input} value={form.priority} onChange={e=>setForm({...form,priority:e.target.value})}>
            <option value="NORMAL">عادية</option><option value="HIGH">مرتفعة</option><option value="CRITICAL">حرجة</option>
          </select>
        </label>
        <button type="submit" disabled={saving||busy} className="rounded-lg bg-primary-600 px-4 py-2 text-white disabled:opacity-50">حفظ الملف</button>
      </form>
      <section className="scc-card space-y-3">
        <h2 className="text-white font-semibold">ملفات {space.label}</h2>
        {busy&&<p className="text-slate-400">تحميل...</p>}
        {!busy&&records.length===0&&<p className="text-slate-400">لا توجد ملفات مسجلة.</p>}
        {records.map(item=><button type="button" onClick={()=>openCase(item.id)} key={item.id}
          className="w-full text-right rounded-lg border border-slate-700 p-3 text-slate-200 hover:border-primary-500">
          <span className="block font-semibold">{item.title}</span>
          <span className="text-xs text-slate-400">{item.status} · {item.priority} · {new Date(item.createdAt).toLocaleDateString('ar-SA')}</span>
        </button>)}
      </section>
    </div>
    {selected&&<section className="scc-card space-y-3">
      <h2 className="text-lg font-bold text-white">{selected.title}</h2>
      <p className="text-slate-300 whitespace-pre-wrap">{selected.description}</p>
      <p className="text-xs text-slate-400">الحالة: {selected.status} · رقم الملف: {selected.id} · الموظف: {selected.employeeId}</p>
      <div className="space-y-2"><h3 className="text-white font-semibold">سجل الإجراءات</h3>
        {(selected.events||[]).map((event:any)=><div key={event.id} className="border-t border-slate-700 p-2 text-slate-300 text-sm">
          <div>{event.action} — {event.details}</div>
          <div className="text-xs text-slate-500">{new Date(event.createdAt).toLocaleString('ar-SA')} · {event.actorUserId}</div>
        </div>)}
      </div>
      {selected.status!=='CLOSED'&&<>
        <label className="block text-slate-300 text-sm">إضافة إفادة أو إجراء
          <textarea className={input} rows={3} value={note} onChange={e=>setNote(e.target.value)}/>
        </label>
        <button onClick={addNote} disabled={saving||note.trim().length<2} className="border border-slate-600 rounded-lg px-3 py-2 text-white disabled:opacity-50">حفظ الإجراء</button>
        <label className="block text-slate-300 text-sm">سبب القرار (إلزامي عند الحل أو الإغلاق)
          <textarea className={input} rows={2} value={resolution} onChange={e=>setResolution(e.target.value)}/>
        </label>
        <div className="flex flex-wrap gap-2">
          {selected.status==='OPEN'&&<button onClick={()=>changeStatus('IN_REVIEW')} disabled={saving} className="rounded-lg border border-slate-600 px-3 py-2 text-white">بدء المراجعة</button>}
          {selected.status==='IN_REVIEW'&&<button onClick={()=>changeStatus('RESOLVED')} disabled={saving||!resolution.trim()} className="rounded-lg border border-slate-600 px-3 py-2 text-white">إثبات نتيجة المراجعة</button>}
          {['OPEN','IN_REVIEW','RESOLVED'].includes(selected.status)&&<button onClick={()=>changeStatus('CLOSED')} disabled={saving||!resolution.trim()} className="rounded-lg border border-slate-600 px-3 py-2 text-white">إغلاق الملف</button>}
        </div>
      </>}
      <p className="text-xs text-amber-300">إغلاق الملف إجراء إداري داخل هذه المساحة، ولا يعني فرض عقوبة أو إثبات دين أو إصدار حكم.</p>
    </section>}
  </main>;
}
