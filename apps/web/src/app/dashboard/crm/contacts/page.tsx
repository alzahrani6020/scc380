'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import api from '@/lib/api';
import { Users, Plus, Search, Phone, Mail, MapPin, Pencil, Trash2, X, AlertCircle, RefreshCw, Download, Upload } from 'lucide-react';
import Modal from '@/components/ui/Modal';
import Input from '@/components/ui/Input';
import Select from '@/components/ui/Select';
import Button from '@/components/ui/Button';
import Textarea from '@/components/ui/Textarea';
import AsyncCombobox, { type AsyncComboboxOption } from '@/components/ui/AsyncCombobox';

const PAGE_SIZE = 25;

const contactTypes = [
  { value: 'CUSTOMER', label: 'عميل' },
  { value: 'LEAD', label: 'محتمل' },
  { value: 'PROSPECT', label: 'عميل محتمل' },
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

const typeFilterOptions = [{ value: '', label: 'كل الأنواع' }, ...contactTypes];
const statusFilterOptions = [{ value: '', label: 'كل الحالات' }, ...contactStatuses];

export default function CrmPage() {
  const [contacts, setContacts] = useState<any[]>([]);
  const [csvLoading, setCsvLoading] = useState(false);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingContact, setEditingContact] = useState<any>(null);
  const [formLoading, setFormLoading] = useState(false);
  const [formData, setFormData] = useState<any>({});
  const abortRef = useRef<AbortController | null>(null);

  const fetchContacts = useCallback((p: number, s: string, t: string, st: string) => {
    abortRef.current?.abort();
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    setLoading(true);
    setError(null);
    const params = new URLSearchParams({ page: String(p), limit: String(PAGE_SIZE) });
    if (s) params.set('search', s);
    if (t) params.set('type', t);
    if (st) params.set('status', st);
    api
      .get(`/crm/contacts?${params.toString()}`, { signal: ctrl.signal })
      .then((res) => {
        const body = res.data as { data: any[]; count: number; page: number; limit: number };
        setContacts(body.data);
        setTotal(body.count);
      })
      .catch((err) => {
        if (err?.code === 'ERR_CANCELED') return;
        setError('تعذر تحميل جهات الاتصال. تحقق من الاتصال بالخادم.');
      })
      .finally(() => {
        if (!ctrl.signal.aborted) setLoading(false);
      });
  }, []);

  const loadCompanies = useCallback(async (query: string, signal: AbortSignal): Promise<AsyncComboboxOption[]> => {
    const params = new URLSearchParams({ limit: '20', active: 'true' });
    if (query) params.set('search', query);
    const res = await api.get('/crm/companies?' + params.toString(), { signal });
    return (res.data?.data || []).map((company: any) => ({ value: company.id, label: company.name }));
  }, []);

  const resolveCompany = useCallback(async (id: string, signal: AbortSignal): Promise<AsyncComboboxOption | null> => {
    try {
      const res = await api.get('/crm/companies/' + id, { signal });
      return res.data ? { value: res.data.id, label: res.data.name } : null;
    } catch (err: any) {
      if (err?.code === 'ERR_CANCELED') throw err;
      return null;
    }
  }, []);

  // Debounce the search box (400ms) before it becomes a server query.
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search), 400);
    return () => clearTimeout(timer);
  }, [search]);

  // Any filter change restarts from page 1.
  useEffect(() => {
    setPage(1);
  }, [debouncedSearch, typeFilter, statusFilter]);

  useEffect(() => {
    fetchContacts(page, debouncedSearch, typeFilter, statusFilter);
  }, [page, debouncedSearch, typeFilter, statusFilter, fetchContacts]);

  // Cancel in-flight request on unmount.
  useEffect(() => {
    return () => abortRef.current?.abort();
  }, []);

  const openCreate = () => {
    setEditingContact(null);
    setFormData({ type: 'CUSTOMER', status: 'ACTIVE', country: 'SA' });
    setIsModalOpen(true);
  };

  const openEdit = (contact: any) => {
    setEditingContact(contact);
    // Only DTO-whitelisted fields — the API rejects unknown fields (forbidNonWhitelisted)
    setFormData({
      firstName: contact.firstName || '',
      lastName: contact.lastName || '',
      email: contact.email || '',
      phone: contact.phone || '',
      phone2: contact.phone2 || '',
      companyName: contact.companyName || '',
      companyId: contact.companyId || '',
      jobTitle: contact.jobTitle || '',
      idNumber: contact.idNumber || '',
      vatNumber: contact.vatNumber || '',
      crNumber: contact.crNumber || '',
      address: contact.address || '',
      city: contact.city || '',
      region: contact.region || '',
      country: contact.country || 'SA',
      type: contact.type || 'CUSTOMER',
      status: contact.status || 'ACTIVE',
    });
    setIsModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormLoading(true);
    try {
      const payload = { ...formData };
      if (payload.companyId === '') {
        if (editingContact) payload.companyId = null;
        else delete payload.companyId;
      }
      if (editingContact) {
        await api.patch(`/crm/contacts/${editingContact.id}`, payload);
      } else {
        await api.post('/crm/contacts', payload);
      }
      setIsModalOpen(false);
      fetchContacts(page, debouncedSearch, typeFilter, statusFilter);
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
      if (contacts.length === 1 && page > 1) {
        setPage(page - 1);
      } else {
        fetchContacts(page, debouncedSearch, typeFilter, statusFilter);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const exportCsv = async () => {
    setCsvLoading(true);
    try {
      const res = await api.get('/crm/csv/contacts', { responseType: 'blob' });
      const url = URL.createObjectURL(new Blob([res.data], { type: 'text/csv;charset=utf-8' }));
      const a = document.createElement('a');
      a.href = url;
      a.download = 'crm-contacts.csv';
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } finally {
      setCsvLoading(false);
    }
  };

  const importCsv = async (file?: File) => {
    if (!file) return;
    setCsvLoading(true);
    try {
      const csv = await file.text();
      const preview = await api.post('/crm/csv/contacts/import', { csv, dryRun: true });
      const p = preview.data;
      const message = 'الصفوف: ' + p.totalRows + '\nصالحة: ' + p.validRows + '\nمكررة: ' + p.duplicates.length + '\nأخطاء: ' + p.errors.length;
      if (p.errors.length) {
        alert(message + '\nلن يتم الاستيراد حتى تصحيح الأخطاء.');
        return;
      }
      if (!confirm(message + '\nهل تريد تنفيذ الاستيراد؟')) return;
      const result = await api.post('/crm/csv/contacts/import', { csv, dryRun: false });
      alert('تم استيراد ' + result.data.imported + ' وتجاوز ' + result.data.skippedDuplicates + ' مكرر.');
      fetchContacts(1, debouncedSearch, typeFilter, statusFilter);
      setPage(1);
    } finally {
      setCsvLoading(false);
    }
  };

  const hasActiveFilters = Boolean(debouncedSearch || typeFilter || statusFilter);
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <div className="space-y-6 animate-fade-in-up">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <Users className="h-6 w-6 text-primary-400" />
            إدارة العملاء (CRM)
          </h1>
          <p className="text-slate-400 text-sm mt-1">{total} جهة اتصال مسجلة</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="ghost" onClick={exportCsv} disabled={csvLoading}><Download className="h-4 w-4" /> تصدير CSV</Button>
          <input id="crm-csv-import" type="file" accept=".csv,text/csv" className="hidden" onChange={(e) => { const file = e.target.files?.[0]; importCsv(file).catch(console.error); e.currentTarget.value = ''; }} />
          <Button variant="ghost" onClick={() => document.getElementById('crm-csv-import')?.click()} disabled={csvLoading}><Upload className="h-4 w-4" /> استيراد CSV</Button>
          <Button onClick={openCreate}><Plus className="h-5 w-5" /> إضافة جهة اتصال</Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
        <div className="relative md:col-span-2">
          <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-500" />
          <input
            type="text"
            placeholder="البحث في العملاء..."
            className="scc-input pr-10 w-full"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <Select
          aria-label="تصفية حسب النوع"
          options={typeFilterOptions}
          value={typeFilter}
          onChange={(e) => setTypeFilter(e.target.value)}
        />
        <Select
          aria-label="تصفية حسب الحالة"
          options={statusFilterOptions}
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
        />
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-64">
          <div className="w-10 h-10 border-4 border-primary-500/30 border-t-primary-500 rounded-full animate-spin" />
        </div>
      ) : error ? (
        <div className="flex flex-col items-center justify-center h-64 gap-4">
          <div className="flex items-center gap-2 text-red-400">
            <AlertCircle className="h-5 w-5" />
            <span>{error}</span>
          </div>
          <Button variant="ghost" onClick={() => fetchContacts(page, debouncedSearch, typeFilter, statusFilter)}>
            <RefreshCw className="h-4 w-4" /> إعادة المحاولة
          </Button>
        </div>
      ) : contacts.length === 0 && !hasActiveFilters ? (
        <div className="flex flex-col items-center justify-center h-64 gap-4 text-slate-400">
          <Users className="h-12 w-12 text-slate-600" />
          <p>لا توجد جهات اتصال بعد</p>
          <Button onClick={openCreate}><Plus className="h-5 w-5" /> إضافة جهة اتصال</Button>
        </div>
      ) : contacts.length === 0 && hasActiveFilters ? (
        <div className="flex flex-col items-center justify-center h-64 gap-2 text-slate-400">
          <Search className="h-12 w-12 text-slate-600" />
          <p>لا توجد نتائج مطابقة</p>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {contacts.map((contact) => (
              <div key={contact.id} className="scc-card-hover group">
                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-primary-500 to-primary-700 flex items-center justify-center text-white font-bold text-lg shrink-0">
                    {contact.firstName?.charAt(0)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-bold text-white truncate">{contact.firstName} {contact.lastName}</h3>
                    <p className="text-slate-400 text-sm">{contact.company?.name || contact.companyName || '—'}</p>
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

          <div className="flex items-center justify-between pt-2">
            <p className="text-sm text-slate-400">
              صفحة {page} من {totalPages} — إجمالي {total}
            </p>
            <div className="flex items-center gap-2">
              <Button variant="ghost" disabled={page <= 1} onClick={() => setPage(page - 1)}>السابق</Button>
              <Button variant="ghost" disabled={page >= totalPages} onClick={() => setPage(page + 1)}>التالي</Button>
            </div>
          </div>
        </>
      )}

      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title={editingContact ? 'تعديل جهة اتصال' : 'إضافة جهة اتصال'} size="lg">
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Input label="الاسم الأول" required value={formData.firstName || ''} onChange={(e) => setFormData({ ...formData, firstName: e.target.value })} />
            <Input label="الاسم الأخير" required value={formData.lastName || ''} onChange={(e) => setFormData({ ...formData, lastName: e.target.value })} />
            <Input label="البريد الإلكتروني" type="email" value={formData.email || ''} onChange={(e) => setFormData({ ...formData, email: e.target.value })} />
            <Input label="الهاتف" value={formData.phone || ''} onChange={(e) => setFormData({ ...formData, phone: e.target.value })} />
            <Input label="الهاتف 2" value={formData.phone2 || ''} onChange={(e) => setFormData({ ...formData, phone2: e.target.value })} />
            <AsyncCombobox
              label="الشركة"
              value={formData.companyId || ''}
              onChange={(value) => setFormData({ ...formData, companyId: value })}
              loadOptions={loadCompanies}
              resolveValue={resolveCompany}
              placeholder="بدون شركة مرتبطة"
              searchPlaceholder="ابحث عن شركة..."
              clearLabel="بدون شركة مرتبطة"
            />
            <Input label="اسم الشركة (نص قديم/حر)" value={formData.companyName || ''} onChange={(e) => setFormData({ ...formData, companyName: e.target.value })} />
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
