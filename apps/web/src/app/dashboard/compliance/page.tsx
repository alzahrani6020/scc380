'use client';

import { useState, useEffect } from 'react';
import api from '@/lib/api';
import {
  Shield, FileCheck, AlertTriangle, CheckCircle2, Users,
  FileText, Lock, Globe, RefreshCw, Download, Eye,
  Loader2, ClipboardCheck, Fingerprint,
} from 'lucide-react';

interface ComplianceReport {
  generatedAt: string;
  tenantId: string;
  summary: {
    auditLogs: number;
    dataSubjectConsents: number;
    activeConsents: number;
    totalInvoices: number;
  };
  zatcaStatus: string;
  zatcaAssurance: string;
  pdplStatus: string;
  ncaStatus: string;
  qiwaStatus: string;
  wpsStatus: string;
  dgaStatus: string;
  dataHosting: {
    location: string;
    compliant: boolean;
    verified: boolean;
    status: string;
    note: string;
  };
  recommendations: string[];
}

export default function ComplianceDashboardPage() {
  const [report, setReport] = useState<ComplianceReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [syncing, setSyncing] = useState(false);

  useEffect(() => {
    fetchReport();
  }, []);

  const fetchReport = async () => {
    setLoading(true);
    try {
      const res = await api.get('/compliance/report');
      setReport(res.data);
    } catch {
      setReport(null);
    } finally {
      setLoading(false);
    }
  };

  const exportWps = async () => {
    if (report?.wpsStatus !== 'VERIFIED') {
      alert('WPS غير متحقق إنتاجياً بعد. يجب ربط حساب بنكي مستقل بكل موظف والتحقق من صيغة الملف قبل الاستخدام.');
      return;
    }

    const month = new Date().getMonth() + 1;
    const year = new Date().getFullYear();
    setExporting(true);
    try {
      const res = await api.get(`/compliance/wps/export?month=${month}&year=${year}`, {
        responseType: 'blob',
      });
      const url = window.URL.createObjectURL(new Blob([res.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `WPS_${year}_${month}.sif`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } finally {
      setExporting(false);
    }
  };

  const syncQiwa = async () => {
    setSyncing(true);
    try {
      const res = await api.post('/compliance/qiwa/sync');
      alert(res.data?.message || 'محاكاة Qiwa فقط');
    } finally {
      setSyncing(false);
    }
  };

  const getStatusColor = (status: string) => {
    if (status === 'VERIFIED' || status === 'COMPLIANT') {
      return 'text-emerald-400 bg-emerald-500/10 border-emerald-500/30';
    }
    if (status === 'PARTIAL' || status === 'PENDING') {
      return 'text-amber-400 bg-amber-500/10 border-amber-500/30';
    }
    if (status === 'ACTIVE') {
      return 'text-blue-400 bg-blue-500/10 border-blue-500/30';
    }
    if (status === 'MOCK') {
      return 'text-violet-400 bg-violet-500/10 border-violet-500/30';
    }
    if (status === 'NOT_VERIFIED') {
      return 'text-slate-300 bg-slate-500/10 border-slate-500/30';
    }
    return 'text-red-400 bg-red-500/10 border-red-500/30';
  };

  const getStatusLabel = (status: string) => {
    if (status === 'VERIFIED') return 'تم التحقق';
    if (status === 'COMPLIANT') return 'متوافق';
    if (status === 'PARTIAL') return 'جزئي';
    if (status === 'PENDING') return 'قيد الإعداد';
    if (status === 'ACTIVE') return 'نشط — المطابقة غير مثبتة';
    if (status === 'MOCK') return 'محاكاة';
    if (status === 'NOT_VERIFIED') return 'غير متحقق';
    if (status === 'NOT_CONFIGURED') return 'غير مهيأ';
    return status;
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <Loader2 className="h-8 w-8 text-primary-400 animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 p-6" dir="rtl">
      <div className="max-w-6xl mx-auto space-y-6">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center shadow-lg">
              <Shield className="h-6 w-6 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-white">لوحة الامتثال</h1>
              <p className="text-slate-400 text-sm">تعرض الحالة المثبتة فقط، ولا تعتبر النشاط التقني امتثالاً قانونياً تلقائياً</p>
            </div>
          </div>
          <div className="flex gap-2">
            <button
              onClick={exportWps}
              disabled={exporting || report?.wpsStatus !== 'VERIFIED'}
              title={report?.wpsStatus !== 'VERIFIED' ? 'WPS غير متحقق إنتاجياً' : undefined}
              className="flex items-center gap-2 bg-slate-800 hover:bg-slate-700 text-white px-4 py-2 rounded-xl text-sm transition-all border border-slate-700 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {exporting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
              تصدير WPS
            </button>
            <button
              onClick={syncQiwa}
              disabled={syncing}
              className="flex items-center gap-2 bg-slate-800 hover:bg-slate-700 text-white px-4 py-2 rounded-xl text-sm transition-all border border-slate-700"
            >
              {syncing ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
              محاكاة Qiwa
            </button>
          </div>
        </div>

        {report && (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className={`p-5 rounded-2xl border ${getStatusColor(report.zatcaAssurance)}`}>
                <FileText className="h-6 w-6 mb-3" />
                <p className="text-sm opacity-70">ZATCA Assurance</p>
                <p className="text-xl font-bold">{getStatusLabel(report.zatcaAssurance)}</p>
                <p className="text-xs mt-2 opacity-70">إعداد الشهادة: {getStatusLabel(report.zatcaStatus)}</p>
              </div>

              <div className={`p-5 rounded-2xl border ${getStatusColor(report.pdplStatus)}`}>
                <Fingerprint className="h-6 w-6 mb-3" />
                <p className="text-sm opacity-70">PDPL</p>
                <p className="text-xl font-bold">{getStatusLabel(report.pdplStatus)}</p>
                <p className="text-xs mt-2 opacity-70">الموافقات وحدها لا تثبت الامتثال الكامل</p>
              </div>

              <div className={`p-5 rounded-2xl border ${getStatusColor(report.dataHosting.status)}`}>
                <Globe className="h-6 w-6 mb-3" />
                <p className="text-sm opacity-70">استضافة البيانات</p>
                <p className="text-xl font-bold">{getStatusLabel(report.dataHosting.status)}</p>
                <p className="text-xs mt-2 opacity-70">الموقع: {report.dataHosting.location}</p>
              </div>

              <div className="p-5 rounded-2xl border text-blue-400 bg-blue-500/10 border-blue-500/30">
                <Lock className="h-6 w-6 mb-3" />
                <p className="text-sm opacity-70">Audit Logs</p>
                <p className="text-xl font-bold">{report.summary.auditLogs.toLocaleString()}</p>
                <p className="text-xs mt-2 opacity-70">عدد السجلات، وليس درجة امتثال</p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="bg-slate-900/50 border border-slate-800 rounded-2xl p-5">
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-10 h-10 rounded-lg bg-violet-500/10 flex items-center justify-center">
                    <Users className="h-5 w-5 text-violet-400" />
                  </div>
                  <div>
                    <p className="text-slate-400 text-sm">موافقات البيانات</p>
                    <p className="text-white font-bold text-lg">{report.summary.dataSubjectConsents}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2 text-xs text-slate-400">
                  <CheckCircle2 className="h-3 w-3 text-emerald-400" />
                  {report.summary.activeConsents} موافقة نشطة
                </div>
              </div>

              <div className="bg-slate-900/50 border border-slate-800 rounded-2xl p-5">
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-10 h-10 rounded-lg bg-amber-500/10 flex items-center justify-center">
                    <FileText className="h-5 w-5 text-amber-400" />
                  </div>
                  <div>
                    <p className="text-slate-400 text-sm">الفواتير</p>
                    <p className="text-white font-bold text-lg">{report.summary.totalInvoices}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2 text-xs text-slate-400">
                  <Eye className="h-3 w-3 text-primary-400" />
                  <a href="/dashboard/zatca" className="text-primary-400 hover:underline">إعدادات ZATCA</a>
                </div>
              </div>

              <div className="bg-slate-900/50 border border-slate-800 rounded-2xl p-5">
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-10 h-10 rounded-lg bg-slate-500/10 flex items-center justify-center">
                    <ClipboardCheck className="h-5 w-5 text-slate-300" />
                  </div>
                  <div>
                    <p className="text-slate-400 text-sm">حالة التقرير</p>
                    <p className="text-white font-bold text-lg">تم توليده</p>
                  </div>
                </div>
                <div className="flex items-center gap-2 text-xs text-slate-400">
                  مُحدث: {new Date(report.generatedAt).toLocaleString('ar-SA')}
                </div>
              </div>
            </div>

            {report.recommendations.length > 0 && (
              <div className="bg-amber-500/5 border border-amber-500/20 rounded-2xl p-5">
                <h3 className="text-amber-400 font-bold mb-3 flex items-center gap-2">
                  <AlertTriangle className="h-5 w-5" />
                  إجراءات مطلوبة
                </h3>
                <ul className="space-y-2">
                  {report.recommendations.map((rec, i) => (
                    <li key={i} className="text-slate-300 text-sm flex items-start gap-2">
                      <span className="text-amber-400 mt-1">•</span>
                      {rec}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <div className="bg-slate-900/50 border border-slate-800 rounded-2xl p-6">
              <h3 className="text-white font-bold mb-4">الأطر والتكاملات</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {[
                  { name: 'ZATCA', desc: 'الفوترة الإلكترونية — حالة المطابقة', status: report.zatcaAssurance, icon: FileText },
                  { name: 'PDPL', desc: 'حماية البيانات الشخصية', status: report.pdplStatus, icon: Fingerprint },
                  { name: 'NCA', desc: 'الأمن السيبراني', status: report.ncaStatus, icon: Lock },
                  { name: 'MHRSD / Qiwa', desc: 'تكامل الموارد البشرية', status: report.qiwaStatus, icon: Users },
                  { name: 'MHRSD / WPS', desc: 'حماية الأجور', status: report.wpsStatus, icon: FileCheck },
                  { name: 'DGA', desc: 'الحكومة الرقمية', status: report.dgaStatus, icon: Shield },
                ].map((org) => (
                  <div key={org.name} className="p-4 bg-slate-800/50 rounded-xl flex items-center gap-3">
                    <org.icon className="h-5 w-5 text-slate-400" />
                    <div className="flex-1">
                      <p className="text-white text-sm font-medium">{org.name}</p>
                      <p className="text-slate-400 text-xs">{org.desc}</p>
                    </div>
                    <span className={`text-xs px-2 py-0.5 rounded-full border ${getStatusColor(org.status)}`}>
                      {getStatusLabel(org.status)}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-slate-900/30 border border-slate-800 rounded-2xl p-5 text-center">
              <p className="text-slate-400 text-sm">
                <span className="text-white">استضافة البيانات:</span> {report.dataHosting.note}
              </p>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
