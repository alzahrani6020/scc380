'use client';

import { useEffect, useMemo, useState } from 'react';
import api from '@/lib/api';
import { getRole } from '@/lib/auth';
import { CheckCircle2, Circle, ListChecks, Plus, SkipForward } from 'lucide-react';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import Modal from '@/components/ui/Modal';
import Select from '@/components/ui/Select';

export default function HrLifecyclePage() {
  const [cases, setCases] = useState<any[]>([]);
  const [employees, setEmployees] = useState<any[]>([]);
  const [type, setType] = useState('');
  const [open, setOpen] = useState(false);
  const [exitCase,setExitCase] = useState<any>(null);
  const [exitReason,setExitReason] = useState('');
  const [exitDate,setExitDate] = useState(new Date().toISOString().slice(0,10));
  const [exitBusy,setExitBusy] = useState(false);
  const [completionBusy,setCompletionBusy]=useState<string>('');
  const [form, setForm] = useState<any>({ type: 'ONBOARDING' });

  const load = () => {
    const q = type ? '?type=' + type : '';
    Promise.all([
      api.get('/hr/lifecycle' + q).then(r => setCases(r.data.data || [])),
      api.get('/hr/employees?limit=200').then(r => setEmployees(r.data.data || [])),
    ]).catch(console.error);
  };
  useEffect(() => { load(); }, [type]);

  const employeesOptions = useMemo(() => employees.map(e => ({value:e.id,label:`${e.firstName} ${e.lastName} · ${e.employeeCode}`})),[employees]);

  const createCase = async () => {
    await api.post('/hr/lifecycle', {
      employeeId: form.employeeId, type: form.type,
      targetDate: form.targetDate || undefined, notes: form.notes || undefined,
    });
    setOpen(false); setForm({ type: 'ONBOARDING' }); load();
  };

  const setTask = async (caseId: string, taskId: string, status: string) => {
    await api.patch(`/hr/lifecycle/${caseId}/tasks/${taskId}`, { status });
    load();
  };

  const completeExistingExit=async(caseId:string)=>{
    if(!confirm('إكمال إخلاء الطرف الإداري بعد التحقق من انتهاء العمل والعقود والعهد والصلاحيات؟ لا يعني هذا إثبات دفع المستحقات.'))return;
    setCompletionBusy(caseId);
    try{
      await api.post('/hr/lifecycle/'+caseId+'/complete',{});
      await load();
    }catch(e:any){alert(e.response?.data?.message||'لم تجتز حالة المغادرة شروط الإكمال');}
    finally{setCompletionBusy('');}
  };

  const finalizeExit=async()=>{
    if(!exitCase||exitReason.trim().length<10)return;
    if(!confirm('سيُنهي النظام العلاقة الوظيفية والعقود ويعطل حساب الموظف وجلساته. لا يُثبت هذا سداد المستحقات. هل تؤكد التنفيذ؟'))return;
    setExitBusy(true);
    try {
      await api.post('/hr/lifecycle/'+exitCase.id+'/finalize-exit',{
        confirmation:'FINALIZE_EMPLOYMENT_EXIT',
        lastWorkingDate:exitDate,
        reason:exitReason.trim(),
      });
      setExitCase(null);setExitReason('');load();
    }catch(e:any){alert(e.response?.data?.message||'تعذر إقفال المغادرة');}
    finally{setExitBusy(false);}
  };

  return <div className="space-y-6 animate-fade-in-up">
    <div className="flex justify-between gap-4">
      <div><h1 className="text-2xl font-bold text-white flex items-center gap-2"><ListChecks className="h-6 w-6 text-primary-400" /> الانضمام والمغادرة</h1><p className="text-slate-400 text-sm mt-1">حالات onboarding/offboarding مرتبطة بالموظف وبمهام قابلة للتتبع والإقفال.</p></div>
      <Button onClick={() => setOpen(true)}><Plus className="h-4 w-4" /> حالة جديدة</Button>
    </div>
    <div className="max-w-xs"><Select label="النوع" value={type} onChange={e => setType(e.target.value)} options={[{value:'',label:'الكل'},{value:'ONBOARDING',label:'انضمام'},{value:'OFFBOARDING',label:'مغادرة'}]} /></div>
    <div className="space-y-4">{cases.map(c => {
      const done=(c.tasks||[]).filter((t:any)=>['DONE','SKIPPED'].includes(t.status)).length;
      const total=(c.tasks||[]).length;
      return <div key={c.id} className="scc-card">
        <div className="flex justify-between gap-4 mb-4">
          <div><div className="font-bold text-white">{c.employee?.firstName} {c.employee?.lastName} · {c.type === 'ONBOARDING' ? 'انضمام' : 'مغادرة'}</div><div className="text-sm text-slate-500">{c.status} · {done}/{total} مكتمل</div></div>
          <div className="text-sm text-primary-400">{total ? Math.round(done/total*100) : 0}%</div>
        </div>
        <div className="space-y-2">{(c.tasks||[]).map((t:any)=><div key={t.id} className="flex items-center justify-between gap-3 border-t border-slate-800 pt-2">
          <div className="flex items-start gap-2">{t.status==='DONE'?<CheckCircle2 className="h-4 w-4 text-emerald-400 mt-0.5" />:<Circle className="h-4 w-4 text-slate-500 mt-0.5" />}<div><div className="text-white text-sm">{t.title}</div><div className="text-xs text-slate-500">{t.description}</div></div></div>
          {!['DONE','SKIPPED'].includes(t.status) && <div className="flex gap-1"><button onClick={()=>setTask(c.id,t.id,'DONE')} className="text-emerald-400 p-1" title="إكمال"><CheckCircle2 className="h-4 w-4" /></button>{c.type!=='OFFBOARDING'&&<button onClick={()=>setTask(c.id,t.id,'SKIPPED')}
                className="text-amber-400 p-1" title="تجاوز"><SkipForward className="h-4 w-4" /></button>}</div>}
        </div>)}</div>
        {c.type==='OFFBOARDING'&&!['COMPLETED','CANCELLED'].includes(c.status)&&
          ['ADMIN','SUPER_ADMIN'].includes(getRole()||'')&&
          <div className="mt-4 flex items-center justify-between gap-3 border-t border-slate-700 pt-3">
            <span className="text-xs text-amber-300">يتطلب إقفال المغادرة إنجاز جميع المهام واسترداد العهد؛ صرف المستحقات مسار منفصل.</span>
            {c.employee?.status==='TERMINATED'
              ? <Button size="sm" isLoading={completionBusy===c.id}
                  disabled={!(c.tasks||[]).length||(c.tasks||[]).some((t:any)=>t.status!=='DONE')}
                  onClick={()=>completeExistingExit(c.id)}>إكمال الإخلاء بعد التحقق</Button>
              : <Button size="sm" disabled={!(c.tasks||[]).length||(c.tasks||[]).some((t:any)=>t.status!=='DONE')}
                  onClick={()=>{setExitCase(c);setExitReason('');}}>
                  إقفال المغادرة وإلغاء الوصول
                </Button>}
          </div>}
      </div>;
    })}</div>

    <Modal isOpen={!!exitCase} onClose={()=>setExitCase(null)} title="تأكيد إقفال مغادرة موظف" size="lg">
      <div className="space-y-4">
        <div className="rounded-lg border border-amber-500/40 p-3 text-sm text-amber-200">
          إجراء إداري حساس: إنهاء علاقة العمل والعقود وتعطيل حساب الموظف وإلغاء جلساته.
          لن يتم تسجيل دفع المستحقات المالية تلقائيًا.
        </div>
        <Input label="آخر يوم عمل (لا يكون في المستقبل)" type="date" value={exitDate}
          onChange={e=>setExitDate(e.target.value)}/>
        <Input label="سبب إنهاء العلاقة موثقًا" required maxLength={1000}
          value={exitReason} onChange={e=>setExitReason(e.target.value)}/>
        <div className="flex justify-end gap-3">
          <Button variant="ghost" onClick={()=>setExitCase(null)}>إلغاء</Button>
          <Button isLoading={exitBusy} disabled={exitReason.trim().length<10||!exitDate}
            onClick={finalizeExit}>اعتماد الإقفال الإداري</Button>
        </div>
      </div>
    </Modal>

    <Modal isOpen={open} onClose={()=>setOpen(false)} title="إنشاء حالة دورة موظف" size="lg">
      <div className="space-y-4">
        <Select label="الموظف" options={employeesOptions} value={form.employeeId||''} onChange={e=>setForm({...form,employeeId:e.target.value})} />
        <Select label="النوع" options={[{value:'ONBOARDING',label:'انضمام'},{value:'OFFBOARDING',label:'مغادرة'}]} value={form.type} onChange={e=>setForm({...form,type:e.target.value})} />
        <Input label="التاريخ المستهدف" type="date" value={form.targetDate||''} onChange={e=>setForm({...form,targetDate:e.target.value})} />
        <Input label="ملاحظات" value={form.notes||''} onChange={e=>setForm({...form,notes:e.target.value})} />
        <div className="flex justify-end"><Button disabled={!form.employeeId} onClick={createCase}>إنشاء بالقائمة الافتراضية</Button></div>
      </div>
    </Modal>
  </div>;
}
