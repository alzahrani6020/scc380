'use client';
import { useCallback, useEffect, useState } from 'react';
import api from '@/lib/api';

type Camera={id:string;name:string;supportsPtz:boolean;effectiveConnectionStatus?:string;connectionStatus:string};
type Command={id:string;cameraId:string;action:string;status:string;resultCode?:string|null;createdAt:string;expiresAt:string};
const actions=[['PTZ_LEFT','يسار'],['PTZ_RIGHT','يمين'],['PTZ_UP','أعلى'],['PTZ_DOWN','أسفل'],
  ['ZOOM_IN','تكبير'],['ZOOM_OUT','تصغير'],['PTZ_STOP','إيقاف']] as const;
export default function SurveillanceDeviceCommands({cameras}:{cameras:Camera[]}) {
  const [rows,setRows]=useState<Command[]>([]);
  const [cameraId,setCameraId]=useState('');
  const [action,setAction]=useState('PTZ_STOP');
  const [message,setMessage]=useState('');
  const [busy,setBusy]=useState(false);
  const load=useCallback(async()=>{
    try{
      const r=await api.get<Command[]>('/surveillance/device-commands');
      if(!Array.isArray(r.data))throw new Error('Invalid response');
      setRows(r.data);return true;
    }catch{setMessage('تعذّر التحقق من سجل أوامر الأجهزة أو صلاحية الوصول.');return false;}
  },[]);
  useEffect(()=>{void load();},[load]);
  const create=async()=>{
    if(!window.confirm('إرسال طلب PTZ؟ قد تتحرك الكاميرا فقط إذا فُعّل التشغيل الميداني في الخادم والفرع. متابعة؟'))return;
    setBusy(true);setMessage('');
    try{
      const r=await api.post<{deviceExecuted:boolean;status:string}>('/surveillance/device-commands',{cameraId,action});
      if(r.data.deviceExecuted!==false||r.data.status!=='QUEUED')throw new Error('Unexpected result');
      setMessage(await load()?'سُجل الطلب، لكن لم يتأكد تنفيذ حركة. افحص نتيجة الطلب من سجل أوامر الفرع.':'استجاب الخادم ولكن لم يتأكد استرجاع الطلب.');
    }catch{setMessage('لم يثبت تسجيل الطلب. تحقق من اتصال البوابة وقدرات الكاميرا والصلاحية.');}
    finally{setBusy(false);}
  };
  const camera=cameras.find(c=>c.id===cameraId);
  const eligible=camera?.supportsPtz&&
    (camera.effectiveConnectionStatus??camera.connectionStatus)==='ONLINE';
  return <section className="space-y-4">
    <h2 className="text-lg font-semibold">أوامر PTZ — التفعيل مشروط بالمحوّل الميداني</h2>
    <p className="rounded border border-amber-600 p-3 text-sm text-amber-200">
      تُرسل هذه الواجهة طلبات قصيرة المدة (15 ثانية). لا تعني حالة QUEUED أن الكاميرا تحركت.
      قد ينفّذ محوّل ONVIF الحركة فقط بعد تفعيل التشغيل بشكل منفصل في الخادم والفرع. تُعد SOAP_ACKNOWLEDGED
      استجابة بروتوكولية لا إثبات حركة مرئية؛ ويجب تأكيد الأداء ميدانيًا.
    </p>
    <form className="flex flex-wrap gap-2" onSubmit={e=>{e.preventDefault();void create();}}>
      <select required value={cameraId} onChange={e=>setCameraId(e.target.value)}
        aria-label="كاميرا التحكم التجريبي" className="rounded border border-slate-600 bg-slate-900 p-2">
        <option value="">اختر الكاميرا</option>
        {cameras.filter(c=>c.supportsPtz).map(c=><option value={c.id} key={c.id}>{c.name}</option>)}
      </select>
      <select value={action} onChange={e=>setAction(e.target.value)} aria-label="نوع الطلب التجريبي"
        className="rounded border border-slate-600 bg-slate-900 p-2">
        {actions.map(([id,label])=><option value={id} key={id}>{label}</option>)}
      </select>
      <button disabled={busy||!eligible} className="rounded bg-blue-700 px-3 py-2 disabled:opacity-50">
        إرسال طلب PTZ
      </button>
    </form>
    {message&&<p role="status" className="rounded border border-slate-700 p-3">{message}</p>}
    <button type="button" onClick={()=>void load()} className="rounded border border-slate-600 px-3 py-2">تحديث سجل الطلبات</button>
    <div className="space-y-2">{rows.map(row=><article key={row.id}
      className="rounded border border-slate-700 bg-slate-900 p-3 text-sm">
      <strong>{cameras.find(c=>c.id===row.cameraId)?.name||'كاميرا غير متاحة'}</strong>
      <span> — {row.action} — {row.status}{row.resultCode?' ('+row.resultCode+')':''}</span>
      <p className="text-slate-400">تاريخ الطلب: {new Date(row.createdAt).toLocaleString('ar-SA')}</p>
    </article>)}</div>
  </section>;
}
