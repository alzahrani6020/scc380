'use client';

import { useEffect, useState } from 'react';
import api from '@/lib/api';
import { FileSignature, Plus, CheckCircle2, XCircle, Pencil, Trash2, X } from 'lucide-react';
import Modal from '@/components/ui/Modal';
import Input from '@/components/ui/Input';
import Select from '@/components/ui/Select';
import Button from '@/components/ui/Button';

const contractTypes = [
  { value: 'FIXED_TERM', label: 'محدد المدة' },
  { value: 'INDEFINITE', label: 'غير محدد المدة' },
  { value: 'TEMPORARY', label: 'مؤقت' },
  { value: 'TRAINING', label: 'تدريب' },
];

export default function ContractsPage() {
  const [items, setItems] = useState<any[]>([]);
  const [employees, setEmployees] = useState<any[]>([]);
  const [employeesLoading, setEmployeesLoading] = useState(true);
  const [employeesError, setEmployeesError] = useState('');
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<any>(null);
  const [formData, setFormData] = useState<any>({});
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [formLoading, setFormLoading] = useState(false);

  useEffect(() => { fetchData(); }, []);

  const fetchData = () => {
    setEmployeesLoading(true);
    const employeeId = typeof window !== 'undefined' ? new URLSearchParams(window.location.search).get('employeeId') : null;
    const url = employeeId ? '/hr/contracts?employeeId=' + encodeURIComponent(employeeId) : '/hr/contracts';
    Promise.all([
      api.get(url).then(r => setItems(r.data.data || [])),
      api.get('/hr/employees?limit=200')
        .then(r => { setEmployees(r.data.data || []); setEmployeesError(''); })
        .catch(() => { setEmployees([]); setEmployeesError('تعذر تحميل قائمة الموظفين. أعد تحميل الصفحة.'); })
        .finally(() => setEmployeesLoading(false)),
    ]).catch(console.error).finally(() => setLoading(false));
  };

  const openCreate = () => {
    setEditing(null);
    const employeeId = typeof window !== 'undefined' ? new URLSearchParams(window.location.search).get('employeeId') : null;
    setFormData({ employeeId: employeeId || '', type: 'FIXED_TERM' });
    setIsModalOpen(true);
  };

  const openEdit = (item: any) => {
    setEditing(item);
    setFormData({
      contractNumber: item.contractNumber,
      type: item.type,
      startDate: item.startDate ? new Date(item.startDate).toISOString().split('T')[0] : '',
      endDate: item.endDate ? new Date(item.endDate).toISOString().split('T')[0] : '',
      probationEndDate: item.probationEndDate ? new Date(item.probationEndDate).toISOString().split('T')[0] : '',
      jobTitle: item.jobTitle || '',
      basicSalary: item.basicSalary ?? '',
      housingAllowance: item.housingAllowance ?? '',
      transportAllowance: item.transportAllowance ?? '',
      otherAllowances: item.otherAllowances ?? '',
      workingHoursPerWeek: item.workingHoursPerWeek ?? '',
      notes: item.notes || '',
    });
    setIsModalOpen(true);
  };

  const optionalNumber = (v: any) => v === '' || v == null ? undefined : Number(v);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editing && !employees.some(employee => employee.id === formData.employeeId)) {
      setEmployeesError('اختر موظفًا من القائمة قبل إنشاء العقد.');
      return;
    }
    setFormLoading(true);
    const payload = {
      ...(editing ? {} : { employeeId: formData.employeeId }),
      contractNumber: formData.contractNumber,
      type: formData.type,
      startDate: formData.startDate,
      endDate: formData.endDate || undefined,
      probationEndDate: formData.probationEndDate || undefined,
      jobTitle: formData.jobTitle || undefined,
      basicSalary: optionalNumber(formData.basicSalary),
      housingAllowance: optionalNumber(formData.housingAllowance),
      transportAllowance: optionalNumber(formData.transportAllowance),
      otherAllowances: optionalNumber(formData.otherAllowances),
      workingHoursPerWeek: optionalNumber(formData.workingHoursPerWeek),
      notes: formData.notes || undefined,
    };
    try {
      if (editing) await api.patch(`/hr/contracts/${editing.id}`, payload);
      else await api.post('/hr/contracts', payload);
      setIsModalOpen(false);
      fetchData();
    } catch {
      alert('تعذر حفظ العقد');
    } finally {
      setFormLoading(false);
    }
  };

  const activate = async (id: string) => {
    if (!confirm('سيتم تفعيل العقد وتحديث بيانات الموظف من العقد. متابعة؟')) return;
    await api.post(`/hr/contracts/${id}/activate`, {});
    fetchData();
  };

  const terminate = async (id: string) => {
    const reason = prompt('سبب إنهاء العقد:') || '';
    if (!reason) return;
    await api.post(`/hr/contracts/${id}/terminate`, { reason });
    fetchData();
  };

  const remove = async (id: string) => {
    if (!confirm('حذف مسودة العقد؟')) return;
    await api.delete(`/hr/contracts/${id}`);
    fetchData();
  };

  const employeeOptions = [
    { value: '', label: employeesLoading ? 'جاري تحميل الموظفين...' : 'اختر الموظف' },
    ...employees.map(e => ({ value: e.id, label: `${e.firstName} ${e.lastName} · ${e.employeeCode}` })),
  ];

  return (
    <div className="space-y-6 animate-fade-in-up">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2"><FileSignature className="h-6 w-6 text-primary-400" /> عقود الموظفين</h1>
          <p className="text-slate-400 text-sm mt-1">{items.length} عقد</p>
        </div>
        <Button onClick={openCreate}><Plus className="h-5 w-5" /> عقد جديد</Button>
      </div>

      {loading ? <div className="h-64 flex items-center justify-center text-slate-400">جاري التحميل...</div> :
        items.length === 0 ? <div className="scc-card text-center py-12 text-slate-400">لا توجد عقود.</div> :
        <div className="space-y-3">
          {items.map((item) => (
            <div key={item.id} className="scc-card-hover flex items-center justify-between gap-4">
              <div>
                <h3 className="text-white font-bold">{item.employee?.firstName} {item.employee?.lastName}</h3>
                <p className="text-slate-400 text-sm">{item.contractNumber} · {contractTypes.find(t => t.value === item.type)?.label || item.type}</p>
                <p className="text-slate-500 text-xs mt-1">{new Date(item.startDate).toLocaleDateString('ar-SA')} {item.endDate ? '— ' + new Date(item.endDate).toLocaleDateString('ar-SA') : '— مفتوح'}</p>
              </div>
              <div className="flex items-center gap-2 flex-wrap justify-end">
                <span className={`px-2 py-1 rounded-full text-xs ${item.status === 'ACTIVE' ? 'bg-emerald-500/20 text-emerald-400' : item.status === 'DRAFT' ? 'bg-amber-500/20 text-amber-400' : 'bg-slate-500/20 text-slate-300'}`}>{item.status}</span>
                {item.status === 'DRAFT' && <Button size="sm" onClick={() => activate(item.id)}><CheckCircle2 className="h-3 w-3" /> تفعيل</Button>}
                {item.status === 'ACTIVE' && <Button size="sm" variant="ghost" onClick={() => terminate(item.id)}><XCircle className="h-3 w-3" /> إنهاء</Button>}
                {item.status === 'DRAFT' && <button onClick={() => openEdit(item)} className="p-2 text-primary-400"><Pencil className="h-4 w-4" /></button>}
                {item.status === 'DRAFT' && <button onClick={() => remove(item.id)} className="p-2 text-red-400"><Trash2 className="h-4 w-4" /></button>}
              </div>
            </div>
          ))}
        </div>
      }

      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title={editing ? 'تعديل مسودة العقد' : 'عقد موظف جديد'} size="xl">
        <form onSubmit={handleSubmit} className="space-y-4">
          {!editing && (
            <div className="space-y-2">
              <Select label="الموظف" required options={employeeOptions} disabled={employeesLoading || employees.length === 0} value={formData.employeeId || ''} onChange={e => { setFormData({ ...formData, employeeId: e.target.value }); setEmployeesError(''); }} />
              {employeesError && <p role="alert" className="text-sm text-red-400">{employeesError}</p>}
              {!employeesLoading && !employeesError && employees.length === 0 && <p role="status" className="text-sm text-amber-400">لا يوجد موظفون متاحون. أضف موظفًا أولًا من صفحة الموظفين.</p>}
            </div>
          )}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Input label="رقم العقد" required value={formData.contractNumber || ''} onChange={e => setFormData({ ...formData, contractNumber: e.target.value })} />
            <Select label="نوع العقد" options={contractTypes} value={formData.type || 'FIXED_TERM'} onChange={e => setFormData({ ...formData, type: e.target.value })} />
            <Input label="تاريخ البداية" type="date" required value={formData.startDate || ''} onChange={e => setFormData({ ...formData, startDate: e.target.value })} />
            <Input label="تاريخ النهاية" type="date" value={formData.endDate || ''} onChange={e => setFormData({ ...formData, endDate: e.target.value })} />
            <Input label="نهاية التجربة" type="date" value={formData.probationEndDate || ''} onChange={e => setFormData({ ...formData, probationEndDate: e.target.value })} />
            <Input label="المسمى الوظيفي" value={formData.jobTitle || ''} onChange={e => setFormData({ ...formData, jobTitle: e.target.value })} />
            <Input label="الراتب الأساسي" type="number" value={formData.basicSalary || ''} onChange={e => setFormData({ ...formData, basicSalary: e.target.value })} />
            <Input label="بدل السكن" type="number" value={formData.housingAllowance || ''} onChange={e => setFormData({ ...formData, housingAllowance: e.target.value })} />
            <Input label="بدل النقل" type="number" value={formData.transportAllowance || ''} onChange={e => setFormData({ ...formData, transportAllowance: e.target.value })} />
            <Input label="بدلات أخرى" type="number" value={formData.otherAllowances || ''} onChange={e => setFormData({ ...formData, otherAllowances: e.target.value })} />
            <Input label="ساعات العمل الأسبوعية" type="number" value={formData.workingHoursPerWeek || ''} onChange={e => setFormData({ ...formData, workingHoursPerWeek: e.target.value })} />
            <Input label="ملاحظات" value={formData.notes || ''} onChange={e => setFormData({ ...formData, notes: e.target.value })} />
          </div>
          <div className="flex justify-end gap-3">
            <Button type="button" variant="ghost" onClick={() => setIsModalOpen(false)}><X className="h-4 w-4" /> إلغاء</Button>
            <Button type="submit" disabled={!editing && (employeesLoading || employees.length === 0 || !formData.employeeId)} isLoading={formLoading}>{editing ? 'حفظ' : 'إنشاء مسودة'}</Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
