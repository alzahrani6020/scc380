'use client';

import { useEffect, useState } from 'react';
import api from '@/lib/api';
import { CalendarRange, Lock, Unlock, Plus, Trash2, X } from 'lucide-react';
import Modal from '@/components/ui/Modal';
import Input from '@/components/ui/Input';
import Button from '@/components/ui/Button';

type Period = {
  id: string;
  name: string;
  year: number;
  month?: number | null;
  startDate: string;
  endDate: string;
  isClosed: boolean;
  closedAt?: string | null;
};

export default function FinancialPeriodsPage() {
  const [periods, setPeriods] = useState<Period[]>([]);
  const [loading, setLoading] = useState(true);
  const [workingId, setWorkingId] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [formLoading, setFormLoading] = useState(false);
  const [formData, setFormData] = useState<any>({
    name: '',
    year: new Date().getFullYear(),
    month: new Date().getMonth() + 1,
    startDate: '',
    endDate: '',
  });

  const fetchData = () => {
    setLoading(true);
    api.get('/finance/financial-periods')
      .then(r => setPeriods(r.data?.data || []))
      .catch(err => alert(err.response?.data?.message || 'تعذر تحميل الفترات المالية'))
      .finally(() => setLoading(false));
  };

  useEffect(() => { fetchData(); }, []);

  const openCreate = () => {
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth() + 1;
    const startDate = `${year}-${String(month).padStart(2, '0')}-01`;
    const end = new Date(Date.UTC(year, month, 0));
    const endDate = `${year}-${String(month).padStart(2, '0')}-${String(end.getUTCDate()).padStart(2, '0')}`;
    setFormData({
      name: `${year}-${String(month).padStart(2, '0')}`,
      year,
      month,
      startDate,
      endDate,
    });
    setIsModalOpen(true);
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormLoading(true);
    try {
      await api.post('/finance/financial-periods', {
        ...formData,
        year: Number(formData.year),
        month: formData.month ? Number(formData.month) : undefined,
      });
      setIsModalOpen(false);
      fetchData();
    } catch (err: any) {
      alert(err.response?.data?.message || 'تعذر إنشاء الفترة');
    } finally {
      setFormLoading(false);
    }
  };

  const closePeriod = async (period: Period) => {
    if (!confirm(`إغلاق الفترة "${period.name}"؟ بعد الإغلاق لن يقبل النظام قيوداً داخلها.`)) return;
    setWorkingId(period.id);
    try {
      await api.post(`/finance/financial-periods/${period.id}/close`);
      fetchData();
    } catch (err: any) {
      alert(err.response?.data?.message || 'تعذر إغلاق الفترة');
    } finally {
      setWorkingId('');
    }
  };

  const reopenPeriod = async (period: Period) => {
    if (!confirm(`إعادة فتح الفترة "${period.name}"؟ هذا الإجراء للمسؤول فقط.`)) return;
    setWorkingId(period.id);
    try {
      await api.post(`/finance/financial-periods/${period.id}/reopen`);
      fetchData();
    } catch (err: any) {
      alert(err.response?.data?.message || 'تعذر إعادة فتح الفترة');
    } finally {
      setWorkingId('');
    }
  };

  const removePeriod = async (period: Period) => {
    if (!confirm(`حذف الفترة "${period.name}"؟ لا يمكن حذف فترة مغلقة أو لها حركة محاسبية.`)) return;
    setWorkingId(period.id);
    try {
      await api.delete(`/finance/financial-periods/${period.id}`);
      fetchData();
    } catch (err: any) {
      alert(err.response?.data?.message || 'تعذر حذف الفترة');
    } finally {
      setWorkingId('');
    }
  };

  return (
    <div className="space-y-6 animate-fade-in-up">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <CalendarRange className="h-6 w-6 text-primary-400" />
            الفترات المالية
          </h1>
          <p className="text-slate-400 text-sm mt-1">
            إدارة فتح وإغلاق الفترات المحاسبية ومنع الترحيل إلى الفترات المغلقة
          </p>
        </div>
        <Button onClick={openCreate}><Plus className="h-5 w-5" /> فترة جديدة</Button>
      </div>

      <div className="bg-slate-900 rounded-xl border border-slate-800 overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-700 text-slate-400 bg-slate-800/50">
              <th className="text-right p-3">الفترة</th>
              <th className="text-center p-3">السنة / الشهر</th>
              <th className="text-center p-3">من</th>
              <th className="text-center p-3">إلى</th>
              <th className="text-center p-3">الحالة</th>
              <th className="text-center p-3">الإجراء</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={6} className="p-8 text-center text-slate-500">جارٍ التحميل...</td></tr>
            ) : periods.length === 0 ? (
              <tr><td colSpan={6} className="p-8 text-center text-slate-500">لا توجد فترات مالية</td></tr>
            ) : periods.map(period => (
              <tr key={period.id} className="border-b border-slate-800/50 hover:bg-slate-800/30">
                <td className="p-3 font-medium text-white">{period.name}</td>
                <td className="p-3 text-center text-slate-300">{period.year}{period.month ? ` / ${period.month}` : ''}</td>
                <td className="p-3 text-center text-slate-300">{new Date(period.startDate).toLocaleDateString('ar-SA')}</td>
                <td className="p-3 text-center text-slate-300">{new Date(period.endDate).toLocaleDateString('ar-SA')}</td>
                <td className="p-3 text-center">
                  <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs ${period.isClosed ? 'bg-red-500/15 text-red-400' : 'bg-emerald-500/15 text-emerald-400'}`}>
                    {period.isClosed ? <Lock className="h-3 w-3" /> : <Unlock className="h-3 w-3" />}
                    {period.isClosed ? 'مغلقة' : 'مفتوحة'}
                  </span>
                </td>
                <td className="p-3">
                  <div className="flex justify-center gap-2">
                    {period.isClosed ? (
                      <button
                        disabled={workingId === period.id}
                        onClick={() => reopenPeriod(period)}
                        className="px-3 py-1.5 rounded-lg bg-amber-500/10 text-amber-400 hover:bg-amber-500/20 disabled:opacity-50"
                      >
                        إعادة فتح
                      </button>
                    ) : (
                      <>
                        <button
                          disabled={workingId === period.id}
                          onClick={() => closePeriod(period)}
                          className="px-3 py-1.5 rounded-lg bg-primary-500/10 text-primary-400 hover:bg-primary-500/20 disabled:opacity-50"
                        >
                          إغلاق
                        </button>
                        <button
                          disabled={workingId === period.id}
                          onClick={() => removePeriod(period)}
                          className="p-1.5 rounded-lg hover:bg-red-500/10 text-red-400 disabled:opacity-50"
                          title="حذف"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title="فترة مالية جديدة">
        <form onSubmit={submit} className="space-y-4">
          <Input label="اسم الفترة" required value={formData.name || ''} onChange={e => setFormData({ ...formData, name: e.target.value })} />
          <div className="grid grid-cols-2 gap-4">
            <Input label="السنة" type="number" required value={formData.year || ''} onChange={e => setFormData({ ...formData, year: e.target.value })} />
            <Input label="الشهر" type="number" value={formData.month || ''} onChange={e => setFormData({ ...formData, month: e.target.value })} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Input label="تاريخ البداية" type="date" required value={formData.startDate || ''} onChange={e => setFormData({ ...formData, startDate: e.target.value })} />
            <Input label="تاريخ النهاية" type="date" required value={formData.endDate || ''} onChange={e => setFormData({ ...formData, endDate: e.target.value })} />
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <Button type="button" variant="ghost" onClick={() => setIsModalOpen(false)}><X className="h-4 w-4" /> إلغاء</Button>
            <Button type="submit" isLoading={formLoading}>إنشاء الفترة</Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
