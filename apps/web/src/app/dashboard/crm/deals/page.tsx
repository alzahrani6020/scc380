'use client';

import { useEffect, useState } from 'react';
import api from '@/lib/api';
import { Briefcase, Plus, Search, TrendingUp, Pencil, Trash2, X } from 'lucide-react';
import Modal from '@/components/ui/Modal';
import Input from '@/components/ui/Input';
import Select from '@/components/ui/Select';
import Button from '@/components/ui/Button';
import Textarea from '@/components/ui/Textarea';

const stages = [
  { value: 'LEAD', label: 'محتمل' },
  { value: 'QUALIFIED', label: 'مؤهل' },
  { value: 'PROPOSAL', label: 'عرض سعر' },
  { value: 'NEGOTIATION', label: 'تفاوض' },
  { value: 'CLOSED_WON', label: 'مغلق (ربح)' },
  { value: 'CLOSED_LOST', label: 'مغلق (خسارة)' },
];

const stageColors: Record<string, string> = {
  LEAD: 'bg-slate-500/20 text-slate-400',
  QUALIFIED: 'bg-blue-500/20 text-blue-400',
  PROPOSAL: 'bg-violet-500/20 text-violet-400',
  NEGOTIATION: 'bg-amber-500/20 text-amber-400',
  CLOSED_WON: 'bg-emerald-500/20 text-emerald-400',
  CLOSED_LOST: 'bg-red-500/20 text-red-400',
};

export default function DealsPage() {
  const [items, setItems] = useState<any[]>([]);
  const [contacts, setContacts] = useState<any[]>([]);
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
      api.get('/crm/deals').then(r => setItems(r.data.data || [])),
      api.get('/crm/contacts').then(r => setContacts(r.data.data || [])),
    ]).catch(console.error).finally(() => setLoading(false));
  };

  const openCreate = () => {
    setEditing(null);
    setFormData({ stage: 'LEAD', currency: 'SAR', probability: 0 });
    setIsModalOpen(true);
  };

  const openEdit = (item: any) => {
    setEditing(item);
    setFormData({
      ...item,
      expectedClose: item.expectedClose ? new Date(item.expectedClose).toISOString().split('T')[0] : '',
    });
    setIsModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormLoading(true);
    try {
      const payload = { ...formData };
      if (payload.value) payload.value = parseFloat(payload.value);
      if (payload.probability) payload.probability = parseInt(payload.probability);
      if (editing) {
        await api.patch(`/crm/deals/${editing.id}`, payload);
      } else {
        await api.post('/crm/deals', payload);
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
    await api.delete(`/crm/deals/${id}`);
    fetchData();
  };

  const filtered = items.filter((d) => d.title?.includes(search) || d.description?.includes(search));

  const contactOptions = contacts.map(c => ({ value: c.id, label: `${c.firstName} ${c.lastName}` }));

  return (
    <div className="space-y-6 animate-fade-in-up">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <Briefcase className="h-6 w-6 text-primary-400" />
            الصفقات
          </h1>
          <p className="text-slate-400 text-sm mt-1">{items.length} صفقة</p>
        </div>
        <Button onClick={openCreate}><Plus className="h-5 w-5" /> صفقة جديدة</Button>
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
          {filtered.map((d) => (
            <div key={d.id} className="scc-card-hover flex items-center justify-between group">
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center text-white shrink-0">
                  <TrendingUp className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="font-bold text-white text-sm">{d.title}</h3>
                  <p className="text-slate-400 text-xs">{d.currency} {Number(d.value).toLocaleString()}</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <div className="text-left">
                  <span className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-medium ${stageColors[d.stage]}`}>{stages.find(s => s.value === d.stage)?.label || d.stage}</span>
                  {d.probability !== null && <p className="text-slate-500 text-xs mt-1">{d.probability}% احتمالية</p>}
                </div>
                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button onClick={() => openEdit(d)} className="p-1.5 rounded-lg hover:bg-primary-500/10 text-primary-400"><Pencil className="h-4 w-4" /></button>
                  <button onClick={() => handleDelete(d.id)} className="p-1.5 rounded-lg hover:bg-red-500/10 text-red-400"><Trash2 className="h-4 w-4" /></button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title={editing ? 'تعديل صفقة' : 'صفقة جديدة'} size="lg">
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Input label="العنوان" required value={formData.title || ''} onChange={(e) => setFormData({ ...formData, title: e.target.value })} />
            <Select label="العميل" required options={contactOptions} value={formData.contactId || ''} onChange={(e) => setFormData({ ...formData, contactId: e.target.value })} />
            <Input label="القيمة" type="number" value={formData.value || ''} onChange={(e) => setFormData({ ...formData, value: e.target.value })} />
            <Input label="العملة" value={formData.currency || 'SAR'} onChange={(e) => setFormData({ ...formData, currency: e.target.value })} />
            <Select label="المرحلة" options={stages} value={formData.stage || 'LEAD'} onChange={(e) => setFormData({ ...formData, stage: e.target.value })} />
            <Input label="الاحتمالية %" type="number" min="0" max="100" value={formData.probability || 0} onChange={(e) => setFormData({ ...formData, probability: e.target.value })} />
            <Input label="تاريخ الإغلاق المتوقع" type="date" value={formData.expectedClose || ''} onChange={(e) => setFormData({ ...formData, expectedClose: e.target.value })} />
          </div>
          <Textarea label="الوصف" rows={3} value={formData.description || ''} onChange={(e) => setFormData({ ...formData, description: e.target.value })} />
          <div className="flex justify-end gap-3 pt-2">
            <Button type="button" variant="ghost" onClick={() => setIsModalOpen(false)}><X className="h-4 w-4" /> إلغاء</Button>
            <Button type="submit" isLoading={formLoading}>{editing ? 'حفظ' : 'إنشاء'}</Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
