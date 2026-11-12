'use client';

import { useEffect, useState } from 'react';
import api from '@/lib/api';
import { ClipboardList, Plus, Search, Pencil, Trash2, X } from 'lucide-react';
import Modal from '@/components/ui/Modal';
import Input from '@/components/ui/Input';
import Select from '@/components/ui/Select';
import Button from '@/components/ui/Button';

const attendanceStatuses = [
  { value: 'PRESENT', label: 'حاضر' },
  { value: 'ABSENT', label: 'غائب' },
  { value: 'LATE', label: 'متأخر' },
  { value: 'ON_LEAVE', label: 'في إجازة' },
  { value: 'HALF_DAY', label: 'نصف يوم' },
  { value: 'REMOTE', label: 'عن بعد' },
];

export default function AttendancePage() {
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
    const employeeId = typeof window !== 'undefined' ? new URLSearchParams(window.location.search).get('employeeId') : null;
    const listUrl = employeeId ? '/hr/attendances?employeeId=' + encodeURIComponent(employeeId) : '/hr/attendances';
    Promise.all([
      api.get(listUrl).then(r => setItems(r.data.data || [])),
      api.get('/hr/employees').then(r => setEmployees(r.data.data || [])),
    ]).catch(console.error).finally(() => setLoading(false));
  };

  const openCreate = () => {
    setEditing(null);
    const employeeId = typeof window !== 'undefined' ? new URLSearchParams(window.location.search).get('employeeId') : null;
    setFormData({ employeeId: employeeId || undefined, status: 'PRESENT', date: new Date().toISOString().split('T')[0] });
    setIsModalOpen(true);
  };

  const openEdit = (item: any) => {
    setEditing(item);
    setFormData({
      employeeId: item.employeeId,
      date: item.date ? new Date(item.date).toISOString().split('T')[0] : '',
      checkIn: item.checkIn ? new Date(item.checkIn).toISOString().slice(0, 16) : '',
      checkOut: item.checkOut ? new Date(item.checkOut).toISOString().slice(0, 16) : '',
      status: item.status,
      notes: item.notes || '',
      workHours: item.workHours ?? '',
      overtimeHours: item.overtimeHours ?? '',
    });
    setIsModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormLoading(true);
    try {
      const commonPayload = {
        date: formData.date || undefined,
        checkIn: formData.checkIn || undefined,
        checkOut: formData.checkOut || undefined,
        status: formData.status,
        notes: formData.notes || undefined,
        workHours: formData.workHours === '' || formData.workHours == null ? undefined : Number(formData.workHours),
        overtimeHours: formData.overtimeHours === '' || formData.overtimeHours == null ? undefined : Number(formData.overtimeHours),
      };
      if (editing) {
        await api.patch(`/hr/attendances/${editing.id}`, commonPayload);
      } else {
        await api.post('/hr/attendances', { employeeId: formData.employeeId, ...commonPayload });
      }
      setIsModalOpen(false);
      fetchData();
    } catch (err) {
      alert('تعذر حفظ سجل الحضور');
    } finally {
      setFormLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('هل أنت متأكد؟')) return;
    await api.delete(`/hr/attendances/${id}`);
    fetchData();
  };

  const filtered = items.filter((a) =>
    a.employee?.firstName?.includes(search) || a.employee?.lastName?.includes(search)
  );

  const empOptions = employees.map(e => ({ value: e.id, label: `${e.firstName} ${e.lastName}` }));

  const statusColor = (status: string) => {
    if (status === 'PRESENT') return 'bg-emerald-500/20 text-emerald-400';
    if (status === 'ABSENT') return 'bg-red-500/20 text-red-400';
    if (status === 'LATE') return 'bg-amber-500/20 text-amber-400';
    return 'bg-slate-500/20 text-slate-400';
  };

  return (
    <div className="space-y-6 animate-fade-in-up">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <ClipboardList className="h-6 w-6 text-primary-400" />
            الحضور والانصراف
          </h1>
          <p className="text-slate-400 text-sm mt-1">{items.length} سجل</p>
        </div>
        <Button onClick={openCreate}><Plus className="h-5 w-5" /> تسجيل حضور</Button>
      </div>
      <div className="relative">
        <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-500" />
        <input type="text" placeholder="البحث..." className="scc-input pr-10" value={search} onChange={(e) => setSearch(e.target.value)} />
      </div>
      {loading ? (
        <div className="flex items-center justify-center h-64">
          <div className="w-10 h-10 border-4 border-primary-500/30 border-t-primary-500 rounded-full animate-spin" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="scc-card text-center py-12 text-slate-400">لا توجد سجلات حضور مطابقة.</div>
      ) : (
        <div className="space-y-3">
          {filtered.map((a) => (
            <div key={a.id} className="scc-card-hover flex items-center justify-between group">
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center text-white font-bold shrink-0">
                  {a.employee?.firstName?.charAt(0)}
                </div>
                <div>
                  <h3 className="font-bold text-white text-sm">{a.employee?.firstName} {a.employee?.lastName}</h3>
                  <p className="text-slate-400 text-xs">{a.employee?.employeeCode}</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <div className="text-left">
                  <p className="text-slate-400 text-xs">{new Date(a.date).toLocaleDateString('ar-SA')}</p>
                  <div className="flex items-center gap-2 mt-1">
                    <span className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-medium ${statusColor(a.status)}`}>{attendanceStatuses.find(s => s.value === a.status)?.label || a.status}</span>
                    {a.workHours && <span className="text-slate-500 text-[10px]">{a.workHours} ساعة</span>}
                  </div>
                </div>
                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button onClick={() => openEdit(a)} className="p-1.5 rounded-lg hover:bg-primary-500/10 text-primary-400"><Pencil className="h-4 w-4" /></button>
                  <button onClick={() => handleDelete(a.id)} className="p-1.5 rounded-lg hover:bg-red-500/10 text-red-400"><Trash2 className="h-4 w-4" /></button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title={editing ? 'تعديل سجل' : 'تسجيل حضور'}>
        <form onSubmit={handleSubmit} className="space-y-4">
          <Select label="الموظف" required disabled={!!editing} options={empOptions} value={formData.employeeId || ''} onChange={(e) => setFormData({ ...formData, employeeId: e.target.value })} />
          <Input label="التاريخ" type="date" required value={formData.date || ''} onChange={(e) => setFormData({ ...formData, date: e.target.value })} />
          <div className="grid grid-cols-2 gap-4">
            <Input label="دخول" type="datetime-local" value={formData.checkIn || ''} onChange={(e) => setFormData({ ...formData, checkIn: e.target.value })} />
            <Input label="خروج" type="datetime-local" value={formData.checkOut || ''} onChange={(e) => setFormData({ ...formData, checkOut: e.target.value })} />
          </div>
          <Select label="الحالة" options={attendanceStatuses} value={formData.status || 'PRESENT'} onChange={(e) => setFormData({ ...formData, status: e.target.value })} />
          <Input label="ساعات العمل" type="number" step="0.5" value={formData.workHours || ''} onChange={(e) => setFormData({ ...formData, workHours: e.target.value })} />
          <Input label="ساعات إضافية" type="number" step="0.5" value={formData.overtimeHours || ''} onChange={(e) => setFormData({ ...formData, overtimeHours: e.target.value })} />
          <Input label="ملاحظات" value={formData.notes || ''} onChange={(e) => setFormData({ ...formData, notes: e.target.value })} />
          <div className="flex justify-end gap-3 pt-2">
            <Button type="button" variant="ghost" onClick={() => setIsModalOpen(false)}><X className="h-4 w-4" /> إلغاء</Button>
            <Button type="submit" isLoading={formLoading}>{editing ? 'حفظ' : 'تسجيل'}</Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
