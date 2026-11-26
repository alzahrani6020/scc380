'use client';
import { useState } from 'react';
type Camera={id:string;name:string;siteId:string;supportsAudio:boolean;supportsTalk:boolean;connectionStatus:string;effectiveConnectionStatus?:string};
export default function SurveillanceMedia({cameras}:{cameras:Camera[]}) {
  const [cameraId,setCameraId]=useState('');
  const camera=cameras.find(x=>x.id===cameraId);
  const path=camera?encodeURIComponent(camera.id):'';
  // Browser-to-site access is deliberately loopback-only. An operator must have
  // an authenticated SSH tunnel or run the viewer on the trusted site workstation.
  const liveUrl='http://127.0.0.1:8888/'+path;
  const playbackUrl='http://127.0.0.1:9996/list?path='+path;
  return <section className="space-y-4">
    <h2 className="text-lg font-semibold">البث المباشر والتسجيلات المحلية</h2>
    <p className="rounded border border-amber-600 p-3 text-sm text-amber-100">
      يتطلب هذا المسار تشغيل خدمة MediaMTX على جهاز الفرع وإعداد اتصال محلي أو نفق آمن إلى 127.0.0.1.
      لا تُرسل كلمات مرور الكاميرات إلى SCC380. لن تعمل الروابط عن بُعد بلا اتصال آمن بالفرع،
      ولم يُعتمد بث إنتاجي فعلي قبل اختبار الكاميرا.
    </p>
    <select value={cameraId} onChange={e=>setCameraId(e.target.value)}
      aria-label="كاميرا البث والتسجيل" className="rounded border border-slate-600 bg-slate-900 p-2">
      <option value="">اختر كاميرا الموقع</option>
      {cameras.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}
    </select>
    {camera&&<div className="space-y-3 rounded border border-slate-700 bg-slate-900 p-4">
      <p>الحالة: {camera.effectiveConnectionStatus??camera.connectionStatus}</p>
      <p className="text-sm text-slate-400">
        الاستماع: {camera.supportsAudio?'معلن في تعريف الجهاز (غير مختبر)':'غير معلن'}.
        التحدث إلى الكاميرا يحتاج بروتوكول backchannel منفصلًا ولم يُفعّل بعد.
      </p>
      <div className="flex flex-wrap gap-3">
        <a href={liveUrl} rel="noopener noreferrer" target="_blank"
          className="rounded border border-blue-500 px-3 py-2 underline">
          فتح بث HLS عبر الاتصال المحلي
        </a>
        <a href={playbackUrl} rel="noopener noreferrer" target="_blank"
          className="rounded border border-slate-500 px-3 py-2 underline">
          استعراض فترات التسجيل المحلية
        </a>
      </div>
      <p className="text-xs text-slate-400">
        يسجل MediaMTX المقاطع في جهاز الفرع عند تفعيله. تنزيل المقاطع محكوم بإعداداته المحلية،
        وليس بصلاحيات منصة SCC380 وحدها.
      </p>
    </div>}
  </section>;
}
