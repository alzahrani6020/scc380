'use client';
import {useMemo,useState} from 'react';
type Site={id:string;name:string;city?:string|null};
type Camera={id:string;siteId:string;name:string;connectionStatus:string;effectiveConnectionStatus?:string;lastSeenAt?:string|null;supportsAudio:boolean;supportsTalk:boolean;supportsPtz:boolean;supportsWiper:boolean;site?:{name:string}};
type Maintenance={id:string;cameraId:string;status:string;taskType:string;camera?:{name:string;site:{name:string}}};
export type OperationsRow={id:string;siteId:string;name:string;siteName:string;status:'ONLINE_REPORTED'|'STALE'|'UNCONFIGURED'|'UNKNOWN';lastSeenAt:string|null;supportsAudio:boolean;supportsTalk:boolean;supportsPtz:boolean;supportsWiper:boolean;openTasks:number};
export function calculateOperations(sites:Site[],cameras:Camera[],tasks:Maintenance[],nowMs:number):OperationsRow[]{
  const cameraSite=new Map(sites.map(s=>[s.id,s.name]));
  const taskCounts=new Map<string,number>();
  for(const t of tasks)if(t.status==='OPEN'||t.status==='IN_PROGRESS')taskCounts.set(t.cameraId,(taskCounts.get(t.cameraId)||0)+1);
  return cameras.map(c=>{
    const age=c.lastSeenAt?Date.parse(c.lastSeenAt):NaN;
    const fresh=Number.isFinite(age)&&age<=nowMs&&nowMs-age<=120000;
    const state=c.effectiveConnectionStatus??c.connectionStatus;
    // An API-reported online camera is only a recent RTSP reachability report, NOT verified media.
    const status:OperationsRow['status']=state==='UNCONFIGURED'?'UNCONFIGURED':
      state==='STALE'?'STALE':
      state==='ONLINE'&&fresh?'ONLINE_REPORTED':
      !fresh&&Number.isFinite(age)?'STALE':'UNKNOWN';
    return {id:c.id,siteId:c.siteId,name:c.name,siteName:cameraSite.get(c.siteId)||c.site?.name||'موقع غير معروف',
      status,lastSeenAt:c.lastSeenAt??null,supportsAudio:c.supportsAudio,
      supportsTalk:c.supportsTalk,supportsPtz:c.supportsPtz,supportsWiper:c.supportsWiper,
      openTasks:taskCounts.get(c.id)||0};
  });
}
const states:Record<OperationsRow['status'],string>={
  ONLINE_REPORTED:'تقرير اتصال حديث — البث غير مؤكد',
  STALE:'اتصال متقادم',
  UNCONFIGURED:'غير مهيأة',
  UNKNOWN:'حالة الاتصال غير معروفة'
};
export default function SurveillanceOperations({sites,cameras,maintenance,onNavigate}:{
  sites:Site[];cameras:Camera[];maintenance:Maintenance[];onNavigate:(tab:'cameras'|'maintenance'|'gateways'|'media'|'incidents'|'controls')=>void;
}){
  const [siteId,setSiteId]=useState('');
  const [status,setStatus]=useState('');
  const [query,setQuery]=useState('');
  const rows=useMemo(()=>calculateOperations(sites,cameras,maintenance,Date.now()),[sites,cameras,maintenance]);
  const filtered=rows.filter(r=>(!siteId||r.siteId===siteId)&&(!status||r.status===status)&&
    (!query||[r.name,r.siteName].some(v=>v.toLowerCase().includes(query.trim().toLowerCase()))));
  const count=(s:OperationsRow['status'])=>filtered.filter(r=>r.status===s).length;
  return <section className="space-y-4" data-testid="surveillance-operations-center">
    <div className="space-y-1">
      <h2 className="text-lg font-semibold">مركز تشغيل المراقبة</h2>
      <p className="text-sm text-slate-300">مؤشرات تشغيلية من سجلات الشركة الحالية؛ حالة الاتصال تعني تقرير فحص RTSP حديثًا فقط، ولا تثبت بث الصورة أو الصوت أو عمل التسجيلات.</p>
    </div>
    <div className="flex flex-wrap gap-2">
      <select aria-label="تصفية حسب الموقع" value={siteId} onChange={e=>setSiteId(e.target.value)} className="rounded border border-slate-600 bg-slate-900 p-2">
        <option value="">كل المواقع</option>{sites.map(s=><option key={s.id} value={s.id}>{s.name}</option>)}
      </select>
      <select aria-label="تصفية حسب حالة الاتصال" value={status} onChange={e=>setStatus(e.target.value)} className="rounded border border-slate-600 bg-slate-900 p-2">
        <option value="">جميع الحالات</option>{Object.entries(states).map(([k,v])=><option key={k} value={k}>{v}</option>)}
      </select>
      <input aria-label="البحث عن كاميرا" placeholder="ابحث عن كاميرا أو موقع" value={query} onChange={e=>setQuery(e.target.value)}
        className="rounded border border-slate-600 bg-slate-900 p-2"/>
    </div>
    <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
      {([
        ['ONLINE_REPORTED','اتصال مُبلّغ حديثًا'],
        ['STALE','اتصال متقادم'],
        ['UNCONFIGURED','غير مهيأة'],
        ['UNKNOWN','حالة غير معروفة']
      ] as const).map(([s,label])=><div key={s} className="rounded-lg border border-slate-700 bg-slate-900 p-3">
        <div className="text-2xl font-bold tabular-nums">{count(s)}</div><div className="text-sm text-slate-300">{label}</div>
      </div>)}
    </div>
    <div className="flex flex-wrap gap-2">
      <button type="button" onClick={()=>onNavigate('gateways')} className="rounded border border-sky-600 px-3 py-2">بوابات الفروع</button>
      <button type="button" onClick={()=>onNavigate('media')} className="rounded border border-sky-600 px-3 py-2">البث والتسجيلات</button>
      <button type="button" onClick={()=>onNavigate('maintenance')} className="rounded border border-sky-600 px-3 py-2">الصيانة</button>
      <button type="button" onClick={()=>onNavigate('incidents')} className="rounded border border-sky-600 px-3 py-2">الحوادث</button>
    </div>
    <div className="overflow-x-auto"><table className="w-full min-w-[700px] text-right text-sm">
      <thead><tr className="border-b border-slate-700">
        <th className="p-2">الموقع</th><th className="p-2">الكاميرا</th><th className="p-2">تقرير الاتصال</th>
        <th className="p-2">الصوت</th><th className="p-2">التحكم</th><th className="p-2">صيانة مفتوحة</th>
      </tr></thead>
      <tbody>{filtered.map(r=><tr key={r.id} className="border-b border-slate-800">
        <td className="p-2">{r.siteName}</td><td className="p-2">{r.name}</td>
        <td className="p-2">{states[r.status]}{r.lastSeenAt&&<div className="text-xs text-slate-400">آخر تقرير: {new Date(r.lastSeenAt).toLocaleString('ar-SA')}</div>}</td>
        <td className="p-2">{r.supportsAudio?'مدعوم بحسب التعريف، غير مختبر':'غير معلن'}</td>
        <td className="p-2">{r.supportsPtz?'PTZ معلن':'PTZ غير معلن'} / {r.supportsTalk?'تحدث معلن':'تحدث غير معلن'}</td>
        <td className="p-2">{r.openTasks}</td>
      </tr>)}</tbody>
    </table></div>
    {!filtered.length&&<p className="text-slate-400">لا توجد كاميرات تطابق المرشحات الحالية.</p>}
    <p className="text-xs text-amber-200">هذه اللوحة لا تفحص تدفق الفيديو ولا تتصل بميكروفونات المستخدم، ولا تعني وجود تسجيلات سحابية. البيانات المعروضة تخص جلسة الشركة الحالية وفق API.</p>
  </section>;
}
