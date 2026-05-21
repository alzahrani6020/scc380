'use client';

import { useEffect, useState } from 'react';
import api from '@/lib/api';
import { Truck, Plus, Search, Pencil, Trash2, X, Fuel, Wrench, Route, FileText } from 'lucide-react';
import Modal from '@/components/ui/Modal';
import Input from '@/components/ui/Input';
import Select from '@/components/ui/Select';
import Button from '@/components/ui/Button';

const vehicleStatuses = [
  { value: 'ACTIVE', label: 'نشطة' },
  { value: 'INACTIVE', label: 'غير نشطة' },
  { value: 'IN_MAINTENANCE', label: 'في الصيانة' },
  { value: 'SOLD', label: 'مباعة' },
  { value: 'RETIRED', label: 'مهجورة' },
];

const ownershipTypes = [
  { value: 'OWNED', label: 'مملوكة' },
  { value: 'LEASED', label: 'مستأجرة' },
  { value: 'RENTED', label: 'مؤجرة' },
];

const fuelTypes = [
  { value: 'PETROL', label: 'بنزين' },
  { value: 'DIESEL', label: 'ديزل' },
  { value: 'ELECTRIC', label: 'كهرباء' },
  { value: 'HYBRID', label: 'هجين' },
];

const plateTypes = [
  { value: 'PRIVATE', label: 'خصوصي' },
  { value: 'COMMERCIAL', label: 'تجاري' },
  { value: 'TRANSPORT', label: 'نقل' },
  { value: 'HEAVY', label: 'ثقيل' },
  { value: 'DIPLOMATIC', label: 'دبلوماسي' },
  { value: 'TEMPORARY', label: 'مؤقت' },
];

export default function FleetPage() {
  const [items, setItems] = useState<any[]>([]);
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
    api.get('/fleet/vehicles').then((res) => setItems(res.data.data || [])).catch(console.error).finally(() => setLoading(false));
  };

  const openCreate = () => {
    setEditing(null);
    setFormData({ status: 'ACTIVE', ownershipType: 'OWNED', fuelType: 'PETROL', plateType: 'PRIVATE' });
    setIsModalOpen(true);
  };

  const openEdit = (item: any) => {
    setEditing(item);
    setFormData({
      ...item,
      istimaraExpiry: item.istimaraExpiry ? new Date(item.istimaraExpiry).toISOString().split('T')[0] : '',
      insuranceExpiry: item.insuranceExpiry ? new Date(item.insuranceExpiry).toISOString().split('T')[0] : '',
      periodicInspectionExpiry: item.periodicInspectionExpiry ? new Date(item.periodicInspectionExpiry).toISOString().split('T')[0] : '',
    });
    setIsModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormLoading(true);
    try {
      if (editing) {
        await api.patch(`/fleet/vehicles/${editing.id}`, formData);
      } else {
        await api.post('/fleet/vehicles', formData);
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
    await api.delete(`/fleet/vehicles/${id}`);
    fetchData();
  };

  const filtered = items.filter((v) => v.plateNumber?.includes(search) || v.make?.includes(search));

  return (
    <div className="space-y-6 animate-fade-in-up">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <Truck className="h-6 w-6 text-primary-400" />
            إدارة الأسطول
          </h1>
          <p className="text-slate-400 text-sm mt-1">{items.length} مركبة</p>
        </div>
        <Button onClick={openCreate}><Plus className="h-5 w-5" /> إضافة مركبة</Button>
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
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((v) => (
            <div key={v.id} className="scc-card-hover group">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-orange-500 to-amber-600 flex items-center justify-center text-white">
                    <Truck className="h-6 w-6" />
                  </div>
                  <div>
                    <h3 className="font-bold text-white">{v.plateNumber}</h3>
                    <p className="text-slate-400 text-sm">{v.make} {v.model} {v.year}</p>
                  </div>
                </div>
                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button onClick={() => window.open(`/dashboard/templates?search=صيانة`, '_blank')} className="p-1.5 rounded-lg hover:bg-blue-500/10 text-blue-400" title="تصدير كنموذج"><FileText className="h-4 w-4" /></button>
                  <button onClick={() => openEdit(v)} className="p-1.5 rounded-lg hover:bg-primary-500/10 text-primary-400"><Pencil className="h-4 w-4" /></button>
                  <button onClick={() => handleDelete(v.id)} className="p-1.5 rounded-lg hover:bg-red-500/10 text-red-400"><Trash2 className="h-4 w-4" /></button>
                </div>
              </div>
              <div className="mt-4 flex items-center gap-2">
                <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${
                  v.status === 'ACTIVE' ? 'bg-emerald-500/20 text-emerald-400' :
                  v.status === 'IN_MAINTENANCE' ? 'bg-amber-500/20 text-amber-400' :
                  'bg-slate-500/20 text-slate-400'
                }`}>{v.status}</span>
                <span className="text-slate-500 text-xs">{v.fuelType}</span>
              </div>
            </div>
          ))}
        </div>
      )}

      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title={editing ? 'تعديل مركبة' : 'مركبة جديدة'} size="xl">
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Input label="رقم اللوحة" required value={formData.plateNumber || ''} onChange={(e) => setFormData({ ...formData, plateNumber: e.target.value })} />
            <Select label="نوع اللوحة" options={plateTypes} value={formData.plateType || 'PRIVATE'} onChange={(e) => setFormData({ ...formData, plateType: e.target.value })} />
            <Input label="الشركة المصنعة" required value={formData.make || ''} onChange={(e) => setFormData({ ...formData, make: e.target.value })} />
            <Input label="الموديل" required value={formData.model || ''} onChange={(e) => setFormData({ ...formData, model: e.target.value })} />
            <Input label="السنة" type="number" value={formData.year || ''} onChange={(e) => setFormData({ ...formData, year: e.target.value })} />
            <Input label="اللون" value={formData.color || ''} onChange={(e) => setFormData({ ...formData, color: e.target.value })} />
            <Input label="رقم الهيكل (VIN)" value={formData.vin || ''} onChange={(e) => setFormData({ ...formData, vin: e.target.value })} />
            <Select label="الحالة" options={vehicleStatuses} value={formData.status || 'ACTIVE'} onChange={(e) => setFormData({ ...formData, status: e.target.value })} />
            <Select label="نوع الملكية" options={ownershipTypes} value={formData.ownershipType || 'OWNED'} onChange={(e) => setFormData({ ...formData, ownershipType: e.target.value })} />
            <Select label="نوع الوقود" options={fuelTypes} value={formData.fuelType || 'PETROL'} onChange={(e) => setFormData({ ...formData, fuelType: e.target.value })} />
            <Input label="انتهاء الاستمارة" type="date" value={formData.istimaraExpiry || ''} onChange={(e) => setFormData({ ...formData, istimaraExpiry: e.target.value })} />
            <Input label="انتهاء التأمين" type="date" value={formData.insuranceExpiry || ''} onChange={(e) => setFormData({ ...formData, insuranceExpiry: e.target.value })} />
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <Button type="button" variant="ghost" onClick={() => setIsModalOpen(false)}><X className="h-4 w-4" /> إلغاء</Button>
            <Button type="submit" isLoading={formLoading}>{editing ? 'حفظ' : 'إنشاء'}</Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
