'use client';

import { useEffect, useState } from 'react';
import api from '@/lib/api';
import { Wrench, Plus, Search, Calendar, Truck, Pencil, Trash2, X } from 'lucide-react';
import Modal from '@/components/ui/Modal';
import Input from '@/components/ui/Input';
import Select from '@/components/ui/Select';
import Button from '@/components/ui/Button';
import Textarea from '@/components/ui/Textarea';

const maintenanceTypes = [
  { value: 'ROUTINE', label: 'دورية' },
  { value: 'REPAIR', label: 'إصلاح' },
  { value: 'ACCIDENT', label: 'حادث' },
  { value: 'INSPECTION', label: 'فحص' },
  { value: 'TIRE_CHANGE', label: 'تغيير إطارات' },
  { value: 'BATTERY', label: 'بطارية' },
  { value: 'OTHER', label: 'أخرى' },
];

const maintenanceStatuses = [
  { value: 'SCHEDULED', label: 'مجدولة' },
  { value: 'IN_PROGRESS', label: 'قيد التنفيذ' },
  { value: 'COMPLETED', label: 'مكتملة' },
  { value: 'CANCELLED', label: 'ملغاة' },
];

export default function MaintenancePage() {
  const [items, setItems] = useState<any[]>([]);
  const [vehicles, setVehicles] = useState<any[]>([]);
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
      api.get('/fleet/maintenance').then(r => setItems(r.data.data || [])),
      api.get('/fleet/vehicles').then(r => setVehicles(r.data.data || [])),
    ]).catch(console.error).finally(() => setLoading(false));
  };

  const openCreate = () => {
    setEditing(null);
    setFormData({ type: 'ROUTINE', status: 'SCHEDULED' });
    setIsModalOpen(true);
  };

  const openEdit = (item: any) => {
    setEditing(item);
    setFormData({
      ...item,
      serviceDate: item.serviceDate ? new Date(item.serviceDate).toISOString().split('T')[0] : '',
      nextServiceDate: item.nextServiceDate ? new Date(item.nextServiceDate).toISOString().split('T')[0] : '',
    });
    setIsModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormLoading(true);
    try {
      const payload = { ...formData, cost: parseFloat(formData.cost) || 0 };
      if (editing) {
        await api.patch(`/fleet/maintenance/${editing.id}`, payload);
      } else {
        await api.post('/fleet/maintenance', payload);
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
    await api.delete(`/fleet/maintenance/${id}`);
    fetchData();
  };

  const filtered = items.filter((m) => m.description?.includes(search) || m.vehicle?.plateNumber?.includes(search));

  const vehicleOptions = vehicles.map(v => ({ value: v.id, label: v.plateNumber }));

  return (
    <div className="space-y-6 animate-fade-in-up">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <Wrench className="h-6 w-6 text-primary-400" />
            الصيانة
          </h1>
          <p className="text-slate-400 text-sm mt-1">{items.length} سجل صيانة</p>
        </div>
        <Button onClick={openCreate}><Plus className="h-5 w-5" /> تسجيل صيانة</Button>
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
          {filtered.map((m) => (
            <div key={m.id} className="scc-card-hover flex items-center justify-between group">
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-rose-500 to-pink-600 flex items-center justify-center text-white shrink-0">
                  <Wrench className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="font-bold text-white text-sm">{m.description}</h3>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="flex items-center gap-1 text-slate-400 text-xs"><Truck className="h-3 w-3" /> {m.vehicle?.plateNumber}</span>
                    <span className="text-slate-500 text-xs">{maintenanceTypes.find(t => t.value === m.type)?.label || m.type}</span>
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <div className="text-left">
                  <p className="text-white font-bold text-sm">{m.cost ? `${Number(m.cost).toLocaleString()} ر.س` : '—'}</p>
                  <div className="flex items-center gap-1 text-slate-500 text-xs mt-1"><Calendar className="h-3 w-3" /> {new Date(m.serviceDate).toLocaleDateString('ar-SA')}</div>
                  <span className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-medium mt-1 ${
                    m.status === 'COMPLETED' ? 'bg-emerald-500/20 text-emerald-400' :
                    m.status === 'IN_PROGRESS' ? 'bg-blue-500/20 text-blue-400' :
                    'bg-amber-500/20 text-amber-400'
                  }`}>{maintenanceStatuses.find(s => s.value === m.status)?.label || m.status}</span>
                </div>
                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button onClick={() => openEdit(m)} className="p-1.5 rounded-lg hover:bg-primary-500/10 text-primary-400"><Pencil className="h-4 w-4" /></button>
                  <button onClick={() => handleDelete(m.id)} className="p-1.5 rounded-lg hover:bg-red-500/10 text-red-400"><Trash2 className="h-4 w-4" /></button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title={editing ? 'تعديل صيانة' : 'تسجيل صيانة'}>
        <form onSubmit={handleSubmit} className="space-y-4">
          <Select label="المركبة" required options={vehicleOptions} value={formData.vehicleId || ''} onChange={(e) => setFormData({ ...formData, vehicleId: e.target.value })} />
          <Select label="النوع" options={maintenanceTypes} value={formData.type || 'ROUTINE'} onChange={(e) => setFormData({ ...formData, type: e.target.value })} />
          <Textarea label="الوصف" required rows={2} value={formData.description || ''} onChange={(e) => setFormData({ ...formData, description: e.target.value })} />
          <div className="grid grid-cols-2 gap-4">
            <Input label="التكلفة" type="number" value={formData.cost || ''} onChange={(e) => setFormData({ ...formData, cost: e.target.value })} />
            <Input label="القراءة (كم)" type="number" value={formData.mileage || ''} onChange={(e) => setFormData({ ...formData, mileage: e.target.value })} />
            <Input label="تاريخ الخدمة" type="date" value={formData.serviceDate || ''} onChange={(e) => setFormData({ ...formData, serviceDate: e.target.value })} />
            <Input label="الخدمة القادمة" type="date" value={formData.nextServiceDate || ''} onChange={(e) => setFormData({ ...formData, nextServiceDate: e.target.value })} />
            <Input label="مركز الصيانة" value={formData.serviceCenter || ''} onChange={(e) => setFormData({ ...formData, serviceCenter: e.target.value })} />
            <Select label="الحالة" options={maintenanceStatuses} value={formData.status || 'SCHEDULED'} onChange={(e) => setFormData({ ...formData, status: e.target.value })} />
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <Button type="button" variant="ghost" onClick={() => setIsModalOpen(false)}><X className="h-4 w-4" /> إلغاء</Button>
            <Button type="submit" isLoading={formLoading}>{editing ? 'حفظ' : 'تسجيل'}</Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
