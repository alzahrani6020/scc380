'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import api from '@/lib/api';
import { Briefcase, Plus, Search, Pencil, UserMinus, X, Phone, Mail, Calendar, FileText, FolderOpen } from 'lucide-react';
import Modal from '@/components/ui/Modal';
import Input from '@/components/ui/Input';
import Select from '@/components/ui/Select';
import Button from '@/components/ui/Button';
import PaginationControls from '@/components/hr/PaginationControls';

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
  const [statusFilter, setStatusFilter] = useState('');
  const [departmentFilter, setDepartmentFilter] = useState('');
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [formLoading, setFormLoading] = useState(false);
  const [formData, setFormData] = useState<any>({});

  useEffect(() => {
    api.get('/hr/departments').then(r => setDepartments(r.data.data || [])).catch(console.error);
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => fetchData(), 350);
    return () => clearTimeout(timer);
  }, [page, search, statusFilter, departmentFilter]);

  const fetchData = () => {
    setLoading(true);
    const params = new URLSearchParams({ page: String(page), limit: '25' });
    if (search.trim()) params.set('search', search.trim());
    if (statusFilter) params.set('status', statusFilter);
    if (departmentFilter) params.set('departmentId', departmentFilter);
    api.get('/hr/employees?' + params.toString())
      .then(r => {
        setEmployees(r.data.data || []);
        setTotal(Number(r.data.count || 0));
        setTotalPages(Number(r.data.totalPages || 1));
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  };

  const openCreate = () => {
    setEditing(null);
    setFormData({ employmentType: 'FULL_TIME', status: 'ACTIVE', nationality: 'SA' });
    setIsModalOpen(true);
  };

  const openEdit = (item: any) => {
    setEditing(item);
    setFormData({
      employeeCode: item.employeeCode,
      firstName: item.firstName,
      lastName: item.lastName,
      email: item.email || '',
      phone: item.phone || '',
      idNumber: item.idNumber || '',
      nationality: item.nationality || 'SA',
      departmentId: item.departmentId || '',
      jobTitle: item.jobTitle || '',
      employmentType: item.employmentType,
      status: item.status,
      hireDate: item.hireDate ? new Date(item.hireDate).toISOString().split('T')[0] : '',
      basicSalary: item.basicSalary ?? '',
      housingAllowance: item.housingAllowance ?? '',
      transportAllowance: item.transportAllowance ?? '',
      otherAllowances: item.otherAllowances ?? '',
      gosiNumber: item.gosiNumber || '',
      gosiSalary: item.gosiSalary ?? '',
      emergencyContactName: item.emergencyContactName || '',
      emergencyContactPhone: item.emergencyContactPhone || '',
    });
    setIsModalOpen(true);
  };

  const optionalNumber = (value: any) => value === '' || value == null ? undefined : Number(value);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormLoading(true);
    try {
      const payload = {
        employeeCode: formData.employeeCode,
        firstName: formData.firstName,
        lastName: formData.lastName,
        email: formData.email || undefined,
        phone: formData.phone || undefined,
        idNumber: formData.idNumber || undefined,
        nationality: formData.nationality || undefined,
        departmentId: formData.departmentId || undefined,
        jobTitle: formData.jobTitle || undefined,
        employmentType: formData.employmentType,
        status: formData.status,
        hireDate: formData.hireDate,
        basicSalary: optionalNumber(formData.basicSalary),
        housingAllowance: optionalNumber(formData.housingAllowance),
        transportAllowance: optionalNumber(formData.transportAllowance),
        otherAllowances: optionalNumber(formData.otherAllowances),
        gosiNumber: formData.gosiNumber || undefined,
        gosiSalary: optionalNumber(formData.gosiSalary),
        emergencyContactName: formData.emergencyContactName || undefined,
        emergencyContactPhone: formData.emergencyContactPhone || undefined,
      };
      if (editing) {
        await api.patch(`/hr/employees/${editing.id}`, payload);
      } else {
        await api.post('/hr/employees', payload);
      }
      setIsModalOpen(false);
      setPage(1);
      fetchData();
    } catch (err) {
      alert('تعذر حفظ بيانات الموظف');
    } finally {
      setFormLoading(false);
    }
  };

  const handleTerminate = async (id: string) => {
    if (!confirm('سيتم إنهاء خدمة الموظف مع الاحتفاظ بسجلاته. هل تريد المتابعة؟')) return;
    await api.delete(`/hr/employees/${id}`);
    if (employees.length === 1 && page > 1) setPage(page - 1); else fetchData();
  };

  const deptOptions = departments.map(d => ({ value: d.id, label: d.name }));

  return (
    <div className="space-y-6 animate-fade-in-up">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <Briefcase className="h-6 w-6 text-primary-400" />
            مكين - الموارد البشرية
          </h1>
          <p className="text-slate-400 text-sm mt-1">منصة مكين لإدارة الموارد البشرية داخل SCC 380 — {total} موظف</p>
        </div>
        <Button onClick={openCreate}><Plus className="h-5 w-5" /> إضافة موظف</Button>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <div className="relative">
          <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-500" />
          <input type="text" placeholder="البحث بالاسم أو الكود أو المسمى..." className="scc-input pr-10" value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} />
        </div>
        <Select label="" options={[{ value: '', label: 'كل الحالات' }, ...empStatuses]} value={statusFilter} onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }} />
        <Select label="" options={[{ value: '', label: 'كل الإدارات' }, ...deptOptions]} value={departmentFilter} onChange={(e) => { setDepartmentFilter(e.target.value); setPage(1); }} />
      </div>
      {loading ? (
        <div className="flex items-center justify-center h-64">
          <div className="w-10 h-10 border-4 border-primary-500/30 border-t-primary-500 rounded-full animate-spin" />
        </div>
      ) : employees.length === 0 ? (
        <div className="scc-card text-center py-14">
          <Briefcase className="h-10 w-10 text-slate-600 mx-auto mb-3" />
          <p className="text-white font-medium">لا يوجد موظفون مطابقون.</p>
          <p className="text-slate-500 text-sm mt-1">أضف موظفًا جديدًا أو غيّر عبارة البحث.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {employees.map((emp) => (
            <div key={emp.id} className="scc-card-hover group">
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center text-white font-bold text-lg shrink-0">
                  {emp.firstName?.charAt(0)}
                </div>
                <div className="flex-1 min-w-0">
                  <Link href={`/dashboard/hr/employees/${emp.id}`} className="font-bold text-white truncate hover:text-primary-400 block">{emp.firstName} {emp.lastName}</Link>
                  <p className="text-slate-400 text-sm">{emp.jobTitle || '—'}</p>
                </div>
                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <Link href={`/dashboard/hr/documents?employeeId=${emp.id}`} className="p-1.5 rounded-lg hover:bg-emerald-500/10 text-emerald-400" title="مستندات الموظف"><FolderOpen className="h-4 w-4" /></Link>
                  <button onClick={() => window.open('/dashboard/templates?search=عقد+عمل', '_blank')} className="p-1.5 rounded-lg hover:bg-blue-500/10 text-blue-400" title="تصدير كنموذج"><FileText className="h-4 w-4" /></button>
                  <button onClick={() => openEdit(emp)} className="p-1.5 rounded-lg hover:bg-primary-500/10 text-primary-400"><Pencil className="h-4 w-4" /></button>
                  {emp.status !== 'TERMINATED' && <button onClick={() => handleTerminate(emp.id)} className="p-1.5 rounded-lg hover:bg-red-500/10 text-red-400" title="إنهاء الخدمة"><UserMinus className="h-4 w-4" /></button>}
                </div>
              </div>
              <div className="mt-4 space-y-2 text-sm">
                <div className="flex items-center gap-2 text-slate-400"><Phone className="h-4 w-4" /><span>{emp.phone || '—'}</span></div>
                <div className="flex items-center gap-2 text-slate-400"><Mail className="h-4 w-4" /><span className="truncate">{emp.email || '—'}</span></div>
                <div className="flex items-center gap-2 text-slate-400"><Calendar className="h-4 w-4" /><span>{emp.hireDate ? new Date(emp.hireDate).toLocaleDateString('ar-SA') : '—'}</span></div>
              </div>
              <div className="mt-3 flex items-center gap-2">
                <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${emp.status === 'ACTIVE' ? 'bg-emerald-500/20 text-emerald-400' : emp.status === 'ON_LEAVE' ? 'bg-amber-500/20 text-amber-400' : 'bg-red-500/20 text-red-400'}`}>{empStatuses.find(s => s.value === emp.status)?.label || emp.status}</span>
                <span className="text-slate-500 text-xs">{emp.employeeCode}</span>
              </div>
            </div>
          ))}
        </div>
      )}
      <PaginationControls page={page} totalPages={totalPages} total={total} onPageChange={setPage} />

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
            <Input label="تاريخ التعيين" type="date" required value={formData.hireDate || ''} onChange={(e) => setFormData({ ...formData, hireDate: e.target.value })} />
            <Input label="الراتب الأساسي" type="number" value={formData.basicSalary || ''} onChange={(e) => setFormData({ ...formData, basicSalary: e.target.value })} />
            <Input label="بدل السكن" type="number" value={formData.housingAllowance || ''} onChange={(e) => setFormData({ ...formData, housingAllowance: e.target.value })} />
            <Input label="بدل النقل" type="number" value={formData.transportAllowance || ''} onChange={(e) => setFormData({ ...formData, transportAllowance: e.target.value })} />
            <Input label="بدلات أخرى" type="number" value={formData.otherAllowances || ''} onChange={(e) => setFormData({ ...formData, otherAllowances: e.target.value })} />
            <Input label="رقم التأمينات" value={formData.gosiNumber || ''} onChange={(e) => setFormData({ ...formData, gosiNumber: e.target.value })} />
            <Input label="راتب التأمينات" type="number" value={formData.gosiSalary || ''} onChange={(e) => setFormData({ ...formData, gosiSalary: e.target.value })} />
            <Input label="جهة اتصال للطوارئ" value={formData.emergencyContactName || ''} onChange={(e) => setFormData({ ...formData, emergencyContactName: e.target.value })} />
            <Input label="هاتف الطوارئ" value={formData.emergencyContactPhone || ''} onChange={(e) => setFormData({ ...formData, emergencyContactPhone: e.target.value })} />
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
