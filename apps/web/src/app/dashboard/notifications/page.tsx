'use client';

import { useEffect, useState, useRef } from 'react';
import Link from 'next/link';
import api from '@/lib/api';
import { getTenantId } from '@/lib/auth';
import { io, Socket } from 'socket.io-client';
import { Bell, Check, Trash2, Mail, MessageSquare, Smartphone, Plus, X, AlertTriangle, AlertCircle, Info, Package, FileText, Clock, CreditCard, UserCheck, ExternalLink, Eye } from 'lucide-react';
import Modal from '@/components/ui/Modal';
import Input from '@/components/ui/Input';
import Select from '@/components/ui/Select';
import Button from '@/components/ui/Button';
import Textarea from '@/components/ui/Textarea';

const channels = [
  { value: 'IN_APP', label: 'داخل التطبيق' },
  { value: 'EMAIL', label: 'بريد إلكتروني' },
  { value: 'SMS', label: 'رسالة نصية' },
];

const severityConfig: Record<string, { icon: any; color: string; bg: string; label: string }> = {
  CRITICAL: { icon: AlertTriangle, color: 'text-red-400', bg: 'bg-red-500/10 border-red-500/30', label: 'حرج' },
  WARNING: { icon: AlertCircle, color: 'text-amber-400', bg: 'bg-amber-500/10 border-amber-500/30', label: 'تحذير' },
  INFO: { icon: Info, color: 'text-blue-400', bg: 'bg-blue-500/10 border-blue-500/30', label: 'معلومة' },
};

const typeConfig: Record<string, { icon: any; label: string }> = {
  LOW_STOCK: { icon: Package, label: 'مخزون منخفض' },
  OVERDUE_INVOICE: { icon: FileText, label: 'فاتورة مستحقة' },
  UPCOMING_INVOICE: { icon: Clock, label: 'استحقاق قادم' },
  PENDING_PAYMENT: { icon: CreditCard, label: 'دفع معلق' },
  ASSET_DEPRECIATION: { icon: FileText, label: 'إهلاك أصل' },
  PENDING_LEAVE: { icon: UserCheck, label: 'إجازة معلقة' },
};

export default function NotificationsPage() {
  const [activeTab, setActiveTab] = useState<'manual' | 'smart'>('smart');
  
  // Manual notifications
  const [items, setItems] = useState<any[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [formLoading, setFormLoading] = useState(false);
  const [formData, setFormData] = useState<any>({});

  // Smart alerts
  const [alerts, setAlerts] = useState<any[]>([]);
  const [alertCounts, setAlertCounts] = useState({ total: 0, critical: 0, warning: 0, info: 0 });
  const [alertFilter, setAlertFilter] = useState<'ALL' | 'CRITICAL' | 'WARNING' | 'INFO'>('ALL');
  const [wsConnected, setWsConnected] = useState(false);
  const socketRef = useRef<Socket | null>(null);

  useEffect(() => {
    fetchData();
    fetchAlerts();

    // WebSocket for real-time alerts
    const socket = io('http://localhost:3001/alerts');
    socketRef.current = socket;

    socket.on('connect', () => {
      setWsConnected(true);
      const tenantId = getTenantId() || 'default';
      socket.emit('subscribe', tenantId);
    });

    socket.on('disconnect', () => setWsConnected(false));

    socket.on('new-alert', (newAlert: any) => {
      setAlerts((prev) => [newAlert, ...prev]);
      setAlertCounts((prev) => ({ ...prev, total: prev.total + 1, [newAlert.severity?.toLowerCase() || 'info']: prev[(newAlert.severity?.toLowerCase() || 'info') as keyof typeof prev] + 1 }));
    });

    socket.on('alert-count', (counts: any) => {
      setAlertCounts(counts);
    });

    return () => { socket.disconnect(); };
  }, []);

  const fetchData = () => {
    Promise.all([
      api.get('/notifications').then(r => setItems(r.data.data || [])),
      api.get('/users').then(r => setUsers(r.data.data || [])),
    ]).catch(console.error).finally(() => setLoading(false));
  };

  const fetchAlerts = async () => {
    try {
      const [alertsRes, countsRes] = await Promise.all([
        api.get('/alerts'),
        api.get('/alerts/counts'),
      ]);
      setAlerts(alertsRes.data || []);
      setAlertCounts(countsRes.data || { total: 0, critical: 0, warning: 0, info: 0 });
    } catch (err) {
      console.error('Failed to fetch alerts', err);
    }
  };

  const markNotificationAsRead = async (id: string) => {
    await api.post(`/notifications/${id}/read`);
    fetchData();
  };

  const markAllNotificationsAsRead = async () => {
    await api.post('/notifications/read-all');
    fetchData();
  };

  const removeNotification = async (id: string) => {
    await api.delete(`/notifications/${id}`);
    fetchData();
  };

  const markAlertAsRead = async (id: string) => {
    await api.post(`/alerts/${id}/read`);
    fetchAlerts();
  };

  const markAllAlertsAsRead = async () => {
    await api.post('/alerts/read-all');
    fetchAlerts();
  };

  const dismissAlert = async (id: string) => {
    await api.delete(`/alerts/${id}`);
    fetchAlerts();
  };

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormLoading(true);
    try {
      await api.post('/notifications', formData);
      setIsModalOpen(false);
      setFormData({});
      fetchData();
    } catch (err) {
      alert('حدث خطأ');
    } finally {
      setFormLoading(false);
    }
  };

  const channelIcon = (channel: string) => {
    if (channel === 'EMAIL') return <Mail className="h-4 w-4 text-blue-400" />;
    if (channel === 'SMS') return <Smartphone className="h-4 w-4 text-emerald-400" />;
    return <MessageSquare className="h-4 w-4 text-primary-400" />;
  };

  const userOptions = users.map(u => ({ value: u.id, label: `${u.firstName} ${u.lastName} (${u.email})` }));

  const filteredAlerts = alertFilter === 'ALL' ? alerts : alerts.filter(a => a.severity === alertFilter);

  return (
    <div className="space-y-6 animate-fade-in-up">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <Bell className="h-6 w-6 text-primary-400" />
            التنبيهات والإشعارات
          </h1>
        </div>
        {activeTab === 'manual' && (
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="sm" onClick={markAllNotificationsAsRead}><Check className="h-4 w-4" /> تحديد الكل</Button>
            <Button size="sm" onClick={() => setIsModalOpen(true)}><Plus className="h-4 w-4" /> إرسال إشعار</Button>
          </div>
        )}
      </div>

      {/* Tabs */}
      <div className="flex gap-2 border-b border-slate-700 pb-1">
        <button
          onClick={() => setActiveTab('smart')}
          className={`px-4 py-2 text-sm font-medium rounded-t-lg transition-colors ${activeTab === 'smart' ? 'text-primary-400 border-b-2 border-primary-400 bg-primary-500/10' : 'text-slate-400 hover:text-white'}`}
        >
          التنبيهات الذكية
          {alertCounts.total > 0 && <span className="mr-2 bg-red-500 text-white text-xs rounded-full px-2 py-0.5">{alertCounts.total}</span>}
        </button>
        <button
          onClick={() => setActiveTab('manual')}
          className={`px-4 py-2 text-sm font-medium rounded-t-lg transition-colors ${activeTab === 'manual' ? 'text-primary-400 border-b-2 border-primary-400 bg-primary-500/10' : 'text-slate-400 hover:text-white'}`}
        >
          الإشعارات
          {items.filter((i) => !i.readAt).length > 0 && <span className="mr-2 bg-primary-500 text-white text-xs rounded-full px-2 py-0.5">{items.filter((i) => !i.readAt).length}</span>}
        </button>
      </div>

      {activeTab === 'smart' && (
        <div className="space-y-6">
          {/* Count Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              { label: 'إجمالي التنبيهات', count: alertCounts.total, color: 'bg-slate-700' },
              { label: 'حرجة', count: alertCounts.critical, color: 'bg-red-500/20 text-red-400' },
              { label: 'تحذير', count: alertCounts.warning, color: 'bg-amber-500/20 text-amber-400' },
              { label: 'معلومة', count: alertCounts.info, color: 'bg-blue-500/20 text-blue-400' },
            ].map(c => (
              <div key={c.label} className={`scc-card text-center ${c.color}`}>
                <div className="text-2xl font-bold">{c.count}</div>
                <div className="text-xs mt-1 opacity-80">{c.label}</div>
              </div>
            ))}
          </div>

          {/* Filters + Actions */}
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div className="flex gap-2 flex-wrap">
              {(['ALL', 'CRITICAL', 'WARNING', 'INFO'] as const).map(f => (
                <button
                  key={f}
                  onClick={() => setAlertFilter(f)}
                  className={`px-3 py-1.5 text-xs rounded-lg font-medium transition-colors ${
                    alertFilter === f ? 'bg-primary-500 text-white' : 'bg-slate-800 text-slate-400 hover:text-white'
                  }`}
                >
                  {f === 'ALL' ? 'الكل' : severityConfig[f].label}
                </button>
              ))}
            </div>
            <div className="flex items-center gap-2">
              {wsConnected && <span className="text-[10px] bg-emerald-500/10 text-emerald-400 px-2 py-1 rounded-full flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" /> مباشر</span>}
              {alertCounts.total > 0 && (
                <Button variant="ghost" size="sm" onClick={markAllAlertsAsRead}>
                  <Check className="h-4 w-4" /> تحديد الكل كمقروء
                </Button>
              )}
            </div>
          </div>

          {/* Alerts List */}
          {filteredAlerts.length === 0 ? (
            <div className="scc-card text-center py-16">
              <Bell className="h-12 w-12 text-slate-600 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-white">لا توجد تنبيهات</h3>
              <p className="text-slate-500 text-sm mt-1">كل شيء تحت السيطرة!</p>
            </div>
          ) : (
            <div className="space-y-3">
              {filteredAlerts.map((alert) => {
                const sev = severityConfig[alert.severity] || severityConfig.INFO;
                const typ = typeConfig[alert.type] || { icon: Bell, label: alert.type };
                const TypeIcon = typ.icon;
                const SevIcon = sev.icon;
                return (
                  <div key={alert.id} className={`scc-card-hover border-r-2 ${sev.bg.replace('bg-', 'border-').replace('/10', '/50')} ${alert.isRead ? 'opacity-60' : ''}`}>
                    <div className="flex items-start justify-between">
                      <div className="flex items-start gap-3">
                        <div className={`p-2 rounded-lg ${sev.bg}`}>
                          <TypeIcon className={`h-5 w-5 ${sev.color}`} />
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <h3 className={`font-bold text-sm ${alert.isRead ? 'text-slate-400' : 'text-white'}`}>{alert.title}</h3>
                            <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${sev.bg} ${sev.color}`}>
                              {sev.label}
                            </span>
                            {alert.isRead && <span className="text-[10px] bg-slate-700 text-slate-400 px-2 py-0.5 rounded-full">مقروء</span>}
                          </div>
                          <p className="text-slate-400 text-sm mt-1">{alert.message}</p>
                          <div className="flex items-center gap-3 mt-2">
                            <span className="text-slate-600 text-xs flex items-center gap-1">
                              <SevIcon className="h-3 w-3" /> {typ.label}
                            </span>
                            <span className="text-slate-600 text-xs">{new Date(alert.createdAt).toLocaleDateString('ar-SA')}</span>
                            {alert.actionUrl && (
                              <Link href={alert.actionUrl} className="text-primary-400 text-xs flex items-center gap-1 hover:underline">
                                <ExternalLink className="h-3 w-3" /> اذهب
                              </Link>
                            )}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-1">
                        {!alert.isRead && (
                          <button onClick={() => markAlertAsRead(alert.id)} className="p-2 rounded-lg hover:bg-primary-500/10 text-primary-400" title="تحديد كمقروء">
                            <Eye className="h-4 w-4" />
                          </button>
                        )}
                        <button onClick={() => dismissAlert(alert.id)} className="p-2 rounded-lg hover:bg-red-500/10 text-red-400" title="إخفاء">
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {activeTab === 'manual' && (
        <>
          {loading ? (
            <div className="flex items-center justify-center h-64">
              <div className="w-10 h-10 border-4 border-primary-500/30 border-t-primary-500 rounded-full animate-spin" />
            </div>
          ) : (
            <div className="space-y-3">
              {items.map((n) => (
                <div key={n.id} className={`scc-card-hover flex items-center justify-between ${!n.readAt ? 'border-r-2 border-primary-500' : ''}`}>
                  <div className="flex items-center gap-4">
                    {channelIcon(n.channel)}
                    <div>
                      <h3 className={`font-bold text-sm ${!n.readAt ? 'text-white' : 'text-slate-400'}`}>{n.title}</h3>
                      <p className="text-slate-500 text-xs">{n.body}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-slate-500 text-xs">{new Date(n.createdAt).toLocaleDateString('ar-SA')}</span>
                    {!n.readAt && <button onClick={() => markNotificationAsRead(n.id)} className="p-2 rounded-lg hover:bg-primary-500/10 text-primary-400"><Check className="h-4 w-4" /></button>}
                    <button onClick={() => removeNotification(n.id)} className="p-2 rounded-lg hover:bg-red-500/10 text-red-400"><Trash2 className="h-4 w-4" /></button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title="إرسال إشعار">
        <form onSubmit={handleSend} className="space-y-4">
          <Select label="المستخدم" required options={userOptions} value={formData.userId || ''} onChange={(e) => setFormData({ ...formData, userId: e.target.value })} />
          <Input label="العنوان" required value={formData.title || ''} onChange={(e) => setFormData({ ...formData, title: e.target.value })} />
          <Textarea label="المحتوى" required rows={3} value={formData.body || ''} onChange={(e) => setFormData({ ...formData, body: e.target.value })} />
          <Select label="القناة" options={channels} value={formData.channel || 'IN_APP'} onChange={(e) => setFormData({ ...formData, channel: e.target.value })} />
          <div className="flex justify-end gap-3">
            <Button type="button" variant="ghost" onClick={() => setIsModalOpen(false)}><X className="h-4 w-4" /> إلغاء</Button>
            <Button type="submit" isLoading={formLoading}>إرسال</Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
