'use client';
import { useCallback, useEffect, useState } from 'react';
import api from '@/lib/api';

type Site={id:string;name:string};
type Vehicle={id:string;plateNumber:string;make:string;model:string};
type Camera={id:string;siteId:string;name:string;manufacturer?:string|null;model?:string|null;
  cameraType?:string;connectorType?:string;vehicleId?:string|null;
  connectionStatus:string;effectiveConnectionStatus?:string;
  lastLatitude?:string|number|null;lastLongitude?:string|number|null;lastTelemetryAt?:string|null};
const dashTypes=[
  ['DASHCAM_FRONT','أمامية'],['DASHCAM_REAR','خلفية'],['DASHCAM_CABIN','داخل المقصورة'],
  ['DASHCAM_MULTI','متعددة القنوات'],
] as const;
const connectors=[
  ['UNCONFIGURED','غير متصلة بعد'],['DASHCAM_RTSP','RTSP عبر بوابة الشركة'],
  ['VENDOR_ADAPTER','محوّل الشركة المصنعة (بعد التحقق)'],
] as const;
export default function SurveillanceDashcams({sites,cameras,onAdded}:{
  sites:Site[];cameras:Camera[];onAdded:()=>Promise<boolean>}) {
  const [vehicles,setVehicles]=useState<Vehicle[]>([]);
  const [fleetError,setFleetError]=useState('');
  const [siteId,setSiteId]=useState('');
  const [vehicleId,setVehicleId]=useState('');
  const [name,setName]=useState('');
  const [manufacturer,setManufacturer]=useState('');
  const [model,setModel]=useState('');
  const [cameraType,setCameraType]=useState('DASHCAM_FRONT');
  const [connectorType,setConnectorType]=useState('UNCONFIGURED');
  const [supportsAudio,setSupportsAudio]=useState(false);
  const [busy,setBusy]=useState(false);
  const [message,setMessage]=useState('');
  const refreshFleet=useCallback(async()=>{
    try{
      const response=await api.get<Vehicle[]>('/surveillance/vehicles');
      if(!Array.isArray(response.data))throw new Error('Invalid vehicle list');
      setVehicles(response.data);setFleetError('');
    }catch{setFleetError('تعذر قراءة أسطول المركبات في مساحة العمل. يمكنك تسجيل الكاميرا دون ربط مركبة.');}
  },[]);
  useEffect(()=>{void refreshFleet();},[refreshFleet]);
  const register=async()=>{
    setBusy(true);setMessage('');
    try{
      await api.post('/surveillance/cameras',{
        siteId,name,manufacturer:manufacturer||undefined,model:model||undefined,
        cameraType,connectorType,vehicleId:vehicleId||undefined,supportsAudio,
        supportsTalk:false,supportsPtz:false,supportsWiper:false,
      });
      const verified=await onAdded();
      setMessage(verified?'سُجلت داش كام وأعيد تحميلها من مساحة العمل. الربط المرئي يتطلب إعداد جهاز فعلي.':
        'استجاب الخادم ولكن لم يتأكد استرجاع الكاميرا من قاعدة البيانات.');
      setName('');setManufacturer('');setModel('');
    }catch(e:unknown){
      const code=(e as {response?:{status?:number}}).response?.status;
      setMessage(code===404?'الموقع أو المركبة لا يتبعان مساحة العمل الحالية.':
        code===403?'لا تملك صلاحية تسجيل داش كام في مساحة العمل.':
        'تعذر تأكيد تسجيل داش كام. تحقق من بيانات الجهاز واتصال API.');
    }finally{setBusy(false);}
  };
  const dashcams=cameras.filter(c=>c.cameraType?.startsWith('DASHCAM'));
  return <section className="space-y-4">
    <h2 className="text-lg font-semibold">كاميرات المركبات — Dash Cam</h2>
    <p className="text-sm text-slate-300">تسجل كاميرات المركبات داخل مساحة العمل الحالية، ويمكن ربطها بمركبة موجودة في أسطول الشركة.
      يعتمد الاتصال الحقيقي على دعم الجهاز لبروتوكول RTSP أو محوّل موثّق من المصنع، ولا يعني تسجيله أنه متصل بالفعل.</p>
    <form className="space-y-3 rounded-lg border border-slate-700 bg-slate-900 p-4"
      onSubmit={e=>{e.preventDefault();void register();}}>
      <div className="flex flex-wrap gap-2">
        <select required aria-label="موقع البوابة التابعة للمركبة" value={siteId} onChange={e=>setSiteId(e.target.value)}
          className="rounded border border-slate-600 bg-slate-950 p-2">
          <option value="">اختر موقع / مركز تشغيل الأسطول</option>
          {sites.map(s=><option key={s.id} value={s.id}>{s.name}</option>)}
        </select>
        <select aria-label="مركبة مسجلة في مساحة العمل" value={vehicleId} onChange={e=>setVehicleId(e.target.value)}
          className="rounded border border-slate-600 bg-slate-950 p-2">
          <option value="">بلا مركبة مسندة</option>
          {vehicles.map(v=><option key={v.id} value={v.id}>{v.plateNumber} — {v.make} {v.model}</option>)}
        </select>
        <button type="button" onClick={()=>void refreshFleet()} className="rounded border border-slate-600 px-3 py-2">تحديث الأسطول</button>
      </div>
      {fleetError&&<p role="status" className="text-amber-200">{fleetError}</p>}
      <div className="flex flex-wrap gap-2">
        <input required value={name} onChange={e=>setName(e.target.value)} maxLength={120}
          placeholder="اسم داش كام" aria-label="اسم داش كام" className="rounded border border-slate-600 bg-slate-950 p-2"/>
        <input value={manufacturer} onChange={e=>setManufacturer(e.target.value)} maxLength={120}
          placeholder="الشركة المصنعة" aria-label="الشركة المصنعة" className="rounded border border-slate-600 bg-slate-950 p-2"/>
        <input value={model} onChange={e=>setModel(e.target.value)} maxLength={120}
          placeholder="الموديل" aria-label="موديل داش كام" className="rounded border border-slate-600 bg-slate-950 p-2"/>
        <select value={cameraType} onChange={e=>setCameraType(e.target.value)}
          aria-label="موضع كاميرا المركبة" className="rounded border border-slate-600 bg-slate-950 p-2">
          {dashTypes.map(([v,label])=><option key={v} value={v}>{label}</option>)}
        </select>
        <select value={connectorType} onChange={e=>setConnectorType(e.target.value)}
          aria-label="طريقة ربط داش كام" className="rounded border border-slate-600 bg-slate-950 p-2">
          {connectors.map(([v,label])=><option key={v} value={v}>{label}</option>)}
        </select>
      </div>
      <label className="flex items-center gap-2"><input type="checkbox" checked={supportsAudio}
        onChange={e=>setSupportsAudio(e.target.checked)}/> الجهاز يعلن دعم تسجيل الصوت</label>
      <p className="text-xs text-amber-200">ربط الشركة المصنعة اختيار تهيئة وليس إثبات تكامل. تتطلب الكاميرات المتنقلة اتصالًا من البوابة أو محوّل السحابة الموثق؛ ولا تُرفع مقاطع أو بيانات موقع تلقائيًا.</p>
      <button disabled={busy||!sites.length} className="rounded bg-blue-700 px-4 py-2 disabled:opacity-50">تسجيل داش كام</button>
    </form>
    {message&&<p role="status" className="rounded border border-slate-600 p-3">{message}</p>}
    <div className="space-y-3">
      {dashcams.map(c=><article key={c.id} className="rounded border border-slate-700 bg-slate-900 p-4">
        <h3 className="font-semibold">{c.name} — {dashTypes.find(t=>t[0]===c.cameraType)?.[1]||c.cameraType}</h3>
        <p className="text-sm text-slate-300">الشركة: {c.manufacturer||'غير محددة'} — الربط: {c.connectorType||'غير محدد'}</p>
        <p className="text-sm">المركبة: {vehicles.find(v=>v.id===c.vehicleId)?.plateNumber||'غير مسندة'} —
          الاتصال: {c.effectiveConnectionStatus??c.connectionStatus}</p>
        <p className="text-sm text-slate-400">آخر موقع مبلغ من بوابة الشركة: {c.lastLatitude!=null&&c.lastLongitude!=null?
          String(c.lastLatitude)+', '+String(c.lastLongitude):'غير متاح'}
          {c.lastTelemetryAt?' — '+new Date(c.lastTelemetryAt).toLocaleString('ar-SA'):''}</p>
      </article>)}
      {dashcams.length===0&&<p className="text-slate-400">لا توجد كاميرات مركبات مسجلة في مساحة العمل.</p>}
    </div>
  </section>;
}
