'use client';

import { useEffect, useMemo, useState } from 'react';
import api from '@/lib/api';
import { Landmark, Plus, RefreshCw, CheckCircle2, RotateCcw, X } from 'lucide-react';
import Modal from '@/components/ui/Modal';
import Input from '@/components/ui/Input';
import Select from '@/components/ui/Select';
import Button from '@/components/ui/Button';

export default function BankReconciliationPage() {
  const [banks,setBanks]=useState<any[]>([]);
  const [items,setItems]=useState<any[]>([]);
  const [selectedId,setSelectedId]=useState('');
  const [selected,setSelected]=useState<any>(null);
  const [loading,setLoading]=useState(true);
  const [open,setOpen]=useState(false);
  const [lineOpen,setLineOpen]=useState(false);
  const [matchOpen,setMatchOpen]=useState(false);
  const [matchLine,setMatchLine]=useState<any>(null);
  const [candidates,setCandidates]=useState<any[]>([]);
  const [saving,setSaving]=useState(false);
  const [form,setForm]=useState<any>({});
  const [line,setLine]=useState<any>({});
  const params=useMemo(()=>new URLSearchParams(typeof window==='undefined'?'':window.location.search),[]);
  const requestedBank=params.get('bankAccountId')||'';

  const load=async()=>{
    const [b,r]=await Promise.all([
      api.get('/finance/bank-accounts'),
      api.get('/finance/bank-reconciliations', { params: requestedBank ? { bankAccountId: requestedBank } : {} }),
    ]);
    setBanks(b.data?.data||[]);
    setItems(r.data?.data||[]);
    setLoading(false);
  };

  const loadOne=async(id:string)=>{
    setSelectedId(id);
    const r=await api.get(`/finance/bank-reconciliations/${id}`);
    setSelected(r.data);
  };

  useEffect(()=>{load().catch(err=>alert(err.response?.data?.message||'تعذر تحميل التسويات'))},[]);
  useEffect(()=>{if(!selectedId&&items[0])loadOne(items[0].id).catch(console.error)},[items]);

  const create=()=>{
    const bankId=requestedBank||banks[0]?.id||'';
    setForm({bankAccountId:bankId,openingBalance:0,endingBalance:0,startDate:'',endDate:''});
    setOpen(true);
  };

  const submit=async(e:React.FormEvent)=>{
    e.preventDefault();setSaving(true);
    try{
      const r=await api.post('/finance/bank-reconciliations',{
        ...form,openingBalance:Number(form.openingBalance),endingBalance:Number(form.endingBalance)
      });
      setOpen(false);await load();await loadOne(r.data.id);
    }catch(err:any){alert(err.response?.data?.message||'تعذر إنشاء التسوية')}
    finally{setSaving(false)}
  };

  const addLine=async(e:React.FormEvent)=>{
    e.preventDefault();if(!selected)return;setSaving(true);
    try{
      await api.post(`/finance/bank-reconciliations/${selected.id}/lines`,{lines:[{...line,amount:Number(line.amount)}]});
      setLineOpen(false);setLine({});await loadOne(selected.id);
    }catch(err:any){alert(err.response?.data?.message||'تعذر إضافة سطر الكشف')}
    finally{setSaving(false)}
  };

  const openMatch=async(statementLine:any)=>{
    if(!selected)return;
    try{
      const r=await api.get(`/finance/bank-reconciliations/${selected.id}/lines/${statementLine.id}/candidates`);
      setMatchLine(statementLine);
      setCandidates(r.data?.candidates||[]);
      setMatchOpen(true);
    }catch(err:any){alert(err.response?.data?.message||'تعذر تحميل مرشحي المطابقة')}
  };

  const applyMatch=async(candidate:any)=>{
    if(!selected||!matchLine)return;
    setSaving(true);
    try{
      await api.post(
        `/finance/bank-reconciliations/${selected.id}/lines/${matchLine.id}/match`,
        candidate.kind==='MODERN'
          ? {journalEntryLineId:candidate.id}
          : {legacyJournalEntryId:candidate.id},
      );
      setMatchOpen(false);setCandidates([]);setMatchLine(null);
      await loadOne(selected.id);
    }catch(err:any){alert(err.response?.data?.message||'تعذر تطبيق المطابقة')}
    finally{setSaving(false)}
  };

  const unmatch=async(statementLine:any)=>{
    if(!selected)return;
    try{
      await api.post(`/finance/bank-reconciliations/${selected.id}/lines/${statementLine.id}/unmatch`);
      await loadOne(selected.id);
    }catch(err:any){alert(err.response?.data?.message||'تعذر إلغاء المطابقة')}
  };

  const action=async(path:string)=>{
    if(!selected)return;
    try{
      await api.post(`/finance/bank-reconciliations/${selected.id}/${path}`);
      await load();await loadOne(selected.id);
    }catch(err:any){alert(err.response?.data?.message||'تعذر تنفيذ الإجراء')}
  };

  return <div className="space-y-6 animate-fade-in-up">
    <div className="flex items-center justify-between">
      <div><h1 className="text-2xl font-bold text-white flex items-center gap-2"><Landmark className="h-6 w-6 text-primary-400"/>التسوية البنكية</h1><p className="text-slate-400 text-sm mt-1">مطابقة كشف البنك مع دفتر الأستاذ وإغلاق الفروقات الصفرية فقط</p></div>
      <Button onClick={create}><Plus className="h-5 w-5"/>تسوية جديدة</Button>
    </div>

    {loading?<div className="h-48 flex items-center justify-center text-slate-400">جارٍ التحميل...</div>:<div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
      <div className="space-y-3">
        {items.map(x=><button key={x.id} onClick={()=>loadOne(x.id)} className={`w-full text-right p-4 rounded-xl border ${selectedId===x.id?'border-primary-500 bg-primary-500/10':'border-slate-800 bg-slate-900'}`}>
          <div className="flex justify-between"><span className="text-white font-bold">{x.bankAccount?.bankName}</span><span className={x.status==='COMPLETED'?'text-emerald-400':'text-amber-400'}>{x.status==='COMPLETED'?'مكتملة':'مسودة'}</span></div>
          <p className="text-slate-400 text-xs mt-1">{new Date(x.startDate).toLocaleDateString('ar-SA')} — {new Date(x.endDate).toLocaleDateString('ar-SA')}</p>
          <p className="text-slate-500 text-xs mt-1">{x._count?.lines||0} حركة</p>
        </button>)}
        {items.length===0&&<div className="p-6 text-center text-slate-500 bg-slate-900 rounded-xl border border-slate-800">لا توجد تسويات</div>}
      </div>

      <div className="lg:col-span-2">
        {!selected?<div className="p-10 text-center text-slate-500 bg-slate-900 rounded-xl border border-slate-800">اختر تسوية</div>:<div className="space-y-4">
          <div className="bg-slate-900 rounded-xl border border-slate-800 p-5">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
              <div><p className="text-slate-500">الرصيد الافتتاحي</p><p className="text-white font-bold">{Number(selected.openingBalance).toLocaleString()}</p></div>
              <div><p className="text-slate-500">رصيد الكشف</p><p className="text-white font-bold">{Number(selected.endingBalance).toLocaleString()}</p></div>
              <div><p className="text-slate-500">رصيد الدفتر</p><p className="text-white font-bold">{selected.ledgerBalance==null?'—':Number(selected.ledgerBalance).toLocaleString()}</p></div>
              <div><p className="text-slate-500">الفرق</p><p className={Math.abs(Number(selected.difference||0))<0.01?'text-emerald-400 font-bold':'text-red-400 font-bold'}>{selected.difference==null?'—':Number(selected.difference).toLocaleString()}</p></div>
            </div>
            <div className="flex flex-wrap gap-2 mt-5">
              {selected.status!=='COMPLETED'&&<>
                <Button onClick={()=>setLineOpen(true)}><Plus className="h-4 w-4"/>سطر كشف</Button>
                <Button variant="ghost" onClick={()=>action('auto-match')}><RefreshCw className="h-4 w-4"/>مطابقة تلقائية</Button>
                <Button variant="ghost" onClick={()=>action('complete')}><CheckCircle2 className="h-4 w-4"/>إكمال التسوية</Button>
              </>}
              {selected.status==='COMPLETED'&&<Button variant="ghost" onClick={()=>action('reopen')}><RotateCcw className="h-4 w-4"/>إعادة فتح</Button>}
            </div>
          </div>

          <div className="bg-slate-900 rounded-xl border border-slate-800 overflow-hidden">
            <table className="w-full text-sm">
              <thead><tr className="bg-slate-800/50 text-slate-400 border-b border-slate-800"><th className="p-3 text-right">التاريخ</th><th className="p-3 text-right">الوصف</th><th className="p-3 text-right">المرجع</th><th className="p-3 text-left">المبلغ</th><th className="p-3 text-center">المطابقة</th></tr></thead>
              <tbody>{(selected.lines||[]).map((x:any)=><tr key={x.id} className="border-b border-slate-800/50"><td className="p-3">{new Date(x.transactionDate).toLocaleDateString('ar-SA')}</td><td className="p-3">{x.description||'—'}</td><td className="p-3 text-slate-400">{x.reference||'—'}</td><td className={`p-3 text-left font-bold ${Number(x.amount)>=0?'text-emerald-400':'text-red-400'}`}>{Number(x.amount).toLocaleString()}</td><td className="p-3 text-center"><div className="flex items-center justify-center gap-2"><span className={x.status==='MATCHED'?'text-emerald-400':'text-amber-400'}>{x.status==='MATCHED'?'مطابق':'غير مطابق'}</span>{selected.status!=='COMPLETED'&&(x.status==='MATCHED'?<button onClick={()=>unmatch(x)} className="text-xs text-slate-400 hover:text-white">إلغاء</button>:<button onClick={()=>openMatch(x)} className="text-xs text-primary-400 hover:text-primary-300">مطابقة يدوية</button>)}</div></td></tr>)}
              {(selected.lines||[]).length===0&&<tr><td colSpan={5} className="p-8 text-center text-slate-500">لا توجد سطور كشف</td></tr>}
              </tbody>
            </table>
          </div>
        </div>}
      </div>
    </div>}

    <Modal isOpen={open} onClose={()=>setOpen(false)} title="تسوية بنكية جديدة"><form onSubmit={submit} className="space-y-4">
      <Select label="الحساب البنكي" required options={banks.map((b:any)=>({value:b.id,label:`${b.bankName} — ${b.accountNumber}`}))} value={form.bankAccountId||''} onChange={e=>setForm({...form,bankAccountId:e.target.value})}/>
      <div className="grid grid-cols-2 gap-4"><Input label="من" type="date" required value={form.startDate||''} onChange={e=>setForm({...form,startDate:e.target.value})}/><Input label="إلى" type="date" required value={form.endDate||''} onChange={e=>setForm({...form,endDate:e.target.value})}/></div>
      <div className="grid grid-cols-2 gap-4"><Input label="الرصيد الافتتاحي" type="number" required value={form.openingBalance??''} onChange={e=>setForm({...form,openingBalance:e.target.value})}/><Input label="رصيد نهاية الكشف" type="number" required value={form.endingBalance??''} onChange={e=>setForm({...form,endingBalance:e.target.value})}/></div>
      <div className="flex justify-end gap-3"><Button type="button" variant="ghost" onClick={()=>setOpen(false)}><X className="h-4 w-4"/>إلغاء</Button><Button type="submit" isLoading={saving}>إنشاء</Button></div>
    </form></Modal>

    <Modal isOpen={lineOpen} onClose={()=>setLineOpen(false)} title="إضافة حركة من كشف البنك"><form onSubmit={addLine} className="space-y-4">
      <Input label="التاريخ" type="date" required value={line.transactionDate||''} onChange={e=>setLine({...line,transactionDate:e.target.value})}/>
      <Input label="المبلغ (+ إيداع / - سحب)" type="number" required value={line.amount??''} onChange={e=>setLine({...line,amount:e.target.value})}/>
      <Input label="المرجع" value={line.reference||''} onChange={e=>setLine({...line,reference:e.target.value})}/>
      <Input label="الوصف" value={line.description||''} onChange={e=>setLine({...line,description:e.target.value})}/>
      <Input label="معرف البنك الخارجي" value={line.externalId||''} onChange={e=>setLine({...line,externalId:e.target.value})}/>
      <div className="flex justify-end gap-3"><Button type="button" variant="ghost" onClick={()=>setLineOpen(false)}><X className="h-4 w-4"/>إلغاء</Button><Button type="submit" isLoading={saving}>إضافة</Button></div>
    </form></Modal>

    <Modal isOpen={matchOpen} onClose={()=>setMatchOpen(false)} title="مطابقة حركة كشف البنك">
      <div className="space-y-3">
        {matchLine&&<div className="p-3 rounded-lg bg-slate-800 text-sm"><p className="text-slate-400">حركة الكشف</p><p className="text-white font-bold mt-1">{Number(matchLine.amount).toLocaleString()} — {matchLine.reference||matchLine.description||'بدون مرجع'}</p></div>}
        {candidates.map((candidate:any)=><button
          key={`${candidate.kind}:${candidate.id}`}
          disabled={saving}
          onClick={()=>applyMatch(candidate)}
          className="w-full text-right p-3 rounded-lg border border-slate-700 bg-slate-900 hover:border-primary-500 disabled:opacity-50"
        >
          <div className="flex items-center justify-between"><span className="text-white font-medium">{candidate.entryNumber}</span><span className="text-emerald-400 font-bold">{Number(candidate.amount).toLocaleString()}</span></div>
          <p className="text-slate-400 text-xs mt-1">{new Date(candidate.date).toLocaleDateString('ar-SA')} — {candidate.description||'—'}</p>
          <p className="text-slate-500 text-xs mt-1">{candidate.kind==='MODERN'?'قيد حديث':'قيد تاريخي'}{candidate.reference?` — ${candidate.reference}`:''}</p>
        </button>)}
        {candidates.length===0&&<div className="p-6 text-center text-slate-500">لا يوجد قيد مؤهل بنفس المبلغ ضمن ±14 يومًا. راجع القيد أو تاريخ كشف البنك.</div>}
        <div className="flex justify-end"><Button type="button" variant="ghost" onClick={()=>setMatchOpen(false)}><X className="h-4 w-4"/>إغلاق</Button></div>
      </div>
    </Modal>
  </div>;
}
