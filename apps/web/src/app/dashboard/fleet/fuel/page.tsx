'use client';

import { useEffect, useState } from 'react';
import api from '@/lib/api';
import { Fuel, Plus, Search, Truck, Pencil, Trash2, X } from 'lucide-react';
import Modal from '@/components/ui/Modal';
import Input from '@/components/ui/Input';
import Select from '@/components/ui/Select';
import Button from '@/components/ui/Button';

const fuelTypes = [
  { value: 'PETROL', label: 'بنزين' },
  { value: 'DIESEL', label: 'ديزل' },
  { value: 'ELECTRIC', label: 'كهرباء' },
  { value: 'HYBRID', label: 'هجين' },
];

export default function FuelLogsPage() {
  const [items, setItems] = useState<any[]>([]);
  const [vehicles, setVehicles] = useState<any[]>([]);
  const [drivers, setDrivers] = useState<any[]>([]);
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
      api.get('/fleet/fuel-logs').then(r => setItems(r.data.data || [])),
      api.get('/fleet/vehicles').then(r => setVehicles(r.data.data || [])),
      api.get('/fleet/drivers').then(r => setDrivers(r.data.data || [])),
    ]).catch(console.error).finally(() => setLoading(false));
  };

  const openCreate = () => {
    setEditing(null);
    setFormData({ fuelType: 'PETROL' });
    setIsModalOpen(true);
  };

  const openEdit = (item: any) => {
    setEditing(item);
    setFormData({
      ...item,
      fueledAt: item.fueledAt ? new Date(item.fueledAt).toISOString().slice(0, 16) : '',
    });
    setIsModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormLoading(true);
    try {
      const payload = {
        ...formData,
        liters: parseFloat(formData.liters) || 0,
        pricePerLiter: parseFloat(formData.pricePerLiter) || 0,
        totalCost: parseFloat(formData.totalCost) || 0,
        odometer: parseFloat(formData.odometer) || 0,
      };
      if (editing) {
        await api.patch(`/fleet/fuel-logs/${editing.id}`, payload);
      } else {
        await api.post('/fleet/fuel-logs', payload);
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
    await api.delete(`/fleet/fuel-logs/${id}`);
    fetchData();
  };

  const filtered = items.filter((f) => f.vehicle?.plateNumber?.includes(search) || f.location?.includes(search));

  const vehicleOptions = vehicles.map(v => ({ value: v.id, label: v.plateNumber }));
  const driverOptions = drivers.map(d => ({ value: d.id, label: `${d.firstName} ${d.lastName}` }));

  return (
    <div className="space-y-6 animate-fade-in-up">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <Fuel className="h-6 w-6 text-primary-400" />
            سجل الوقود
          </h1>
          <p className="text-slate-400 text-sm mt-1">{items.length} تعبئة</p>
        </div>
        <Button onClick={openCreate}><Plus className="h-5 w-5" /> تعبئة جديدة</Button>
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
          {filtered.map((f) => (
            <div key={f.id} className="scc-card-hover flex items-center justify-between group">
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-orange-500 to-red-600 flex items-center justify-center text-white shrink-0">
                  <Fuel className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="font-bold text-white text-sm">{f.vehicle?.plateNumber}</h3>
                  <p className="text-slate-400 text-xs">{f.fuelType} • {Number(f.liters).toFixed(2)} لتر</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <div className="text-left">
                  <p className="text-white font-bold text-sm">{Number(f.totalCost).toLocaleString()} ر.س</p>
                  <p className="text-slate-500 text-xs mt-1">{new Date(f.fueledAt).toLocaleDateString('ar-SA')}</p>
                  {f.location && <p className="text-slate-500 text-xs">{f.location}</p>}
                </div>
                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button onClick={() => openEdit(f)} className="p-1.5 rounded-lg hover:bg-primary-500/10 text-primary-400"><Pencil className="h-4 w-4" /></button>
                  <button onClick={() => handleDelete(f.id)} className="p-1.5 rounded-lg hover:bg-red-500/10 text-red-400"><Trash2 className="h-4 w-4" /></button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title={editing ? 'تعديل تعبئة' : 'تعبئة جديدة'}>
        <form onSubmit={handleSubmit} className="space-y-4">
          <Select label="المركبة" required options={vehicleOptions} value={formData.vehicleId || ''} onChange={(e) => setFormData({ ...formData, vehicleId: e.target.value })} />
          <Select label="السائق" options={driverOptions} value={formData.driverId || ''} onChange={(e) => setFormData({ ...formData, driverId: e.target.value })} />
          <Select label="نوع الوقود" options={fuelTypes} value={formData.fuelType || 'PETROL'} onChange={(e) => setFormData({ ...formData, fuelType: e.target.value })} />
          <div className="grid grid-cols-3 gap-4">
            <Input label="الكمية (لتر)" type="number" step="0.01" required value={formData.liters || ''} onChange={(e) => setFormData({ ...formData, liters: e.target.value })} />
            <Input label="السعر/لتر" type="number" step="0.01" required value={formData.pricePerLiter || ''} onChange={(e) => setFormData({ ...formData, pricePerLiter: e.target.value })} />
            <Input label="الإجمالي" type="number" step="0.01" required value={formData.totalCost || ''} onChange={(e) => setFormData({ ...formData, totalCost: e.target.value })} />
          </div>
          <Input label="القراءة (كم)" type="number" value={formData.odometer || ''} onChange={(e) => setFormData({ ...formData, odometer: e.target.value })} />
          <Input label="الموقع" value={formData.location || ''} onChange={(e) => setFormData({ ...formData, location: e.target.value })} />
          <Input label="التاريخ" type="datetime-local" value={formData.fueledAt || ''} onChange={(e) => setFormData({ ...formData, fueledAt: e.target.value })} />
          <div className="flex justify-end gap-3 pt-2">
            <Button type="button" variant="ghost" onClick={() => setIsModalOpen(false)}><X className="h-4 w-4" /> إلغاء</Button>
            <Button type="submit" isLoading={formLoading}>{editing ? 'حفظ' : 'تسجيل'}</Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
