'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { getRole } from '@/lib/auth';
import api from '@/lib/api';
import { Download, FileText, RefreshCw, Send, UserCircle2, WalletCards } from 'lucide-react';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import Select from '@/components/ui/Select';

const requestTypes = [
  { value: 'EMPLOYMENT_CERTIFICATE', label: 'شهادة تعريف بالعمل' },
  { value: 'SALARY_CERTIFICATE', label: 'تعريف بالراتب' },
  { value: 'LETTER', label: 'خطاب موارد بشرية' },
  { value: 'DATA_CORRECTION', label: 'تصحيح بيانات' },
  { value: 'BENEFIT_INQUIRY', label: 'استفسار عن استحقاق' },
  { value: 'OTHER', label: 'طلب آخر' },
];

export default function HrSelfServicePage() {
  const [data, setData] = useState<any>(null);
  const [payroll, setPayroll] = useState<any[]>([]);
  const [loans, setLoans] = useState<any[]>([]);
  const [error, setError] = useState('');
  const [sectionWarnings, setSectionWarnings] = useState<string[]>([]);
  const [documents, setDocuments] = useState<any[]>([]);
  const [requests, setRequests] = useState<any[]>([]);
  const [custody, setCustody] = useState<any[]>([]);
  const [performance, setPerformance] = useState<any[]>([]);
  const [governanceCases, setGovernanceCases] = useState<any[]>([]);
  const [caseReplies, setCaseReplies] = useState<Record<string,string>>({});
  const [caseBusy, setCaseBusy] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [unlinked, setUnlinked] = useState(false);
  const [form, setForm] = useState<any>({ type: 'EMPLOYMENT_CERTIFICATE', subject: '' });
  const [profile, setProfile] = useState<any>({});
  const [busy, setBusy] = useState(false);

  const load = async () => {
    setLoading(true);
    setUnlinked(false);
    setError('');
    setSectionWarnings([]);
    try {
      // Only an explicit 404 from identity resolution means the account is unlinked.
      const me = await api.get('/hr/self/me');
      setData(me.data);
      setLoans(me.data.loans || []);
      setProfile({
        phone: me.data.employee?.phone || '',
        emergencyContactName: me.data.employee?.emergencyContactName || '',
        emergencyContactPhone: me.data.employee?.emergencyContactPhone || '',
      });

      const results = await Promise.allSettled([
        api.get('/hr/self/payroll?limit=12'),
        api.get('/hr/self/documents'),
        api.get('/hr/self/requests'),
        api.get('/hr/self/assets'),
        api.get('/hr/self/performance'),
        api.get('/hr/self/governance'),
      ]);
      const names = ['الرواتب', 'المستندات', 'الطلبات', 'العهد', 'تقييمات الأداء', 'الردود والتظلمات'];
      const setters = [setPayroll, setDocuments, setRequests, setCustody, setPerformance, setGovernanceCases];
      const warnings: string[] = [];
      results.forEach((result, index) => {
        if (result.status === 'fulfilled') setters[index](result.value.data || []);
        else {
          setters[index]([]);
          warnings.push(names[index]);
        }
      });
      setSectionWarnings(warnings);
    } catch (err: any) {
      setData(null);
      if (err?.response?.status === 404) {
        setUnlinked(true);
      } else if (err?.response?.status === 403) {
        setError('ليس لديك تصريح للوصول إلى ملف الموظف.');
      } else if (err?.response?.status === 401) {
        setError('انتهت صلاحية الجلسة. يرجى تسجيل الدخول مجددًا.');
      } else {
        const status = err?.response?.status;
        setError(status ? `تعذر تحميل ملف الموظف (HTTP ${status}).` : 'تعذر الاتصال بخدمة الموظف. تحقق من الاتصال ثم أعد المحاولة.');
      }
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => { load(); }, []);

  const saveProfile = async () => {
    setBusy(true);
    try {
      await api.patch('/hr/self/profile', profile);
      await load();
    } catch (err: any) { alert(err?.response?.data?.message || 'تعذر تحديث البيانات'); }
    finally { setBusy(false); }
  };

  const submitRequest = async () => {
    if (!form.subject?.trim()) return;
    setBusy(true);
    try {
      await api.post('/hr/self/requests', { type: form.type, subject: form.subject, details: { note: form.note || '' } });
      setForm({ type: 'EMPLOYMENT_CERTIFICATE', subject: '', note: '' });
      await load();
    } catch (err: any) { alert(err?.response?.data?.message || 'تعذر إرسال الطلب'); }
    finally { setBusy(false); }
  };

  const cancelRequest = async (id: string) => {
    if (!confirm('إلغاء الطلب المعلق؟')) return;
    await api.post(`/hr/self/requests/${id}/cancel`, {});
    await load();
  };

  const acknowledgePerformance = async (id: string) => {
    const employeeComments = prompt('تعليق الموظف على التقييم (اختياري):', '') ?? null;
    if (employeeComments === null) return;
    setBusy(true);
    try {
      await api.post(`/hr/self/performance/${id}/acknowledge`, { employeeComments: employeeComments || undefined });
      await load();
    } catch (err: any) {
      alert(err?.response?.data?.message || 'تعذر إقرار التقييم');
    } finally {
      setBusy(false);
    }
  };

  const formatCaseNarrative = (details: string) => {
    try { const parsed=JSON.parse(details); return String(parsed?.narrative||details); }
    catch { return details; }
  };

  const sendCaseResponse = async (caseId:string, code:'EMPLOYEE_RESPONSE'|'APPEAL_SUBMITTED') => {
    const narrative=(caseReplies[caseId]||'').trim();
    if(narrative.length<10)return;
    setCaseBusy(caseId);
    try {
      await api.post('/hr/self/governance/'+caseId+'/actions',{code,narrative});
      setCaseReplies(prev=>({...prev,[caseId]:''}));
      await load();
    }catch(e:any){alert(e.response?.data?.message||'تعذر حفظ الرد أو التظلم');}
    finally{setCaseBusy('');}
  };

  const download = async (item: any) => {
    const res = await api.get(`/hr/self/documents/${item.id}/download`, { responseType: 'blob' });
    const url = URL.createObjectURL(res.data);
    const a = document.createElement('a');
    a.href = url; a.download = item.fileName; a.click(); URL.revokeObjectURL(url);
  };

  if (loading) return <div className="scc-card py-16 text-center text-slate-400">جاري تحميل ملف الموظف...</div>;
  if (unlinked) return (
    <div className="scc-card py-16 text-center">
      <UserCircle2 className="h-12 w-12 text-amber-400 mx-auto mb-3" />
      <h1 className="text-xl font-bold text-white">الحساب غير مربوط بملف موظف</h1>
      <p className="text-slate-400 mt-2">يجب على مسؤول الموارد البشرية ربط مستخدمك بملف الموظف أولًا.</p>
      <div className="mt-5 flex flex-wrap justify-center gap-3">
        <Button onClick={load}><RefreshCw className="h-4 w-4" /> إعادة المحاولة</Button>
        {['ADMIN', 'SUPER_ADMIN', 'MANAGER'].includes(getRole() || '') && (
          <Link href="/dashboard/hr/employees" className="rounded-lg border border-slate-600 px-4 py-2 text-sm text-slate-200 hover:bg-slate-800">إدارة وربط حسابات الموظفين</Link>
        )}
      </div>
    </div>
  );

  if (error || !data) return (
    <div role="alert" className="scc-card py-14 text-center space-y-4">
      <p className="text-amber-400">{error || 'بيانات الموظف غير متاحة.'}</p>
      <Button onClick={load}><RefreshCw className="h-4 w-4" /> إعادة المحاولة</Button>
    </div>
  );

  const employee = data.employee;
  return (
    <div className="space-y-6 animate-fade-in-up">
      <div>
        <h1 className="text-2xl font-bold text-white flex items-center gap-2"><UserCircle2 className="h-6 w-6 text-primary-400" /> الخدمة الذاتية للموظف</h1>
        <p className="text-slate-400 text-sm mt-1">{employee.firstName} {employee.lastName} · {employee.employeeCode} · {employee.jobTitle || '—'}</p>
      </div>

      {sectionWarnings.length > 0 && (
        <div role="status" className="rounded-xl border border-amber-500/40 bg-amber-500/10 p-4 text-amber-200 text-sm">
          تعذر تحميل الأقسام التالية: {sectionWarnings.join('، ')}. بقية بياناتك متاحة. <button className="underline mr-2" onClick={load}>إعادة التحميل</button>
        </div>
      )}

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
        <div className="scc-card space-y-4">
          <h2 className="font-bold text-white">بيانات الاتصال والطوارئ</h2>
          <Input label="الهاتف" value={profile.phone || ''} onChange={e => setProfile({ ...profile, phone: e.target.value })} />
          <Input label="جهة اتصال الطوارئ" value={profile.emergencyContactName || ''} onChange={e => setProfile({ ...profile, emergencyContactName: e.target.value })} />
          <Input label="هاتف الطوارئ" value={profile.emergencyContactPhone || ''} onChange={e => setProfile({ ...profile, emergencyContactPhone: e.target.value })} />
          <Button isLoading={busy} onClick={saveProfile}>حفظ البيانات المسموح بها</Button>
        </div>

        <div className="scc-card">
          <h2 className="font-bold text-white mb-4">العقد والاستحقاقات</h2>
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div><span className="text-slate-500 block">الحالة</span><span className="text-white">{employee.status}</span></div>
            <div><span className="text-slate-500 block">تاريخ التعيين</span><span className="text-white">{employee.hireDate ? new Date(employee.hireDate).toLocaleDateString('ar-SA') : '—'}</span></div>
            <div><span className="text-slate-500 block">العقد الفعال</span><span className="text-white">{data?.contract?.contractNumber || '—'}</span></div>
            <div><span className="text-slate-500 block">نهاية العقد</span><span className="text-white">{data?.contract?.endDate ? new Date(data.contract.endDate).toLocaleDateString('ar-SA') : '—'}</span></div>
          </div>
          <div className="mt-4 space-y-2">
            {(data?.leaveBalances || []).map((b: any) => (
              <div key={b.id} className="flex justify-between text-sm border-t border-slate-800 pt-2">
                <span className="text-slate-400">{b.type}</span>
                <span className="text-white">{Number(b.entitlement) + Number(b.carriedForward) + Number(b.adjustment) - Number(b.used) - Number(b.pending)} يوم متاح</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <section className="scc-card space-y-4">
        <h2 className="font-bold text-white">البلاغات المعلنة لك والردود والتظلمات</h2>
        <p className="text-sm text-slate-400">تُعرض فقط القضايا التي تتعلق بملفك الوظيفي وكُشف لك عنها رسميًا داخل مكين. الرد لا يعني إقرارًا بصحة الاتهام أو الموافقة على خصم.</p>
        {governanceCases.length===0?<p className="text-slate-500 text-sm">لا توجد قضايا معلنة لملفك.</p>:governanceCases.map((c:any)=>{
          const review=c.events?.some((e:any)=>e.action==='FINAL_REVIEW');
          const latestAppeal=(c.events||[]).map((e:any)=>e.action);
          const hasAppeal=latestAppeal.lastIndexOf('APPEAL_SUBMITTED')>latestAppeal.lastIndexOf('APPEAL_REVIEWED');
          const canReply=c.status==='IN_REVIEW';
          const canAppeal=c.category==='DISCIPLINE'&&review&&!hasAppeal&&['IN_REVIEW','RESOLVED'].includes(c.status);
          return <article key={c.id} className="rounded-lg border border-slate-700 p-4 space-y-3">
            <h3 className="font-semibold text-white">{c.title}</h3>
            <p className="text-sm text-slate-400">{c.category==='DISCIPLINE'?'إجراء وظيفي':'مطالبة'} · {c.status}</p>
            <div className="space-y-1">
              {(c.events||[]).map((e:any)=><div key={e.id} className="text-xs text-slate-300 border-t border-slate-800 pt-2">
                <span className="text-primary-300">{e.action}: </span>{formatCaseNarrative(e.details)}
              </div>)}
            </div>
            {(canReply||canAppeal)&&<>
              <label className="block text-sm text-slate-300">إفادتك أو اعتراضك
                <textarea rows={3} maxLength={4000} value={caseReplies[c.id]||''}
                  onChange={e=>setCaseReplies(prev=>({...prev,[c.id]:e.target.value}))}
                  className="w-full rounded-lg border border-slate-700 bg-slate-900 p-2 text-white"/>
              </label>
              <div className="flex flex-wrap gap-2">
                {canReply&&<Button isLoading={caseBusy===c.id} disabled={caseBusy!==''||(caseReplies[c.id]||'').trim().length<10}
                  onClick={()=>sendCaseResponse(c.id,'EMPLOYEE_RESPONSE')}>تقديم الإفادة</Button>}
                {canAppeal&&<Button isLoading={caseBusy===c.id} disabled={caseBusy!==''||(caseReplies[c.id]||'').trim().length<10}
                  onClick={()=>sendCaseResponse(c.id,'APPEAL_SUBMITTED')}>تقديم تظلم</Button>}
              </div>
            </>}
          </article>;
        })}
      </section>

      <div className="scc-card">
        <h2 className="font-bold text-white flex items-center gap-2 mb-4"><WalletCards className="h-5 w-5 text-primary-400" /> آخر الرواتب</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead><tr className="text-slate-500 border-b border-slate-800"><th className="text-right py-2">الفترة</th><th className="text-right">الإجمالي</th><th className="text-right">خصم القرض</th><th className="text-right">الصافي</th><th className="text-right">الحالة</th></tr></thead>
            <tbody>{payroll.map(row => <tr key={row.id} className="border-b border-slate-800/60"><td className="py-3 text-white">{row.year}/{String(row.month).padStart(2,'0')}</td><td>{Number(row.grossSalary).toLocaleString('ar-SA')}</td><td>{Number(row.loanDeductions || 0).toLocaleString('ar-SA')}</td><td className="text-emerald-400">{Number(row.netSalary).toLocaleString('ar-SA')}</td><td>{row.status}</td></tr>)}</tbody>
          </table>
        </div>
      </div>

      <div className="scc-card">
        <h2 className="font-bold text-white flex items-center gap-2 mb-4"><WalletCards className="h-5 w-5 text-primary-400" /> السلف والقروض المسجلة</h2>
        {loans.length === 0 ? <p className="text-slate-500 text-sm">لا توجد سلف أو قروض مسجلة.</p> : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr className="border-b border-slate-800 text-slate-400"><th className="text-right py-2">النوع</th><th className="text-right">الأصل</th><th className="text-right">القسط</th><th className="text-right">المتبقي</th><th className="text-right">الحالة</th></tr></thead>
              <tbody>{loans.map((loan: any) => <tr key={loan.id} className="border-b border-slate-800/60">
                <td className="py-3">{loan.type}</td><td>{Number(loan.principal).toLocaleString('ar-SA')}</td>
                <td>{Number(loan.installmentAmount).toLocaleString('ar-SA')}</td>
                <td>{Number(loan.balance).toLocaleString('ar-SA')}</td><td>{loan.status}</td>
              </tr>)}</tbody>
            </table>
          </div>
        )}
      </div>

      <div className="scc-card">
        <h2 className="font-bold text-white flex items-center gap-2 mb-4">تقييمات الأداء</h2>
        <div className="space-y-3">
          {performance.length === 0 ? <p className="text-slate-500 text-sm">لا توجد تقييمات أداء.</p> : performance.map((review: any) => (
            <div key={review.id} className="rounded-lg border border-slate-800 p-3 flex flex-wrap justify-between gap-3">
              <div>
                <div className="text-white font-medium">
                  {new Date(review.periodStart).toLocaleDateString('ar-SA')} — {new Date(review.periodEnd).toLocaleDateString('ar-SA')}
                </div>
                <div className="text-xs text-slate-500 mt-1">الحالة: {review.status} · النتيجة: {review.overallScore ?? '—'} / 5</div>
                {review.summary && <div className="text-sm text-slate-300 mt-2">{review.summary}</div>}
                {review.employeeComments && <div className="text-xs text-slate-400 mt-2">تعليقك: {review.employeeComments}</div>}
              </div>
              {review.status === 'SUBMITTED' && (
                <Button size="sm" isLoading={busy} onClick={() => acknowledgePerformance(review.id)}>إقرار التقييم</Button>
              )}
            </div>
          ))}
        </div>
      </div>

      <div className="scc-card">
        <h2 className="font-bold text-white flex items-center gap-2 mb-4"><FileText className="h-5 w-5 text-primary-400" /> عهدي وأصولي</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {custody.length === 0 ? <p className="text-slate-500 text-sm">لا توجد عهد مسجلة.</p> : custody.map((item:any) => (
            <div key={item.id} className="rounded-lg border border-slate-800 p-3">
              <div className="text-white font-medium">{item.asset?.name}</div>
              <div className="text-xs text-slate-500 mt-1">{item.asset?.category?.name || '—'} · {item.status}</div>
              <div className="text-xs text-slate-400 mt-1">تاريخ التسليم: {new Date(item.assignedAt).toLocaleDateString('ar-SA')}</div>
              {item.expectedReturnAt && <div className="text-xs text-slate-400">الاسترداد المتوقع: {new Date(item.expectedReturnAt).toLocaleDateString('ar-SA')}</div>}
            </div>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
        <div className="scc-card">
          <h2 className="font-bold text-white flex items-center gap-2 mb-4"><FileText className="h-5 w-5 text-primary-400" /> مستنداتي</h2>
          <div className="space-y-2">
            {documents.length === 0 ? <p className="text-slate-500 text-sm">لا توجد مستندات.</p> : documents.map(d => (
              <div key={d.id} className="flex justify-between items-center gap-3 border-b border-slate-800 py-2">
                <div className="min-w-0"><div className="text-white truncate">{d.title}</div><div className="text-xs text-slate-500">{d.fileName}</div></div>
                <button onClick={() => download(d)} className="text-primary-400 p-2"><Download className="h-4 w-4" /></button>
              </div>
            ))}
          </div>
        </div>

        <div className="scc-card space-y-3">
          <h2 className="font-bold text-white flex items-center gap-2"><Send className="h-5 w-5 text-primary-400" /> طلب جديد للموارد البشرية</h2>
          <Select label="نوع الطلب" options={requestTypes} value={form.type} onChange={e => setForm({ ...form, type: e.target.value })} />
          <Input label="عنوان الطلب" value={form.subject || ''} onChange={e => setForm({ ...form, subject: e.target.value })} />
          <Input label="التفاصيل" value={form.note || ''} onChange={e => setForm({ ...form, note: e.target.value })} />
          <Button isLoading={busy} onClick={submitRequest}><Send className="h-4 w-4" /> إرسال الطلب</Button>
          <div className="pt-3 space-y-2">
            {requests.map(r => <div key={r.id} className="border-t border-slate-800 pt-2 flex justify-between gap-3">
              <div><div className="text-white text-sm">{r.subject}</div><div className="text-xs text-slate-500">{r.type} · {r.status}{r.resolution ? ` · ${r.resolution}` : ''}</div></div>
              {r.status === 'PENDING' && <button onClick={() => cancelRequest(r.id)} className="text-xs text-red-400">إلغاء</button>}
            </div>)}
          </div>
        </div>
      </div>
    </div>
  );
}
