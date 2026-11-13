'use client';

import { useEffect, useMemo, useState } from 'react';
import api from '@/lib/api';
import { CalendarCheck2, Eye, Lock, RotateCcw } from 'lucide-react';
import Select from '@/components/ui/Select';
import Button from '@/components/ui/Button';

export default function YearEndClosingPage() {
  const [periods,setPeriods]=useState<any[]>([]);
  const [equity,setEquity]=useState<any[]>([]);
  const [history,setHistory]=useState<any[]>([]);
  const [year,setYear]=useState('');
  const [accountId,setAccountId]=useState('');
  const [preview,setPreview]=useState<any>(null);
  const [loading,setLoading]=useState(true);
  const [working,setWorking]=useState(false);

  const years=useMemo(
    ()=>[...new Set(periods.map((p:any)=>String(p.year)))].sort((a,b)=>Number(b)-Number(a)),
    [periods],
  );

  const load=async()=>{
    setLoading(true);
    try{
      const [p,a,h]=await Promise.all([
        api.get('/finance/financial-periods'),
        api.get('/finance/chart-of-accounts'),
        api.get('/finance/year-end-closing'),
      ]);
      const ps=p.data?.data||[];
      const es=(a.data?.data||[]).filter((x:any)=>x.type==='EQUITY'&&x.isActive!==false);
      setPeriods(ps);setEquity(es);setHistory(h.data||[]);
      if(!year&&ps.length)setYear(String([...ps].sort((x:any,y:any)=>y.year-x.year)[0].year));
      if(!accountId&&es.length)setAccountId(es[0].id);
    }catch(err:any){alert(err.response?.data?.message||'تعذر تحميل بيانات الإقفال')}
    finally{setLoading(false)}
  };

  useEffect(()=>{load()},[]);

  const doPreview=async()=>{
    if(!year||!accountId)return;
    setWorking(true);
    try{
      const r=await api.get('/finance/year-end-closing/preview',{params:{year,retainedEarningsAccountId:accountId}});
      setPreview(r.data);
    }catch(err:any){alert(err.response?.data?.message||'تعذر معاينة الإقفال')}
    finally{setWorking(false)}
  };

  const closeYear=async()=>{
    if(!year||!accountId)return;
    if(!confirm(`إقفال السنة المالية ${year}؟ سيتم إنشاء قيد إقفال وإغلاق الفترة الأخيرة.`))return;
    setWorking(true);
    try{
      await api.post('/finance/year-end-closing',{year:Number(year),retainedEarningsAccountId:accountId});
      setPreview(null);await load();await doPreview();
    }catch(err:any){alert(err.response?.data?.message||'تعذر إقفال السنة')}
    finally{setWorking(false)}
  };

  const reverseYear=async()=>{
    if(!year)return;
    if(!confirm(`عكس إقفال السنة ${year}؟ سيُنشأ قيد عكسي وتُفتح الفترة الأخيرة.`))return;
    setWorking(true);
    try{
      await api.post(`/finance/year-end-closing/${year}/reverse`);
      setPreview(null);await load();
    }catch(err:any){alert(err.response?.data?.message||'تعذر عكس الإقفال')}
    finally{setWorking(false)}
  };

  const latest=history.find((x:any)=>String(x.year)===year);

  return <div className="space-y-6 animate-fade-in-up">
    <div>
      <h1 className="text-2xl font-bold text-white flex items-center gap-2"><CalendarCheck2 className="h-6 w-6 text-primary-400"/>الإقفال السنوي</h1>
      <p className="text-slate-400 text-sm mt-1">تصفير الإيرادات والمصروفات وترحيل صافي الربح أو الخسارة إلى الأرباح المبقاة مع سجل عكس تدقيقي</p>
    </div>

    <div className="bg-slate-900 rounded-xl border border-slate-800 p-5">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
        <Select label="السنة المالية" options={years.map(y=>({value:y,label:y}))} value={year} onChange={e=>{setYear(e.target.value);setPreview(null)}}/>
        <Select label="حساب الأرباح المبقاة" options={equity.map((a:any)=>({value:a.id,label:`${a.code} — ${a.name}`}))} value={accountId} onChange={e=>{setAccountId(e.target.value);setPreview(null)}}/>
        <Button onClick={doPreview} isLoading={working||loading}><Eye className="h-4 w-4"/>معاينة الإقفال</Button>
      </div>
    </div>

    {latest&&<div className="bg-slate-900 rounded-xl border border-slate-800 p-5 flex flex-wrap items-center justify-between gap-4">
      <div>
        <p className="text-slate-400 text-sm">آخر سجل للسنة {year}</p>
        <p className={`font-bold mt-1 ${latest.status==='CLOSED'?'text-emerald-400':'text-amber-400'}`}>{latest.status==='CLOSED'?'مغلقة':'تم عكس الإقفال'} — النسخة {latest.version}</p>
        <p className="text-slate-500 text-xs mt-1">صافي الربح/الخسارة: {Number(latest.netIncome).toLocaleString()}</p>
      </div>
      {latest.status==='CLOSED'&&<Button variant="ghost" onClick={reverseYear} isLoading={working}><RotateCcw className="h-4 w-4"/>عكس الإقفال</Button>}
    </div>}

    {preview&&<div className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="scc-card"><p className="text-slate-500 text-xs">الإيرادات</p><p className="text-xl font-bold text-emerald-400 mt-2">{Number(preview.revenue).toLocaleString()}</p></div>
        <div className="scc-card"><p className="text-slate-500 text-xs">المصروفات</p><p className="text-xl font-bold text-red-400 mt-2">{Number(preview.expenses).toLocaleString()}</p></div>
        <div className="scc-card"><p className="text-slate-500 text-xs">صافي الربح / الخسارة</p><p className={`text-xl font-bold mt-2 ${Number(preview.netIncome)>=0?'text-emerald-400':'text-red-400'}`}>{Number(preview.netIncome).toLocaleString()}</p></div>
      </div>

      <div className="bg-slate-900 rounded-xl border border-slate-800 overflow-hidden">
        <div className="p-4 border-b border-slate-800"><h2 className="font-bold text-white">خطوط الإقفال المقترحة</h2></div>
        <table className="w-full text-sm">
          <thead><tr className="bg-slate-800/50 text-slate-400"><th className="p-3 text-right">الحساب</th><th className="p-3 text-right">النوع</th><th className="p-3 text-left">مدين</th><th className="p-3 text-left">دائن</th></tr></thead>
          <tbody>{preview.closingLines.map((line:any)=><tr key={line.accountId} className="border-t border-slate-800/60"><td className="p-3 text-white">{line.accountCode} — {line.accountName}</td><td className="p-3 text-slate-400">{line.accountType}</td><td className="p-3 text-left">{Number(line.debitAmount||0).toLocaleString()}</td><td className="p-3 text-left">{Number(line.creditAmount||0).toLocaleString()}</td></tr>)}</tbody>
        </table>
      </div>

      {(!latest||latest.status==='REVERSED')&&<div className="flex justify-end"><Button onClick={closeYear} isLoading={working}><Lock className="h-4 w-4"/>تنفيذ الإقفال السنوي</Button></div>}
    </div>}
  </div>;
}
