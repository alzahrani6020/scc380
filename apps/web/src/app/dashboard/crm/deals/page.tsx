'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import api from '@/lib/api';
import { Activity, Briefcase, Plus, Search, TrendingUp, Pencil, Trash2, X, AlertCircle, RefreshCw } from 'lucide-react';
import Modal from '@/components/ui/Modal';
import Input from '@/components/ui/Input';
import Select from '@/components/ui/Select';
import AsyncCombobox, { AsyncComboboxOption } from '@/components/ui/AsyncCombobox';
import Button from '@/components/ui/Button';
import Textarea from '@/components/ui/Textarea';

const PAGE_SIZE = 25;

const stages = [
  { value: 'LEAD', label: 'محتمل' },
  { value: 'QUALIFIED', label: 'مؤهل' },
  { value: 'PROPOSAL', label: 'عرض سعر' },
  { value: 'NEGOTIATION', label: 'تفاوض' },
  { value: 'CLOSED_WON', label: 'مغلق (ربح)' },
  { value: 'CLOSED_LOST', label: 'مغلق (خسارة)' },
];

const stageFilterOptions = [{ value: '', label: 'كل المراحل' }, ...stages];

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
  const [pipelines, setPipelines] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [stageFilter, setStageFilter] = useState('');
  const [companyFilter, setCompanyFilter] = useState('');
  const [pipelineFilter, setPipelineFilter] = useState('');
  const [pipelineStageFilter, setPipelineStageFilter] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [formLoading, setFormLoading] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [operationError, setOperationError] = useState<string | null>(null);
  const [formData, setFormData] = useState<any>({});
  const abortRef = useRef<AbortController | null>(null);

  const fetchDeals = useCallback((p: number, s: string, stage: string, companyId: string, pipelineId: string, pipelineStageId: string) => {
    abortRef.current?.abort();
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    setLoading(true);
    setError(null);
    const params = new URLSearchParams({ page: String(p), limit: String(PAGE_SIZE) });
    if (s) params.set('search', s);
    if (stage) params.set('stage', stage);
    if (companyId) params.set('companyId', companyId);
    if (pipelineId) params.set('pipelineId', pipelineId);
    if (pipelineStageId) params.set('pipelineStageId', pipelineStageId);
    api
      .get(`/crm/deals?${params.toString()}`, { signal: ctrl.signal })
      .then((res) => {
        const body = res.data as { data: any[]; count: number };
        setItems(body.data);
        setTotal(body.count);
      })
      .catch((err) => {
        if (err?.code === 'ERR_CANCELED') return;
        setError('تعذر تحميل الصفقات. تحقق من الاتصال بالخادم.');
      })
      .finally(() => {
        if (!ctrl.signal.aborted) setLoading(false);
      });
  }, []);

  useEffect(() => {
    api.get('/crm/pipelines').then((r) => setPipelines(r.data || [])).catch(() => {});
  }, []);

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

  const loadCompanies = useCallback(async (term: string, signal: AbortSignal): Promise<AsyncComboboxOption[]> => {
    const params = new URLSearchParams({ limit: '20', active: 'true' });
    if (term) params.set('search', term);
    const res = await api.get(`/crm/companies?${params.toString()}`, { signal });
    return (res.data?.data || []).map((company: any) => ({ value: company.id, label: company.name }));
  }, []);

  const resolveCompany = useCallback(async (id: string, signal: AbortSignal): Promise<AsyncComboboxOption | null> => {
    if (!id) return null;
    const res = await api.get(`/crm/companies/${id}`, { signal });
    return { value: res.data.id, label: res.data.name };
  }, []);

  // Debounce the search box (400ms) before it becomes a server query.
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search), 400);
    return () => clearTimeout(timer);
  }, [search]);

  // Any filter change restarts from page 1.
  useEffect(() => {
    setPage(1);
  }, [debouncedSearch, stageFilter, companyFilter, pipelineFilter, pipelineStageFilter]);

  useEffect(() => {
    fetchDeals(page, debouncedSearch, stageFilter, companyFilter, pipelineFilter, pipelineStageFilter);
  }, [page, debouncedSearch, stageFilter, companyFilter, pipelineFilter, pipelineStageFilter, fetchDeals]);

  // Cancel in-flight request on unmount.
  useEffect(() => {
    return () => abortRef.current?.abort();
  }, []);

  const openCreate = () => {
    setEditing(null);
    setFormError(null);
    setOperationError(null);
    setFormData({ stage: 'LEAD', currency: 'SAR', probability: 0 });
    setIsModalOpen(true);
  };

  const openEdit = (item: any) => {
    setEditing(item);
    setFormError(null);
    setOperationError(null);
    // Only DTO-whitelisted fields — the API rejects unknown fields (forbidNonWhitelisted)
    setFormData({
      title: item.title || '',
      description: item.description || '',
      contactId: item.contactId || '',
      companyId: item.companyId || '',
      pipelineId: item.pipelineId || '',
      pipelineStageId: item.pipelineStageId || '',
      value: item.value ?? '',
      currency: item.currency || 'SAR',
      stage: item.stage || 'LEAD',
      probability: item.probability ?? 0,
      expectedClose: item.expectedClose ? new Date(item.expectedClose).toISOString().split('T')[0] : '',
    });
    setIsModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormLoading(true);
    setFormError(null);
    try {
      const payload = { ...formData };
      if (payload.value) payload.value = parseFloat(payload.value);
      if (payload.probability) payload.probability = parseInt(payload.probability);
      // On edit, an explicitly cleared optional value must be sent as null so
      // Prisma can remove the existing value/relation. Omitting it would keep
      // the previous database value unchanged.
      for (const key of ['description', 'expectedClose', 'value', 'companyId', 'pipelineId', 'pipelineStageId']) {
        if (payload[key] === '') {
          if (editing) payload[key] = null;
          else delete payload[key];
        }
      }
      // These fields keep their create defaults when left empty.
      for (const key of ['probability', 'currency']) {
        if (payload[key] === '') delete payload[key];
      }
      if (editing) {
        await api.patch(`/crm/deals/${editing.id}`, payload);
      } else {
        await api.post('/crm/deals', payload);
      }
      setIsModalOpen(false);
      fetchDeals(page, debouncedSearch, stageFilter, companyFilter, pipelineFilter, pipelineStageFilter);
    } catch {
      setFormError('تعذر حفظ الصفقة. تحقق من البيانات أو الاتصال بالخادم.');
    } finally {
      setFormLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('هل أنت متأكد؟')) return;
    setOperationError(null);
    try {
      await api.delete(`/crm/deals/${id}`);
      if (items.length === 1 && page > 1) {
        setPage(page - 1);
      } else {
        fetchDeals(page, debouncedSearch, stageFilter, companyFilter, pipelineFilter, pipelineStageFilter);
      }
    } catch {
      setOperationError('تعذر حذف الصفقة. قد تكون مرتبطة ببيانات أخرى أو تعذر الاتصال بالخادم.');
    }
  };

  const pipelineOptions = [{ value: '', label: 'بدون مسار ديناميكي' }, ...pipelines.map(p => ({ value: p.id, label: p.name }))];
  const pipelineFilterOptions = [{ value: '', label: 'كل المسارات' }, ...pipelines.map(p => ({ value: p.id, label: p.name }))];
  const selectedPipeline = pipelines.find((p) => p.id === formData.pipelineId);
  const pipelineStageOptions = [
    { value: '', label: 'بدون مرحلة ديناميكية' },
    ...((selectedPipeline?.stages || []).map((s: any) => ({ value: s.id, label: `${s.order}. ${s.name}` }))),
  ];
  const filterPipeline = pipelines.find((p) => p.id === pipelineFilter);
  const pipelineStageFilterOptions = [
    { value: '', label: 'كل المراحل الديناميكية' },
    ...((filterPipeline?.stages || []).map((s: any) => ({ value: s.id, label: `${s.order}. ${s.name}` }))),
  ];

  const hasActiveFilters = Boolean(debouncedSearch || stageFilter || companyFilter || pipelineFilter || pipelineStageFilter);
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <div className="space-y-6 animate-fade-in-up">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <Briefcase className="h-6 w-6 text-primary-400" />
            الصفقات
          </h1>
          <p className="text-slate-400 text-sm mt-1">{total} صفقة</p>
        </div>
        <Button onClick={openCreate}><Plus className="h-5 w-5" /> صفقة جديدة</Button>
      </div>

      {operationError && (
        <div className="scc-card border-red-500/30 text-red-400 flex items-center gap-2">
          <AlertCircle className="h-5 w-5 shrink-0" />
          <span>{operationError}</span>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-3">
        <div className="relative md:col-span-2 lg:col-span-2">
          <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-500" />
          <input
            type="text"
            placeholder="البحث في كل الصفقات..."
            className="scc-input pr-10 w-full"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <Select aria-label="تصفية حسب المرحلة" options={stageFilterOptions} value={stageFilter} onChange={(e) => setStageFilter(e.target.value)} />
        <AsyncCombobox
          value={companyFilter}
          onChange={setCompanyFilter}
          loadOptions={loadCompanies}
          resolveValue={resolveCompany}
          placeholder="كل الشركات"
          searchPlaceholder="ابحث عن شركة..."
          clearLabel="كل الشركات"
        />
        <Select
          aria-label="تصفية حسب المسار"
          options={pipelineFilterOptions}
          value={pipelineFilter}
          onChange={(e) => { setPipelineFilter(e.target.value); setPipelineStageFilter(''); }}
        />
        <Select
          aria-label="تصفية حسب المرحلة الديناميكية"
          options={pipelineStageFilterOptions}
          value={pipelineStageFilter}
          onChange={(e) => setPipelineStageFilter(e.target.value)}
          disabled={!pipelineFilter}
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
          <Button variant="ghost" onClick={() => fetchDeals(page, debouncedSearch, stageFilter, companyFilter, pipelineFilter, pipelineStageFilter)}>
            <RefreshCw className="h-4 w-4" /> إعادة المحاولة
          </Button>
        </div>
      ) : items.length === 0 && !hasActiveFilters ? (
        <div className="flex flex-col items-center justify-center h-64 gap-4 text-slate-400">
          <Briefcase className="h-12 w-12 text-slate-600" />
          <p>لا توجد صفقات بعد</p>
          <Button onClick={openCreate}><Plus className="h-5 w-5" /> صفقة جديدة</Button>
        </div>
      ) : items.length === 0 && hasActiveFilters ? (
        <div className="flex flex-col items-center justify-center h-64 gap-2 text-slate-400">
          <Search className="h-12 w-12 text-slate-600" />
          <p>لا توجد نتائج مطابقة</p>
        </div>
      ) : (
        <>
          <div className="space-y-3">
            {items.map((d) => (
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
                    <span className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-medium ${stageColors[d.stage] || 'bg-slate-500/20 text-slate-400'}`}>{pipelines.flatMap((p) => p.stages || []).find((s: any) => s.id === d.pipelineStageId)?.name || stages.find(s => s.value === d.stage)?.label || d.stage}</span>
                    {d.probability !== null && <p className="text-slate-500 text-xs mt-1">{d.probability}% احتمالية</p>}
                  </div>
                  <div className="flex items-center gap-1">
                    <Link href={`/dashboard/crm/activities?dealId=${d.id}`} className="p-1.5 rounded-lg hover:bg-emerald-500/10 text-emerald-400" title="أنشطة الصفقة">
                      <Activity className="h-4 w-4" />
                    </Link>
                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button onClick={() => openEdit(d)} className="p-1.5 rounded-lg hover:bg-primary-500/10 text-primary-400"><Pencil className="h-4 w-4" /></button>
                      <button onClick={() => handleDelete(d.id)} className="p-1.5 rounded-lg hover:bg-red-500/10 text-red-400"><Trash2 className="h-4 w-4" /></button>
                    </div>
                  </div>
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

      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title={editing ? 'تعديل صفقة' : 'صفقة جديدة'} size="lg">
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Input label="العنوان" required value={formData.title || ''} onChange={(e) => setFormData({ ...formData, title: e.target.value })} />
            <AsyncCombobox
              label="العميل"
              required
              value={formData.contactId || ''}
              onChange={(value) => setFormData({ ...formData, contactId: value })}
              loadOptions={loadContacts}
              resolveValue={resolveContact}
              placeholder="اختر العميل"
              searchPlaceholder="ابحث بالاسم أو البريد أو الجوال..."
            />
            <AsyncCombobox
              label="الشركة"
              value={formData.companyId || ''}
              onChange={(value) => setFormData({ ...formData, companyId: value })}
              loadOptions={loadCompanies}
              resolveValue={resolveCompany}
              placeholder="بدون شركة"
              searchPlaceholder="ابحث عن شركة..."
              clearLabel="بدون شركة"
            />
            <Select label="مسار المبيعات" options={pipelineOptions} value={formData.pipelineId || ''} onChange={(e) => setFormData({ ...formData, pipelineId: e.target.value, pipelineStageId: '' })} />
            <Select label="المرحلة الديناميكية" options={pipelineStageOptions} value={formData.pipelineStageId || ''} onChange={(e) => setFormData({ ...formData, pipelineStageId: e.target.value })} />
            <Input label="القيمة" type="number" value={formData.value || ''} onChange={(e) => setFormData({ ...formData, value: e.target.value })} />
            <Input label="العملة" value={formData.currency || 'SAR'} onChange={(e) => setFormData({ ...formData, currency: e.target.value })} />
            <Select label="المرحلة" options={stages} value={formData.stage || 'LEAD'} onChange={(e) => setFormData({ ...formData, stage: e.target.value })} />
            <Input label="الاحتمالية %" type="number" min="0" max="100" value={formData.probability || 0} onChange={(e) => setFormData({ ...formData, probability: e.target.value })} />
            <Input label="تاريخ الإغلاق المتوقع" type="date" value={formData.expectedClose || ''} onChange={(e) => setFormData({ ...formData, expectedClose: e.target.value })} />
          </div>
          <Textarea label="الوصف" rows={3} value={formData.description || ''} onChange={(e) => setFormData({ ...formData, description: e.target.value })} />
          {formError && <p className="text-sm text-red-400">{formError}</p>}
          <div className="flex justify-end gap-3 pt-2">
            <Button type="button" variant="ghost" onClick={() => setIsModalOpen(false)}><X className="h-4 w-4" /> إلغاء</Button>
            <Button type="submit" isLoading={formLoading}>{editing ? 'حفظ' : 'إنشاء'}</Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
