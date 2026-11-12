'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import api from '@/lib/api';
import { Activity, CalendarClock, CheckCircle2, Pencil, Plus, RefreshCw, Search, Trash2, X, AlertCircle } from 'lucide-react';
import Modal from '@/components/ui/Modal';
import Input from '@/components/ui/Input';
import Select from '@/components/ui/Select';
import AsyncCombobox, { AsyncComboboxOption } from '@/components/ui/AsyncCombobox';
import Button from '@/components/ui/Button';
import Textarea from '@/components/ui/Textarea';

const PAGE_SIZE = 25;

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
  const [items, setItems] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [type, setType] = useState('');
  const [contactId, setContactId] = useState('');
  const [dealId, setDealId] = useState('');
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [formLoading, setFormLoading] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [operationError, setOperationError] = useState<string | null>(null);
  const [formData, setFormData] = useState<any>({ type: 'TASK' });
  const abortRef = useRef<AbortController | null>(null);

  const loadContacts = useCallback(async (term: string, signal: AbortSignal): Promise<AsyncComboboxOption[]> => {
    const params = new URLSearchParams({ limit: '20' });
    if (term) params.set('search', term);
    const res = await api.get(`/crm/contacts?${params.toString()}`, { signal });
    return (res.data?.data || []).map((c: any) => ({
      value: c.id,
      label: `${c.firstName || ''} ${c.lastName || ''}`.trim() || c.email || c.phone || c.id,
    }));
  }, []);

  const resolveContact = useCallback(async (id: string, signal: AbortSignal): Promise<AsyncComboboxOption | null> => {
    if (!id) return null;
    const res = await api.get(`/crm/contacts/${id}`, { signal });
    const c = res.data;
    return { value: c.id, label: `${c.firstName || ''} ${c.lastName || ''}`.trim() || c.email || c.phone || c.id };
  }, []);

  const loadDeals = useCallback(async (term: string, signal: AbortSignal): Promise<AsyncComboboxOption[]> => {
    const params = new URLSearchParams({ limit: '20' });
    if (term) params.set('search', term);
    const res = await api.get(`/crm/deals?${params.toString()}`, { signal });
    return (res.data?.data || []).map((deal: any) => ({ value: deal.id, label: deal.title }));
  }, []);

  const resolveDeal = useCallback(async (id: string, signal: AbortSignal): Promise<AsyncComboboxOption | null> => {
    if (!id) return null;
    const res = await api.get(`/crm/deals/${id}`, { signal });
    return { value: res.data.id, label: res.data.title };
  }, []);

  const fetchActivities = useCallback((p: number, s: string, t: string, c: string, d: string) => {
    abortRef.current?.abort();
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    setLoading(true);
    setError(null);
    const params = new URLSearchParams({ page: String(p), limit: String(PAGE_SIZE) });
    if (s) params.set('search', s);
    if (t) params.set('type', t);
    if (c) params.set('contactId', c);
    if (d) params.set('dealId', d);
    api
      .get('/crm/activities?' + params.toString(), { signal: ctrl.signal })
      .then((res) => {
        const body = res.data as { data: any[]; count: number };
        setItems(body.data);
        setTotal(body.count);
      })
      .catch((err) => {
        if (err?.code === 'ERR_CANCELED') return;
        setError('تعذر تحميل الأنشطة. تحقق من الاتصال بالخادم.');
      })
      .finally(() => {
        if (!ctrl.signal.aborted) setLoading(false);
      });
  }, []);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    setType(params.get('type') || '');
    setContactId(params.get('contactId') || '');
    setDealId(params.get('dealId') || '');
  }, []);

  // Debounce the search box (400ms) before it becomes a server query.
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search), 400);
    return () => clearTimeout(timer);
  }, [search]);

  // Any filter change restarts from page 1.
  useEffect(() => {
    setPage(1);
  }, [debouncedSearch, type, contactId, dealId]);

  useEffect(() => {
    fetchActivities(page, debouncedSearch, type, contactId, dealId);
  }, [page, debouncedSearch, type, contactId, dealId, fetchActivities]);

  // Cancel in-flight request on unmount.
  useEffect(() => {
    return () => abortRef.current?.abort();
  }, []);

  const openCreate = () => {
    setEditing(null);
    setFormError(null);
    setOperationError(null);
    setFormData({
      type: 'TASK',
      contactId: contactId || '',
      dealId: dealId || '',
      scheduledAt: '',
      remindAt: '',
      description: '',
      subject: '',
    });
    setIsModalOpen(true);
  };

  const openEdit = (item: any) => {
    setEditing(item);
    setFormError(null);
    setOperationError(null);
    // Only DTO-whitelisted fields — the API rejects unknown fields (forbidNonWhitelisted)
    setFormData({
      type: item.type || 'TASK',
      subject: item.subject || '',
      description: item.description || '',
      contactId: item.contactId || '',
      dealId: item.dealId || '',
      scheduledAt: item.scheduledAt ? new Date(item.scheduledAt).toISOString().slice(0, 16) : '',
      remindAt: item.remindAt ? new Date(item.remindAt).toISOString().slice(0, 16) : '',
      completedAt: item.completedAt ? new Date(item.completedAt).toISOString().slice(0, 16) : '',
    });
    setIsModalOpen(true);
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormLoading(true);
    setFormError(null);
    try {
      const payload = { ...formData };
      // Preserve the distinction between "unchanged" and "explicitly cleared".
      // PATCH omission keeps the old value, while null removes nullable
      // relations/dates/text from the database.
      for (const key of ['contactId', 'dealId', 'scheduledAt', 'remindAt', 'description']) {
        if (payload[key] === '') {
          if (editing) payload[key] = null;
          else delete payload[key];
        }
      }
      for (const key of ['completedAt', 'assignedToId']) {
        if (payload[key] === '') delete payload[key];
      }
      if (editing) await api.patch(`/crm/activities/${editing.id}`, payload);
      else await api.post('/crm/activities', payload);
      setIsModalOpen(false);
      fetchActivities(page, debouncedSearch, type, contactId, dealId);
    } catch {
      setFormError('تعذر حفظ النشاط. تحقق من البيانات أو الاتصال بالخادم.');
    } finally {
      setFormLoading(false);
    }
  };

  const remove = async (id: string) => {
    if (!confirm('هل تريد حذف هذا النشاط؟')) return;
    setOperationError(null);
    try {
      await api.delete(`/crm/activities/${id}`);
      if (items.length === 1 && page > 1) {
        setPage(page - 1);
      } else {
        fetchActivities(page, debouncedSearch, type, contactId, dealId);
      }
    } catch {
      setOperationError('تعذر حذف النشاط. قد يكون مرتبطًا ببيانات أخرى أو تعذر الاتصال بالخادم.');
    }
  };

  const markCompleted = async (item: any) => {
    setOperationError(null);
    try {
      await api.patch(`/crm/activities/${item.id}`, { completedAt: new Date().toISOString() });
      fetchActivities(page, debouncedSearch, type, contactId, dealId);
    } catch {
      setOperationError('تعذر إكمال النشاط. حاول مرة أخرى.');
    }
  };

  const hasActiveFilters = Boolean(debouncedSearch || type || contactId || dealId);
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <div className="space-y-6 animate-fade-in-up">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <Activity className="h-6 w-6 text-primary-400" />
            أنشطة CRM
          </h1>
          <p className="text-slate-400 text-sm mt-1">متابعة المكالمات والاجتماعات والمهام المرتبطة بالعملاء والصفقات — إجمالي {total}</p>
        </div>
        <Button onClick={openCreate}><Plus className="h-5 w-5" /> نشاط جديد</Button>
      </div>

      {operationError && (
        <div className="scc-card border-red-500/30 text-red-400 flex items-center gap-2">
          <AlertCircle className="h-5 w-5 shrink-0" />
          <span>{operationError}</span>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
        <div className="relative md:col-span-1">
          <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
          <input className="scc-input pr-9" placeholder="بحث في كل الأنشطة..." value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <Select options={activityTypes} value={type} onChange={(e) => setType(e.target.value)} />
        <AsyncCombobox
          value={contactId}
          onChange={setContactId}
          loadOptions={loadContacts}
          resolveValue={resolveContact}
          placeholder="كل جهات الاتصال"
          searchPlaceholder="ابحث عن جهة اتصال..."
          clearLabel="كل جهات الاتصال"
        />
        <AsyncCombobox
          value={dealId}
          onChange={setDealId}
          loadOptions={loadDeals}
          resolveValue={resolveDeal}
          placeholder="كل الصفقات"
          searchPlaceholder="ابحث عن صفقة..."
          clearLabel="كل الصفقات"
        />
      </div>

      {loading ? (
        <div className="h-64 flex items-center justify-center"><RefreshCw className="h-8 w-8 animate-spin text-primary-400" /></div>
      ) : error ? (
        <div className="flex flex-col items-center justify-center h-64 gap-4">
          <div className="flex items-center gap-2 text-red-400">
            <AlertCircle className="h-5 w-5" />
            <span>{error}</span>
          </div>
          <Button variant="ghost" onClick={() => fetchActivities(page, debouncedSearch, type, contactId, dealId)}>
            <RefreshCw className="h-4 w-4" /> إعادة المحاولة
          </Button>
        </div>
      ) : items.length === 0 && !hasActiveFilters ? (
        <div className="scc-card text-center py-14">
          <CalendarClock className="h-10 w-10 text-slate-600 mx-auto mb-3" />
          <p className="text-slate-300 font-medium">لا توجد أنشطة بعد</p>
          <p className="text-slate-500 text-sm mt-1">أنشئ نشاطًا لمتابعة عملائك.</p>
        </div>
      ) : items.length === 0 && hasActiveFilters ? (
        <div className="scc-card text-center py-14">
          <Search className="h-10 w-10 text-slate-600 mx-auto mb-3" />
          <p className="text-slate-300 font-medium">لا توجد أنشطة مطابقة</p>
          <p className="text-slate-500 text-sm mt-1">غيّر عوامل التصفية أو البحث.</p>
        </div>
      ) : (
        <>
          <div className="space-y-3">
            {items.map((item) => {
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
                      {item.contact && <span>العميل: {item.contact.firstName} {item.contact.lastName}</span>}
                      {item.deal && <span>الصفقة: {item.deal.title}</span>}
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

      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title={editing ? 'تعديل النشاط' : 'نشاط جديد'} size="lg">
        <form onSubmit={submit} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Select label="النوع" options={activityTypes.filter((x) => x.value)} value={formData.type || 'TASK'} onChange={(e) => setFormData({ ...formData, type: e.target.value })} />
            <Input label="الموضوع" required value={formData.subject || ''} onChange={(e) => setFormData({ ...formData, subject: e.target.value })} />
            <AsyncCombobox
              label="جهة الاتصال"
              value={formData.contactId || ''}
              onChange={(value) => setFormData({ ...formData, contactId: value })}
              loadOptions={loadContacts}
              resolveValue={resolveContact}
              placeholder="بدون جهة اتصال"
              searchPlaceholder="ابحث عن جهة اتصال..."
              clearLabel="بدون جهة اتصال"
            />
            <AsyncCombobox
              label="الصفقة"
              value={formData.dealId || ''}
              onChange={(value) => setFormData({ ...formData, dealId: value })}
              loadOptions={loadDeals}
              resolveValue={resolveDeal}
              placeholder="بدون صفقة"
              searchPlaceholder="ابحث عن صفقة..."
              clearLabel="بدون صفقة"
            />
            <Input label="موعد النشاط" type="datetime-local" value={formData.scheduledAt || ''} onChange={(e) => setFormData({ ...formData, scheduledAt: e.target.value })} />
            <Input label="موعد التذكير" type="datetime-local" value={formData.remindAt || ''} onChange={(e) => setFormData({ ...formData, remindAt: e.target.value })} />
          </div>
          <Textarea label="الوصف" rows={3} value={formData.description || ''} onChange={(e) => setFormData({ ...formData, description: e.target.value })} />
          {formError && <p className="text-sm text-red-400">{formError}</p>}
          <div className="flex justify-end gap-3">
            <Button type="button" variant="ghost" onClick={() => setIsModalOpen(false)}><X className="h-4 w-4" /> إلغاء</Button>
            <Button type="submit" isLoading={formLoading}>{editing ? 'حفظ' : 'إنشاء'}</Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
