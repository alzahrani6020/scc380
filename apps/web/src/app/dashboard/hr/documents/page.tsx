'use client';

import { ChangeEvent, useEffect, useMemo, useState } from 'react';
import api from '@/lib/api';
import { Download, FileArchive, Plus, Trash2, X } from 'lucide-react';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import Modal from '@/components/ui/Modal';
import Select from '@/components/ui/Select';

const docTypes = [
  { value: 'NATIONAL_ID', label: 'هوية وطنية' },
  { value: 'IQAMA', label: 'إقامة' },
  { value: 'PASSPORT', label: 'جواز سفر' },
  { value: 'CERTIFICATE', label: 'شهادة' },
  { value: 'LICENSE', label: 'ترخيص' },
  { value: 'CONTRACT_ATTACHMENT', label: 'مرفق عقد' },
  { value: 'OTHER', label: 'أخرى' },
];

export default function EmployeeDocumentsPage() {
  const [items, setItems] = useState<any[]>([]);
  const [employees, setEmployees] = useState<any[]>([]);
  const [employeeId, setEmployeeId] = useState('');
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<any>({ type: 'NATIONAL_ID' });
  const [file, setFile] = useState<File | null>(null);

  useEffect(() => {
    const fromQuery = typeof window !== 'undefined' ? new URLSearchParams(window.location.search).get('employeeId') || '' : '';
    setEmployeeId(fromQuery);
    api.get('/hr/employees?limit=200').then(r => setEmployees(r.data.data || [])).catch(console.error);
  }, []);

  useEffect(() => { fetchData(); }, [employeeId]);

  const fetchData = () => {
    setLoading(true);
    const q = employeeId ? '?employeeId=' + encodeURIComponent(employeeId) : '';
    api.get('/hr/employee-documents' + q)
      .then(r => setItems(r.data.data || []))
      .catch(console.error)
      .finally(() => setLoading(false));
  };

  const employeeOptions = useMemo(() => [
    { value: '', label: 'كل الموظفين' },
    ...employees.map(e => ({ value: e.id, label: `${e.firstName} ${e.lastName} · ${e.employeeCode}` })),
  ], [employees]);

  const fileToBase64 = (selected: File) => new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = reject;
    reader.onload = () => resolve(String(reader.result).split(',')[1] || '');
    reader.readAsDataURL(selected);
  });

  const onFile = (e: ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files?.[0] || null;
    if (selected && selected.size > 5 * 1024 * 1024) {
      alert('الحد الأقصى لحجم المستند 5 ميجابايت');
      e.target.value = '';
      return;
    }
    setFile(selected);
    if (selected && !form.title) setForm((v: any) => ({ ...v, title: selected.name }));
  };

  const upload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file || !form.employeeId) return;
    setSaving(true);
    try {
      const contentBase64 = await fileToBase64(file);
      await api.post('/hr/employee-documents', {
        employeeId: form.employeeId,
        type: form.type,
        title: form.title,
        fileName: file.name,
        mimeType: file.type,
        contentBase64,
        issuedAt: form.issuedAt || undefined,
        expiresAt: form.expiresAt || undefined,
        notes: form.notes || undefined,
      });
      setOpen(false);
      setFile(null);
      setForm({ type: 'NATIONAL_ID', employeeId: employeeId || '' });
      fetchData();
    } catch (err: any) {
      alert(err?.response?.data?.message || 'تعذر رفع المستند');
    } finally {
      setSaving(false);
    }
  };

  const download = async (item: any) => {
    const res = await api.get(`/hr/employee-documents/${item.id}/download`, { responseType: 'blob' });
    const url = URL.createObjectURL(res.data);
    const a = document.createElement('a');
    a.href = url;
    a.download = item.fileName;
    a.click();
    URL.revokeObjectURL(url);
  };

  const remove = async (id: string) => {
    if (!confirm('حذف المستند نهائيًا؟')) return;
    await api.delete(`/hr/employee-documents/${id}`);
    fetchData();
  };

  const daysToExpiry = (value?: string) => {
    if (!value) return null;
    return Math.ceil((new Date(value).getTime() - Date.now()) / 86400000);
  };

  return (
    <div className="space-y-6 animate-fade-in-up">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2"><FileArchive className="h-6 w-6 text-primary-400" /> مستندات الموظفين</h1>
          <p className="text-slate-400 text-sm mt-1">حفظ فعلي مشفر داخل قاعدة بيانات المنصة · PDF/JPG/PNG · حد 5MB</p>
        </div>
        <Button onClick={() => { setForm({ type: 'NATIONAL_ID', employeeId: employeeId || '' }); setOpen(true); }}><Plus className="h-4 w-4" /> رفع مستند</Button>
      </div>

      <div className="max-w-md">
        <Select label="الموظف" options={employeeOptions} value={employeeId} onChange={e => setEmployeeId(e.target.value)} />
      </div>

      {loading ? <div className="scc-card py-12 text-center text-slate-400">جاري التحميل...</div> :
        items.length === 0 ? <div className="scc-card py-12 text-center text-slate-400">لا توجد مستندات.</div> :
        <div className="space-y-3">
          {items.map(item => {
            const days = daysToExpiry(item.expiresAt);
            return (
              <div key={item.id} className="scc-card-hover flex items-center justify-between gap-4">
                <div className="min-w-0">
                  <div className="text-white font-semibold truncate">{item.title}</div>
                  <div className="text-slate-400 text-sm">{item.employee?.firstName} {item.employee?.lastName} · {docTypes.find(t => t.value === item.type)?.label || item.type}</div>
                  <div className="text-slate-500 text-xs mt-1">{item.fileName} · {(item.sizeBytes / 1024).toFixed(0)} KB</div>
                  {days !== null && <div className={`text-xs mt-1 ${days < 0 ? 'text-red-400' : days <= 7 ? 'text-amber-400' : 'text-slate-400'}`}>
                    {days < 0 ? `منتهي منذ ${Math.abs(days)} يوم` : `ينتهي خلال ${days} يوم`}
                  </div>}
                </div>
                <div className="flex gap-2 shrink-0">
                  <button onClick={() => download(item)} className="p-2 text-primary-400" title="تحميل"><Download className="h-4 w-4" /></button>
                  <button onClick={() => remove(item.id)} className="p-2 text-red-400" title="حذف"><Trash2 className="h-4 w-4" /></button>
                </div>
              </div>
            );
          })}
        </div>
      }

      <Modal isOpen={open} onClose={() => setOpen(false)} title="رفع مستند موظف" size="lg">
        <form onSubmit={upload} className="space-y-4">
          <Select label="الموظف" required options={employeeOptions.filter(o => o.value)} value={form.employeeId || ''} onChange={e => setForm({ ...form, employeeId: e.target.value })} />
          <Select label="نوع المستند" options={docTypes} value={form.type || 'NATIONAL_ID'} onChange={e => setForm({ ...form, type: e.target.value })} />
          <Input label="عنوان المستند" required value={form.title || ''} onChange={e => setForm({ ...form, title: e.target.value })} />
          <Input label="تاريخ الإصدار" type="date" value={form.issuedAt || ''} onChange={e => setForm({ ...form, issuedAt: e.target.value })} />
          <Input label="تاريخ الانتهاء" type="date" value={form.expiresAt || ''} onChange={e => setForm({ ...form, expiresAt: e.target.value })} />
          <Input label="ملاحظات" value={form.notes || ''} onChange={e => setForm({ ...form, notes: e.target.value })} />
          <div>
            <label className="text-sm text-slate-300 block mb-2">الملف</label>
            <input required type="file" accept=".pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png" onChange={onFile} className="scc-input" />
            <p className="text-slate-500 text-xs mt-1">PDF أو JPG أو PNG، بحد أقصى 5 ميجابايت.</p>
          </div>
          <div className="flex justify-end gap-3">
            <Button type="button" variant="ghost" onClick={() => setOpen(false)}><X className="h-4 w-4" /> إلغاء</Button>
            <Button type="submit" isLoading={saving}>رفع وحفظ</Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
