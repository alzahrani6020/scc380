'use client';

import { useEffect, useState } from 'react';
import api from '@/lib/api';
import { Clock3, Plus, Pencil, Trash2, X } from 'lucide-react';
import Modal from '@/components/ui/Modal';
import Input from '@/components/ui/Input';
import Select from '@/components/ui/Select';
import Button from '@/components/ui/Button';

export default function ShiftsPage() {
  const [items, setItems] = useState<any[]>([]);
  const [employees, setEmployees] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<any>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [formLoading, setFormLoading] = useState(false);
  const [formData, setFormData] = useState<any>({});

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = () => {
    setLoading(true);
    Promise.all([
      api.get('/hr/shifts').then(r => setItems(r.data.data || [])),
      api.get('/hr/employees').then(r => setEmployees(r.data.data || [])),
    ]).catch(console.error).finally(() => setLoading(false));
  };

  const openCreate = () => {
    setEditing(null);
    setFormData({ name: 'الوردية الرئيسية', isRecurring: false });
    setIsModalOpen(true);
  };

  const openEdit = (item: any) => {
    setEditing(item);
    setFormData({
      employeeId: item.employeeId,
      name: item.name,
      startTime: item.startTime ? new Date(item.startTime).toISOString().slice(0, 16) : '',
      endTime: item.endTime ? new Date(item.endTime).toISOString().slice(0, 16) : '',
      isRecurring: !!item.isRecurring,
      recurrence: item.recurrence || '',
    });
    setIsModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormLoading(true);
    try {
      const common = {
        name: formData.name,
        startTime: formData.startTime,
        endTime: formData.endTime,
        isRecurring: !!formData.isRecurring,
        recurrence: formData.recurrence || undefined,
      };
      if (editing) {
        await api.patch(`/hr/shifts/${editing.id}`, common);
      } else {
        await api.post('/hr/shifts', { employeeId: formData.employeeId, ...common });
      }
      setIsModalOpen(false);
      fetchData();
    } catch {
      alert('تعذر حفظ الوردية');
    } finally {
      setFormLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('هل تريد حذف الوردية؟')) return;
    await api.delete(`/hr/shifts/${id}`);
    fetchData();
  };

  const employeeOptions = employees.map(e => ({ value: e.id, label: `${e.firstName} ${e.lastName}` }));

  return (
    <div className="space-y-6 animate-fade-in-up">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <Clock3 className="h-6 w-6 text-primary-400" />
            الورديات والجداول
          </h1>
          <p className="text-slate-400 text-sm mt-1">{items.length} وردية</p>
        </div>
        <Button onClick={openCreate}><Plus className="h-5 w-5" /> إضافة وردية</Button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-64">
          <div className="w-10 h-10 border-4 border-primary-500/30 border-t-primary-500 rounded-full animate-spin" />
        </div>
      ) : items.length === 0 ? (
        <div className="scc-card text-center py-14">
          <Clock3 className="h-10 w-10 text-slate-600 mx-auto mb-3" />
          <p className="text-white font-medium">لا توجد ورديات بعد.</p>
          <p className="text-slate-500 text-sm mt-1">أضف أول وردية واربطها بموظف.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {items.map(item => (
            <div key={item.id} className="scc-card-hover flex items-center justify-between group">
              <div>
                <h3 className="text-white font-semibold">{item.name}</h3>
                <p className="text-slate-400 text-sm">
                  {item.employee?.firstName} {item.employee?.lastName} · {item.employee?.employeeCode}
                </p>
                <p className="text-slate-500 text-xs mt-1">
                  {new Date(item.startTime).toLocaleString('ar-SA')} — {item.endTime ? new Date(item.endTime).toLocaleString('ar-SA') : 'بدون نهاية'}
                </p>
              </div>
              <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                <button onClick={() => openEdit(item)} className="p-1.5 rounded-lg hover:bg-primary-500/10 text-primary-400"><Pencil className="h-4 w-4" /></button>
                <button onClick={() => handleDelete(item.id)} className="p-1.5 rounded-lg hover:bg-red-500/10 text-red-400"><Trash2 className="h-4 w-4" /></button>
              </div>
            </div>
          ))}
        </div>
      )}

      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title={editing ? 'تعديل وردية' : 'وردية جديدة'}>
        <form onSubmit={handleSubmit} className="space-y-4">
          <Select label="الموظف" required disabled={!!editing} options={employeeOptions} value={formData.employeeId || ''} onChange={(e) => setFormData({ ...formData, employeeId: e.target.value })} />
          <Input label="اسم الوردية" required value={formData.name || ''} onChange={(e) => setFormData({ ...formData, name: e.target.value })} />
          <Input label="بداية الوردية" type="datetime-local" required value={formData.startTime || ''} onChange={(e) => setFormData({ ...formData, startTime: e.target.value })} />
          <Input label="نهاية الوردية" type="datetime-local" required value={formData.endTime || ''} onChange={(e) => setFormData({ ...formData, endTime: e.target.value })} />
          <label className="flex items-center gap-2 text-sm text-slate-300">
            <input type="checkbox" checked={!!formData.isRecurring} onChange={(e) => setFormData({ ...formData, isRecurring: e.target.checked })} />
            وردية متكررة
          </label>
          {formData.isRecurring && <Input label="قاعدة التكرار" placeholder="مثال: WEEKDAYS" value={formData.recurrence || ''} onChange={(e) => setFormData({ ...formData, recurrence: e.target.value })} />}
          <div className="flex justify-end gap-3 pt-2">
            <Button type="button" variant="ghost" onClick={() => setIsModalOpen(false)}><X className="h-4 w-4" /> إلغاء</Button>
            <Button type="submit" isLoading={formLoading}>{editing ? 'حفظ' : 'إنشاء'}</Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
