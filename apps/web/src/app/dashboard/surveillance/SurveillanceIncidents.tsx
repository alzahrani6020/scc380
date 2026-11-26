'use client';

import { useCallback, useEffect, useState } from 'react';
import api from '@/lib/api';

type Camera = { id: string; name: string; site?: { name: string } };
type Incident = {
  id: string; cameraId: string; title: string; description?: string | null;
  severity: string; status: string; occurredAt: string; resolution?: string | null;
  camera: { name: string; site: { name: string } };
};
type Props = { cameras: Camera[] };

export default function SurveillanceIncidents({ cameras }: Props) {
  const [items, setItems] = useState<Incident[]>([]);
  const [cameraId, setCameraId] = useState('');
  const [title, setTitle] = useState('');
  const [severity, setSeverity] = useState('MEDIUM');
  const [description, setDescription] = useState('');
  const [resolution, setResolution] = useState<Record<string,string>>({});
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const result=await api.get<Incident[]>('/surveillance/incidents');
      if (!Array.isArray(result.data)) throw new Error('Unexpected incident response');
      setItems(result.data);
      setError('');
    } catch {
      setError('تعذر جلب الحوادث. لم يتم افتراض أن القائمة فارغة.');
    } finally { setLoading(false); }
  }, []);
  useEffect(()=>{void refresh();},[refresh]);

  const submit = async () => {
    setBusy(true); setError('');
    try {
      await api.post('/surveillance/incidents',{cameraId,title,severity,description:description||undefined});
      setTitle('');setDescription('');
      await refresh();
    } catch {
      setError('لم يثبت إنشاء البلاغ. تحقق من الصلاحيات والبيانات.');
    } finally {setBusy(false);}
  };
  const decide = async (id:string,status:'ACKNOWLEDGED'|'RESOLVED') => {
    setBusy(true);setError('');
    try {
      if(status==='RESOLVED'&&!resolution[id]?.trim()) {
        setError('اكتب نتيجة المعالجة قبل إغلاق البلاغ.');
        return;
      }
      await api.patch('/surveillance/incidents/'+encodeURIComponent(id),
        {status,...(status==='RESOLVED'?{resolution:resolution[id].trim()}:{})});
      await refresh();
    } catch {setError('تعذر تحديث البلاغ. ربما أُغلق أو لم تعد لديك صلاحية.');}
    finally {setBusy(false);}
  };

  return <section className="space-y-4">
    <div className="flex flex-wrap items-center justify-between gap-2">
      <h2 className="text-lg font-semibold">الحوادث الأمنية المرتبطة بالكاميرات</h2>
      <button type="button" onClick={()=>void refresh()} disabled={loading}
        className="rounded-lg border border-slate-600 px-3 py-2 disabled:opacity-50">تحديث البلاغات</button>
    </div>
    <p className="text-xs text-slate-400">بلاغات بشرية موثقة. لم يُربط اكتشاف تلقائي أو تحليل ذكاء اصطناعي بالكاميرات.</p>
    <form className="grid gap-2 rounded-lg border border-slate-700 bg-slate-900 p-4 sm:grid-cols-2" onSubmit={e=>{e.preventDefault();void submit();}}>
      <select required aria-label="كاميرا الحدث" value={cameraId} onChange={e=>setCameraId(e.target.value)}
        className="rounded-lg border border-slate-600 bg-slate-950 p-2">
        <option value="">الكاميرا المعنية</option>
        {cameras.map(c=><option key={c.id} value={c.id}>{c.name} — {c.site?.name}</option>)}
      </select>
      <select aria-label="خطورة الحادث" value={severity} onChange={e=>setSeverity(e.target.value)}
        className="rounded-lg border border-slate-600 bg-slate-950 p-2">
        <option value="LOW">منخفض</option><option value="MEDIUM">متوسط</option>
        <option value="HIGH">مرتفع</option><option value="CRITICAL">حرج</option>
      </select>
      <input required maxLength={200} aria-label="عنوان البلاغ" placeholder="عنوان البلاغ"
        value={title} onChange={e=>setTitle(e.target.value)}
        className="rounded-lg border border-slate-600 bg-slate-950 p-2 sm:col-span-2"/>
      <textarea maxLength={2000} aria-label="وصف البلاغ" placeholder="الوقائع والتفاصيل"
        value={description} onChange={e=>setDescription(e.target.value)}
        className="rounded-lg border border-slate-600 bg-slate-950 p-2 sm:col-span-2"/>
      <button className="rounded-lg bg-blue-700 px-4 py-2 disabled:opacity-50" disabled={busy||!cameras.length}>تسجيل البلاغ</button>
    </form>
    {error&&<p role="alert" className="rounded-lg border border-amber-700 p-3 text-amber-200">{error}</p>}
    {loading&&<p>جارٍ تحميل البلاغات...</p>}
    <div className="space-y-3">
      {items.map(item=><article key={item.id} className="space-y-3 rounded-lg border border-slate-700 bg-slate-900 p-4">
        <div className="flex flex-wrap justify-between gap-2">
          <div><h3 className="font-semibold">{item.title}</h3>
            <p className="text-sm text-slate-400">{item.camera?.site?.name} — {item.camera?.name}</p>
          </div>
          <div className="text-sm">{item.severity} — {item.status}</div>
        </div>
        {item.description&&<p className="whitespace-pre-line text-sm">{item.description}</p>}
        {item.status==='RESOLVED'?<p className="text-sm text-emerald-300">نتيجة الإغلاق: {item.resolution}</p>:<div className="flex flex-wrap gap-2">
          {item.status==='OPEN'&&<button type="button" disabled={busy}
            onClick={()=>void decide(item.id,'ACKNOWLEDGED')}
            className="rounded-lg border border-blue-500 px-3 py-2">استلام البلاغ</button>}
          <input maxLength={2000} aria-label={'نتيجة معالجة '+item.title} placeholder="نتيجة المعالجة المطلوبة للإغلاق"
            value={resolution[item.id]||''} onChange={e=>setResolution(v=>({...v,[item.id]:e.target.value}))}
            className="min-w-56 flex-1 rounded-lg border border-slate-600 bg-slate-950 p-2"/>
          <button type="button" disabled={busy||!resolution[item.id]?.trim()}
            onClick={()=>void decide(item.id,'RESOLVED')}
            className="rounded-lg border border-emerald-500 px-3 py-2 disabled:opacity-50">إغلاق البلاغ</button>
        </div>}
      </article>)}
    </div>
    {!loading&&!error&&items.length===0&&<p className="text-slate-400">لا توجد بلاغات مسجلة.</p>}
  </section>;
}
