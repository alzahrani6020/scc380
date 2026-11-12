'use client';

import { useEffect, useMemo, useState } from 'react';
import api from '@/lib/api';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import Modal from '@/components/ui/Modal';
import Select from '@/components/ui/Select';

export default function RecruitmentPage() {
  const [jobs,setJobs]=useState<any[]>([]);
  const [candidates,setCandidates]=useState<any[]>([]);
  const [departments,setDepartments]=useState<any[]>([]);
  const [jobOpen,setJobOpen]=useState(false);
  const [candidateOpen,setCandidateOpen]=useState(false);
  const [job,setJob]=useState<any>({headcount:1});
  const [candidate,setCandidate]=useState<any>({});
  const [busy,setBusy]=useState(false);

  const load=()=>Promise.all([
    api.get('/hr/recruitment/jobs').then(r=>setJobs(r.data.data||[])),
    api.get('/hr/recruitment/candidates').then(r=>setCandidates(r.data.data||[])),
    api.get('/hr/departments').then(r=>setDepartments(r.data.data||[])),
  ]).catch(console.error);
  useEffect(()=>{load();},[]);

  const deptOptions=[{value:'',label:'بدون إدارة'},...departments.map(d=>({value:d.id,label:d.name}))];
  const openJobOptions=jobs.filter(j=>j.status==='OPEN').map(j=>({value:j.id,label:j.title+(j.code?' · '+j.code:'')}));

  const createJob=async()=>{
    setBusy(true);
    try{
      await api.post('/hr/recruitment/jobs',{
        title:job.title,code:job.code||undefined,departmentId:job.departmentId||undefined,
        headcount:Number(job.headcount||1),employmentType:job.employmentType||undefined,
        location:job.location||undefined,description:job.description||undefined,requirements:job.requirements||undefined
      });
      setJobOpen(false);setJob({headcount:1});await load();
    }catch(e:any){alert(e?.response?.data?.message||'تعذر إنشاء الشاغر');}finally{setBusy(false);}
  };

  const setJobStatus=async(id:string,status:string)=>{await api.post(`/hr/recruitment/jobs/${id}/status`,{status});await load();};

  const fileToBase64=(f:File)=>new Promise<string>((resolve,reject)=>{
    const reader=new FileReader();reader.onerror=reject;reader.onload=()=>resolve(String(reader.result).split(',')[1]||'');reader.readAsDataURL(f);
  });

  const createCandidate=async()=>{
    setBusy(true);
    try{
      const payload:any={...candidate};
      if(candidate.file){
        if(candidate.file.size>5*1024*1024) throw new Error('الحد الأقصى للسيرة 5MB');
        payload.resumeFileName=candidate.file.name;payload.resumeMimeType=candidate.file.type;
        payload.resumeContentBase64=await fileToBase64(candidate.file);delete payload.file;
      }
      await api.post('/hr/recruitment/candidates',payload);
      setCandidateOpen(false);setCandidate({});await load();
    }catch(e:any){alert(e?.response?.data?.message||e.message||'تعذر إضافة المرشح');}finally{setBusy(false);}
  };

  const interview=async(c:any)=>{
    const scheduledAt=prompt('موعد المقابلة بصيغة 2026-11-20T10:00:00+03:00'); if(!scheduledAt)return;
    await api.post(`/hr/recruitment/candidates/${c.id}/interviews`,{scheduledAt,type:'INTERVIEW'});await load();
  };
  const offer=async(c:any)=>{
    const salary=Number(prompt('الراتب المعروض'));if(!salary)return;
    await api.post(`/hr/recruitment/candidates/${c.id}/offer`,{offerSalary:salary});await load();
  };
  const hire=async(c:any)=>{
    const employeeCode=prompt('رقم الموظف');if(!employeeCode)return;
    const hireDate=prompt('تاريخ التعيين YYYY-MM-DD',new Date().toISOString().slice(0,10));if(!hireDate)return;
    await api.post(`/hr/recruitment/candidates/${c.id}/hire`,{employeeCode,hireDate});await load();
  };
  const downloadResume=async(c:any)=>{
    const r=await api.get(`/hr/recruitment/candidates/${c.id}/resume`,{responseType:'blob'});
    const url=URL.createObjectURL(r.data);const a=document.createElement('a');a.href=url;a.download=c.resumeFileName||'resume';a.click();URL.revokeObjectURL(url);
  };

  return <div className="space-y-6">
    <div className="flex justify-between gap-4"><div><h1 className="text-2xl font-bold text-white">التوظيف</h1><p className="text-slate-400 text-sm">شاغر → مرشح → مقابلة → عرض → موظف فعلي وOnboarding.</p></div><div className="flex gap-2"><Button variant="ghost" onClick={()=>setJobOpen(true)}>شاغر جديد</Button><Button onClick={()=>setCandidateOpen(true)}>مرشح جديد</Button></div></div>
    <div className="scc-card"><h2 className="text-white font-bold mb-3">الشواغر</h2><div className="space-y-3">{jobs.map(j=><div key={j.id} className="flex justify-between border-b border-slate-800 pb-3"><div><div className="text-white">{j.title}</div><div className="text-xs text-slate-500">{j.department?.name||'—'} · {j.status} · {j._count?.candidates||0} مرشح</div></div><div className="flex gap-2">{j.status==='DRAFT'&&<Button size="sm" onClick={()=>setJobStatus(j.id,'OPEN')}>فتح</Button>}{j.status==='OPEN'&&<Button size="sm" variant="ghost" onClick={()=>setJobStatus(j.id,'CLOSED')}>إغلاق</Button>}</div></div>)}</div></div>
    <div className="scc-card"><h2 className="text-white font-bold mb-3">المرشحون</h2><div className="space-y-3">{candidates.map(c=><div key={c.id} className="flex justify-between gap-4 border-b border-slate-800 pb-3"><div><div className="text-white">{c.firstName} {c.lastName}</div><div className="text-xs text-slate-500">{c.jobOpening?.title} · {c.status} · {c.email||'—'}</div></div><div className="flex gap-2 flex-wrap justify-end">{c.resumeFileName&&<Button size="sm" variant="ghost" onClick={()=>downloadResume(c)}>السيرة</Button>}{!['HIRED','REJECTED','WITHDRAWN'].includes(c.status)&&<Button size="sm" variant="ghost" onClick={()=>interview(c)}>مقابلة</Button>}{!['HIRED','REJECTED','WITHDRAWN'].includes(c.status)&&<Button size="sm" variant="ghost" onClick={()=>offer(c)}>عرض</Button>}{c.status==='OFFER'&&<Button size="sm" onClick={()=>hire(c)}>توظيف</Button>}</div></div>)}</div></div>

    <Modal isOpen={jobOpen} onClose={()=>setJobOpen(false)} title="شاغر جديد" size="lg"><div className="space-y-4"><Input label="المسمى" value={job.title||''} onChange={e=>setJob({...job,title:e.target.value})}/><Input label="الرمز" value={job.code||''} onChange={e=>setJob({...job,code:e.target.value})}/><Select label="الإدارة" options={deptOptions} value={job.departmentId||''} onChange={e=>setJob({...job,departmentId:e.target.value})}/><Input label="العدد المطلوب" type="number" value={job.headcount||1} onChange={e=>setJob({...job,headcount:e.target.value})}/><Input label="الموقع" value={job.location||''} onChange={e=>setJob({...job,location:e.target.value})}/><Input label="الوصف" value={job.description||''} onChange={e=>setJob({...job,description:e.target.value})}/><div className="flex justify-end"><Button disabled={!job.title} isLoading={busy} onClick={createJob}>حفظ</Button></div></div></Modal>
    <Modal isOpen={candidateOpen} onClose={()=>setCandidateOpen(false)} title="مرشح جديد" size="lg"><div className="space-y-4"><Select label="الشاغر المفتوح" options={openJobOptions} value={candidate.jobOpeningId||''} onChange={e=>setCandidate({...candidate,jobOpeningId:e.target.value})}/><div className="grid grid-cols-2 gap-3"><Input label="الاسم الأول" value={candidate.firstName||''} onChange={e=>setCandidate({...candidate,firstName:e.target.value})}/><Input label="اسم العائلة" value={candidate.lastName||''} onChange={e=>setCandidate({...candidate,lastName:e.target.value})}/><Input label="البريد" value={candidate.email||''} onChange={e=>setCandidate({...candidate,email:e.target.value})}/><Input label="الهاتف" value={candidate.phone||''} onChange={e=>setCandidate({...candidate,phone:e.target.value})}/></div><input className="scc-input" type="file" accept=".pdf,.doc,.docx" onChange={e=>setCandidate({...candidate,file:e.target.files?.[0]})}/><div className="flex justify-end"><Button disabled={!candidate.jobOpeningId||!candidate.firstName||!candidate.lastName} isLoading={busy} onClick={createCandidate}>إضافة المرشح</Button></div></div></Modal>
  </div>;
}
