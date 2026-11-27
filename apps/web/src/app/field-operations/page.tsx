'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import api from '@/lib/api';

type Site = { id: string; name: string; city: string | null; siteType: string;
  branchId: string | null; _count: { cameras: number } };
type Camera = { id: string; siteId: string; name: string; cameraType: string;
  connectionStatus: string; effectiveConnectionStatus: string;
  lastSeenAt: string | null; connectorType: string; vehicleId: string | null;
  supportsAudio: boolean; supportsTalk: boolean; supportsPtz: boolean;
  supportsWiper: boolean; site: { name: string } };
type Gateway = { id: string; siteId: string; name: string;
  connectionState: string; lastSeenAt: string | null };
type Incident = { id: string; cameraId: string; title: string; severity: string;
  status: string; description: string | null; occurredAt: string;
  resolution: string | null; camera: { name: string; site: { name: string } } };
type Maintenance = { id: string; cameraId: string; taskType: string; status: string;
  description: string | null; createdAt: string; camera: { name: string;
    site: { name: string } } };

export default function FieldOperationsCenterPage() {
  const [sites, setSites] = useState<Site[]>([]);
  const [cameras, setCameras] = useState<Camera[]>([]);
  const [gateways, setGateways] = useState<Gateway[]>([]);
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [maintenance, setMaintenance] = useState<Maintenance[]>([]);
  const [siteFilter, setSiteFilter] = useState('');
  const [cameraId, setCameraId] = useState('');
  const [issueTitle, setIssueTitle] = useState('');
  const [issueDescription, setIssueDescription] = useState('');
  const [issueSeverity, setIssueSeverity] = useState('MEDIUM');
  const [taskType, setTaskType] = useState('CLEANING');
  const [taskDescription, setTaskDescription] = useState('');
  const [busy, setBusy] = useState(false);
  const [incidentResolutions, setIncidentResolutions] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [resultMessage, setResultMessage] = useState('');
  const [tab, setTab] = useState<'cameras' | 'incidents' | 'maintenance'>('cameras');

  const refresh = useCallback(async () => {
    setError('');
    try {
      const [s, c, g, i, m] = await Promise.all([
        api.get<Site[]>('/surveillance/sites'),
        api.get<Camera[]>('/surveillance/cameras'),
        api.get<Gateway[]>('/surveillance/gateways'),
        api.get<Incident[]>('/surveillance/incidents'),
        api.get<Maintenance[]>('/surveillance/maintenance'),
      ]);
      setSites(s.data); setCameras(c.data); setGateways(g.data);
      setIncidents(i.data); setMaintenance(m.data);
    } catch (err: any) {
      setError(err.response?.status === 403
        ? 'ليس لهذا الحساب تصريح بمتابعة كاميرات هذه الشركة.'
        : 'تعذر قراءة بيانات مواقع الشركة؛ تحقق من تسجيل الدخول واتصال API.');
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { void refresh(); }, [refresh]);
  const displayed = useMemo(() =>
    cameras.filter(c => !siteFilter || c.siteId === siteFilter), [cameras, siteFilter]);
  const selectedCamera = cameras.find(c => c.id === cameraId);

  const createIncident = async () => {
    if (!cameraId || !issueTitle.trim() || busy) return;
    setBusy(true); setError(''); setResultMessage('');
    try {
      await api.post('/surveillance/incidents', {
        cameraId, title: issueTitle.trim(), severity: issueSeverity,
        description: issueDescription.trim() || undefined,
      });
      setIssueTitle(''); setIssueDescription('');
      setResultMessage('سُجل بلاغ حادثة الشركة. لم يُرسل أي أمر فعلي إلى الكاميرا.');
      await refresh();
    } catch (err: any) {
      setError(err.response?.data?.message || 'تعذر تسجيل الحادثة.');
    } finally { setBusy(false); }
  };

  const createMaintenance = async () => {
    if (!cameraId || busy) return;
    setBusy(true); setError(''); setResultMessage('');
    try {
      await api.post('/surveillance/maintenance', {
        cameraId, taskType, description: taskDescription.trim() || undefined,
      });
      setTaskDescription('');
      setResultMessage('حُفظ طلب الصيانة للكاميرا؛ التنفيذ الفعلي يتطلب فريق الموقع.');
      await refresh();
    } catch (err: any) {
      setError(err.response?.data?.message || 'تعذر تسجيل طلب الصيانة.');
    } finally { setBusy(false); }
  };

  const updateIncident = async (id: string, action: 'ACKNOWLEDGED' | 'RESOLVED') => {
    if (busy) return;
    const resolution = (incidentResolutions[id] || '').trim();
    if (action === 'RESOLVED' && !resolution) {
      setError('يلزم كتابة إجراء المعالجة قبل إغلاق الحادثة.');
      return;
    }
    if (action === 'RESOLVED' &&
        !window.confirm('هل تؤكد إغلاق الحادثة بعد مراجعة إجراء المعالجة؟')) return;
    setBusy(true); setError(''); setResultMessage('');
    try {
      await api.patch('/surveillance/incidents/' + encodeURIComponent(id), {
        status: action, ...(action === 'RESOLVED' ? { resolution } : {}),
      });
      setResultMessage(action === 'RESOLVED'
        ? 'حُفظ قرار إغلاق الحادثة ومبررات المعالجة.'
        : 'حُفظ استلام الحادثة للمتابعة.');
      setIncidentResolutions(current => ({ ...current, [id]: '' }));
      await refresh();
    } catch (err: any) {
      setError(err.response?.data?.message || 'تعذر حفظ قرار الحادثة.');
    } finally { setBusy(false); }
  };

  const closeMaintenance = async (id: string) => {
    if (busy || !window.confirm('تأكيد إتمام مهمة الصيانة بعد التحقق الميداني؟')) return;
    setBusy(true); setError(''); setResultMessage('');
    try {
      await api.patch('/surveillance/maintenance/' + encodeURIComponent(id), { status: 'COMPLETED' });
      setResultMessage('حُفظ إتمام مهمة الصيانة بناءً على تأكيد المسؤول.');
      await refresh();
    } catch (err: any) {
      setError(err.response?.data?.message || 'تعذر تغيير حالة المهمة.');
    } finally { setBusy(false); }
  };

  return (
    <main dir="rtl" className="mx-auto max-w-7xl space-y-5 p-4 text-slate-100 md:p-8">
      <header className="space-y-2">
        <Link href="/dashboard" className="text-sm text-sky-300 hover:underline">العودة إلى لوحة التحكم</Link>
        <h1 className="text-2xl font-bold">SCC380 — مركز العمليات والكاميرات</h1>
        <p className="text-sm text-slate-300">متابعة كاميرات الشركات وفروعها ومركباتها، وبلاغات الحوادث وصيانة الأجهزة، وفق صلاحيات الشركة الحالية.</p>
        <p className="text-xs text-amber-300">حالة الاتصال تستند إلى تقارير البوابة؛ لا تعني أن الفيديو قابل للتشغيل أو أن وظائف PTZ والصوت تم اختبارها.</p>
      </header>
      <div className="flex flex-wrap gap-2">
        <Link href="/field-devices" className="rounded-lg border border-slate-600 px-4 py-2 text-sm">إدارة جوالات الشركة</Link>
        <button type="button" onClick={() => void refresh()} disabled={busy}
          className="rounded-lg border border-slate-600 px-4 py-2 text-sm disabled:opacity-50">تحديث البيانات</button>
      </div>

      {error && <div role="alert" className="rounded-lg border border-red-700 bg-red-950 p-4">{error}</div>}
      {resultMessage && <div role="status" className="rounded-lg border border-green-700 bg-green-950 p-4">{resultMessage}</div>}
      {loading && <p role="status">جار تحميل بيانات مواقع الشركة...</p>}

      <section aria-label="ملخص الكاميرات" className="grid grid-cols-2 gap-3 md:grid-cols-5">
        {([
          ['المواقع', sites.length],
          ['الكاميرات', cameras.length],
          ['بوابات متصلة', gateways.filter(g => g.connectionState === 'CONNECTED').length],
          ['بلاغات مفتوحة', incidents.filter(i => i.status !== 'RESOLVED').length],
          ['مهام صيانة مفتوحة', maintenance.filter(m => !['COMPLETED', 'CANCELLED'].includes(m.status)).length],
        ] as const).map(([label, value]) => (
          <div key={label} className="rounded-xl border border-slate-700 bg-slate-900 p-4">
            <p className="text-xs text-slate-300">{label}</p>
            <p className="mt-1 text-xl font-semibold">{value}</p>
          </div>
        ))}
      </section>

      <section className="rounded-xl border border-slate-700 bg-slate-900 p-5">
        <h2 className="mb-3 font-semibold">البوابات الميدانية</h2>
        {gateways.length === 0 ? <p className="text-sm text-slate-400">لم تُسجل بوابات اتصال بهذه الشركة.</p> :
          <ul className="grid grid-cols-1 gap-3 md:grid-cols-3">
            {gateways.map(g => <li key={g.id} className="rounded-lg border border-slate-700 p-3">
              <p className="font-medium">{g.name}</p>
              <p className="text-sm text-slate-300">{g.connectionState}</p>
              <p className="text-xs text-slate-400">{g.lastSeenAt ? 'آخر إشارة: ' + new Date(g.lastSeenAt).toLocaleString('ar-SA') : 'لا توجد إشارة مثبتة'}</p>
            </li>)}
          </ul>}
      </section>

      <section className="space-y-4">
        <div className="flex flex-wrap gap-2" role="tablist" aria-label="وحدات العمليات">
          {([
            ['cameras', 'الكاميرات والفروع'],
            ['incidents', 'بلاغات الحوادث'],
            ['maintenance', 'الصيانة والتنظيف'],
          ] as const).map(([value, label]) => (
            <button key={value} role="tab" aria-selected={tab === value} onClick={() => setTab(value)}
              className={'rounded-lg border px-4 py-2 text-sm ' + (tab === value ? 'border-sky-500 bg-sky-950' : 'border-slate-600')}>
              {label}
            </button>
          ))}
        </div>

        {tab === 'cameras' && <section className="space-y-4">
          <label className="block text-sm">تصفية حسب الفرع أو الموقع
            <select value={siteFilter} onChange={e => setSiteFilter(e.target.value)}
              className="mt-1 block w-full max-w-md rounded-lg border border-slate-600 bg-slate-900 p-3">
              <option value="">كل مواقع الشركة</option>
              {sites.map(site => <option key={site.id} value={site.id}>{site.name} — {site.siteType}</option>)}
            </select>
          </label>
          {displayed.length === 0 && <p className="text-sm text-slate-300">لا توجد كاميرات مسجلة لهذا الاختيار.</p>}
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
            {displayed.map(camera => <article key={camera.id} className="space-y-2 rounded-xl border border-slate-700 bg-slate-900 p-4">
              <h3 className="font-semibold">{camera.name}</h3>
              <p className="text-sm text-slate-300">{camera.site.name} — {camera.cameraType}</p>
              <p className="text-sm">حالة الاتصال: <strong>{camera.effectiveConnectionStatus}</strong></p>
              <p className="text-xs text-slate-400">{camera.lastSeenAt ?
                'آخر إشارة: ' + new Date(camera.lastSeenAt).toLocaleString('ar-SA') :
                'لم يُتحقق من اتصال هذه الكاميرا'}</p>
              <div className="flex flex-wrap gap-2 text-xs text-slate-300">
                {camera.supportsAudio && <span>ميكروفون معلن الإمكانية</span>}
                {camera.supportsTalk && <span>تحدث ثنائي مدعوم نظريًا</span>}
                {camera.supportsPtz && <span>PTZ معلن الإمكانية</span>}
                {camera.supportsWiper && <span>ماسحة عدسة مدعومة نظريًا</span>}
              </div>
              <p className="rounded-lg border border-slate-600 bg-slate-950 p-2 text-xs text-amber-300">
                لا يوجد مشغل بث موثّق لهذه الكاميرا في المركز الحالي.
              </p>
              <button type="button" onClick={() => { setCameraId(camera.id); setTab('incidents'); }}
                className="rounded-lg border border-slate-500 px-3 py-2 text-xs">تسجيل حادثة لهذه الكاميرا</button>
            </article>)}
          </div>
        </section>}

        {tab === 'incidents' && <section className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          <div className="space-y-3 rounded-xl border border-slate-700 bg-slate-900 p-4">
            <h2 className="font-semibold">تسجيل حادثة تشغيلية</h2>
            <label className="block text-sm">الكاميرا
              <select value={cameraId} onChange={e => setCameraId(e.target.value)} className="mt-1 w-full rounded-lg bg-slate-800 p-2">
                <option value="">اختر الكاميرا</option>
                {cameras.map(c => <option value={c.id} key={c.id}>{c.name} — {c.site.name}</option>)}
              </select>
            </label>
            <label className="block text-sm">عنوان الحادثة
              <input value={issueTitle} maxLength={200} onChange={e => setIssueTitle(e.target.value)}
                className="mt-1 w-full rounded-lg bg-slate-800 p-2" />
            </label>
            <label className="block text-sm">الخطورة
              <select value={issueSeverity} onChange={e => setIssueSeverity(e.target.value)} className="mt-1 w-full rounded-lg bg-slate-800 p-2">
                <option value="LOW">منخفضة</option><option value="MEDIUM">متوسطة</option>
                <option value="HIGH">مرتفعة</option><option value="CRITICAL">حرجة</option>
              </select>
            </label>
            <label className="block text-sm">التفاصيل
              <textarea value={issueDescription} maxLength={2000} onChange={e => setIssueDescription(e.target.value)}
                className="mt-1 w-full rounded-lg bg-slate-800 p-2" rows={3} />
            </label>
            <button disabled={busy || !cameraId || !issueTitle.trim()} onClick={() => void createIncident()}
              className="rounded-lg bg-sky-600 px-4 py-2 disabled:opacity-50">حفظ الحادثة</button>
          </div>
          <div className="space-y-2 lg:col-span-2">
            <h2 className="font-semibold">الحوادث المسجلة</h2>
            {incidents.map(i => <article key={i.id} className="rounded-lg border border-slate-700 bg-slate-900 p-3">
              <p className="font-semibold">{i.title}</p>
              <p className="text-sm text-slate-300">{i.camera.name} — {i.camera.site.name}</p>
              <p className="text-xs text-slate-400">الخطورة: {i.severity} — الحالة: {i.status} — {new Date(i.occurredAt).toLocaleString('ar-SA')}</p>
              {i.resolution && <p className="mt-2 text-sm">{i.resolution}</p>}
              {i.status === 'OPEN' && (
                <button type="button" disabled={busy} onClick={() => void updateIncident(i.id, 'ACKNOWLEDGED')}
                  className="mt-2 rounded border border-slate-500 px-3 py-1 text-xs disabled:opacity-50">استلام البلاغ للمتابعة</button>
              )}
              {['OPEN', 'ACKNOWLEDGED'].includes(i.status) && (
                <div className="mt-2 space-y-2">
                  <label className="block text-xs">نتيجة المعالجة
                    <textarea rows={2} value={incidentResolutions[i.id] || ''} maxLength={2000}
                      onChange={e => setIncidentResolutions(v => ({ ...v, [i.id]: e.target.value }))}
                      className="mt-1 w-full rounded-lg bg-slate-800 p-2" />
                  </label>
                  <button type="button" disabled={busy || !(incidentResolutions[i.id] || '').trim()}
                    onClick={() => void updateIncident(i.id, 'RESOLVED')}
                    className="rounded border border-amber-700 px-3 py-1 text-xs disabled:opacity-50">إغلاق الحادثة بعد التحقق</button>
                </div>
              )}
            </article>)}
            {incidents.length === 0 && <p className="text-sm text-slate-300">لا توجد حوادث مسجلة.</p>}
          </div>
        </section>}

        {tab === 'maintenance' && <section className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          <div className="space-y-3 rounded-xl border border-slate-700 bg-slate-900 p-4">
            <h2 className="font-semibold">طلب صيانة أو تنظيف</h2>
            <label className="block text-sm">الكاميرا
              <select value={cameraId} onChange={e => setCameraId(e.target.value)} className="mt-1 w-full rounded-lg bg-slate-800 p-2">
                <option value="">اختر الكاميرا</option>
                {cameras.map(c => <option key={c.id} value={c.id}>{c.name} — {c.site.name}</option>)}
              </select>
            </label>
            <label className="block text-sm">الإجراء
              <select value={taskType} onChange={e => setTaskType(e.target.value)} className="mt-1 w-full rounded-lg bg-slate-800 p-2">
                <option value="CLEANING">تنظيف</option>
                <option value="LENS_CHECK">فحص العدسة</option>
                <option value="PTZ_CHECK">فحص حركة PTZ</option>
                <option value="RECORDING_CHECK">فحص التسجيل</option>
                <option value="REPAIR">إصلاح</option>
              </select>
            </label>
            <label className="block text-sm">ملاحظات
              <textarea value={taskDescription} maxLength={1000} onChange={e => setTaskDescription(e.target.value)}
                className="mt-1 w-full rounded-lg bg-slate-800 p-2" rows={3}/>
            </label>
            {selectedCamera && <p className="text-xs text-slate-300">الجهاز المختار: {selectedCamera.name}</p>}
            <button disabled={busy || !cameraId} onClick={() => void createMaintenance()}
              className="rounded-lg bg-sky-600 px-4 py-2 disabled:opacity-50">إضافة مهمة صيانة</button>
          </div>
          <div className="space-y-2 lg:col-span-2">
            <h2 className="font-semibold">مهام الصيانة</h2>
            {maintenance.map(task => <article key={task.id} className="rounded-lg border border-slate-700 bg-slate-900 p-3">
              <p className="font-semibold">{task.camera.name} — {task.taskType}</p>
              <p className="text-sm text-slate-300">{task.camera.site.name} — الحالة: {task.status}</p>
              {task.description && <p className="text-sm">{task.description}</p>}
              {!['COMPLETED', 'CANCELLED'].includes(task.status) &&
                <button disabled={busy} onClick={() => void closeMaintenance(task.id)}
                  className="mt-2 rounded-lg border border-slate-500 px-3 py-1 text-xs disabled:opacity-50">تأكيد إتمام الصيانة</button>}
            </article>)}
            {maintenance.length === 0 && <p className="text-sm text-slate-300">لا توجد مهام صيانة مسجلة.</p>}
          </div>
        </section>}
      </section>
    </main>
  );
}
