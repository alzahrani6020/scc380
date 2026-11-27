'use client';
import { useState } from 'react';
type Camera={id:string;name:string;siteId:string;supportsAudio:boolean;supportsTalk:boolean;connectionStatus:string;effectiveConnectionStatus?:string};
export default function SurveillanceMedia({cameras}:{cameras:Camera[]}) {
  const [cameraId,setCameraId]=useState('');
  const [showLocalPilot,setShowLocalPilot]=useState(false);
  const [showLocalPreview,setShowLocalPreview]=useState(false);
  const camera=cameras.find(x=>x.id===cameraId);
  const path=camera?encodeURIComponent(camera.id):'';
  // Browser-to-site access is deliberately loopback-only. An operator must have
  // an authenticated SSH tunnel or run the viewer on the trusted site workstation.
  const liveUrl='http://127.0.0.1:8888/'+path;
  const playbackUrl='http://127.0.0.1:9996/list?path='+path;
  // Deliberately independent of production camera IDs and tenant claims. This is
  // an operator-initiated localhost pilot, never a remote cloud media relay.
  const laptopLocalHls='http://127.0.0.1:8890/laptop';
  const laptopRecordingList='http://127.0.0.1:9996/list?path=laptop';
  return <section className="space-y-4">
    <h2 className="text-lg font-semibold">البث المباشر والتسجيلات المحلية</h2>
    <p className="rounded border border-amber-600 p-3 text-sm text-amber-100">
      يتطلب هذا المسار تشغيل خدمة MediaMTX على جهاز الفرع وإعداد اتصال محلي أو نفق آمن إلى 127.0.0.1.
      لا تُرسل كلمات مرور الكاميرات إلى SCC380. لن تعمل الروابط عن بُعد بلا اتصال آمن بالفرع،
      ولم يُعتمد بث إنتاجي فعلي قبل اختبار الكاميرا.
    </p>
    <div className="space-y-3 rounded-xl border border-sky-700 bg-slate-900 p-4" data-testid="local-laptop-media-pilot">
      <h3 className="font-semibold">اختبار كاميرا اللابتوب — محلي فقط</h3>
      <p className="text-sm text-slate-300">تم تخصيص اختبار محلي لمصدر MediaMTX باسم <code dir="ltr">laptop</code> على جهازك. لا يمثل هذا بثًا من خادم SCC380، ولا يُربط تلقائيًا بكاميرات شركات أخرى. يحتاج فتح هذه الصفحة من جهاز Windows الذي يعمل عليه MediaMTX، وبقاء النشر من FFmpeg نشطًا لمشاهدة البث المباشر.</p>
      <button type="button" className="rounded-lg border border-sky-500 px-3 py-2" aria-expanded={showLocalPilot} onClick={()=>{setShowLocalPilot(v=>!v);setShowLocalPreview(false);}}>{showLocalPilot?'إغلاق الاختبار المحلي':'فتح اختبار كاميرا اللابتوب'}</button>
      {showLocalPilot&&<div className="space-y-3 rounded-lg border border-slate-700 p-3">
        <p className="text-xs text-amber-200">الاتصال مباشر بين هذا المتصفح و127.0.0.1 على الجهاز الحالي. لن تعمل الروابط من هاتف أو كمبيوتر آخر دون اتصال محلي آمن. سيطلب MediaMTX حساب المشاهدة المحلي؛ لا تدخل مفتاح بوابة SCC380 في هذه النافذة.</p>
        <div className="flex flex-wrap gap-2">
          <a href={laptopLocalHls} target="_blank" rel="noopener noreferrer" className="rounded border border-blue-500 px-3 py-2 underline">فتح المشاهدة المباشرة المحلية</a>
          <a href={laptopRecordingList} target="_blank" rel="noopener noreferrer" className="rounded border border-slate-500 px-3 py-2 underline">فتح فهرس التسجيلات المحلي</a>
          <button type="button" className="rounded border border-slate-500 px-3 py-2" onClick={()=>setShowLocalPreview(v=>!v)} aria-expanded={showLocalPreview}>{showLocalPreview?'إغلاق نافذة المعاينة':'محاولة المعاينة داخل الصفحة'}</button>
        </div>
        {showLocalPreview&&<div className="space-y-2">
          <p className="text-xs text-slate-400">قد يمنع المتصفح المعاينة المضمنة من صفحة HTTPS إلى خادم HTTP محلي. استخدم «فتح المشاهدة المباشرة المحلية» إن لم تظهر الصورة. لا يُعد غياب الصورة دليلًا على انقطاع الكاميرا.</p>
          <iframe title="معاينة فيديو اللابتوب المحلي" src={laptopLocalHls} loading="lazy" referrerPolicy="no-referrer" allow="autoplay" className="aspect-video w-full rounded border border-slate-700 bg-black" />
        </div>}
        <p className="text-xs text-slate-400">بعد انتهاء إرسال FFmpeg يتوقف البث المباشر، بينما تبقى التسجيلات المحلية حتى انتهاء سياسة الاحتفاظ. واجهة فهرس التسجيلات تعرض بيانات JSON؛ تنزيل المقاطع يتم من MediaMTX المحلي باستخدام حساب المشاهدة، وليس صلاحيات SCC380 السحابية.</p>
      </div>}
    </div>
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
