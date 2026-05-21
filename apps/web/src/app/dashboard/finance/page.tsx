'use client';

import { useEffect, useState } from 'react';
import api from '@/lib/api';
import { Receipt, ArrowUpRight, ArrowDownRight, Wallet, TrendingUp, CreditCard, Landmark, Plus, Pencil, Trash2, X, BookOpen, BookText, TreePine } from 'lucide-react';
import Modal from '@/components/ui/Modal';
import Input from '@/components/ui/Input';
import Select from '@/components/ui/Select';
import Button from '@/components/ui/Button';

const paymentMethods = [
  { value: 'CASH', label: 'نقدي' },
  { value: 'BANK_TRANSFER', label: 'تحويل بنكي' },
  { value: 'CREDIT_CARD', label: 'بطاقة ائتمان' },
  { value: 'SADAD', label: 'سداد' },
  { value: 'STC_PAY', label: 'STC Pay' },
  { value: 'APPLE_PAY', label: 'Apple Pay' },
];

const expenseCategories = [
  { value: 'OFFICE', label: 'مكتب' },
  { value: 'TRAVEL', label: 'سفر' },
  { value: 'MEALS', label: 'وجبات' },
  { value: 'UTILITIES', label: 'خدمات' },
  { value: 'MARKETING', label: 'تسويق' },
  { value: 'SALARIES', label: 'رواتب' },
  { value: 'RENT', label: 'إيجار' },
  { value: 'MAINTENANCE', label: 'صيانة' },
  { value: 'INSURANCE', label: 'تأمين' },
  { value: 'TAXES', label: 'ضرائب' },
  { value: 'SUPPLIES', label: 'مستلزمات' },
  { value: 'OTHER', label: 'أخرى' },
];

export default function FinancePage() {
  const [payments, setPayments] = useState<any[]>([]);
  const [expenses, setExpenses] = useState<any[]>([]);
  const [accounts, setAccounts] = useState<any[]>([]);
  const [invoices, setInvoices] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'payments' | 'expenses'>('payments');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [formLoading, setFormLoading] = useState(false);
  const [formData, setFormData] = useState<any>({});

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = () => {
    Promise.all([
      api.get('/finance/payments').then(r => setPayments(r.data.data || [])),
      api.get('/finance/expenses').then(r => setExpenses(r.data.data || [])),
      api.get('/finance/chart-of-accounts').then(r => setAccounts(r.data.data || [])),
      api.get('/erp/invoices').then(r => setInvoices(r.data.data || [])),
    ]).catch(console.error).finally(() => setLoading(false));
  };

  const openCreate = () => {
    setEditing(null);
    setFormData(activeTab === 'payments'
      ? { method: 'CASH', currency: 'SAR', status: 'COMPLETED' }
      : { category: 'OFFICE', currency: 'SAR', status: 'PENDING', incurredAt: new Date().toISOString().split('T')[0] }
    );
    setIsModalOpen(true);
  };

  const openEdit = (item: any) => {
    setEditing(item);
    setFormData({
      ...item,
      paidAt: item.paidAt ? new Date(item.paidAt).toISOString().split('T')[0] : '',
      incurredAt: item.incurredAt ? new Date(item.incurredAt).toISOString().split('T')[0] : '',
    });
    setIsModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormLoading(true);
    try {
      const payload = { ...formData, amount: parseFloat(formData.amount) };
      const endpoint = activeTab === 'payments' ? '/finance/payments' : '/finance/expenses';
      if (editing) {
        await api.patch(`${endpoint}/${editing.id}`, payload);
      } else {
        await api.post(endpoint, payload);
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
    const endpoint = activeTab === 'payments' ? '/finance/payments' : '/finance/expenses';
    await api.delete(`${endpoint}/${id}`);
    fetchData();
  };

  const totalPayments = payments.reduce((sum, p) => sum + Number(p.amount), 0);
  const totalExpenses = expenses.reduce((sum, e) => sum + Number(e.amount), 0);

  return (
    <div className="space-y-6 animate-fade-in-up">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <Receipt className="h-6 w-6 text-primary-400" />
            المالية
          </h1>
          <p className="text-slate-400 text-sm mt-1">نظرة عامة على الأداء المالي</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="scc-card-hover">
          <div className="flex items-center gap-3 mb-3"><div className="w-10 h-10 rounded-lg bg-emerald-500/10 flex items-center justify-center"><ArrowDownRight className="h-5 w-5 text-emerald-400" /></div><p className="text-slate-400 text-sm">المدفوعات</p></div>
          <p className="text-2xl font-bold text-white">{totalPayments.toLocaleString()} ر.س</p>
        </div>
        <div className="scc-card-hover">
          <div className="flex items-center gap-3 mb-3"><div className="w-10 h-10 rounded-lg bg-rose-500/10 flex items-center justify-center"><ArrowUpRight className="h-5 w-5 text-rose-400" /></div><p className="text-slate-400 text-sm">المصروفات</p></div>
          <p className="text-2xl font-bold text-white">{totalExpenses.toLocaleString()} ر.س</p>
        </div>
        <div className="scc-card-hover">
          <div className="flex items-center gap-3 mb-3"><div className="w-10 h-10 rounded-lg bg-blue-500/10 flex items-center justify-center"><Landmark className="h-5 w-5 text-blue-400" /></div><p className="text-slate-400 text-sm">الحسابات</p></div>
          <p className="text-2xl font-bold text-white">{accounts.length}</p>
        </div>
        <div className="scc-card-hover">
          <div className="flex items-center gap-3 mb-3"><div className="w-10 h-10 rounded-lg bg-amber-500/10 flex items-center justify-center"><Wallet className="h-5 w-5 text-amber-400" /></div><p className="text-slate-400 text-sm">صافي التدفق</p></div>
          <p className="text-2xl font-bold text-white">{(totalPayments - totalExpenses).toLocaleString()} ر.س</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <a href="/dashboard/finance/journal-entries" className="scc-card-hover flex items-center gap-4 group">
          <div className="w-12 h-12 rounded-xl bg-primary-500/10 flex items-center justify-center group-hover:bg-primary-500/20 transition-colors">
            <BookOpen className="h-6 w-6 text-primary-400" />
          </div>
          <div>
            <h3 className="font-bold text-white">القيود اليومية</h3>
            <p className="text-slate-400 text-sm">إدارة القيود المحاسبية</p>
          </div>
        </a>
        <a href="/dashboard/finance/general-ledger" className="scc-card-hover flex items-center gap-4 group">
          <div className="w-12 h-12 rounded-xl bg-indigo-500/10 flex items-center justify-center group-hover:bg-indigo-500/20 transition-colors">
            <BookText className="h-6 w-6 text-indigo-400" />
          </div>
          <div>
            <h3 className="font-bold text-white">دفتر الأستاذ</h3>
            <p className="text-slate-400 text-sm">عرض الأرصدة لكل حساب</p>
          </div>
        </a>
        <a href="/dashboard/finance/chart-of-accounts" className="scc-card-hover flex items-center gap-4 group">
          <div className="w-12 h-12 rounded-xl bg-teal-500/10 flex items-center justify-center group-hover:bg-teal-500/20 transition-colors">
            <TreePine className="h-6 w-6 text-teal-400" />
          </div>
          <div>
            <h3 className="font-bold text-white">دليل الحسابات</h3>
            <p className="text-slate-400 text-sm">شجرة الحسابات المحاسبية</p>
          </div>
        </a>
      </div>

      <div className="flex items-center gap-4">
        <div className="flex bg-slate-800 rounded-lg p-1">
          <button onClick={() => setActiveTab('payments')} className={`px-4 py-2 rounded-md text-sm ${activeTab === 'payments' ? 'bg-primary-500 text-white' : 'text-slate-400'}`}>المدفوعات</button>
          <button onClick={() => setActiveTab('expenses')} className={`px-4 py-2 rounded-md text-sm ${activeTab === 'expenses' ? 'bg-primary-500 text-white' : 'text-slate-400'}`}>المصروفات</button>
        </div>
        <Button onClick={openCreate}><Plus className="h-5 w-5" /> {activeTab === 'payments' ? 'تسجيل دفع' : 'تسجيل مصروف'}</Button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-64"><div className="w-10 h-10 border-4 border-primary-500/30 border-t-primary-500 rounded-full animate-spin" /></div>
      ) : activeTab === 'payments' ? (
        <div className="space-y-3">
          {payments.map((p) => (
            <div key={p.id} className="scc-card-hover flex items-center justify-between group">
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 rounded-lg bg-emerald-500/10 flex items-center justify-center text-emerald-400"><CreditCard className="h-5 w-5" /></div>
                <div>
                  <p className="text-white font-medium text-sm">{p.method}</p>
                  <p className="text-slate-400 text-xs">{p.reference || '—'}</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <p className="text-emerald-400 font-bold">+{Number(p.amount).toLocaleString()} ر.س</p>
                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button onClick={() => { setActiveTab('payments'); openEdit(p); }} className="p-1.5 rounded-lg hover:bg-primary-500/10 text-primary-400"><Pencil className="h-4 w-4" /></button>
                  <button onClick={() => handleDelete(p.id)} className="p-1.5 rounded-lg hover:bg-red-500/10 text-red-400"><Trash2 className="h-4 w-4" /></button>
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="space-y-3">
          {expenses.map((e) => (
            <div key={e.id} className="scc-card-hover flex items-center justify-between group">
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 rounded-lg bg-rose-500/10 flex items-center justify-center text-rose-400"><TrendingUp className="h-5 w-5" /></div>
                <div>
                  <p className="text-white font-medium text-sm">{e.description}</p>
                  <p className="text-slate-400 text-xs">{expenseCategories.find(c => c.value === e.category)?.label || e.category}</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <p className="text-rose-400 font-bold">-{Number(e.amount).toLocaleString()} ر.س</p>
                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button onClick={() => { setActiveTab('expenses'); openEdit(e); }} className="p-1.5 rounded-lg hover:bg-primary-500/10 text-primary-400"><Pencil className="h-4 w-4" /></button>
                  <button onClick={() => handleDelete(e.id)} className="p-1.5 rounded-lg hover:bg-red-500/10 text-red-400"><Trash2 className="h-4 w-4" /></button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title={editing ? 'تعديل' : (activeTab === 'payments' ? 'تسجيل دفع' : 'تسجيل مصروف')}>
        <form onSubmit={handleSubmit} className="space-y-4">
          {activeTab === 'payments' ? (
            <>
              <Select label="الفاتورة" options={invoices.map(i => ({ value: i.id, label: i.invoiceNumber }))} value={formData.invoiceId || ''} onChange={(e) => setFormData({ ...formData, invoiceId: e.target.value })} />
              <Input label="المبلغ" type="number" required value={formData.amount || ''} onChange={(e) => setFormData({ ...formData, amount: e.target.value })} />
              <Select label="طريقة الدفع" options={paymentMethods} value={formData.method || 'CASH'} onChange={(e) => setFormData({ ...formData, method: e.target.value })} />
              <Input label="المرجع" value={formData.reference || ''} onChange={(e) => setFormData({ ...formData, reference: e.target.value })} />
              <Input label="تاريخ الدفع" type="date" value={formData.paidAt || ''} onChange={(e) => setFormData({ ...formData, paidAt: e.target.value })} />
            </>
          ) : (
            <>
              <Select label="الفئة" options={expenseCategories} value={formData.category || 'OTHER'} onChange={(e) => setFormData({ ...formData, category: e.target.value })} />
              <Input label="المبلغ" type="number" required value={formData.amount || ''} onChange={(e) => setFormData({ ...formData, amount: e.target.value })} />
              <Input label="الوصف" required value={formData.description || ''} onChange={(e) => setFormData({ ...formData, description: e.target.value })} />
              <Input label="التاريخ" type="date" value={formData.incurredAt || ''} onChange={(e) => setFormData({ ...formData, incurredAt: e.target.value })} />
            </>
          )}
          <div className="flex justify-end gap-3 pt-2">
            <Button type="button" variant="ghost" onClick={() => setIsModalOpen(false)}><X className="h-4 w-4" /> إلغاء</Button>
            <Button type="submit" isLoading={formLoading}>{editing ? 'حفظ' : 'تسجيل'}</Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
