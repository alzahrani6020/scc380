'use client';

import { useState } from 'react';
import { Settings, Palette, Bell, Shield, Globe, Save } from 'lucide-react';

export default function SettingsPage() {
  const [saved, setSaved] = useState(false);

  const handleSave = () => {
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
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
              <select className="scc-input">
                <option>العربية</option>
                <option>English</option>
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
            {['إشعارات الفواتير', 'إشعارات الموظفين', 'إشعارات المركبات', 'التقارير الأسبوعية'].map((item) => (
              <label key={item} className="flex items-center justify-between py-2 cursor-pointer">
                <span className="text-slate-300 text-sm">{item}</span>
                <input type="checkbox" defaultChecked className="w-5 h-5 rounded border-slate-600 bg-slate-800 text-primary-500 focus:ring-primary-500" />
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
              <input type="password" className="scc-input" placeholder="••••••••" />
            </div>
            <div>
              <label className="block text-sm text-slate-400 mb-2">كلمة المرور الجديدة</label>
              <input type="password" className="scc-input" placeholder="••••••••" />
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
              <span className="text-white">PostgreSQL 16</span>
            </div>
            <div className="flex justify-between py-2 border-b border-slate-800">
              <span className="text-slate-400">الخادم</span>
              <span className="text-white">NestJS + Next.js</span>
            </div>
          </div>
        </div>
      </div>

      <div className="flex justify-end">
        <button onClick={handleSave} className="scc-btn-primary">
          <Save className="h-5 w-5" />
          {saved ? 'تم الحفظ!' : 'حفظ الإعدادات'}
        </button>
      </div>
    </div>
  );
}
