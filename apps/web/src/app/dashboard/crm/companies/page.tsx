'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import api from '@/lib/api';
import { Building2, Plus, Search, Pencil, Trash2, X, RefreshCw, AlertCircle } from 'lucide-react';
import Modal from '@/components/ui/Modal';
import Input from '@/components/ui/Input';
import Button from '@/components/ui/Button';

const PAGE_SIZE = 25;

export default function CompaniesPage() {
  const [items, setItems] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [formLoading, setFormLoading] = useState(false);
  const [formData, setFormData] = useState<any>({ country: 'SA', isActive: true });
  const abortRef = useRef<AbortController | null>(null);

  const fetchData = useCallback(async (p: number, s: string) => {
    abortRef.current?.abort();
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    setLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams({ page: String(p), limit: String(PAGE_SIZE) });
      if (s) params.set('search', s);
      const res = await api.get('/crm/companies?' + params.toString(), { signal: ctrl.signal });
      const body = res.data as { data?: any[]; count?: number };
      setItems(body.data || []);
      setTotal(body.count || 0);
    } catch (err: any) {
      if (err?.code === 'ERR_CANCELED') return;
      setError('تعذر تحميل الشركات. تحقق من الاتصال بالخادم.');
    } finally {
      if (!ctrl.signal.aborted) setLoading(false);
    }
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search.trim()), 400);
    return () => clearTimeout(timer);
  }, [search]);

  useEffect(() => {
    setPage(1);
  }, [debouncedSearch]);

  useEffect(() => {
    void fetchData(page, debouncedSearch);
  }, [page, debouncedSearch, fetchData]);

  useEffect(() => {
    return () => abortRef.current?.abort();
  }, []);

  const openCreate = () => {
    setEditing(null);
    setFormData({ country: 'SA', isActive: true });
    setIsModalOpen(true);
  };

  const openEdit = (item: any) => {
    setEditing(item);
    setFormData({
      name: item.name || '',
      legalName: item.legalName || '',
      crNumber: item.crNumber || '',
      vatNumber: item.vatNumber || '',
      website: item.website || '',
      email: item.email || '',
      phone: item.phone || '',
      address: item.address || '',
      city: item.city || '',
      country: item.country || 'SA',
      isActive: item.isActive !== false,
    });
    setIsModalOpen(true);
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormLoading(true);
    try {
      const payload = { ...formData };
      for (const key of ['legalName','crNumber','vatNumber','website','email','phone','address','city','country']) {
        if (payload[key] === '') delete payload[key];
      }
      if (editing) await api.patch('/crm/companies/' + editing.id, payload);
      else await api.post('/crm/companies', payload);
      setIsModalOpen(false);
      await fetchData(page, debouncedSearch);
    } finally {
      setFormLoading(false);
    }
  };

  const remove = async (id: string) => {
    if (!confirm('هل تريد حذف هذه الشركة؟ سيتم فصلها عن جهات الاتصال والصفقات دون حذفها.')) return;
    await api.delete('/crm/companies/' + id);
    if (items.length === 1 && page > 1) {
      setPage(page - 1);
    } else {
      await fetchData(page, debouncedSearch);
    }
  };

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const hasActiveSearch = Boolean(debouncedSearch);

  return (
    <div className="space-y-6 animate-fade-in-up">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <Building2 className="h-6 w-6 text-primary-400" />
            الشركات والحسابات
          </h1>
          <p className="text-slate-400 text-sm mt-1">إجمالي {total} شركة — ربط جهات الاتصال والصفقات بكيان تجاري موحد داخل كل منشأة.</p>
        </div>
        <Button onClick={openCreate}><Plus className="h-5 w-5" /> شركة جديدة</Button>
      </div>

      <div className="relative">
        <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-500" />
        <input
          className="scc-input pr-10"
          placeholder="بحث بالاسم أو السجل أو الرقم الضريبي..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {loading ? (
        <div className="h-64 flex items-center justify-center"><RefreshCw className="h-8 w-8 animate-spin text-primary-400" /></div>
      ) : error ? (
        <div className="h-64 flex flex-col items-center justify-center gap-4">
          <div className="flex items-center gap-2 text-red-400">
            <AlertCircle className="h-5 w-5" />
            <span>{error}</span>
          </div>
          <Button variant="ghost" onClick={() => void fetchData(page, debouncedSearch)}>
            <RefreshCw className="h-4 w-4" /> إعادة المحاولة
          </Button>
        </div>
      ) : items.length === 0 ? (
        <div className="scc-card text-center py-14 text-slate-400">
          {hasActiveSearch ? 'لا توجد شركات مطابقة.' : 'لا توجد شركات بعد.'}
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
            {items.map((item) => (
              <div key={item.id} className="scc-card-hover">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <h3 className="font-bold text-white">{item.name}</h3>
                    <p className="text-sm text-slate-400 mt-1">{item.legalName || '—'}</p>
                    <div className="flex flex-wrap gap-3 text-xs text-slate-500 mt-3">
                      {item.crNumber && <span>س.ت: {item.crNumber}</span>}
                      {item.vatNumber && <span>ضريبة: {item.vatNumber}</span>}
                      {item.city && <span>{item.city}</span>}
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    <button onClick={() => openEdit(item)} className="p-2 rounded-lg hover:bg-primary-500/10 text-primary-400"><Pencil className="h-4 w-4" /></button>
                    <button onClick={() => remove(item.id)} className="p-2 rounded-lg hover:bg-red-500/10 text-red-400"><Trash2 className="h-4 w-4" /></button>
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className="flex items-center justify-between pt-2">
            <p className="text-sm text-slate-400">صفحة {page} من {totalPages} — إجمالي {total}</p>
            <div className="flex items-center gap-2">
              <Button variant="ghost" disabled={page <= 1} onClick={() => setPage(page - 1)}>السابق</Button>
              <Button variant="ghost" disabled={page >= totalPages} onClick={() => setPage(page + 1)}>التالي</Button>
            </div>
          </div>
        </>
      )}

      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title={editing ? 'تعديل الشركة' : 'شركة جديدة'} size="lg">
        <form onSubmit={submit} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Input label="الاسم" required value={formData.name || ''} onChange={(e) => setFormData({ ...formData, name: e.target.value })} />
            <Input label="الاسم القانوني" value={formData.legalName || ''} onChange={(e) => setFormData({ ...formData, legalName: e.target.value })} />
            <Input label="السجل التجاري" value={formData.crNumber || ''} onChange={(e) => setFormData({ ...formData, crNumber: e.target.value })} />
            <Input label="الرقم الضريبي" value={formData.vatNumber || ''} onChange={(e) => setFormData({ ...formData, vatNumber: e.target.value })} />
            <Input label="البريد" type="email" value={formData.email || ''} onChange={(e) => setFormData({ ...formData, email: e.target.value })} />
            <Input label="الهاتف" value={formData.phone || ''} onChange={(e) => setFormData({ ...formData, phone: e.target.value })} />
            <Input label="الموقع" value={formData.website || ''} onChange={(e) => setFormData({ ...formData, website: e.target.value })} />
            <Input label="المدينة" value={formData.city || ''} onChange={(e) => setFormData({ ...formData, city: e.target.value })} />
            <Input label="الدولة" value={formData.country || 'SA'} onChange={(e) => setFormData({ ...formData, country: e.target.value })} />
            <Input label="العنوان" value={formData.address || ''} onChange={(e) => setFormData({ ...formData, address: e.target.value })} />
          </div>
          <div className="flex justify-end gap-3">
            <Button type="button" variant="ghost" onClick={() => setIsModalOpen(false)}><X className="h-4 w-4" /> إلغاء</Button>
            <Button type="submit" isLoading={formLoading}>{editing ? 'حفظ' : 'إنشاء'}</Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
