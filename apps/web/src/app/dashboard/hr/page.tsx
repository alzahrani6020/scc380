'use client';

import { useEffect, useState } from 'react';
import api from '@/lib/api';
import { Briefcase, Plus, Search, Pencil, Trash2, X, Phone, Mail, Calendar, FileText } from 'lucide-react';
import Modal from '@/components/ui/Modal';
import Input from '@/components/ui/Input';
import Select from '@/components/ui/Select';
import Button from '@/components/ui/Button';

const empTypes = [
  { value: 'FULL_TIME', label: 'دوام كامل' },
  { value: 'PART_TIME', label: 'دوام جزئي' },
  { value: 'CONTRACTOR', label: 'متعاقد' },
  { value: 'INTERN', label: 'متدرب' },
  { value: 'TEMPORARY', label: 'مؤقت' },
];

const empStatuses = [
  { value: 'ACTIVE', label: 'نشط' },
  { value: 'ON_LEAVE', label: 'في إجازة' },
  { value: 'SUSPENDED', label: 'موقوف' },
  { value: 'TERMINATED', label: 'منتهي' },
];

export default function HrPage() {
  const [employees, setEmployees] = useState<any[]>([]);
  const [departments, setDepartments] = useState<any[]>([]);
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
      api.get('/hr/employees').then(r => setEmployees(r.data.data || [])),
      api.get('/hr/departments').then(r => setDepartments(r.data.data || [])),
    ]).catch(console.error).finally(() => setLoading(false));
  };

  const openCreate = () => {
    setEditing(null);
    setFormData({ employmentType: 'FULL_TIME', status: 'ACTIVE', nationality: 'SA' });
    setIsModalOpen(true);
  };

  const openEdit = (item: any) => {
    setEditing(item);
    setFormData({
      ...item,
      hireDate: item.hireDate ? new Date(item.hireDate).toISOString().split('T')[0] : '',
    });
    setIsModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormLoading(true);
    try {
      const payload = { ...formData };
      if (payload.basicSalary) payload.basicSalary = parseFloat(payload.basicSalary);
      if (editing) {
        await api.patch(`/hr/employees/${editing.id}`, payload);
      } else {
        await api.post('/hr/employees', payload);
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
    await api.delete(`/hr/employees/${id}`);
    fetchData();
  };

  const filtered = employees.filter((e) =>
    `${e.firstName} ${e.lastName}`.includes(search) || e.email?.includes(search) || e.employeeCode?.includes(search)
  );

  const deptOptions = departments.map(d => ({ value: d.id, label: d.name }));

  return (
    <div className="space-y-6 animate-fade-in-up">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <Briefcase className="h-6 w-6 text-primary-400" />
            الموارد البشرية
          </h1>
          <p className="text-slate-400 text-sm mt-1">{employees.length} موظف</p>
        </div>
        <Button onClick={openCreate}><Plus className="h-5 w-5" /> إضافة موظف</Button>
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
          {filtered.map((emp) => (
            <div key={emp.id} className="scc-card-hover group">
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center text-white font-bold text-lg shrink-0">
                  {emp.firstName?.charAt(0)}
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="font-bold text-white truncate">{emp.firstName} {emp.lastName}</h3>
                  <p className="text-slate-400 text-sm">{emp.jobTitle || '—'}</p>
                </div>
                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button onClick={() => window.open(`/dashboard/templates?search=عقد+عمل`, '_blank')} className="p-1.5 rounded-lg hover:bg-blue-500/10 text-blue-400" title="تصدير كنموذج"><FileText className="h-4 w-4" /></button>
                  <button onClick={() => openEdit(emp)} className="p-1.5 rounded-lg hover:bg-primary-500/10 text-primary-400"><Pencil className="h-4 w-4" /></button>
                  <button onClick={() => handleDelete(emp.id)} className="p-1.5 rounded-lg hover:bg-red-500/10 text-red-400"><Trash2 className="h-4 w-4" /></button>
                </div>
              </div>
              <div className="mt-4 space-y-2 text-sm">
                <div className="flex items-center gap-2 text-slate-400"><Phone className="h-4 w-4" /><span>{emp.phone || '—'}</span></div>
                <div className="flex items-center gap-2 text-slate-400"><Mail className="h-4 w-4" /><span className="truncate">{emp.email || '—'}</span></div>
                <div className="flex items-center gap-2 text-slate-400"><Calendar className="h-4 w-4" /><span>{new Date(emp.hireDate).toLocaleDateString('ar-SA')}</span></div>
              </div>
              <div className="mt-3 flex items-center gap-2">
                <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${
                  emp.status === 'ACTIVE' ? 'bg-emerald-500/20 text-emerald-400' :
                  emp.status === 'ON_LEAVE' ? 'bg-amber-500/20 text-amber-400' :
                  'bg-red-500/20 text-red-400'
                }`}>{emp.status}</span>
                <span className="text-slate-500 text-xs">{emp.employeeCode}</span>
              </div>
            </div>
          ))}
        </div>
      )}

      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title={editing ? 'تعديل موظف' : 'موظف جديد'} size="xl">
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Input label="الكود" required value={formData.employeeCode || ''} onChange={(e) => setFormData({ ...formData, employeeCode: e.target.value })} />
            <Input label="الاسم الأول" required value={formData.firstName || ''} onChange={(e) => setFormData({ ...formData, firstName: e.target.value })} />
            <Input label="الاسم الأخير" required value={formData.lastName || ''} onChange={(e) => setFormData({ ...formData, lastName: e.target.value })} />
            <Input label="البريد الإلكتروني" type="email" value={formData.email || ''} onChange={(e) => setFormData({ ...formData, email: e.target.value })} />
            <Input label="الهاتف" value={formData.phone || ''} onChange={(e) => setFormData({ ...formData, phone: e.target.value })} />
            <Input label="رقم الهوية" value={formData.idNumber || ''} onChange={(e) => setFormData({ ...formData, idNumber: e.target.value })} />
            <Input label="الجنسية" value={formData.nationality || 'SA'} onChange={(e) => setFormData({ ...formData, nationality: e.target.value })} />
            <Select label="الإدارة" options={deptOptions} value={formData.departmentId || ''} onChange={(e) => setFormData({ ...formData, departmentId: e.target.value })} />
            <Input label="المسمى الوظيفي" value={formData.jobTitle || ''} onChange={(e) => setFormData({ ...formData, jobTitle: e.target.value })} />
            <Select label="نوع التوظيف" options={empTypes} value={formData.employmentType || 'FULL_TIME'} onChange={(e) => setFormData({ ...formData, employmentType: e.target.value })} />
            <Select label="الحالة" options={empStatuses} value={formData.status || 'ACTIVE'} onChange={(e) => setFormData({ ...formData, status: e.target.value })} />
            <Input label="تاريخ التعيين" type="date" value={formData.hireDate || ''} onChange={(e) => setFormData({ ...formData, hireDate: e.target.value })} />
            <Input label="الراتب الأساسي" type="number" value={formData.basicSalary || ''} onChange={(e) => setFormData({ ...formData, basicSalary: e.target.value })} />
            <Input label="بدل السكن" type="number" value={formData.housingAllowance || ''} onChange={(e) => setFormData({ ...formData, housingAllowance: e.target.value })} />
            <Input label="بدل النقل" type="number" value={formData.transportAllowance || ''} onChange={(e) => setFormData({ ...formData, transportAllowance: e.target.value })} />
            <Input label="رقم التأمينات" value={formData.gosiNumber || ''} onChange={(e) => setFormData({ ...formData, gosiNumber: e.target.value })} />
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
