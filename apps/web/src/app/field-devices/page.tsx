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

  const reload = useCallback(async () => {
    setError('');
    try {
      const [inventory, readiness] = await Promise.all([
        api.get<Device[]>('/field-device-inventory'),
        api.get<Capabilities>('/field-devices/capabilities'),
      ]);
      setDevices(inventory.data);
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

  return (
    <main dir="rtl" className="mx-auto max-w-6xl space-y-6 p-4 text-slate-100 md:p-8">
      <header className="space-y-2">
        <Link href="/dashboard" className="text-sm text-sky-300 hover:underline">العودة إلى لوحة التحكم</Link>
        <h1 className="text-2xl font-semibold">SCC380 | مركز أجهزة الشركة</h1>
        <p className="text-sm text-slate-300">سجل الأجهزة المؤسسية وحالة تهيئة الإدارة. لا تُعرض وظيفة فعلية باعتبارها متصلة ما لم تُثبت جاهزيتها.</p>
      </header>

      {error && <div role="alert" className="rounded-lg border border-red-600 bg-red-950 p-4 text-sm">{error}</div>}
      {notice && <div role="status" className="rounded-lg border border-green-700 bg-green-950 p-4 text-sm">{notice}</div>}

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
                <button onClick={() => { setSelected(d); setEnrollment(null); }} className="flex w-full items-center justify-between rounded-lg border border-slate-700 p-3 text-right hover:bg-slate-800">
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
        <p className="mt-4 text-xs text-amber-300">أوامر التحكم والبث والتتبع معطلة حتى يتم ربط مزود MDM معتمد واجتياز الاختبارات.</p>
      </section>}
    </main>
  );
}
