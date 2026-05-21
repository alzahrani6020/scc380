'use client';

import { Landmark, FileCheck, Shield, Globe } from 'lucide-react';

const services = [
  { name: 'زاتكا - الفوترة الإلكترونية', desc: 'إصدار وتقرير الفواتير للهيئة العامة للزكاة والضريبة', icon: FileCheck, color: 'from-emerald-500 to-teal-500', status: 'متصل' },
  { name: 'أبشر - التحقق من الهوية', desc: 'التحقق من هوية الأفراد عبر منصة أبشر', icon: Shield, color: 'from-blue-500 to-indigo-500', status: 'قريباً' },
  { name: 'وزارة الداخلية - السجل التجاري', desc: 'التحقق من السجل التجاري للمنشآت', icon: Landmark, color: 'from-violet-500 to-purple-500', status: 'قريباً' },
  { name: 'نفاذ - التوقيع الرقمي', desc: 'التوقيع الرقمي والمصادقة على المستندات', icon: Globe, color: 'from-amber-500 to-orange-500', status: 'قريباً' },
];

export default function GovernmentPage() {
  return (
    <div className="space-y-6 animate-fade-in-up">
      <div>
        <h1 className="text-2xl font-bold text-white flex items-center gap-2">
          <Landmark className="h-6 w-6 text-primary-400" />
          التكاملات الحكومية
        </h1>
        <p className="text-slate-400 text-sm mt-1">ربط النظام بالجهات الحكومية السعودية</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {services.map((svc) => (
          <div key={svc.name} className="scc-card-hover">
            <div className="flex items-start gap-4">
              <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${svc.color} flex items-center justify-center shadow-lg shrink-0`}>
                <svc.icon className="h-6 w-6 text-white" />
              </div>
              <div className="flex-1">
                <div className="flex items-center justify-between mb-1">
                  <h3 className="font-bold text-white">{svc.name}</h3>
                  <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${
                    svc.status === 'متصل' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-amber-500/20 text-amber-400'
                  }`}>
                    {svc.status}
                  </span>
                </div>
                <p className="text-slate-400 text-sm">{svc.desc}</p>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
