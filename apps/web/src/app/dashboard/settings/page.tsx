'use client';

import { useEffect, useState } from 'react';
import api from '@/lib/api';
import { Settings, Palette, Bell, Shield, Globe, Save } from 'lucide-react';

type Prefs = {
  language: 'ar' | 'en';
  notifyInvoices: boolean;
  notifyEmployees: boolean;
  notifyFleet: boolean;
  notifyWeeklyReports: boolean;
};
const defaultPrefs: Prefs = {
  language: 'ar', notifyInvoices: true, notifyEmployees: true,
  notifyFleet: true, notifyWeeklyReports: true,
};

export default function SettingsPage() {
  const [preferences, setPreferences] = useState<Prefs>(defaultPrefs);
  const [ready, setReady] = useState(false);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState('');
  useEffect(() => {
    api.get<Prefs>('/users/me/preferences')
      .then(({ data }) => setPreferences(data))
      .catch(() => setStatus('تعذر تحميل الإعدادات المحفوظة.'))
      .finally(() => setReady(true));
  }, []);

  const save = async () => {
    setSaving(true);
    setStatus('');
    try {
      await api.patch('/users/me/preferences', preferences);
      const { data } = await api.get<Prefs>('/users/me/preferences');
      if (Object.keys(preferences).some(k =>
        data[k as keyof Prefs] !== preferences[k as keyof Prefs])) {
        throw new Error('Settings verification mismatch');
      }
      setStatus('تم حفظ الإعدادات والتحقق من استرجاعها.');
    } catch {
      setStatus('فشل حفظ الإعدادات أو التحقق منها. لم يتم تأكيد النجاح.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6 animate-fade-in-up">
      <div>
        <h1 className="text-2xl font-bold text-white flex items-center gap-2">
          <Settings className="h-6 w-6 text-primary-400" />
          الإعدادات
        </h1>
        <p className="text-slate-400 text-sm mt-1">تخصيص النظام حسب احتياجاتك</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Appearance */}
        <div className="scc-card">
          <div className="flex items-center gap-3 mb-4">
            <Palette className="h-5 w-5 text-primary-400" />
            <h3 className="font-bold text-white">المظهر</h3>
          </div>
          <div className="space-y-4">
            <div>
              <label className="block text-sm text-slate-400 mb-2">اللغة</label>
              <select className="scc-input" disabled={!ready || saving} value={preferences.language} onChange={e => setPreferences(p => ({ ...p, language: e.target.value as Prefs['language'] }))}>
                <option value="ar">العربية</option>
                <option value="en">English</option>
              </select>
            </div>
            <div>
              <label className="block text-sm text-slate-400 mb-2">المنطقة الزمنية</label>
              <select className="scc-input">
                <option>Asia/Riyadh (توقيت السعودية)</option>
              </select>
            </div>
          </div>
        </div>

        {/* Notifications */}
        <div className="scc-card">
          <div className="flex items-center gap-3 mb-4">
            <Bell className="h-5 w-5 text-amber-400" />
            <h3 className="font-bold text-white">الإشعارات</h3>
          </div>
          <div className="space-y-3">
            {([
              ['notifyInvoices', 'إشعارات الفواتير'],
              ['notifyEmployees', 'إشعارات الموظفين'],
              ['notifyFleet', 'إشعارات المركبات'],
              ['notifyWeeklyReports', 'التقارير الأسبوعية'],
            ] as [keyof Prefs, string][]).map(([key, label]) => (
              <label key={key} className="flex items-center justify-between py-2 cursor-pointer">
                <span className="text-slate-300 text-sm">{label}</span>
                <input type="checkbox" disabled={!ready || saving} checked={Boolean(preferences[key])}
                  onChange={e => setPreferences(p => ({ ...p, [key]: e.target.checked }))}
                  className="w-5 h-5 rounded border-slate-600 bg-slate-800 text-primary-500 focus:ring-primary-500" />
              </label>
            ))}
          </div>
        </div>

        {/* Security */}
        <div className="scc-card">
          <div className="flex items-center gap-3 mb-4">
            <Shield className="h-5 w-5 text-emerald-400" />
            <h3 className="font-bold text-white">الأمان</h3>
          </div>
          <div className="space-y-4">
            <div>
              <label className="block text-sm text-slate-400 mb-2">كلمة المرور الحالية</label>
              <input type="password" disabled className="scc-input" placeholder="••••••••" />
            </div>
            <div>
              <label className="block text-sm text-slate-400 mb-2">كلمة المرور الجديدة</label>
              <input type="password" disabled className="scc-input" placeholder="••••••••" />
            </div>
          </div>
        </div>

        {/* System */}
        <div className="scc-card">
          <div className="flex items-center gap-3 mb-4">
            <Globe className="h-5 w-5 text-violet-400" />
            <h3 className="font-bold text-white">معلومات النظام</h3>
          </div>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between py-2 border-b border-slate-800">
              <span className="text-slate-400">الإصدار</span>
              <span className="text-white">SCC 380 v1.0.0</span>
            </div>
            <div className="flex justify-between py-2 border-b border-slate-800">
              <span className="text-slate-400">قاعدة البيانات</span>
              <span className="text-white">غير متحقق من بيئة الإنتاج</span>
            </div>
            <div className="flex justify-between py-2 border-b border-slate-800">
              <span className="text-slate-400">الخادم</span>
              <span className="text-white">NestJS + Next.js</span>
            </div>
          </div>
        </div>
      </div>

      <p className="text-amber-300 text-sm">تغيير كلمة المرور يتطلب مساراً أمنياً مستقلاً؛ الحقول الأمنية معطلة هنا.</p>
      {status && <p role="status" className="text-sm text-amber-300">{status}</p>}
      <div className="flex justify-end">
        <button onClick={save} disabled={!ready || saving} className="scc-btn-primary">
          <Save className="h-5 w-5" />
          {saving ? 'جارٍ الحفظ...' : 'حفظ الإعدادات'}
        </button>
      </div>
    </div>
  );
}
