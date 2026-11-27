'use client';
import {useCallback,useEffect,useState} from 'react';
import api from '@/lib/api';

type Site={id:string;name:string};
type Camera={id:string;siteId:string;name:string;manufacturer?:string|null;connectionStatus:string;
 effectiveConnectionStatus?:string;lastSeenAt?:string|null;supportsAudio:boolean;supportsTalk:boolean;supportsPtz:boolean;site?:{name:string}};
type Page={page:number;size:number;total:number;totalPages:number;cameras:Camera[]};
const pageSize=50;
export default function SurveillanceFleet({sites}:{sites:Site[]}){
  const [siteId,setSiteId]=useState('');
  const [search,setSearch]=useState('');
  const [submitted,setSubmitted]=useState('');
  const [page,setPage]=useState(1);
  const [result,setResult]=useState<Page|null>(null);
  const [error,setError]=useState('');
  const [busy,setBusy]=useState(false);
  const refresh=useCallback(async(signal:AbortSignal)=>{
    setBusy(true);setError('');setResult(null);
    try{
      const r=await api.get<Page>('/surveillance/fleet',{params:{page,size:pageSize,
        ...(siteId?{siteId}:{}),...(submitted?{search:submitted}:{})},signal});
      if(!Array.isArray(r.data?.cameras)||!Number.isInteger(r.data?.total)||r.data.page!==page)
        throw new Error('INVALID_FLEET_RESPONSE');
      if(!signal.aborted)setResult(r.data);
    }catch(e:unknown){
      if(!signal.aborted)setError('تعذّر تحميل قائمة الكاميرات المرقّمة. البيانات المعروضة غير مؤكدة؛ لا يُفترض أن القائمة فارغة.');
    }finally{if(!signal.aborted)setBusy(false);}
  },[page,siteId,submitted]);
  useEffect(()=>{const ctrl=new AbortController();void refresh(ctrl.signal);return()=>ctrl.abort();},[refresh]);
  const status=(c:Camera)=>{
    const s=c.effectiveConnectionStatus??c.connectionStatus;
    if(s==='STALE')return 'تقرير قديم';
    if(s==='ONLINE')return 'اتصال RTSP حديث (ليس تحقق بث)';
    if(s==='UNCONFIGURED')return 'غير مهيأة';
    if(s==='OFFLINE')return 'غير متصلة وفق آخر تقرير';
    return s||'غير معروف';
  };
  return <section className="space-y-4" data-testid="surveillance-fleet-pagination">
    <h2 className="text-lg font-semibold">فهرس الكاميرات — صفحات متعددة</h2>
    <p className="text-sm text-slate-300">بحث وترقيم صفحات داخل الشركة المسجّل دخولها. لا يُعرض بث فيديو أو صوت من هذا الفهرس.</p>
    <form className="flex flex-wrap gap-2" onSubmit={e=>{e.preventDefault();setPage(1);setSubmitted(search.trim());}}>
      <select aria-label="موقع كاميرات الفهرس" value={siteId} onChange={e=>{setSiteId(e.target.value);setPage(1);}}
        className="rounded border border-slate-600 bg-slate-900 p-2">
        <option value="">جميع المواقع</option>{sites.map(s=><option key={s.id} value={s.id}>{s.name}</option>)}
      </select>
      <input aria-label="البحث في أسماء الكاميرات" maxLength={120} placeholder="اسم الكاميرا" value={search}
        onChange={e=>setSearch(e.target.value)} className="rounded border border-slate-600 bg-slate-900 p-2"/>
      <button type="submit" className="rounded border border-blue-600 px-3 py-2">بحث</button>
      <button type="button" className="rounded border border-slate-600 px-3 py-2" onClick={()=>{setSearch('');setSubmitted('');setPage(1);setSiteId('');}}>إزالة المرشحات</button>
    </form>
    {busy&&<p role="status">جارٍ جلب صفحة الكاميرات...</p>}
    {error&&<p role="alert" className="text-amber-200">{error}</p>}
    {result&&<div className="space-y-3">
      <p className="text-sm">إجمالي الكاميرات المطابقة: <strong>{result.total}</strong> — الصفحة {result.page} من {Math.max(1,result.totalPages)} — {result.cameras.length} كاميرا في الصفحة الحالية</p>
      <div className="overflow-x-auto"><table className="w-full min-w-[680px] text-right text-sm">
        <thead><tr className="border-b border-slate-700"><th className="p-2">الموقع</th><th className="p-2">الكاميرا</th><th className="p-2">الصانع</th><th className="p-2">آخر اتصال</th><th className="p-2">القدرات المعلنة</th></tr></thead>
        <tbody>{result.cameras.map(c=><tr key={c.id} className="border-b border-slate-800">
          <td className="p-2">{c.site?.name||'غير معروف'}</td>
          <td className="p-2">{c.name}</td>
          <td className="p-2">{c.manufacturer||'—'}</td>
          <td className="p-2">{status(c)}{c.lastSeenAt&&<div className="text-xs text-slate-400">{new Date(c.lastSeenAt).toLocaleString('ar-SA')}</div>}</td>
          <td className="p-2">{[c.supportsAudio?'صوت':null,c.supportsTalk?'تحدث':null,c.supportsPtz?'PTZ':null].filter(Boolean).join('، ')||'غير محددة'}</td>
        </tr>)}</tbody>
      </table></div>
      {!result.cameras.length&&<p>لا توجد كاميرات مطابقة.</p>}
      <div className="flex items-center gap-3">
        <button type="button" disabled={busy||page<=1} onClick={()=>setPage(p=>p-1)} className="rounded border border-slate-600 px-3 py-2 disabled:opacity-40">السابقة</button>
        <button type="button" disabled={busy||page>=result.totalPages} onClick={()=>setPage(p=>p+1)} className="rounded border border-slate-600 px-3 py-2 disabled:opacity-40">التالية</button>
      </div>
    </div>}
    <p className="text-xs text-amber-200">مركز التشغيل القديم يعرض نطاقًا محدودًا من الكاميرات. استخدم هذا الفهرس للوصول إلى بقية كاميرات الشركة.</p>
  </section>;
}
