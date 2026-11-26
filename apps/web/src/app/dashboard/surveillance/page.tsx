'use client';

import { useCallback, useEffect, useState } from 'react';
import api from '@/lib/api';

type Site = { id: string; name: string; city?: string | null; siteType: string; _count?: { cameras: number } };
type Camera = { id: string; siteId: string; name: string; manufacturer?: string | null; model?: string | null;
  supportsAudio: boolean; supportsTalk: boolean; supportsPtz: boolean; supportsWiper: boolean;
  connectionStatus: string; site?: { name: string } };
type Task = { id: string; cameraId: string; taskType: string; status: string;
  camera?: { name: string; site: { name: string } }; createdAt: string };

const tasks = [
  ['CLEANING', 'تنظيف الكاميرا'], ['LENS_CHECK', 'فحص العدسة'],
  ['PTZ_CHECK', 'فحص الحركة والزوم'], ['RECORDING_CHECK', 'فحص التسجيل'],
  ['REPAIR', 'إصلاح عطل'],
] as const;

export default function SurveillancePage() {
  const [tab, setTab] = useState<'sites' | 'cameras' | 'maintenance'>('sites');
  const [sites, setSites] = useState<Site[]>([]);
  const [cameras, setCameras] = useState<Camera[]>([]);
  const [maintenance, setMaintenance] = useState<Task[]>([]);
  const [siteName, setSiteName] = useState('');
  const [siteCity, setSiteCity] = useState('');
  const [cameraName, setCameraName] = useState('');
  const [manufacturer, setManufacturer] = useState('');
  const [cameraSiteId, setCameraSiteId] = useState('');
  const [cameraCapabilities, setCameraCapabilities] = useState({ supportsAudio:false,supportsTalk:false,supportsPtz:false,supportsWiper:false });
  const [maintenanceCameraId, setMaintenanceCameraId] = useState('');
  const [taskType, setTaskType] = useState('CLEANING');
  const [description, setDescription] = useState('');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const results = await Promise.all([
        api.get<Site[]>('/surveillance/sites'),
        api.get<Camera[]>('/surveillance/cameras'),
        api.get<Task[]>('/surveillance/maintenance'),
      ]);
      if (!results.every(r => Array.isArray(r.data))) throw new Error('Unexpected API response');
      setSites(results[0].data);
      setCameras(results[1].data);
      setMaintenance(results[2].data);
      setMessage('');
    } catch (error: unknown) {
      const status = (error as { response?: { status?: number } })?.response?.status;
      setMessage(status === 403 ? 'ليس لديك تصريح بالوصول إلى وحدة المراقبة أو لم تُحدد الشركة في الجلسة.' :
        status === 404 ? 'واجهة المراقبة غير متاحة على الخادم حاليًا؛ لا يمكن حفظ البيانات.' :
        'تعذّر الاتصال بخدمة المراقبة. لا يُعتبر عدم ظهور البيانات دليلًا على عدم وجودها.');
    } finally { setLoading(false); }
  }, []);
  useEffect(() => { void refresh(); }, [refresh]);

  const run = async (fn: () => Promise<unknown>) => {
    setBusy(true); setMessage('');
    try { await fn(); await refresh(); setMessage('تم حفظ التغيير في قاعدة البيانات عبر API.'); }
    catch (error: unknown) {
      const status = (error as { response?: { status?: number } })?.response?.status;
      setMessage(status === 403 ? 'تم رفض الإجراء بسبب الصلاحيات.' :
        status === 404 ? 'العنصر غير موجود ضمن شركتك، أو الخدمة غير منشورة.' :
        'لم يثبت حفظ التغيير. تحقق من البيانات واتصال الخدمة.');
    } finally { setBusy(false); }
  };

  return <div dir="rtl" className="space-y-6 text-slate-100">
    <div>
      <h1 className="text-2xl font-bold">SCC380 — المراقبة والكاميرات</h1>
      <p className="mt-2 text-sm text-slate-400">إدارة المواقع والكاميرات والصيانة ضمن الشركة المصرح بها. البث والصوت والتحكم PTZ غير متصلين بأجهزة فعلية في هذه المرحلة.</p>
    </div>
    <div className="flex flex-wrap gap-2" role="navigation" aria-label="أقسام المراقبة">
      {([{id:'sites',name:'المواقع'},{id:'cameras',name:'الكاميرات'},{id:'maintenance',name:'الصيانة والتنظيف'}] as const).map(t=>
        <button key={t.id} type="button" aria-current={tab===t.id?'page':undefined}
          onClick={()=>setTab(t.id)} className={`rounded-lg border px-4 py-2 ${tab===t.id?'bg-blue-700 border-blue-500':'bg-slate-900 border-slate-700'}`}>{t.name}</button>)}
      <button type="button" onClick={()=>void refresh()} disabled={loading} className="rounded-lg border border-slate-600 px-4 py-2 disabled:opacity-50">
        {loading?'جارٍ التحميل...':'تحديث'}</button>
    </div>
    {message && <p role="alert" className="rounded-lg border border-amber-600 p-3 text-amber-200">{message}</p>}
    {tab==='sites' && <section className="space-y-4">
      <h2 className="text-lg font-semibold">مواقع المراقبة</h2>
      <form className="flex flex-wrap gap-2" onSubmit={e=>{ e.preventDefault();void run(async ()=>{
        await api.post('/surveillance/sites',{name:siteName,city:siteCity||undefined});
        setSiteName('');setSiteCity('');
      });}}>
        <input required maxLength={120} aria-label="اسم الموقع" placeholder="اسم الموقع" value={siteName} onChange={e=>setSiteName(e.target.value)}
          className="rounded-lg border border-slate-600 bg-slate-900 p-2"/>
        <input maxLength={120} aria-label="المدينة" placeholder="المدينة" value={siteCity} onChange={e=>setSiteCity(e.target.value)}
          className="rounded-lg border border-slate-600 bg-slate-900 p-2"/>
        <button disabled={busy||loading} className="rounded-lg bg-blue-700 px-4 py-2 disabled:opacity-50">إضافة موقع</button>
      </form>
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {sites.map(s=><article key={s.id} className="rounded-lg border border-slate-700 bg-slate-900 p-4">
          <h3 className="font-semibold">{s.name}</h3><p className="text-sm text-slate-400">{s.city||'مدينة غير محددة'} — {s.siteType}</p>
          <p className="mt-2 text-sm">كاميرات الموقع: {s._count?.cameras ?? 'غير متاح'}</p></article>)}
      </div>
      {!loading&&sites.length===0&&!message&&<p>لا توجد مواقع مسجلة.</p>}
    </section>}
    {tab==='cameras' && <section className="space-y-4">
      <h2 className="text-lg font-semibold">سجل الكاميرات</h2>
      <form className="space-y-3 rounded-lg border border-slate-700 bg-slate-900 p-4" onSubmit={e=>{e.preventDefault(); void run(async ()=>{
        await api.post('/surveillance/cameras',{siteId:cameraSiteId,name:cameraName,manufacturer:manufacturer||undefined,...cameraCapabilities});
        setCameraName('');setManufacturer('');
      });}}>
        <div className="flex flex-wrap gap-2">
          <select required aria-label="موقع الكاميرا" value={cameraSiteId} onChange={e=>setCameraSiteId(e.target.value)}
            className="rounded-lg border border-slate-600 bg-slate-950 p-2"><option value="">اختر الموقع</option>
            {sites.map(s=><option value={s.id} key={s.id}>{s.name}</option>)}</select>
          <input required aria-label="اسم الكاميرا" maxLength={120} value={cameraName} onChange={e=>setCameraName(e.target.value)}
            className="rounded-lg border border-slate-600 bg-slate-950 p-2" placeholder="اسم الكاميرا"/>
          <input aria-label="الشركة المصنعة" maxLength={120} value={manufacturer} onChange={e=>setManufacturer(e.target.value)}
            className="rounded-lg border border-slate-600 bg-slate-950 p-2" placeholder="الشركة المصنعة"/>
        </div>
        <p className="text-xs text-amber-200">حدد قدرات الجهاز وفق مواصفاته. هذه التصنيفات لا تمثل اختبار اتصال فعليًا.</p>
        <div className="flex flex-wrap gap-3 text-sm">
          {([{k:'supportsAudio',n:'استماع'},{k:'supportsTalk',n:'تحدث'},{k:'supportsPtz',n:'PTZ / زوم'},{k:'supportsWiper',n:'مسّاحة'}] as const).map(c=>
            <label key={c.k} className="flex items-center gap-2"><input type="checkbox" checked={cameraCapabilities[c.k]}
              onChange={e=>setCameraCapabilities(v=>({...v,[c.k]:e.target.checked,...(c.k==='supportsAudio'&&!e.target.checked?{supportsTalk:false}:{}) ,...(c.k==='supportsTalk'&&e.target.checked?{supportsAudio:true}:{})}))}/>
              {c.n}</label>)}
        </div>
        <button disabled={busy||loading||!sites.length} className="rounded-lg bg-blue-700 px-4 py-2 disabled:opacity-50">تسجيل كاميرا</button>
      </form>
      <div className="overflow-x-auto"><table className="w-full min-w-[620px] text-right text-sm">
        <thead><tr className="border-b border-slate-700"><th className="p-3">الكاميرا</th><th className="p-3">الموقع</th><th className="p-3">الصانع</th><th className="p-3">الإمكانات المسجلة</th><th className="p-3">حالة الاتصال</th></tr></thead>
        <tbody>{cameras.map(c=><tr key={c.id} className="border-b border-slate-800">
          <td className="p-3">{c.name}</td><td className="p-3">{c.site?.name||'غير متاح'}</td>
          <td className="p-3">{c.manufacturer||'غير متاح'}</td>
          <td className="p-3">{[c.supportsAudio?'صوت':null,c.supportsTalk?'تحدث':null,c.supportsPtz?'PTZ':null,c.supportsWiper?'مسّاحة':null].filter(Boolean).join('، ')||'غير محددة'}</td>
          <td className="p-3">{c.connectionStatus==='UNCONFIGURED'?'لم يُربط جهاز فعلي':c.connectionStatus}</td>
        </tr>)}</tbody></table></div>
      {!loading&&cameras.length===0&&!message&&<p>لا توجد كاميرات مسجلة.</p>}
    </section>}
    {tab==='maintenance' && <section className="space-y-4">
      <h2 className="text-lg font-semibold">أوامر صيانة وتنظيف الكاميرات</h2>
      <form className="flex flex-wrap gap-2" onSubmit={e=>{e.preventDefault();void run(async ()=>{
        await api.post('/surveillance/maintenance',{cameraId:maintenanceCameraId,taskType,description:description||undefined});
        setDescription('');
      });}}>
        <select required aria-label="كاميرا الصيانة" value={maintenanceCameraId} onChange={e=>setMaintenanceCameraId(e.target.value)}
          className="rounded-lg border border-slate-600 bg-slate-900 p-2"><option value="">اختر الكاميرا</option>
          {cameras.map(c=><option key={c.id} value={c.id}>{c.name} — {c.site?.name}</option>)}</select>
        <select aria-label="نوع الصيانة" value={taskType} onChange={e=>setTaskType(e.target.value)}
          className="rounded-lg border border-slate-600 bg-slate-900 p-2">
          {tasks.map(([k,n])=><option key={k} value={k}>{n}</option>)}</select>
        <input maxLength={1000} aria-label="تفاصيل المهمة" placeholder="تفاصيل المهمة" value={description} onChange={e=>setDescription(e.target.value)}
          className="rounded-lg border border-slate-600 bg-slate-900 p-2"/>
        <button disabled={busy||loading||!cameras.length} className="rounded-lg bg-blue-700 px-4 py-2 disabled:opacity-50">إنشاء مهمة</button>
      </form>
      <div className="space-y-2">{maintenance.map(m=><article key={m.id} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-slate-700 bg-slate-900 p-4">
        <div><h3 className="font-semibold">{tasks.find(t=>t[0]===m.taskType)?.[1]||m.taskType}</h3>
          <p className="text-sm text-slate-400">{m.camera?.name} — {m.camera?.site?.name} — {m.status}</p></div>
        {m.status==='OPEN'||m.status==='IN_PROGRESS'?
          <div className="flex gap-2">
            {m.status==='OPEN'&&<button disabled={busy} type="button" className="rounded-lg border border-blue-500 px-3 py-2"
              onClick={()=>void run(()=>api.patch('/surveillance/maintenance/'+encodeURIComponent(m.id),{status:'IN_PROGRESS'}))}>بدء العمل</button>}
            <button disabled={busy} type="button" className="rounded-lg border border-emerald-500 px-3 py-2"
              onClick={()=>void run(()=>api.patch('/surveillance/maintenance/'+encodeURIComponent(m.id),{status:'COMPLETED'}))}>اعتماد الإنجاز</button>
          </div>:null}
      </article>)}</div>
      {!loading&&maintenance.length===0&&!message&&<p>لا توجد مهام صيانة.</p>}
    </section>}
  </div>;
}
