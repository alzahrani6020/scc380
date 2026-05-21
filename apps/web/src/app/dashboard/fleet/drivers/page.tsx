'use client';

import { useEffect, useState } from 'react';
import api from '@/lib/api';
import { Users, Plus, Search, Phone, CreditCard, Pencil, Trash2, X } from 'lucide-react';
import Modal from '@/components/ui/Modal';
import Input from '@/components/ui/Input';
import Select from '@/components/ui/Select';
import Button from '@/components/ui/Button';

const driverStatuses = [
  { value: 'ACTIVE', label: 'نشط' },
  { value: 'INACTIVE', label: 'غير نشط' },
  { value: 'SUSPENDED', label: 'موقوف' },
  { value: 'ON_LEAVE', label: 'في إجازة' },
];

export default function DriversPage() {
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
    api.get('/fleet/drivers').then((res) => setItems(res.data.data || [])).catch(console.error).finally(() => setLoading(false));
  };

  const openCreate = () => {
    setEditing(null);
    setFormData({ status: 'ACTIVE' });
    setIsModalOpen(true);
  };

  const openEdit = (item: any) => {
    setEditing(item);
    setFormData({
      ...item,
      licenseExpiry: item.licenseExpiry ? new Date(item.licenseExpiry).toISOString().split('T')[0] : '',
    });
    setIsModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormLoading(true);
    try {
      if (editing) {
        await api.patch(`/fleet/drivers/${editing.id}`, formData);
      } else {
        await api.post('/fleet/drivers', formData);
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
    await api.delete(`/fleet/drivers/${id}`);
    fetchData();
  };

  const filtered = items.filter((d) =>
    d.firstName?.includes(search) || d.lastName?.includes(search) || d.phone?.includes(search)
  );

  return (
    <div className="space-y-6 animate-fade-in-up">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <Users className="h-6 w-6 text-primary-400" />
            السائقين
          </h1>
          <p className="text-slate-400 text-sm mt-1">{items.length} سائق</p>
        </div>
        <Button onClick={openCreate}><Plus className="h-5 w-5" /> إضافة سائق</Button>
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
          {filtered.map((d) => (
            <div key={d.id} className="scc-card-hover group">
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-orange-500 to-amber-600 flex items-center justify-center text-white font-bold text-lg shrink-0">
                  {d.firstName?.charAt(0)}
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="font-bold text-white truncate">{d.firstName} {d.lastName}</h3>
                  <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${
                    d.status === 'ACTIVE' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-slate-500/20 text-slate-400'
                  }`}>{d.status}</span>
                </div>
                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button onClick={() => openEdit(d)} className="p-1.5 rounded-lg hover:bg-primary-500/10 text-primary-400"><Pencil className="h-4 w-4" /></button>
                  <button onClick={() => handleDelete(d.id)} className="p-1.5 rounded-lg hover:bg-red-500/10 text-red-400"><Trash2 className="h-4 w-4" /></button>
                </div>
              </div>
              <div className="mt-4 space-y-2 text-sm">
                {d.phone && <div className="flex items-center gap-2 text-slate-400"><Phone className="h-4 w-4" /><span>{d.phone}</span></div>}
                {d.licenseNumber && <div className="flex items-center gap-2 text-slate-400"><CreditCard className="h-4 w-4" /><span>{d.licenseNumber}</span></div>}
              </div>
            </div>
          ))}
        </div>
      )}

      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title={editing ? 'تعديل سائق' : 'سائق جديد'}>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <Input label="الاسم الأول" required value={formData.firstName || ''} onChange={(e) => setFormData({ ...formData, firstName: e.target.value })} />
            <Input label="الاسم الأخير" required value={formData.lastName || ''} onChange={(e) => setFormData({ ...formData, lastName: e.target.value })} />
            <Input label="البريد الإلكتروني" type="email" value={formData.email || ''} onChange={(e) => setFormData({ ...formData, email: e.target.value })} />
            <Input label="الهاتف" value={formData.phone || ''} onChange={(e) => setFormData({ ...formData, phone: e.target.value })} />
            <Input label="رقم الهوية" value={formData.idNumber || ''} onChange={(e) => setFormData({ ...formData, idNumber: e.target.value })} />
            <Input label="رقم الرخصة" value={formData.licenseNumber || ''} onChange={(e) => setFormData({ ...formData, licenseNumber: e.target.value })} />
            <Input label="انتهاء الرخصة" type="date" value={formData.licenseExpiry || ''} onChange={(e) => setFormData({ ...formData, licenseExpiry: e.target.value })} />
            <Select label="الحالة" options={driverStatuses} value={formData.status || 'ACTIVE'} onChange={(e) => setFormData({ ...formData, status: e.target.value })} />
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
