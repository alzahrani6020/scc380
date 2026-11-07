'use client';

import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import api from '@/lib/api';
import { Activity, CalendarClock, CheckCircle2, Pencil, Plus, RefreshCw, Search, Trash2, X } from 'lucide-react';
import Modal from '@/components/ui/Modal';
import Input from '@/components/ui/Input';
import Select from '@/components/ui/Select';
import Button from '@/components/ui/Button';
import Textarea from '@/components/ui/Textarea';

const activityTypes = [
  { value: '', label: 'كل الأنواع' },
  { value: 'CALL', label: 'مكالمة' },
  { value: 'MEETING', label: 'اجتماع' },
  { value: 'EMAIL', label: 'بريد إلكتروني' },
  { value: 'TASK', label: 'مهمة' },
  { value: 'NOTE', label: 'ملاحظة' },
  { value: 'WHATSAPP', label: 'واتساب' },
  { value: 'SMS', label: 'رسالة نصية' },
  { value: 'VISIT', label: 'زيارة' },
];

export default function ActivitiesPage() {
  const searchParams = useSearchParams();
  const [items, setItems] = useState<any[]>([]);
  const [contacts, setContacts] = useState<any[]>([]);
  const [deals, setDeals] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [type, setType] = useState(searchParams.get('type') || '');
  const [contactId, setContactId] = useState(searchParams.get('contactId') || '');
  const [dealId, setDealId] = useState(searchParams.get('dealId') || '');
  const [search, setSearch] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [formLoading, setFormLoading] = useState(false);
  const [formData, setFormData] = useState<any>({ type: 'TASK' });

  const fetchData = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (type) params.set('type', type);
      if (contactId) params.set('contactId', contactId);
      if (dealId) params.set('dealId', dealId);

      const [activitiesRes, contactsRes, dealsRes] = await Promise.all([
        api.get('/crm/activities' + (params.toString() ? `?${params.toString()}` : '')),
        api.get('/crm/contacts?limit=100'),
        api.get('/crm/deals'),
      ]);
      setItems(activitiesRes.data?.data || []);
      setContacts(contactsRes.data?.data || []);
      setDeals(dealsRes.data?.data || []);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData().catch(console.error);
  }, [type, contactId, dealId]);

  const contactOptions = useMemo(() => [
    { value: '', label: 'كل جهات الاتصال' },
    ...contacts.map((c) => ({ value: c.id, label: `${c.firstName} ${c.lastName}` })),
  ], [contacts]);

  const dealOptions = useMemo(() => [
    { value: '', label: 'كل الصفقات' },
    ...deals.map((d) => ({ value: d.id, label: d.title })),
  ], [deals]);

  const filtered = items.filter((item) => {
    const q = search.trim().toLowerCase();
    if (!q) return true;
    return [item.subject, item.description].some((v) => String(v || '').toLowerCase().includes(q));
  });

  const openCreate = () => {
    setEditing(null);
    setFormData({
      type: 'TASK',
      contactId: contactId || '',
      dealId: dealId || '',
      scheduledAt: '',
      description: '',
      subject: '',
    });
    setIsModalOpen(true);
  };

  const openEdit = (item: any) => {
    setEditing(item);
    setFormData({
      ...item,
      scheduledAt: item.scheduledAt ? new Date(item.scheduledAt).toISOString().slice(0, 16) : '',
      completedAt: item.completedAt ? new Date(item.completedAt).toISOString().slice(0, 16) : '',
    });
    setIsModalOpen(true);
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormLoading(true);
    try {
      const payload = { ...formData };
      for (const key of ['contactId', 'dealId', 'scheduledAt', 'completedAt', 'assignedToId', 'description']) {
        if (payload[key] === '') delete payload[key];
      }
      if (editing) await api.patch(`/crm/activities/${editing.id}`, payload);
      else await api.post('/crm/activities', payload);
      setIsModalOpen(false);
      await fetchData();
    } finally {
      setFormLoading(false);
    }
  };

  const remove = async (id: string) => {
    if (!confirm('هل تريد حذف هذا النشاط؟')) return;
    await api.delete(`/crm/activities/${id}`);
    await fetchData();
  };

  const markCompleted = async (item: any) => {
    await api.patch(`/crm/activities/${item.id}`, { completedAt: new Date().toISOString() });
    await fetchData();
  };

  return (
    <div className="space-y-6 animate-fade-in-up">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <Activity className="h-6 w-6 text-primary-400" />
            أنشطة CRM
          </h1>
          <p className="text-slate-400 text-sm mt-1">متابعة المكالمات والاجتماعات والمهام المرتبطة بالعملاء والصفقات</p>
        </div>
        <Button onClick={openCreate}><Plus className="h-5 w-5" /> نشاط جديد</Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
        <div className="relative md:col-span-1">
          <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
          <input className="scc-input pr-9" placeholder="بحث في الأنشطة..." value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <Select options={activityTypes} value={type} onChange={(e) => setType(e.target.value)} />
        <Select options={contactOptions} value={contactId} onChange={(e) => setContactId(e.target.value)} />
        <Select options={dealOptions} value={dealId} onChange={(e) => setDealId(e.target.value)} />
      </div>

      {loading ? (
        <div className="h-64 flex items-center justify-center"><RefreshCw className="h-8 w-8 animate-spin text-primary-400" /></div>
      ) : filtered.length === 0 ? (
        <div className="scc-card text-center py-14">
          <CalendarClock className="h-10 w-10 text-slate-600 mx-auto mb-3" />
          <p className="text-slate-300 font-medium">لا توجد أنشطة مطابقة</p>
          <p className="text-slate-500 text-sm mt-1">أنشئ نشاطًا أو غيّر عوامل التصفية.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((item) => {
            const contact = contacts.find((c) => c.id === item.contactId);
            const deal = deals.find((d) => d.id === item.dealId);
            return (
              <div key={item.id} className="scc-card-hover flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-[11px] px-2 py-1 rounded-full bg-primary-500/10 text-primary-300">{item.type}</span>
                    {item.completedAt && <span className="text-[11px] px-2 py-1 rounded-full bg-emerald-500/10 text-emerald-300">مكتمل</span>}
                  </div>
                  <h3 className="text-white font-semibold mt-2">{item.subject}</h3>
                  {item.description && <p className="text-slate-400 text-sm mt-1">{item.description}</p>}
                  <div className="flex flex-wrap gap-3 text-xs text-slate-500 mt-2">
                    {contact && <span>العميل: {contact.firstName} {contact.lastName}</span>}
                    {deal && <span>الصفقة: {deal.title}</span>}
                    {item.scheduledAt && <span>الموعد: {new Date(item.scheduledAt).toLocaleString('ar-SA')}</span>}
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {!item.completedAt && (
                    <button onClick={() => markCompleted(item)} className="p-2 rounded-lg hover:bg-emerald-500/10 text-emerald-400" title="إكمال">
                      <CheckCircle2 className="h-4 w-4" />
                    </button>
                  )}
                  <button onClick={() => openEdit(item)} className="p-2 rounded-lg hover:bg-primary-500/10 text-primary-400" title="تعديل">
                    <Pencil className="h-4 w-4" />
                  </button>
                  <button onClick={() => remove(item.id)} className="p-2 rounded-lg hover:bg-red-500/10 text-red-400" title="حذف">
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title={editing ? 'تعديل النشاط' : 'نشاط جديد'} size="lg">
        <form onSubmit={submit} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Select label="النوع" options={activityTypes.filter((x) => x.value)} value={formData.type || 'TASK'} onChange={(e) => setFormData({ ...formData, type: e.target.value })} />
            <Input label="الموضوع" required value={formData.subject || ''} onChange={(e) => setFormData({ ...formData, subject: e.target.value })} />
            <Select label="جهة الاتصال" options={contactOptions} value={formData.contactId || ''} onChange={(e) => setFormData({ ...formData, contactId: e.target.value })} />
            <Select label="الصفقة" options={dealOptions} value={formData.dealId || ''} onChange={(e) => setFormData({ ...formData, dealId: e.target.value })} />
            <Input label="موعد النشاط" type="datetime-local" value={formData.scheduledAt || ''} onChange={(e) => setFormData({ ...formData, scheduledAt: e.target.value })} />
          </div>
          <Textarea label="الوصف" rows={3} value={formData.description || ''} onChange={(e) => setFormData({ ...formData, description: e.target.value })} />
          <div className="flex justify-end gap-3">
            <Button type="button" variant="ghost" onClick={() => setIsModalOpen(false)}><X className="h-4 w-4" /> إلغاء</Button>
            <Button type="submit" isLoading={formLoading}>{editing ? 'حفظ' : 'إنشاء'}</Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
