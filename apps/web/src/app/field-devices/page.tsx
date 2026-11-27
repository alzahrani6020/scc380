'use client';

import { FormEvent, useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import api from '@/lib/api';
import { QRCodeSVG } from 'qrcode.react';

type Device = {
  id: string;
  assetTag: string;
  platform: string;
  managementState: string;
  provider: string;
  employeeId: string | null;
  branchId: string | null;
  lastSeenAt: string | null;
};
type OperationsSummary = {
  asOf: string;
  alerts: { kind: string; resourceId: string; siteId: string | null;
    severity: string; lastSeenAt: string | null; message: string }[];
  sites: { id: string; name: string; branchId: string | null; siteType: string;
    cameras: number; freshOnline: number; connectedGateways: number }[];
  cameraCoverage: { total: number; freshOnline: number; degraded: number;
    staleOrOffline: number; sites: number; gateways: number;
    connectedGateways: number; vehicleCameras: number; ptzCapable: number;
    audioCapable: number; talkCapable: number };
  fieldDevices: { total: number; android: number; ios: number;
    managedRecords: number; recentlyReported: number; unconfigured: number };
  workflow: { openIncidents: number; pendingMaintenance: number;
    unconfirmedCommands: number };
  acceptance: { playableStreamsVerified: boolean; liveDeviceControlVerified: boolean;
    gpsIngestionVerified: boolean; liveMediaSessionVerified: boolean };
};
type DeviceCommand = {
  id: string;
  action: string;
  status: string;
  reason: string;
  requestedById: string;
  approvedById: string | null;
  createdAt: string;
};
type Capabilities = {
  status: string;
  enrollment: { android: string; ios: string };
  location: string;
  commands: string;
  corporateMessaging: string;
  media: string;
};

export default function FieldDeviceCommandCenter() {
  const [devices, setDevices] = useState<Device[]>([]);
  const [operations, setOperations] = useState<OperationsSummary | null>(null);
  const [operationsError, setOperationsError] = useState('');
  const [capabilities, setCapabilities] = useState<Capabilities | null>(null);
  const [assetTag, setAssetTag] = useState('');
  const [platform, setPlatform] = useState<'ANDROID' | 'IOS'>('ANDROID');
  const [selected, setSelected] = useState<Device | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [androidReady, setAndroidReady] = useState(false);
  const [enrollment, setEnrollment] = useState<{deviceId: string; enrollmentQrData: string; expiresAt: string} | null>(null);
  const [enrolling, setEnrolling] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [deviceCommands, setDeviceCommands] = useState<DeviceCommand[]>([]);
  const [commandReason, setCommandReason] = useState('');
  const [commandBusy, setCommandBusy] = useState(false);

  const reload = useCallback(async () => {
    setError('');
    try {
      const [inventory, readiness] = await Promise.all([
        api.get<Device[]>('/field-device-inventory'),
        api.get<Capabilities>('/field-devices/capabilities'),
      ]);
      setDevices(inventory.data);
      try {
        const response = await api.get<OperationsSummary>('/field-operations/overview');
        setOperations(response.data);
        setOperationsError('');
      } catch {
        setOperations(null);
        setOperationsError('تعذر تحميل المؤشرات التشغيلية. لم يتم افتراض أن أي كاميرا أو جهاز متصل.');
      }
      setCapabilities(readiness.data);
      try {
        const connection = await api.get<{status: string}>('/field-devices/android/connection');
        setAndroidReady(connection.data.status === 'PROVIDER_VERIFIED');
      } catch { setAndroidReady(false); }
    } catch (err: any) {
      setError(err.response?.status === 403 ? 'ليست لديك صلاحية الوصول إلى أجهزة هذه الشركة' :
        'تعذر تحميل سجل الأجهزة. تحقق من الاتصال وصلاحيات الحساب وترحيل قاعدة البيانات.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void reload(); }, [reload]);

  const register = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!assetTag.trim() || saving) return;
    setSaving(true);
    setError('');
    setNotice('');
    try {
      await api.post('/field-device-inventory', { assetTag: assetTag.trim(), platform });
      setAssetTag('');
      setNotice('حُفظ سجل أصل الجهاز. لم يُفعّل MDM أو التتبع على الهاتف.');
      await reload();
    } catch (err: any) {
      setError(err.response?.data?.message || 'تعذر حفظ الجهاز. يلزم حساب مدير شركة وقاعدة بيانات مهيأة.');
    } finally {
      setSaving(false);
    }
  };

  const issueEnrollment = async (device: Device) => {
    if (enrolling || !androidReady || device.platform !== 'ANDROID') return;
    setError('');
    setEnrollment(null);
    setEnrolling(true);
    try {
      const response = await api.post<{
        deviceId: string; enrollmentQrData: string; expiresAt: string;
      }>('/field-device-enrollment/' + encodeURIComponent(device.id) + '/android');
      setEnrollment(response.data);
      setNotice('صدر رمز تسجيل مؤقت. لم يتم تسجيل الجهاز بعد؛ أكمل خطوات التهيئة على هاتف الشركة.');
    } catch (err: any) {
      setError(err.response?.data?.message || 'تعذر إصدار رمز التسجيل. تحقق من إعداد Google Android Management API وصلاحيات الشركة.');
    } finally { setEnrolling(false); }
  };

  const verifyEnrollment = async (device: Device) => {
    if (!androidReady || verifying) return;
    setVerifying(true);
    setError('');
    try {
      const result = await api.post<{verified: boolean; managementState: string}>(
        '/field-device-enrollment/' + encodeURIComponent(device.id) + '/android/verify');
      setNotice(result.data.verified
        ? 'تحقق Google من تسجيل الجهاز وإدارته. حالة الجهاز الآن مُدار.'
        : 'لم يتحقق تسجيل الجهاز بعد. أكمل الإعداد على الهاتف ثم أعد الفحص.');
      if (result.data.verified) {
        setEnrollment(null);
        setSelected({ ...device, managementState: 'MANAGED', provider: 'ANDROID_MANAGEMENT_API' });
      }
      await reload();
    } catch (err: any) {
      setError(err.response?.data?.message || 'تعذر التحقق من تسجيل الجهاز لدى Google.');
    } finally { setVerifying(false); }
  };

  const refreshCommands = async (deviceId: string) => {
    try {
      const response = await api.get<DeviceCommand[]>('/field-device-commands/' + encodeURIComponent(deviceId));
      setDeviceCommands(response.data);
    } catch (err: any) {
      setError(err.response?.data?.message || 'تعذر قراءة أوامر الجهاز');
    }
  };

  const requestLock = async (deviceId: string) => {
    if (!commandReason.trim() || commandBusy) return;
    setCommandBusy(true);
    setError('');
    try {
      await api.post('/field-device-commands/' + encodeURIComponent(deviceId), {
        action: 'LOCK', reason: commandReason.trim(),
        idempotencyKey: crypto.randomUUID(),
      });
      setNotice('سُجل طلب القفل، ويلزم اعتماد مدير آخر قبل إرساله إلى Google.');
      setCommandReason('');
      await refreshCommands(deviceId);
    } catch (err: any) {
      setError(err.response?.data?.message || 'تعذر إنشاء طلب قفل الجهاز');
    } finally { setCommandBusy(false); }
  };

  const processLock = async (deviceId: string, commandId: string,
    action: 'approve' | 'lock' | 'verify') => {
    if (commandBusy) return;
    if (action === 'lock' && !window.confirm('هل تؤكد إرسال أمر قفل لهذا الجهاز المؤسسي؟')) return;
    setCommandBusy(true);
    setError('');
    try {
      const route = action === 'approve'
        ? '/field-device-commands/' + encodeURIComponent(deviceId) + '/' + encodeURIComponent(commandId) + '/approve'
        : '/field-device-dispatch/' + encodeURIComponent(deviceId) + '/' + encodeURIComponent(commandId) +
          (action === 'lock' ? '/lock' : '/verify');
      const response = await api.post<{status: string}>(route);
      setNotice(action === 'approve'
        ? 'سُجلت الموافقة، ولم يُرسل الأمر بعد.'
        : 'حالة العملية لدى المزود: ' + response.data.status +
          '. لا تعتبر هذه النتيجة مشاهدة مستقلة لحالة قفل الشاشة.');
      await refreshCommands(deviceId);
    } catch (err: any) {
      setError(err.response?.data?.message ||
        'تعذر تنفيذ العملية. لا تعاود الإرسال عند عدم اليقين قبل مراجعة السجل.');
    } finally { setCommandBusy(false); }
  };

  return (
    <main dir="rtl" className="mx-auto max-w-6xl space-y-6 p-4 text-slate-100 md:p-8">
      <header className="space-y-2">
        <Link href="/dashboard" className="text-sm text-sky-300 hover:underline">العودة إلى لوحة التحكم</Link>
        <Link href="/field-operations" className="mr-3 text-sm text-sky-300 hover:underline">مركز الكاميرات والعمليات الميدانية</Link>
        <h1 className="text-2xl font-semibold">SCC380 | مركز أجهزة الشركة</h1>
        <p className="text-sm text-slate-300">سجل الأجهزة المؤسسية وحالة تهيئة الإدارة. لا تُعرض وظيفة فعلية باعتبارها متصلة ما لم تُثبت جاهزيتها.</p>
      </header>

      {error && <div role="alert" className="rounded-lg border border-red-600 bg-red-950 p-4 text-sm">{error}</div>}
      {notice && <div role="status" className="rounded-lg border border-green-700 bg-green-950 p-4 text-sm">{notice}</div>}

      <section aria-label="العمليات الموحدة" className="space-y-3 rounded-xl border border-slate-700 bg-slate-900 p-5">
        <h2 className="font-semibold">ملخص الشركات والفروع والأجهزة والكاميرات</h2>
        <p className="text-xs text-slate-300">هذه المؤشرات تخص شركتك الحالية فقط؛ حالة الاتصال تستند إلى أحدث نبضات الأجهزة، ولا تثبت إمكانية تشغيل الفيديو أو الصوت.</p>
        {operationsError && <p role="status" className="text-sm text-amber-300">{operationsError}</p>}
        {!operations && !operationsError && <p className="text-sm text-slate-300">جار تحميل المؤشرات...</p>}
        {operations && (
          <>
            <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
              {([
                ['المواقع', operations.cameraCoverage.sites],
                ['الكاميرات المسجلة', operations.cameraCoverage.total],
                ['كاميرات اتصال حديث', operations.cameraCoverage.freshOnline],
                ['كاميرات غير مؤكدة الاتصال', operations.cameraCoverage.staleOrOffline],
                ['بوابات المواقع المتصلة', operations.cameraCoverage.connectedGateways],
                ['كاميرات المركبات', operations.cameraCoverage.vehicleCameras],
                ['الأجهزة المُدارة في السجل', operations.fieldDevices.managedRecords],
                ['أجهزة أرسلت حالة حديثة', operations.fieldDevices.recentlyReported],
                ['حوادث مفتوحة', operations.workflow.openIncidents],
                ['صيانة معلقة', operations.workflow.pendingMaintenance],
                ['أوامر غير محسومة', operations.workflow.unconfirmedCommands],
                ['جوالات تحتاج تهيئة', operations.fieldDevices.unconfigured],
              ] as const).map(([label, count]) => (
                <div key={label} className="rounded-lg border border-slate-700 p-3">
                  <p className="text-xs text-slate-300">{label}</p>
                  <p className="mt-1 text-xl font-semibold">{count}</p>
                </div>
              ))}
            </div>
            <section className="mt-4 space-y-2" aria-label="المواقع والفروع">
              <h3 className="text-sm font-semibold">حالة المواقع والفروع</h3>
              {operations.sites.length === 0 ?
                <p className="text-xs text-slate-400">لا توجد مواقع مسجلة للشركة الحالية.</p> :
                <ul className="grid grid-cols-1 gap-2 md:grid-cols-2">
                  {operations.sites.map(site => (
                    <li key={site.id} className="rounded-lg border border-slate-700 p-3">
                      <p className="text-sm font-semibold">{site.name}</p>
                      <p className="text-xs text-slate-300">النوع: {site.siteType} — الكاميرات: {site.cameras} — اتصال حديث: {site.freshOnline}</p>
                      <p className="text-xs text-slate-300">بوابات نشطة: {site.connectedGateways}</p>
                    </li>
                  ))}
                </ul>
              }
            </section>
            <section className="mt-4 space-y-2" aria-label="تنبيهات الاتصال">
              <h3 className="text-sm font-semibold">تنبيهات انقطاع الأجهزة والبوابات والكاميرات</h3>
              {operations.alerts.length === 0 ? (
                <p className="text-xs text-slate-300">لا توجد انقطاعات مثبتة في البيانات المستلمة. عدم وجود تنبيه لا يثبت صلاحية بث الكاميرات.</p>
              ) : (
                <ul className="space-y-2">
                  {operations.alerts.map((alert, i) => (
                    <li key={alert.kind + alert.resourceId + i}
                      className="rounded-lg border border-amber-800 p-3 text-sm">
                      <strong>{alert.message}</strong>
                      <p className="mt-1 text-xs text-slate-300">النوع: {alert.kind} — المرجع: {alert.resourceId}</p>
                      {alert.lastSeenAt && <p className="text-xs text-slate-400">
                        آخر إشارة: {new Date(alert.lastSeenAt).toLocaleString('ar-SA')}
                      </p>}
                    </li>
                  ))}
                </ul>
              )}
            </section>
            <p className="text-xs text-amber-300">حالات القبول غير المثبتة: تشغيل البث المباشر، التحكم الفعلي بالأجهزة، وصول GPS، وجلسات الصوت/الفيديو الميدانية.</p>
            <p className="text-xs text-slate-400">آخر تجميع للمؤشرات: {new Date(operations.asOf).toLocaleString('ar-SA')}</p>
          </>
        )}
      </section>

      <section aria-label="حالة الخدمات" className="grid grid-cols-1 gap-3 md:grid-cols-4">
        {[
          ['إدارة Android', capabilities?.enrollment.android],
          ['إدارة iPhone', capabilities?.enrollment.ios],
          ['التتبع', capabilities?.location],
          ['الأوامر', capabilities?.commands],
        ].map(([label, state]) => (
          <div key={label} className="rounded-xl border border-slate-700 bg-slate-900 p-4">
            <p className="text-sm text-slate-300">{label}</p>
            <p className="mt-2 text-sm font-semibold text-amber-300">{state === 'NOT_CONFIGURED' ? 'غير مهيأ' : state || 'جار التحقق'}</p>
          </div>
        ))}
      </section>

      <section className="grid grid-cols-1 gap-5 lg:grid-cols-3">
        <form onSubmit={register} className="space-y-4 rounded-xl border border-slate-700 bg-slate-900 p-5 lg:col-span-1">
          <h2 className="font-semibold">إضافة جهاز إلى سجل الشركة</h2>
          <p className="text-xs text-slate-300">هذه الخطوة تنشئ سجل الأصل فقط. تسجيل الجهاز في MDM وإقرار العامل إجراءات مستقلة لاحقة.</p>
          <label className="block text-sm">رقم أصل الجهاز
            <input value={assetTag} onChange={e => setAssetTag(e.target.value)} required maxLength={100}
              className="mt-1 w-full rounded-lg border border-slate-600 bg-slate-800 px-3 py-2 text-white" placeholder="مثال: SCC-DEV-001" />
          </label>
          <label className="block text-sm">النظام
            <select value={platform} onChange={e => setPlatform(e.target.value as 'ANDROID' | 'IOS')}
              className="mt-1 w-full rounded-lg border border-slate-600 bg-slate-800 px-3 py-2 text-white">
              <option value="ANDROID">Android</option>
              <option value="IOS">iPhone (iOS)</option>
            </select>
          </label>
          <button type="submit" disabled={saving || !assetTag.trim()}
            className="w-full rounded-lg bg-sky-600 px-4 py-2 font-medium text-white disabled:cursor-not-allowed disabled:opacity-50">
            {saving ? 'جار حفظ سجل الجهاز...' : 'إضافة الجهاز'}
          </button>
        </form>

        <section aria-label="قائمة الأجهزة" className="rounded-xl border border-slate-700 bg-slate-900 p-5 lg:col-span-2">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="font-semibold">أجهزة الشركة</h2>
            <button onClick={() => void reload()} className="rounded-lg border border-slate-600 px-3 py-1 text-sm">تحديث</button>
          </div>
          {loading ? <p role="status">جار التحميل...</p> : devices.length === 0 ?
            <p className="text-sm text-slate-300">لا توجد أجهزة مسجلة أو لم تتوفر بيانات.</p> :
            <ul className="space-y-2">
              {devices.map(d => <li key={d.id}>
                <button onClick={() => { setSelected(d); setEnrollment(null); setDeviceCommands([]); setCommandReason(''); }} className="flex w-full items-center justify-between rounded-lg border border-slate-700 p-3 text-right hover:bg-slate-800">
                  <span><span className="font-medium">{d.assetTag}</span><span className="mr-3 text-xs text-slate-300">{d.platform}</span></span>
                  <span className="text-xs text-amber-300">{d.managementState === 'UNCONFIGURED' ? 'لم يُربط بـMDM' : d.managementState}</span>
                </button>
              </li>)}
            </ul>}
        </section>
      </section>

      {selected && <section aria-label="تفاصيل الجهاز" className="rounded-xl border border-slate-700 bg-slate-900 p-5">
        <div className="flex justify-between"><h2 className="font-semibold">الجهاز: {selected.assetTag}</h2>
          <button className="text-sm text-sky-300" onClick={() => { setSelected(null); setEnrollment(null); }}>إغلاق</button></div>
        <dl className="mt-4 grid grid-cols-1 gap-3 text-sm md:grid-cols-2">
          <div><dt className="text-slate-400">المزود</dt><dd>{selected.provider}</dd></div>
          <div><dt className="text-slate-400">حالة الإدارة</dt><dd>{selected.managementState}</dd></div>
          <div><dt className="text-slate-400">آخر اتصال مثبت</dt><dd>{selected.lastSeenAt || 'لا توجد بيانات جهاز'}</dd></div>
          <div><dt className="text-slate-400">الفرع</dt><dd>{selected.branchId || 'غير مخصص'}</dd></div>
        </dl>
        {selected.platform === 'ANDROID' && (
          <div className="mt-4 space-y-3">
            <button type="button" onClick={() => void issueEnrollment(selected)}
              disabled={!androidReady || enrolling || selected.managementState !== 'UNCONFIGURED'}
              className="rounded-lg bg-sky-600 px-4 py-2 text-white disabled:cursor-not-allowed disabled:opacity-50">
              {enrolling ? 'جار إصدار رمز التسجيل...' : 'إصدار رمز تسجيل Android بضغطة واحدة'}
            </button>
            <button type="button" onClick={() => void verifyEnrollment(selected)}
              disabled={!androidReady || verifying}
              className="mr-2 rounded-lg border border-slate-600 px-4 py-2 text-sm disabled:cursor-not-allowed disabled:opacity-50">
              {verifying ? 'جار التحقق لدى Google...' : 'تحقق من تسجيل الجهاز الفعلي'}
            </button>
            {!androidReady && <p className="text-xs text-amber-300">اتصال Android MDM غير مهيأ أو غير متحقق. لا يمكن إصدار رمز التسجيل.</p>}
            {enrollment?.deviceId === selected.id && (
              <div className="inline-flex flex-col items-center gap-3 rounded-lg bg-white p-4 text-slate-900">
                <QRCodeSVG value={enrollment.enrollmentQrData} size={220} />
                <p className="max-w-xs text-center text-xs">رمز مؤقت أحادي الاستخدام. ينتهي: {new Date(enrollment.expiresAt).toLocaleString('ar-SA')}</p>
                <p className="max-w-xs text-center text-xs">امسح الرمز من خطوات إعداد Android المؤسسي على جهاز الشركة. لا يعد إصدار الرمز إثباتًا لاكتمال التسجيل.</p>
                <button onClick={() => setEnrollment(null)} className="rounded border border-slate-400 px-3 py-1 text-sm">إخفاء الرمز</button>
              </div>
            )}
          </div>
        )}
        {selected.platform === 'ANDROID' && selected.managementState === 'MANAGED' && (
          <section className="mt-5 space-y-3 border-t border-slate-700 pt-4" aria-label="إدارة أوامر القفل">
            <h3 className="font-semibold">أوامر قفل الجهاز المؤسسي</h3>
            <p className="text-xs text-slate-300">يتطلب القفل طلبًا معللًا واعتماد مدير مستقل، ثم إرسالًا صريحًا إلى Google. المسح عن بُعد غير مفعّل.</p>
            <label className="block text-sm">سبب طلب القفل
              <input value={commandReason} maxLength={500}
                onChange={e => setCommandReason(e.target.value)}
                className="mt-1 w-full rounded-lg border border-slate-600 bg-slate-800 p-2 text-white"
                placeholder="مثال: بلاغ فقدان هاتف الشركة"/>
            </label>
            <div className="flex flex-wrap gap-2">
              <button type="button" disabled={commandBusy || !commandReason.trim()}
                onClick={() => void requestLock(selected.id)}
                className="rounded-lg border border-sky-600 px-3 py-2 text-sm disabled:opacity-50">طلب قفل</button>
              <button type="button" disabled={commandBusy}
                onClick={() => void refreshCommands(selected.id)}
                className="rounded-lg border border-slate-600 px-3 py-2 text-sm disabled:opacity-50">تحديث سجل الأوامر</button>
            </div>
            {deviceCommands.length === 0 && <p className="text-xs text-slate-400">اضغط تحديث سجل الأوامر لعرض الطلبات الحالية.</p>}
            <ul className="space-y-2">
              {deviceCommands.filter(cmd => cmd.action === 'LOCK').map(cmd => (
                <li key={cmd.id} className="space-y-2 rounded-lg border border-slate-700 p-3">
                  <p className="text-sm">{cmd.reason} — <strong>{cmd.status}</strong></p>
                  <div className="flex flex-wrap gap-2">
                    {cmd.status === 'NOT_DISPATCHED' && !cmd.approvedById && (
                      <button type="button" disabled={commandBusy}
                        onClick={() => void processLock(selected.id, cmd.id, 'approve')}
                        className="rounded border border-slate-500 px-2 py-1 text-xs disabled:opacity-50">اعتماد مدير ثانٍ</button>
                    )}
                    {cmd.status === 'NOT_DISPATCHED' && cmd.approvedById && (
                      <button type="button" disabled={commandBusy}
                        onClick={() => void processLock(selected.id, cmd.id, 'lock')}
                        className="rounded border border-amber-600 px-2 py-1 text-xs disabled:opacity-50">إرسال أمر القفل</button>
                    )}
                    {['PROVIDER_ACCEPTED', 'PROVIDER_PENDING', 'PROVIDER_COMPLETED', 'PROVIDER_FAILED'].includes(cmd.status) && (
                      <button type="button" disabled={commandBusy}
                        onClick={() => void processLock(selected.id, cmd.id, 'verify')}
                        className="rounded border border-slate-500 px-2 py-1 text-xs disabled:opacity-50">تحقق من نتيجة Google</button>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          </section>
        )}
        <p className="mt-4 text-xs text-amber-300">مسح الجهاز والبث والتتبع المباشر ما زالت غير مفعلة. استجابة Google لأمر القفل ليست دليلًا مرئيًا مستقلًا على قفل الشاشة.</p>
      </section>}
    </main>
  );
}
