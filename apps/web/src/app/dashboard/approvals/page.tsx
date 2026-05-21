'use client';

import { useEffect, useState } from 'react';
import api from '@/lib/api';
import { CheckCircle, XCircle, Clock, Filter, Calendar, User, DollarSign, FileText } from 'lucide-react';
import Button from '@/components/ui/Button';
import Modal from '@/components/ui/Modal';

const typeLabels: Record<string, string> = {
  leave: 'إجازة',
  expense: 'مصروف',
  invoice: 'فاتورة',
  purchaseOrder: 'أمر شراء',
  fleetMaintenance: 'صيانة',
};

const typeIcons: Record<string, any> = {
  leave: Calendar,
  expense: DollarSign,
  invoice: FileText,
  purchaseOrder: FileText,
  fleetMaintenance: Calendar,
};

const statusColors: Record<string, string> = {
  PENDING: 'bg-amber-500/20 text-amber-400',
  APPROVED: 'bg-emerald-500/20 text-emerald-400',
  REJECTED: 'bg-red-500/20 text-red-400',
  DRAFT: 'bg-slate-500/20 text-slate-400',
  SCHEDULED: 'bg-blue-500/20 text-blue-400',
};

const statusLabels: Record<string, string> = {
  PENDING: 'قيد الانتظار',
  APPROVED: 'معتمد',
  REJECTED: 'مرفوض',
  DRAFT: 'مسودة',
  SCHEDULED: 'مجدول',
};

export default function ApprovalsPage() {
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'pending' | 'my'>('pending');
  const [filterType, setFilterType] = useState<string>('');
  const [rejectModal, setRejectModal] = useState<{ id: string; type: string } | null>(null);
  const [rejectReason, setRejectReason] = useState('');
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const fetchData = () => {
    setLoading(true);
    const endpoint = activeTab === 'pending' ? '/approvals/pending' : '/approvals/my-requests';
    api.get(endpoint)
      .then((res) => setItems(res.data || []))
      .catch(console.error)
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchData();
  }, [activeTab]);

  const handleApprove = async (id: string, type: string) => {
    setActionLoading(id);
    try {
      await api.post(`/approvals/${type}/${id}/approve`);
      fetchData();
    } catch (err) {
      alert('فشلت الموافقة');
    } finally {
      setActionLoading(null);
    }
  };

  const handleReject = async () => {
    if (!rejectModal) return;
    setActionLoading(rejectModal.id);
    try {
      await api.post(`/approvals/${rejectModal.type}/${rejectModal.id}/reject`, { reason: rejectReason });
      setRejectModal(null);
      setRejectReason('');
      fetchData();
    } catch (err) {
      alert('فشل الرفض');
    } finally {
      setActionLoading(null);
    }
  };

  const filtered = filterType ? items.filter((i) => i.type === filterType) : items;

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-10 h-10 border-4 border-primary-500/30 border-t-primary-500 rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in-up">
      <div>
        <h1 className="text-2xl font-bold text-white flex items-center gap-2">
          <Clock className="h-6 w-6 text-primary-400" />
          طلبات الموافقة
        </h1>
        <p className="text-slate-400 text-sm mt-1">إدارة ومراجعات طلبات النظام</p>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-4 border-b border-slate-800 pb-4">
        <button
          onClick={() => setActiveTab('pending')}
          className={`text-sm font-medium pb-2 border-b-2 transition-all ${activeTab === 'pending' ? 'border-primary-500 text-primary-400' : 'border-transparent text-slate-400 hover:text-white'}`}
        >
          قيد الانتظار
        </button>
        <button
          onClick={() => setActiveTab('my')}
          className={`text-sm font-medium pb-2 border-b-2 transition-all ${activeTab === 'my' ? 'border-primary-500 text-primary-400' : 'border-transparent text-slate-400 hover:text-white'}`}
        >
          طلباتي
        </button>
      </div>

      {/* Filter */}
      <div className="flex items-center gap-3">
        <Filter className="h-4 w-4 text-slate-400" />
        <select
          className="scc-input py-2 text-sm w-48"
          value={filterType}
          onChange={(e) => setFilterType(e.target.value)}
        >
          <option value="">جميع الأنواع</option>
          <option value="leave">إجازات</option>
          <option value="expense">مصروفات</option>
          <option value="invoice">فواتير</option>
          <option value="purchaseOrder">أوامر شراء</option>
          <option value="fleetMaintenance">صيانة</option>
        </select>
        <span className="text-slate-400 text-sm">{filtered.length} طلب</span>
      </div>

      {/* List */}
      <div className="space-y-3">
        {filtered.length === 0 && (
          <div className="scc-card text-center py-12">
            <Clock className="h-12 w-12 text-slate-600 mx-auto mb-4" />
            <p className="text-slate-400">لا توجد طلبات {activeTab === 'pending' ? 'قيد الانتظار' : ''}</p>
          </div>
        )}
        {filtered.map((item) => {
          const Icon = typeIcons[item.type] || FileText;
          return (
            <div key={`${item.type}-${item.id}`} className="scc-card-hover flex items-center justify-between gap-4">
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 rounded-lg bg-primary-500/10 flex items-center justify-center">
                  <Icon className="h-5 w-5 text-primary-400" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <p className="text-white font-medium text-sm">{item.title}</p>
                    <span className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-medium ${statusColors[item.status] || 'bg-slate-500/20 text-slate-400'}`}>
                      {statusLabels[item.status] || item.status}
                    </span>
                  </div>
                  <div className="flex items-center gap-3 mt-1">
                    <span className="text-slate-400 text-xs flex items-center gap-1">
                      <User className="h-3 w-3" /> {item.requester || '-'}
                    </span>
                    <span className="text-slate-500 text-xs">
                      {new Date(item.date).toLocaleDateString('ar-SA')}
                    </span>
                    {item.amount && (
                      <span className="text-slate-400 text-xs">
                        {Number(item.amount).toLocaleString()} ر.س
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {activeTab === 'pending' && (
                <div className="flex items-center gap-2">
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => handleApprove(item.id, item.type)}
                    isLoading={actionLoading === item.id}
                  >
                    <CheckCircle className="h-4 w-4 text-emerald-400" />
                    موافقة
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => setRejectModal({ id: item.id, type: item.type })}
                    isLoading={actionLoading === item.id}
                  >
                    <XCircle className="h-4 w-4 text-red-400" />
                    رفض
                  </Button>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Reject Modal */}
      <Modal isOpen={!!rejectModal} onClose={() => setRejectModal(null)} title="سبب الرفض" size="sm">
        <div className="space-y-4">
          <textarea
            className="scc-input h-24"
            placeholder="اكتب سبب الرفض..."
            value={rejectReason}
            onChange={(e) => setRejectReason(e.target.value)}
          />
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setRejectModal(null)}>إلغاء</Button>
            <Button variant="danger" onClick={handleReject} isLoading={!!actionLoading}>رفض</Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
