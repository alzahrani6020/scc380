'use client';

import { useEffect, useState } from 'react';
import api from '@/lib/api';
import {
  AlertTriangle, Bell, FileText, Car, Briefcase,
  ClipboardList, Calendar, Receipt, ArrowLeft, AlertCircle, Info,
} from 'lucide-react';

interface AlertItem {
  id: string;
  type: string;
  severity: 'info' | 'warning' | 'danger';
  title: string;
  message: string;
  link: string;
  count?: number;
}

const typeIcons: Record<string, any> = {
  invoice: FileText,
  vehicle: Car,
  deal: Briefcase,
  task: ClipboardList,
  leave: Calendar,
  expense: Receipt,
  general: Bell,
};

const severityConfig = {
  danger: {
    bg: 'bg-red-500/10 border-red-500/30',
    icon: 'text-red-400',
    badge: 'bg-red-500 text-white',
    glow: 'hover:shadow-red-500/10',
  },
  warning: {
    bg: 'bg-amber-500/10 border-amber-500/30',
    icon: 'text-amber-400',
    badge: 'bg-amber-500 text-white',
    glow: 'hover:shadow-amber-500/10',
  },
  info: {
    bg: 'bg-blue-500/10 border-blue-500/30',
    icon: 'text-blue-400',
    badge: 'bg-blue-500 text-white',
    glow: 'hover:shadow-blue-500/10',
  },
};

export default function AlertsWidget() {
  const [alerts, setAlerts] = useState<AlertItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get('/analytics/alerts')
      .then((res) => setAlerts(res.data || []))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="scc-card">
        <div className="flex items-center gap-3 mb-4">
          <Bell className="h-5 w-5 text-primary-400" />
          <h3 className="text-lg font-bold text-white">التنبيهات</h3>
        </div>
        <div className="flex items-center justify-center h-20">
          <div className="w-6 h-6 border-2 border-primary-500/30 border-t-primary-500 rounded-full animate-spin" />
        </div>
      </div>
    );
  }

  if (alerts.length === 0) {
    return (
      <div className="scc-card">
        <div className="flex items-center gap-3 mb-2">
          <Bell className="h-5 w-5 text-primary-400" />
          <h3 className="text-lg font-bold text-white">التنبيهات</h3>
        </div>
        <div className="flex items-center gap-2 text-slate-400 text-sm py-4">
          <Info className="h-4 w-4" />
          لا توجد تنبيهات حاليًا — كل شيء على ما يرام!
        </div>
      </div>
    );
  }

  const dangerCount = alerts.filter(a => a.severity === 'danger').length;
  const warningCount = alerts.filter(a => a.severity === 'warning').length;

  return (
    <div className="scc-card">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <Bell className="h-5 w-5 text-primary-400" />
          <h3 className="text-lg font-bold text-white">التنبيهات</h3>
          <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-primary-500 text-white text-xs font-bold">
            {alerts.length}
          </span>
        </div>
        <div className="flex items-center gap-2">
          {dangerCount > 0 && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-bold bg-red-500/20 text-red-400">
              <AlertCircle className="h-3 w-3" /> {dangerCount}
            </span>
          )}
          {warningCount > 0 && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-bold bg-amber-500/20 text-amber-400">
              <AlertTriangle className="h-3 w-3" /> {warningCount}
            </span>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
        {alerts.map((alert) => {
          const Icon = typeIcons[alert.type] || Bell;
          const config = severityConfig[alert.severity];
          return (
            <a
              key={alert.id}
              href={alert.link}
              className={`group p-4 rounded-xl border transition-all duration-300 ${config.bg} ${config.glow} hover:-translate-y-0.5`}
            >
              <div className="flex items-start gap-3">
                <div className={`mt-0.5 ${config.icon}`}>
                  <Icon className="h-5 w-5" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <p className="text-white font-medium text-sm truncate">{alert.title}</p>
                    {alert.count !== undefined && alert.count > 0 && (
                      <span className={`inline-flex items-center justify-center px-1.5 py-0.5 rounded text-[10px] font-bold ${config.badge}`}>
                        {alert.count}
                      </span>
                    )}
                  </div>
                  <p className="text-slate-400 text-xs leading-relaxed">{alert.message}</p>
                </div>
                <ArrowLeft className="h-4 w-4 text-slate-600 group-hover:text-white transition-colors shrink-0 mt-1" />
              </div>
            </a>
          );
        })}
      </div>
    </div>
  );
}
