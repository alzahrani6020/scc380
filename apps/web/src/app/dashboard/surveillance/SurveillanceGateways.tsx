'use client';
import { useCallback, useEffect, useState } from 'react';
import api from '@/lib/api';

type Site={id:string;name:string};
type Gateway={id:string;siteId:string;name:string;tokenPrefix:string;lastSeenAt?:string|null;revokedAt?:string|null;connectionState?:'CONNECTED'|'STALE'|'REVOKED'|'NEVER_CONNECTED'};
export default function SurveillanceGateways({sites}:{sites:Site[]}) {
  const [rows,setRows]=useState<Gateway[]>([]);
  const [siteId,setSiteId]=useState('');
  const [name,setName]=useState('');
  const [oneTimeToken,setOneTimeToken]=useState('');
  const [message,setMessage]=useState('');
  const [busy,setBusy]=useState(false);
  const refresh=useCallback(async()=>{
    try {
      const response=await api.get<Gateway[]>('/surveillance/gateways');
      if(!Array.isArray(response.data))throw new Error('Invalid list');
      setRows(response.data);
      return true;
    } catch {
      setMessage('تعذر استرجاع بوابات المواقع؛ لا يمكن تأكيد الحالة.');
      return false;
    }
  },[]);
  useEffect(()=>{void refresh();},[refresh]);
  const issue=async()=>{
    setBusy(true);setOneTimeToken('');setMessage('');
    try{
      const r=await api.post<{enrollmentToken:string}>('/surveillance/gateways',{siteId,name});
      if(!/^sccg_[A-Za-z0-9_-]{43}$/.test(r.data.enrollmentToken))throw new Error('Token not returned');
      setOneTimeToken(r.data.enrollmentToken);
      setName('');
      if(await refresh())setMessage('تم تسجيل البوابة. احفظ مفتاح التسجيل محليًا، فلن يظهر مرة أخرى.');
    }catch{setMessage('لم يثبت تسجيل البوابة. تحقق من الموقع والصلاحيات.');}
    finally{setBusy(false);}
  };
  const revoke=async(id:string)=>{
    if(!window.confirm('إلغاء مفتاح اتصال البوابة الآن؟ سيُمنع إرسال أي حالات لاحقة.'))return;
    setBusy(true);setMessage('');setOneTimeToken('');
    try{await api.post('/surveillance/gateways/'+encodeURIComponent(id)+'/revoke');await refresh();setMessage('تم إرسال أمر إلغاء بوابة الاتصال.');}
    catch{setMessage('تعذر تأكيد إلغاء المفتاح.');}
    finally{setBusy(false);}
  };
  return <section className="space-y-4">
    <h2 className="text-lg font-semibold">بوابات ربط الكاميرات في الفروع</h2>
    <p className="text-sm text-slate-400">تتصل بوابة الفرع بخادم SCC380 اتصالًا صادرًا فقط. تعرض حاليًا اختبار توافر RTSP، وليس بث الفيديو أو التحكم.</p>
    <form className="flex flex-wrap gap-2" onSubmit={e=>{e.preventDefault();void issue();}}>
      <select required aria-label="موقع البوابة" value={siteId} onChange={e=>setSiteId(e.target.value)} className="rounded border border-slate-600 bg-slate-900 p-2">
        <option value="">اختر موقع البوابة</option>{sites.map(s=><option key={s.id} value={s.id}>{s.name}</option>)}
      </select>
      <input required maxLength={120} aria-label="اسم البوابة" placeholder="اسم بوابة الفرع" value={name} onChange={e=>setName(e.target.value)} className="rounded border border-slate-600 bg-slate-900 p-2"/>
      <button disabled={busy||!sites.length} className="rounded bg-blue-700 px-4 py-2 disabled:opacity-50">إنشاء بوابة اتصال</button>
    </form>
    {oneTimeToken&&<div className="space-y-2 rounded border border-amber-500 p-4">
      <p className="font-semibold text-amber-200">مفتاح التسجيل — يظهر مرة واحدة فقط</p>
      <code dir="ltr" className="block break-all rounded bg-slate-950 p-2 text-sm">{oneTimeToken}</code>
      <button type="button" onClick={()=>{void navigator.clipboard.writeText(oneTimeToken);}} className="rounded border border-slate-600 px-3 py-2">نسخ المفتاح</button>
      <button type="button" onClick={()=>setOneTimeToken('')} className="mr-2 rounded border border-slate-600 px-3 py-2">إخفاء المفتاح</button>
      <p className="text-xs text-slate-400">احفظ المفتاح في بيئة الفني الآمنة. لا تضعه في سجل GitHub أو صور الدعم أو عناوين URL.</p>
    </div>}
    {message&&<p role="status" className="rounded border border-slate-700 p-3">{message}</p>}
    <div className="space-y-2">{rows.map(g=><article key={g.id} className="flex flex-wrap items-center justify-between gap-2 rounded border border-slate-700 bg-slate-900 p-3">
      <div><p className="font-semibold">{g.name}</p>
        <p className="text-sm text-slate-400">{sites.find(s=>s.id===g.siteId)?.name||'موقع غير متاح'} — {g.connectionState==='REVOKED'||g.revokedAt?'ملغاة':g.connectionState==='STALE'?'الاتصال متقادم — تحقق من البوابة':g.connectionState==='CONNECTED'?'متصلة حديثًا':g.lastSeenAt?'اتصال سابق: '+new Date(g.lastSeenAt).toLocaleString('ar-SA'):'بانتظار اتصال الفرع'}{g.lastSeenAt?' — آخر تقرير: '+new Date(g.lastSeenAt).toLocaleString('ar-SA'):''}</p>
        <p className="text-xs text-slate-500">معرّف المفتاح: {g.tokenPrefix}…</p>
      </div>
      {!g.revokedAt&&<button type="button" disabled={busy} onClick={()=>void revoke(g.id)} className="rounded border border-red-500 px-3 py-2">إلغاء البوابة</button>}
    </article>)}</div>
    <a href="https://github.com/alzahrani6020/scc380/blob/main/docs/surveillance-pilot-onboarding.md" target="_blank" rel="noopener noreferrer" className="inline-block text-blue-300 underline">إرشادات الربط والفحص الميداني</a>
  </section>;
}
