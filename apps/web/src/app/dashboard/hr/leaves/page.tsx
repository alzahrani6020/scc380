'use client';

import { useEffect, useState } from 'react';
import api from '@/lib/api';
import { CalendarDays, Plus, Search, CheckCircle2, XCircle, Clock, Pencil, Trash2, X } from 'lucide-react';
import Modal from '@/components/ui/Modal';
import Input from '@/components/ui/Input';
import Select from '@/components/ui/Select';
import Button from '@/components/ui/Button';

const leaveTypes = [
  { value: 'ANNUAL', label: 'سنوية' },
  { value: 'SICK', label: 'مرضية' },
  { value: 'EMERGENCY', label: 'طارئة' },
  { value: 'UNPAID', label: 'بدون راتب' },
  { value: 'MATERNITY', label: ' أمومة' },
  { value: 'PATERNITY', label: 'أبوة' },
  { value: 'HAJJ', label: 'حج' },
  { value: 'STUDY', label: 'دراسية' },
  { value: 'COMPASSIONATE', label: 'استثنائية' },
];

const leaveStatuses = [
  { value: 'PENDING', label: 'معلق' },
  { value: 'APPROVED', label: 'معتمد' },
  { value: 'REJECTED', label: 'مرفوض' },
  { value: 'CANCELLED', label: 'ملغى' },
];

export default function LeavesPage() {
  const [items, setItems] = useState<any[]>([]);
  const [employees, setEmployees] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [formLoading, setFormLoading] = useState(false);
  const [formData, setFormData] = useState<any>({});

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = () => {
    Promise.all([
      api.get('/hr/leaves').then(r => setItems(r.data.data || [])),
      api.get('/hr/employees').then(r => setEmployees(r.data.data || [])),
    ]).catch(console.error).finally(() => setLoading(false));
  };

  const openCreate = () => {
    setEditing(null);
    setFormData({ type: 'ANNUAL', status: 'PENDING', days: 1 });
    setIsModalOpen(true);
  };

  const openEdit = (item: any) => {
    setEditing(item);
    setFormData({
      ...item,
      startDate: item.startDate ? new Date(item.startDate).toISOString().split('T')[0] : '',
      endDate: item.endDate ? new Date(item.endDate).toISOString().split('T')[0] : '',
    });
    setIsModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormLoading(true);
    try {
      const payload = { ...formData, days: parseInt(formData.days) || 1 };
      if (editing) {
        await api.patch(`/hr/leaves/${editing.id}`, payload);
      } else {
        await api.post('/hr/leaves', payload);
      }
      setIsModalOpen(false);
      fetchData();
    } catch (err) {
      alert('حدث خطأ');
    } finally {
      setFormLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('هل أنت متأكد؟')) return;
    await api.delete(`/hr/leaves/${id}`);
    fetchData();
  };

  const handleApprove = async (id: string) => {
    await api.patch(`/hr/leaves/${id}`, { status: 'APPROVED' });
    fetchData();
  };

  const filtered = items.filter((l) =>
    l.employee?.firstName?.includes(search) || l.employee?.lastName?.includes(search)
  );

  const empOptions = employees.map(e => ({ value: e.id, label: `${e.firstName} ${e.lastName}` }));

  const statusIcon = (status: string) => {
    if (status === 'APPROVED') return <CheckCircle2 className="h-4 w-4 text-emerald-400" />;
    if (status === 'REJECTED') return <XCircle className="h-4 w-4 text-red-400" />;
    return <Clock className="h-4 w-4 text-amber-400" />;
  };

  return (
    <div className="space-y-6 animate-fade-in-up">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <CalendarDays className="h-6 w-6 text-primary-400" />
            طلبات الإجازة
          </h1>
          <p className="text-slate-400 text-sm mt-1">{items.length} طلب</p>
        </div>
        <Button onClick={openCreate}><Plus className="h-5 w-5" /> طلب إجازة</Button>
      </div>
      <div className="relative">
        <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-500" />
        <input type="text" placeholder="البحث..." className="scc-input pr-10" value={search} onChange={(e) => setSearch(e.target.value)} />
      </div>
      {loading ? (
        <div className="flex items-center justify-center h-64">
          <div className="w-10 h-10 border-4 border-primary-500/30 border-t-primary-500 rounded-full animate-spin" />
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((l) => (
            <div key={l.id} className="scc-card-hover flex items-center justify-between group">
              <div className="flex items-center gap-4">
                {statusIcon(l.status)}
                <div>
                  <h3 className="font-bold text-white text-sm">{l.employee?.firstName} {l.employee?.lastName}</h3>
                  <p className="text-slate-400 text-xs">{leaveTypes.find(t => t.value === l.type)?.label || l.type} • {l.days} يوم</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <div className="text-left">
                  <p className="text-slate-400 text-xs">{new Date(l.startDate).toLocaleDateString('ar-SA')} - {new Date(l.endDate).toLocaleDateString('ar-SA')}</p>
                  <span className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-medium mt-1 ${
                    l.status === 'APPROVED' ? 'bg-emerald-500/20 text-emerald-400' :
                    l.status === 'REJECTED' ? 'bg-red-500/20 text-red-400' :
                    'bg-amber-500/20 text-amber-400'
                  }`}>{leaveStatuses.find(s => s.value === l.status)?.label || l.status}</span>
                </div>
                {l.status === 'PENDING' && (
                  <Button size="sm" onClick={() => handleApprove(l.id)}><CheckCircle2 className="h-3 w-3" /> اعتماد</Button>
                )}
                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button onClick={() => openEdit(l)} className="p-1.5 rounded-lg hover:bg-primary-500/10 text-primary-400"><Pencil className="h-4 w-4" /></button>
                  <button onClick={() => handleDelete(l.id)} className="p-1.5 rounded-lg hover:bg-red-500/10 text-red-400"><Trash2 className="h-4 w-4" /></button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title={editing ? 'تعديل إجازة' : 'طلب إجازة'}>
        <form onSubmit={handleSubmit} className="space-y-4">
          <Select label="الموظف" required options={empOptions} value={formData.employeeId || ''} onChange={(e) => setFormData({ ...formData, employeeId: e.target.value })} />
          <Select label="النوع" options={leaveTypes} value={formData.type || 'ANNUAL'} onChange={(e) => setFormData({ ...formData, type: e.target.value })} />
          <div className="grid grid-cols-2 gap-4">
            <Input label="من تاريخ" type="date" required value={formData.startDate || ''} onChange={(e) => setFormData({ ...formData, startDate: e.target.value })} />
            <Input label="إلى تاريخ" type="date" required value={formData.endDate || ''} onChange={(e) => setFormData({ ...formData, endDate: e.target.value })} />
          </div>
          <Input label="عدد الأيام" type="number" required value={formData.days || 1} onChange={(e) => setFormData({ ...formData, days: e.target.value })} />
          <Input label="السبب" value={formData.reason || ''} onChange={(e) => setFormData({ ...formData, reason: e.target.value })} />
          <div className="flex justify-end gap-3 pt-2">
            <Button type="button" variant="ghost" onClick={() => setIsModalOpen(false)}><X className="h-4 w-4" /> إلغاء</Button>
            <Button type="submit" isLoading={formLoading}>{editing ? 'حفظ' : 'إرسال'}</Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
