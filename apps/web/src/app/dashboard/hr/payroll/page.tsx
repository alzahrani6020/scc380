'use client';

import { useEffect, useState } from 'react';
import api from '@/lib/api';
import { Receipt, Search, Wallet, Pencil, Trash2, X } from 'lucide-react';
import Modal from '@/components/ui/Modal';
import Input from '@/components/ui/Input';
import Select from '@/components/ui/Select';
import Button from '@/components/ui/Button';

const payrollStatuses = [
  { value: 'DRAFT', label: 'مسودة' },
  { value: 'APPROVED', label: 'معتمد' },
  { value: 'PAID', label: 'مدفوع' },
];

export default function PayrollPage() {
  const [items, setItems] = useState<any[]>([]);
  const [employees, setEmployees] = useState<any[]>([]);
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
      api.get('/hr/payrolls').then(r => setItems(r.data.data || [])),
      api.get('/hr/employees').then(r => setEmployees(r.data.data || [])),
    ]).catch(console.error).finally(() => setLoading(false));
  };

  const openCreate = () => {
    setEditing(null);
    setFormData({ month: new Date().getMonth() + 1, year: new Date().getFullYear(), status: 'DRAFT' });
    setIsModalOpen(true);
  };

  const openEdit = (item: any) => {
    setEditing(item);
    setFormData({ ...item });
    setIsModalOpen(true);
  };

  const calculateNet = () => {
    const basic = parseFloat(formData.basicSalary) || 0;
    const housing = parseFloat(formData.housingAllowance) || 0;
    const transport = parseFloat(formData.transportAllowance) || 0;
    const other = parseFloat(formData.otherAllowances) || 0;
    const gosi = parseFloat(formData.gosiDeduction) || 0;
    const tax = parseFloat(formData.taxDeduction) || 0;
    const otherDed = parseFloat(formData.otherDeductions) || 0;
    return basic + housing + transport + other - gosi - tax - otherDed;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormLoading(true);
    try {
      const payload = { ...formData, netSalary: calculateNet() };
      if (editing) {
        await api.patch(`/hr/payrolls/${editing.id}`, payload);
      } else {
        await api.post('/hr/payrolls', payload);
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
    await api.delete(`/hr/payrolls/${id}`);
    fetchData();
  };

  const handlePay = async (id: string) => {
    await api.patch(`/hr/payrolls/${id}`, { status: 'PAID', paidAt: new Date().toISOString() });
    fetchData();
  };

  const filtered = items.filter((p) =>
    p.employee?.firstName?.includes(search) || p.employee?.lastName?.includes(search)
  );

  const empOptions = employees.map(e => ({ value: e.id, label: `${e.firstName} ${e.lastName}` }));

  return (
    <div className="space-y-6 animate-fade-in-up">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <Receipt className="h-6 w-6 text-primary-400" />
            الرواتب
          </h1>
          <p className="text-slate-400 text-sm mt-1">{items.length} سجل راتب</p>
        </div>
        <Button onClick={openCreate}><Wallet className="h-5 w-5" /> إنشاء راتب</Button>
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
        <div className="space-y-3">
          {filtered.map((p) => (
            <div key={p.id} className="scc-card-hover flex items-center justify-between group">
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center text-white shrink-0">
                  <Wallet className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="font-bold text-white text-sm">{p.employee?.firstName} {p.employee?.lastName}</h3>
                  <p className="text-slate-400 text-xs">{p.month}/{p.year}</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <div className="text-left">
                  <p className="text-white font-bold text-sm">{Number(p.netSalary).toLocaleString()} ر.س</p>
                  <span className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-medium ${
                    p.status === 'PAID' ? 'bg-emerald-500/20 text-emerald-400' :
                    p.status === 'APPROVED' ? 'bg-blue-500/20 text-blue-400' :
                    'bg-amber-500/20 text-amber-400'
                  }`}>{payrollStatuses.find(s => s.value === p.status)?.label || p.status}</span>
                </div>
                {p.status !== 'PAID' && <Button size="sm" onClick={() => handlePay(p.id)}><Wallet className="h-3 w-3" /> دفع</Button>}
                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button onClick={() => openEdit(p)} className="p-1.5 rounded-lg hover:bg-primary-500/10 text-primary-400"><Pencil className="h-4 w-4" /></button>
                  <button onClick={() => handleDelete(p.id)} className="p-1.5 rounded-lg hover:bg-red-500/10 text-red-400"><Trash2 className="h-4 w-4" /></button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title={editing ? 'تعديل راتب' : 'راتب جديد'} size="lg">
        <form onSubmit={handleSubmit} className="space-y-4">
          <Select label="الموظف" required options={empOptions} value={formData.employeeId || ''} onChange={(e) => setFormData({ ...formData, employeeId: e.target.value })} />
          <div className="grid grid-cols-2 gap-4">
            <Input label="الشهر" type="number" min="1" max="12" required value={formData.month || ''} onChange={(e) => setFormData({ ...formData, month: e.target.value })} />
            <Input label="السنة" type="number" required value={formData.year || ''} onChange={(e) => setFormData({ ...formData, year: e.target.value })} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Input label="الراتب الأساسي" type="number" required value={formData.basicSalary || ''} onChange={(e) => setFormData({ ...formData, basicSalary: e.target.value })} />
            <Input label="بدل السكن" type="number" value={formData.housingAllowance || ''} onChange={(e) => setFormData({ ...formData, housingAllowance: e.target.value })} />
            <Input label="بدل النقل" type="number" value={formData.transportAllowance || ''} onChange={(e) => setFormData({ ...formData, transportAllowance: e.target.value })} />
            <Input label="بدلات أخرى" type="number" value={formData.otherAllowances || ''} onChange={(e) => setFormData({ ...formData, otherAllowances: e.target.value })} />
            <Input label="خصم التأمينات" type="number" value={formData.gosiDeduction || ''} onChange={(e) => setFormData({ ...formData, gosiDeduction: e.target.value })} />
            <Input label="خصم الضريبة" type="number" value={formData.taxDeduction || ''} onChange={(e) => setFormData({ ...formData, taxDeduction: e.target.value })} />
            <Input label="خصومات أخرى" type="number" value={formData.otherDeductions || ''} onChange={(e) => setFormData({ ...formData, otherDeductions: e.target.value })} />
            <Select label="الحالة" options={payrollStatuses} value={formData.status || 'DRAFT'} onChange={(e) => setFormData({ ...formData, status: e.target.value })} />
          </div>
          <div className="bg-slate-800/50 rounded-xl p-4">
            <div className="flex justify-between text-base font-bold">
              <span className="text-white">صافي الراتب</span>
              <span className="text-primary-400">{calculateNet().toLocaleString()} ر.س</span>
            </div>
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
