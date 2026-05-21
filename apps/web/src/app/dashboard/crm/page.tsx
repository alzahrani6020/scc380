'use client';

import { useEffect, useState } from 'react';
import api from '@/lib/api';
import { Users, Plus, Search, Phone, Mail, MapPin, Building2, Pencil, Trash2, X } from 'lucide-react';
import Modal from '@/components/ui/Modal';
import Input from '@/components/ui/Input';
import Select from '@/components/ui/Select';
import Button from '@/components/ui/Button';
import Textarea from '@/components/ui/Textarea';

const contactTypes = [
  { value: 'CUSTOMER', label: 'عميل' },
  { value: 'LEAD', label: 'محتمل' },
  { value: 'PROSPECT', label: ' prospect' },
  { value: 'PARTNER', label: 'شريك' },
  { value: 'SUPPLIER', label: 'مورد' },
  { value: 'VENDOR', label: 'بائع' },
];

const contactStatuses = [
  { value: 'ACTIVE', label: 'نشط' },
  { value: 'INACTIVE', label: 'غير نشط' },
  { value: 'CONVERTED', label: 'محول' },
  { value: 'BLACKLISTED', label: 'محظور' },
];

export default function CrmPage() {
  const [contacts, setContacts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingContact, setEditingContact] = useState<any>(null);
  const [formLoading, setFormLoading] = useState(false);
  const [formData, setFormData] = useState<any>({});

  useEffect(() => {
    fetchContacts();
  }, []);

  const fetchContacts = () => {
    api.get('/crm/contacts').then((res) => setContacts(res.data.data || [])).catch(console.error).finally(() => setLoading(false));
  };

  const openCreate = () => {
    setEditingContact(null);
    setFormData({ type: 'CUSTOMER', status: 'ACTIVE', country: 'SA' });
    setIsModalOpen(true);
  };

  const openEdit = (contact: any) => {
    setEditingContact(contact);
    setFormData({ ...contact });
    setIsModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormLoading(true);
    try {
      if (editingContact) {
        await api.patch(`/crm/contacts/${editingContact.id}`, formData);
      } else {
        await api.post('/crm/contacts', formData);
      }
      setIsModalOpen(false);
      fetchContacts();
    } catch (err) {
      console.error(err);
      alert('حدث خطأ');
    } finally {
      setFormLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('هل أنت متأكد من الحذف؟')) return;
    try {
      await api.delete(`/crm/contacts/${id}`);
      fetchContacts();
    } catch (err) {
      console.error(err);
    }
  };

  const filtered = contacts.filter((c) =>
    `${c.firstName} ${c.lastName}`.includes(search) ||
    c.email?.includes(search) ||
    c.phone?.includes(search)
  );

  return (
    <div className="space-y-6 animate-fade-in-up">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <Users className="h-6 w-6 text-primary-400" />
            إدارة العملاء (CRM)
          </h1>
          <p className="text-slate-400 text-sm mt-1">{contacts.length} جهة اتصال مسجلة</p>
        </div>
        <Button onClick={openCreate}><Plus className="h-5 w-5" /> إضافة جهة اتصال</Button>
      </div>

      <div className="relative">
        <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-500" />
        <input type="text" placeholder="البحث في العملاء..." className="scc-input pr-10" value={search} onChange={(e) => setSearch(e.target.value)} />
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-64">
          <div className="w-10 h-10 border-4 border-primary-500/30 border-t-primary-500 rounded-full animate-spin" />
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((contact) => (
            <div key={contact.id} className="scc-card-hover group">
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-primary-500 to-primary-700 flex items-center justify-center text-white font-bold text-lg shrink-0">
                  {contact.firstName?.charAt(0)}
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="font-bold text-white truncate">{contact.firstName} {contact.lastName}</h3>
                  <p className="text-slate-400 text-sm">{contact.companyName || '—'}</p>
                </div>
                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button onClick={() => openEdit(contact)} className="p-1.5 rounded-lg hover:bg-primary-500/10 text-primary-400"><Pencil className="h-4 w-4" /></button>
                  <button onClick={() => handleDelete(contact.id)} className="p-1.5 rounded-lg hover:bg-red-500/10 text-red-400"><Trash2 className="h-4 w-4" /></button>
                </div>
                <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${
                  contact.type === 'CUSTOMER' ? 'bg-emerald-500/20 text-emerald-400' :
                  contact.type === 'LEAD' ? 'bg-amber-500/20 text-amber-400' :
                  'bg-blue-500/20 text-blue-400'
                }`}>{contact.type}</span>
              </div>
              <div className="mt-4 space-y-2 text-sm">
                {contact.phone && <div className="flex items-center gap-2 text-slate-400"><Phone className="h-4 w-4" /><span>{contact.phone}</span></div>}
                {contact.email && <div className="flex items-center gap-2 text-slate-400"><Mail className="h-4 w-4" /><span className="truncate">{contact.email}</span></div>}
                {contact.city && <div className="flex items-center gap-2 text-slate-400"><MapPin className="h-4 w-4" /><span>{contact.city}</span></div>}
              </div>
            </div>
          ))}
        </div>
      )}

      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title={editingContact ? 'تعديل جهة اتصال' : 'إضافة جهة اتصال'} size="lg">
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Input label="الاسم الأول" required value={formData.firstName || ''} onChange={(e) => setFormData({ ...formData, firstName: e.target.value })} />
            <Input label="الاسم الأخير" required value={formData.lastName || ''} onChange={(e) => setFormData({ ...formData, lastName: e.target.value })} />
            <Input label="البريد الإلكتروني" type="email" value={formData.email || ''} onChange={(e) => setFormData({ ...formData, email: e.target.value })} />
            <Input label="الهاتف" value={formData.phone || ''} onChange={(e) => setFormData({ ...formData, phone: e.target.value })} />
            <Input label="الهاتف 2" value={formData.phone2 || ''} onChange={(e) => setFormData({ ...formData, phone2: e.target.value })} />
            <Input label="اسم الشركة" value={formData.companyName || ''} onChange={(e) => setFormData({ ...formData, companyName: e.target.value })} />
            <Input label="المسمى الوظيفي" value={formData.jobTitle || ''} onChange={(e) => setFormData({ ...formData, jobTitle: e.target.value })} />
            <Input label="رقم الهوية" value={formData.idNumber || ''} onChange={(e) => setFormData({ ...formData, idNumber: e.target.value })} />
            <Input label="الرقم الضريبي" value={formData.vatNumber || ''} onChange={(e) => setFormData({ ...formData, vatNumber: e.target.value })} />
            <Input label="السجل التجاري" value={formData.crNumber || ''} onChange={(e) => setFormData({ ...formData, crNumber: e.target.value })} />
            <Input label="المدينة" value={formData.city || ''} onChange={(e) => setFormData({ ...formData, city: e.target.value })} />
            <Input label="المنطقة" value={formData.region || ''} onChange={(e) => setFormData({ ...formData, region: e.target.value })} />
            <Select label="النوع" options={contactTypes} value={formData.type || 'CUSTOMER'} onChange={(e) => setFormData({ ...formData, type: e.target.value })} />
            <Select label="الحالة" options={contactStatuses} value={formData.status || 'ACTIVE'} onChange={(e) => setFormData({ ...formData, status: e.target.value })} />
          </div>
          <Textarea label="العنوان" rows={2} value={formData.address || ''} onChange={(e) => setFormData({ ...formData, address: e.target.value })} />
          <div className="flex justify-end gap-3 pt-2">
            <Button type="button" variant="ghost" onClick={() => setIsModalOpen(false)}><X className="h-4 w-4" /> إلغاء</Button>
            <Button type="submit" isLoading={formLoading}>{editingContact ? 'حفظ التعديلات' : 'إنشاء'}</Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
