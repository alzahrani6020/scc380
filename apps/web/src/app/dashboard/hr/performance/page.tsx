'use client';
import {useEffect,useMemo,useState} from 'react';
import api from '@/lib/api';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import Modal from '@/components/ui/Modal';
import Select from '@/components/ui/Select';

export default function PerformancePage(){
 const [cycles,setCycles]=useState<any[]>([]),[reviews,setReviews]=useState<any[]>([]),[employees,setEmployees]=useState<any[]>([]);
 const [cycleOpen,setCycleOpen]=useState(false),[reviewOpen,setReviewOpen]=useState(false);
 const [cycle,setCycle]=useState<any>({}),[review,setReview]=useState<any>({});
 const load=()=>Promise.all([api.get('/hr/performance/cycles').then(r=>setCycles(r.data.data||[])),api.get('/hr/performance/reviews').then(r=>setReviews(r.data.data||[])),api.get('/hr/employees?limit=200').then(r=>setEmployees(r.data.data||[]))]).catch(console.error);
 useEffect(()=>{load();},[]);
 const cycleOptions=cycles.filter(c=>c.status!=='CLOSED').map(c=>({value:c.id,label:c.name+' · '+c.status}));
 const empOptions=employees.filter(e=>e.status==='ACTIVE').map(e=>({value:e.id,label:`${e.firstName} ${e.lastName} · ${e.employeeCode}`}));
 const createCycle=async()=>{await api.post('/hr/performance/cycles',cycle);setCycleOpen(false);setCycle({});load();};
 const createReview=async()=>{await api.post('/hr/performance/reviews',review);setReviewOpen(false);setReview({});load();};
 const addGoal=async(r:any)=>{const title=prompt('اسم الهدف');if(!title)return;const weight=Number(prompt('الوزن %'));if(!weight)return;const target=prompt('المستهدف')||undefined;await api.post(`/hr/performance/reviews/${r.id}/goals`,{title,weight,target});load();};
 const rateGoal=async(r:any,g:any)=>{const rating=Number(prompt('التقييم 0-5',String(g.rating??'')));if(!Number.isFinite(rating))return;const result=prompt('النتيجة المحققة',g.result||'')||undefined;await api.patch(`/hr/performance/reviews/${r.id}/goals/${g.id}`,{rating,result,status:'COMPLETED'});load();};
 const submit=async(r:any)=>{const managerSummary=prompt('ملخص المدير')||undefined;await api.post(`/hr/performance/reviews/${r.id}/submit`,{managerSummary});load();};
 return <div className="space-y-6"><div className="flex justify-between"><div><h1 className="text-2xl font-bold text-white">إدارة الأداء</h1><p className="text-slate-400 text-sm">دورة → مراجعة → أهداف موزونة 100% → تقييم → إقرار الموظف.</p></div><div className="flex gap-2"><Button variant="ghost" onClick={()=>setCycleOpen(true)}>دورة جديدة</Button><Button onClick={()=>setReviewOpen(true)}>مراجعة جديدة</Button></div></div>
 <div className="scc-card"><h2 className="font-bold text-white mb-3">الدورات</h2>{cycles.map(c=><div key={c.id} className="flex justify-between border-b border-slate-800 py-2"><div><div className="text-white">{c.name}</div><div className="text-xs text-slate-500">{c.status} · {new Date(c.startDate).toLocaleDateString('ar-SA')} - {new Date(c.endDate).toLocaleDateString('ar-SA')}</div></div><div className="flex gap-2">{c.status==='DRAFT'&&<Button size="sm" onClick={async()=>{await api.post(`/hr/performance/cycles/${c.id}/status`,{status:'ACTIVE'});load();}}>تفعيل</Button>}{c.status==='ACTIVE'&&<Button size="sm" variant="ghost" onClick={async()=>{await api.post(`/hr/performance/cycles/${c.id}/status`,{status:'CLOSED'});load();}}>إغلاق</Button>}</div></div>)}</div>
 <div className="space-y-4">{reviews.map(r=><div key={r.id} className="scc-card"><div className="flex justify-between"><div><div className="text-white font-bold">{r.employee?.firstName} {r.employee?.lastName}</div><div className="text-xs text-slate-500">{r.cycle?.name} · {r.status} · {r.overallRating!=null?Number(r.overallRating).toFixed(2)+'/5':'غير محسوب'}</div></div>{r.status==='DRAFT'&&<div className="flex gap-2"><Button size="sm" variant="ghost" onClick={()=>addGoal(r)}>هدف</Button><Button size="sm" onClick={()=>submit(r)}>إرسال</Button></div>}</div><div className="mt-3 space-y-2">{(r.goals||[]).map((g:any)=><div key={g.id} className="flex justify-between border-t border-slate-800 pt-2"><div><div className="text-sm text-white">{g.title} · {Number(g.weight)}%</div><div className="text-xs text-slate-500">{g.target||'—'} · {g.rating!=null?Number(g.rating).toFixed(1)+'/5':'دون تقييم'}</div></div>{r.status==='DRAFT'&&<Button size="sm" variant="ghost" onClick={()=>rateGoal(r,g)}>تقييم</Button>}</div>)}</div></div>)}</div>
 <Modal isOpen={cycleOpen} onClose={()=>setCycleOpen(false)} title="دورة أداء" size="lg"><div className="space-y-3"><Input label="الاسم" value={cycle.name||''} onChange={e=>setCycle({...cycle,name:e.target.value})}/><Input label="البداية" type="date" value={cycle.startDate||''} onChange={e=>setCycle({...cycle,startDate:e.target.value})}/><Input label="النهاية" type="date" value={cycle.endDate||''} onChange={e=>setCycle({...cycle,endDate:e.target.value})}/><div className="flex justify-end"><Button disabled={!cycle.name||!cycle.startDate||!cycle.endDate} onClick={createCycle}>حفظ</Button></div></div></Modal>
 <Modal isOpen={reviewOpen} onClose={()=>setReviewOpen(false)} title="مراجعة أداء" size="lg"><div className="space-y-3"><Select label="الدورة" options={cycleOptions} value={review.cycleId||''} onChange={e=>setReview({...review,cycleId:e.target.value})}/><Select label="الموظف" options={empOptions} value={review.employeeId||''} onChange={e=>setReview({...review,employeeId:e.target.value})}/><div className="flex justify-end"><Button disabled={!review.cycleId||!review.employeeId} onClick={createReview}>إنشاء</Button></div></div></Modal>
 </div>;
}
