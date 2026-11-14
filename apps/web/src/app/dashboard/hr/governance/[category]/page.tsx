'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import api from '@/lib/api';

const WORKFLOW_ACTIONS: Record<string, {code:string;label:string}[]> = {
  VIOLATIONS: [{code:'REPORT_DETAIL',label:'تفاصيل البلاغ'},{code:'REVIEW_FINDING',label:'نتيجة المراجعة'}],
  INVESTIGATIONS: [{code:'INVESTIGATOR_ASSIGNED',label:'تكليف المحقق'},{code:'INTERVIEW',label:'محضر استماع'},{code:'FACT_FINDING',label:'نتيجة التحقيق'}],
  EVIDENCE: [{code:'EVIDENCE_REVIEW',label:'فحص دليل'},{code:'CHAIN_OF_CUSTODY',label:'سلسلة حيازة الدليل'}],
  DISCIPLINE: [{code:'NOTICE_PROPOSED',label:'إشعار مقترح'},{code:'FINAL_REVIEW',label:'مراجعة مستقلة'},{code:'APPEAL_REVIEWED',label:'مراجعة التظلم'}],
  CONFLICTS: [{code:'DISCLOSURE',label:'إفصاح'},{code:'MITIGATION_PLAN',label:'خطة معالجة'},{code:'MITIGATION_REVIEW',label:'تقييم المعالجة'}],
  CLAIMS: [{code:'CLAIM_PROPOSED',label:'مطالبة مقترحة'},{code:'CLAIM_REVIEWED',label:'مراجعة مستقلة'},{code:'SETTLEMENT_OFFER',label:'عرض تسوية'}],
  LEGAL: [{code:'CASE_REFERENCE',label:'مرجع القضية'},{code:'HEARING',label:'جلسة قضائية'},{code:'JUDGMENT_RECORDED',label:'القرار القضائي'}],
  OFFBOARDING: [{code:'HANDOVER',label:'تسليم الأعمال'},{code:'ASSET_RETURN_CHECK',label:'فحص العهد'},{code:'ACCESS_REVOKED_CONFIRMED',label:'مراجعة صلاحيات الوصول'}],
  COMPLIANCE: [{code:'CONTROL_FINDING',label:'ملاحظة رقابية'},{code:'CORRECTIVE_ACTION',label:'إجراء تصحيحي'},{code:'CONTROL_VERIFIED',label:'تحقق من المعالجة'}],
};

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
  const [contracts,setContracts] = useState<any[]>([]);
  const [selected,setSelected] = useState<any>(null);
  const [related,setRelated] = useState<any>(null);
  const [form,setForm] = useState({ employeeId:'',contractId:'',title:'',description:'',priority:'NORMAL' });
  const [note,setNote] = useState('');
  const [actionCode,setActionCode] = useState('');
  const [actionNarrative,setActionNarrative] = useState('');
  const [actionAmount,setActionAmount] = useState('');
  const [actionDate,setActionDate] = useState('');
  const [evidence,setEvidence] = useState<any[]>([]);
  const [file,setFile] = useState<File|null>(null);
  const [evidenceDescription,setEvidenceDescription] = useState('');
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
  useEffect(()=>{
    setContracts([]);
    if(!form.employeeId) return;
    api.get('/hr/contracts?employeeId='+encodeURIComponent(form.employeeId))
      .then(r=>setContracts(r.data?.data||[]))
      .catch(()=>setContracts([]));
  },[form.employeeId]);

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
    try{
      const [r,files,linked]=await Promise.all([
        api.get('/hr/governance/'+id),
        api.get('/hr/governance/'+id+'/evidence'),
        api.get('/hr/governance/'+id+'/context'),
      ]);
      setRelated(linked.data);setSelected(r.data);setEvidence(files.data||[]);setResolution('');setNote('');setFile(null);
      setActionCode('');setActionNarrative('');setActionAmount('');setActionDate('');
    }
    catch(e:any){setError(e.response?.data?.message||'تعذر فتح القضية');}
  };
  const uploadEvidence = async () => {
    if(!selected||!file)return;
    if(file.size > 5*1024*1024) { setError('الحد الأقصى للمرفق 5 ميجابايت');return; }
    setSaving(true);setError('');
    try {
      const contentBase64=await new Promise<string>((resolve,reject)=>{
        const reader=new FileReader();reader.onerror=reject;
        reader.onload=()=>resolve(String(reader.result).split(',')[1]||'');
        reader.readAsDataURL(file);
      });
      await api.post('/hr/governance/'+selected.id+'/evidence',{
        fileName:file.name,mimeType:file.type,contentBase64,description:evidenceDescription||undefined,
      });
      const [r,files]=await Promise.all([
        api.get('/hr/governance/'+selected.id),
        api.get('/hr/governance/'+selected.id+'/evidence'),
      ]);
      setSelected(r.data);setEvidence(files.data||[]);
      setFile(null);setEvidenceDescription('');
    }catch(e:any){setError(e.response?.data?.message||'تعذر رفع الدليل');}
    finally{setSaving(false);}
  };
  const downloadEvidence=async(id:string,name:string)=>{
    try{
      const r=await api.get('/hr/governance/'+selected.id+'/evidence/'+id+'/download',{responseType:'blob'});
      const url=URL.createObjectURL(r.data);
      const a=document.createElement('a');a.href=url;a.download=name;a.click();
      URL.revokeObjectURL(url);
    }catch(e:any){setError(e.response?.data?.message||'تعذر تنزيل الدليل');}
  };
  const addWorkflowAction=async()=>{
    if(!selected || !actionCode || actionNarrative.trim().length < 10) return;
    setSaving(true);setError('');
    try {
      const body:any={code:actionCode,narrative:actionNarrative.trim()};
      if(actionAmount.trim())body.amount=Number(actionAmount);
      if(actionDate)body.dueDate=actionDate;
      const r=await api.post('/hr/governance/'+selected.id+'/actions',body);
      setSelected(r.data);setActionCode('');setActionNarrative('');setActionAmount('');setActionDate('');
      await load();
    }catch(e:any){setError(e.response?.data?.message||'تعذر حفظ الإجراء المتخصص');}
    finally{setSaving(false);}
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
        <label className="block text-sm text-slate-300">العقد المرتبط (اختياري)
          <select className={input} value={form.contractId} onChange={e=>setForm({...form,contractId:e.target.value})}>
            <option value="">دون عقد محدد</option>
            {contracts.map(x=><option key={x.id} value={x.id}>{x.contractNumber} — {x.status}</option>)}
          </select>
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
      <div className="flex flex-wrap gap-3 text-sm text-primary-400"><Link href={'/dashboard/hr/employees/'+selected.employeeId}>ملف الموظف</Link><Link href="/dashboard/hr/contracts">العقود</Link><Link href="/dashboard/hr/assets">العهد</Link><Link href="/dashboard/hr/settlements">المخالصات</Link></div>
      {related&&<section className="rounded-lg border border-slate-700 p-3 space-y-2">
        <h3 className="text-white font-semibold">الربط الحي بمساحات عمل الموظف</h3>
        <p className="text-sm text-slate-300">ملف الموظف: {related.employee?.employeeCode} — {related.employee?.firstName} {related.employee?.lastName} ({related.employee?.status})</p>
        <p className="text-sm text-slate-300">العقود: {related.contracts?.length||0} · العهد المسجلة: {related.custody?.length||0} · المخالصات: {related.settlements?.length||0} · حالات الانضمام والمغادرة: {related.lifecycle?.length||0}</p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
          {(related.contracts||[]).map((c:any)=><div key={c.id} className="text-sm text-slate-300">
            عقد: {c.contractNumber} — {c.status} {c.id===related.linkedContractId?'(مرتبط بالقضية)':''}
          </div>)}
          {(related.custody||[]).map((a:any)=><div key={a.id} className="text-sm text-slate-300">
            عهدة: {a.asset?.name} — {a.status}
          </div>)}
          {(related.settlements||[]).map((p:any)=><div key={p.id} className="text-sm text-slate-300">
            مخالصة: {p.status}
          </div>)}
          {(related.lifecycle||[]).map((p:any)=><div key={p.id} className="text-sm text-slate-300">
            {p.type==='OFFBOARDING'?'مغادرة':'انضمام'} — {p.status}
          </div>)}
        </div>
        <p className="text-xs text-slate-500">البيانات مرجعية من النظام وليست اعتمادًا أو تنفيذًا ماليًا؛ قوائم الربط محددة بعدد سجلات.</p>
      </section>}
      <div className="space-y-2"><h3 className="text-white font-semibold">سجل الإجراءات</h3>
        {(selected.events||[]).map((event:any)=><div key={event.id} className="border-t border-slate-700 p-2 text-slate-300 text-sm">
          <div>{event.action} — {event.details}</div>
          <div className="text-xs text-slate-500">{new Date(event.createdAt).toLocaleString('ar-SA')} · {event.actorUserId}</div>
        </div>)}
      </div>
      <section className="rounded-lg border border-slate-700 p-3 space-y-3">
        <h3 className="font-semibold text-white">المرفقات الأصلية والأدلة</h3>
        {evidence.length===0&&<p className="text-sm text-slate-400">لا توجد مرفقات.</p>}
        {evidence.map(item=><div key={item.id} className="border-t border-slate-700 pt-2 text-sm">
          <button type="button" className="text-primary-400 underline" onClick={()=>downloadEvidence(item.id,item.fileName)}>{item.fileName}</button>
          <p className="text-xs text-slate-500">SHA-256: {item.checksumSha256}</p>
          <p className="text-xs text-slate-500">{item.sizeBytes} بايت · {new Date(item.createdAt).toLocaleString('ar-SA')}</p>
        </div>)}
        {selected.status!=='CLOSED'&&<>
          <label className="block text-sm text-slate-300">إضافة ملف أصلي (PDF/JPG/PNG حتى 5 ميجابايت)
            <input type="file" accept=".pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png"
              onChange={e=>setFile(e.target.files?.[0]||null)} className={input}/>
          </label>
          <label className="block text-sm text-slate-300">وصف الدليل
            <input className={input} maxLength={1000} value={evidenceDescription} onChange={e=>setEvidenceDescription(e.target.value)}/>
          </label>
          <button type="button" onClick={uploadEvidence} disabled={saving||!file} className="rounded-lg border border-slate-600 px-3 py-2 text-white disabled:opacity-50">رفع وحفظ الدليل</button>
        </>}
      </section>
      {selected.status!=='CLOSED'&&<section className="rounded-lg border border-slate-700 p-3 space-y-3">
        <h3 className="font-semibold text-white">الإجراءات المتخصصة — {space.label}</h3>
        <label className="block text-sm text-slate-300">نوع الإجراء
          <select value={actionCode} onChange={e=>setActionCode(e.target.value)} className={input}>
            <option value="">اختر نوع الإجراء</option>
            {(WORKFLOW_ACTIONS[space.category]||[]).map(item=><option key={item.code} value={item.code}>{item.label}</option>)}
          </select>
        </label>
        <label className="block text-sm text-slate-300">المحضر أو التفاصيل
          <textarea value={actionNarrative} maxLength={4000} minLength={10}
            onChange={e=>setActionNarrative(e.target.value)} rows={4} className={input}/>
        </label>
        {(space.category==='CLAIMS'||space.category==='LEGAL')&&<label className="block text-sm text-slate-300">المبلغ المرجعي (اختياري، لا يترتب عليه خصم)
          <input type="number" min="0" max="1000000000" step="0.01" value={actionAmount}
            onChange={e=>setActionAmount(e.target.value)} className={input}/>
        </label>}
        {(space.category==='LEGAL'||space.category==='OFFBOARDING'||space.category==='COMPLIANCE')&&
          <label className="block text-sm text-slate-300">تاريخ مرتبط بالإجراء (اختياري)
            <input type="date" value={actionDate} onChange={e=>setActionDate(e.target.value)} className={input}/>
          </label>}
        <button type="button" onClick={addWorkflowAction} disabled={saving||!actionCode||actionNarrative.trim().length<10}
          className="rounded-lg border border-primary-500 px-3 py-2 text-white disabled:opacity-50">حفظ الإجراء في سجل القضية</button>
        <p className="text-xs text-slate-400">يُسجل الإجراء باسم المستخدم، دون تنفيذ اقتطاع أو جزاء أو دفع تلقائي.</p>
      </section>}
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
