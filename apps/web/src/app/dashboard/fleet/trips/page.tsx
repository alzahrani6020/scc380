'use client';

import { useEffect, useState } from 'react';
import api from '@/lib/api';
import { Route, Plus, Search, Pencil, Trash2, X, MapPin, Clock, Truck } from 'lucide-react';
import Modal from '@/components/ui/Modal';
import Input from '@/components/ui/Input';
import Select from '@/components/ui/Select';
import Button from '@/components/ui/Button';

const tripStatuses = [
  { value: 'IN_PROGRESS', label: 'جارية' },
  { value: 'COMPLETED', label: 'مكتملة' },
  { value: 'CANCELLED', label: 'ملغاة' },
];

export default function FleetTripsPage() {
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
    api.get('/fleet/vehicles').then((res) => setVehicles(res.data.data || [])).catch(console.error);
  }, []);

  const fetchData = () => {
    api.get('/fleet/trips').then((res) => setItems(res.data.data || [])).catch(console.error).finally(() => setLoading(false));
  };

  const openCreate = () => {
    setEditing(null);
    setFormData({ status: 'IN_PROGRESS' });
    setIsModalOpen(true);
  };

  const openEdit = (item: any) => {
    setEditing(item);
    setFormData({
      ...item,
      startedAt: item.startedAt ? new Date(item.startedAt).toISOString().slice(0, 16) : '',
      endedAt: item.endedAt ? new Date(item.endedAt).toISOString().slice(0, 16) : '',
    });
    setIsModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormLoading(true);
    try {
      const payload = {
        ...formData,
        startOdometer: formData.startOdometer ? Number(formData.startOdometer) : undefined,
        endOdometer: formData.endOdometer ? Number(formData.endOdometer) : undefined,
      };
      if (editing) {
        await api.patch(`/fleet/trips/${editing.id}`, payload);
      } else {
        await api.post('/fleet/trips', payload);
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
    await api.delete(`/fleet/trips/${id}`);
    fetchData();
  };

  const filtered = items.filter((t) =>
    t.purpose?.includes(search) ||
    vehicles.find((v) => v.id === t.vehicleId)?.plateNumber?.includes(search)
  );

  const getVehicle = (id: string) => vehicles.find((v) => v.id === id);

  return (
    <div className="space-y-6 animate-fade-in-up">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <Route className="h-6 w-6 text-primary-400" />
            الرحلات
          </h1>
          <p className="text-slate-400 text-sm mt-1">{items.length} رحلة</p>
        </div>
        <Button onClick={openCreate}><Plus className="h-5 w-5" /> رحلة جديدة</Button>
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
        <div className="grid grid-cols-1 gap-4">
          {filtered.map((t) => {
            const v = getVehicle(t.vehicleId);
            return (
              <div key={t.id} className="scc-card-hover group flex flex-col md:flex-row md:items-center gap-4 justify-between">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-primary-500 to-blue-600 flex items-center justify-center text-white shrink-0">
                    <Truck className="h-6 w-6" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="font-bold text-white">{t.purpose || 'رحلة بدون عنوان'}</h3>
                      <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${
                        t.status === 'IN_PROGRESS' ? 'bg-amber-500/20 text-amber-400' :
                        t.status === 'COMPLETED' ? 'bg-emerald-500/20 text-emerald-400' :
                        'bg-red-500/20 text-red-400'
                      }`}>{tripStatuses.find((s) => s.value === t.status)?.label || t.status}</span>
                    </div>
                    <div className="flex items-center gap-4 mt-1 text-slate-400 text-sm">
                      <span className="flex items-center gap-1"><Truck className="h-3.5 w-3.5" /> {v?.plateNumber || t.vehicleId}</span>
                      <span className="flex items-center gap-1"><Clock className="h-3.5 w-3.5" /> {new Date(t.startedAt).toLocaleString('ar-SA')}</span>
                      {t.endedAt && <span className="flex items-center gap-1"><Clock className="h-3.5 w-3.5" /> {new Date(t.endedAt).toLocaleString('ar-SA')}</span>}
                      {t.startOdometer && <span className="flex items-center gap-1"><MapPin className="h-3.5 w-3.5" /> عداد: {t.startOdometer}</span>}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button onClick={() => openEdit(t)} className="p-1.5 rounded-lg hover:bg-primary-500/10 text-primary-400"><Pencil className="h-4 w-4" /></button>
                  <button onClick={() => handleDelete(t.id)} className="p-1.5 rounded-lg hover:bg-red-500/10 text-red-400"><Trash2 className="h-4 w-4" /></button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title={editing ? 'تعديل رحلة' : 'رحلة جديدة'} size="lg">
        <form onSubmit={handleSubmit} className="space-y-4">
          <Select label="المركبة" required options={vehicles.map((v) => ({ value: v.id, label: v.plateNumber }))} value={formData.vehicleId || ''} onChange={(e) => setFormData({ ...formData, vehicleId: e.target.value })} />
          <Input label="الغرض" value={formData.purpose || ''} onChange={(e) => setFormData({ ...formData, purpose: e.target.value })} />
          <div className="grid grid-cols-2 gap-4">
            <Input label="عداد البداية" type="number" value={formData.startOdometer || ''} onChange={(e) => setFormData({ ...formData, startOdometer: e.target.value })} />
            <Input label="عداد النهاية" type="number" value={formData.endOdometer || ''} onChange={(e) => setFormData({ ...formData, endOdometer: e.target.value })} />
          </div>
          <Input label="تاريخ البدء" type="datetime-local" required value={formData.startedAt || ''} onChange={(e) => setFormData({ ...formData, startedAt: e.target.value })} />
          <Input label="تاريخ الانتهاء" type="datetime-local" value={formData.endedAt || ''} onChange={(e) => setFormData({ ...formData, endedAt: e.target.value })} />
          <Select label="الحالة" options={tripStatuses} value={formData.status || 'IN_PROGRESS'} onChange={(e) => setFormData({ ...formData, status: e.target.value })} />
          <div className="flex justify-end gap-3 pt-2">
            <Button type="button" variant="ghost" onClick={() => setIsModalOpen(false)}><X className="h-4 w-4" /> إلغاء</Button>
            <Button type="submit" isLoading={formLoading}>{editing ? 'حفظ' : 'إنشاء'}</Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
