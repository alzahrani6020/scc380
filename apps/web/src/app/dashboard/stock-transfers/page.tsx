'use client';

import { useEffect, useState } from 'react';
import api from '@/lib/api';
import { ArrowLeftRight, Plus, Search, X, Package, Check, Truck, Warehouse, MapPin } from 'lucide-react';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import Modal from '@/components/ui/Modal';

const statusMap: Record<string, { label: string; color: string }> = {
  PENDING: { label: 'معلق', color: 'bg-amber-500/10 text-amber-400' },
  APPROVED: { label: 'معتمد', color: 'bg-blue-500/10 text-blue-400' },
  SHIPPED: { label: 'تم الشحن', color: 'bg-primary-500/10 text-primary-400' },
  RECEIVED: { label: 'مستلم', color: 'bg-emerald-500/10 text-emerald-400' },
  REJECTED: { label: 'مرفوض', color: 'bg-red-500/10 text-red-400' },
  CANCELLED: { label: 'ملغي', color: 'bg-slate-700 text-slate-400' },
};

export default function StockTransfersPage() {
  const [transfers, setTransfers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [branches, setBranches] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [form, setForm] = useState<any>({ fromBranchId: '', toBranchId: '', notes: '', items: [{ productId: '', quantity: 1, unitCost: 0 }] });

  useEffect(() => {
    fetchData();
    api.get('/branches').then(r => setBranches(r.data || [])).catch(() => {});
    api.get('/inventory/products').then(r => setProducts(r.data?.data || [])).catch(() => {});
  }, []);

  const fetchData = () => {
    setLoading(true);
    api.get('/stock-transfers').then(r => setTransfers(r.data || [])).catch(console.error).finally(() => setLoading(false));
  };

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api.post('/stock-transfers', form);
      setModalOpen(false);
      setForm({ fromBranchId: '', toBranchId: '', notes: '', items: [{ productId: '', quantity: 1, unitCost: 0 }] });
      fetchData();
    } catch (err) {
      alert('حدث خطأ');
    }
  };

  const updateStatus = async (id: string, status: string) => {
    await api.patch(`/stock-transfers/${id}/status`, { status });
    fetchData();
  };

  const addItem = () => setForm({ ...form, items: [...form.items, { productId: '', quantity: 1, unitCost: 0 }] });
  const removeItem = (idx: number) => setForm({ ...form, items: form.items.filter((_: any, i: number) => i !== idx) });
  const updateItem = (idx: number, field: string, value: any) => {
    const items = [...form.items];
    items[idx][field] = value;
    setForm({ ...form, items });
  };

  return (
    <div className="space-y-6 animate-fade-in-up">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <ArrowLeftRight className="h-6 w-6 text-primary-400" />
            تحويلات المخزون
          </h1>
          <p className="text-slate-400 text-sm mt-1">نقل البضاعة بين الفروع</p>
        </div>
        <Button size="sm" onClick={() => setModalOpen(true)}><Plus className="h-4 w-4" /> تحويل جديد</Button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-64">
          <div className="w-10 h-10 border-4 border-primary-500/30 border-t-primary-500 rounded-full animate-spin" />
        </div>
      ) : (
        <div className="space-y-3">
          {transfers.map((t) => {
            const st = statusMap[t.status] || statusMap.PENDING;
            const fromBranch = branches.find(b => b.id === t.fromBranchId);
            const toBranch = branches.find(b => b.id === t.toBranchId);
            return (
              <div key={t.id} className="scc-card-hover">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-primary-500/10 text-primary-400"><ArrowLeftRight className="h-5 w-5" /></div>
                    <div>
                      <div className="font-bold text-white text-sm">{t.transferNumber}</div>
                      <div className="text-xs text-slate-500">{new Date(t.createdAt).toLocaleDateString('ar-SA')}</div>
                    </div>
                  </div>
                  <span className={`text-xs px-2 py-1 rounded-full font-medium ${st.color}`}>{st.label}</span>
                </div>
                <div className="flex items-center gap-4 mb-3 text-sm">
                  <div className="flex items-center gap-1 text-slate-400"><Warehouse className="h-4 w-4" /> {fromBranch?.name || t.fromBranchId}</div>
                  <ArrowLeftRight className="h-4 w-4 text-slate-600" />
                  <div className="flex items-center gap-1 text-slate-400"><MapPin className="h-4 w-4" /> {toBranch?.name || t.toBranchId}</div>
                </div>
                <div className="flex items-center gap-2 mb-3">
                  {t.items?.map((item: any) => (
                    <span key={item.id} className="text-xs bg-slate-800 text-slate-300 px-2 py-1 rounded-lg">{item.product?.name || item.productId} × {item.quantity}</span>
                  ))}
                </div>
                <div className="flex items-center gap-2">
                  {t.status === 'PENDING' && <Button size="sm" variant="ghost" onClick={() => updateStatus(t.id, 'APPROVED')}><Check className="h-3 w-3" /> اعتماد</Button>}
                  {t.status === 'APPROVED' && <Button size="sm" variant="ghost" onClick={() => updateStatus(t.id, 'SHIPPED')}><Truck className="h-3 w-3" /> شحن</Button>}
                  {t.status === 'SHIPPED' && <Button size="sm" variant="ghost" onClick={() => updateStatus(t.id, 'RECEIVED')}><Check className="h-3 w-3" /> استلام</Button>}
                </div>
              </div>
            );
          })}
          {transfers.length === 0 && <div className="scc-card text-center py-12 text-slate-500">لا توجد تحويلات</div>}
        </div>
      )}

      <Modal isOpen={modalOpen} onClose={() => setModalOpen(false)} title="تحويل مخزون جديد">
        <form onSubmit={save} className="space-y-4 max-h-[70vh] overflow-y-auto pr-1">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-slate-400 mb-1">من الفرع</label>
              <select required value={form.fromBranchId} onChange={e => setForm({ ...form, fromBranchId: e.target.value })} className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white">
                <option value="">اختر</option>
                {branches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs text-slate-400 mb-1">إلى الفرع</label>
              <select required value={form.toBranchId} onChange={e => setForm({ ...form, toBranchId: e.target.value })} className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white">
                <option value="">اختر</option>
                {branches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
              </select>
            </div>
          </div>
          {form.items.map((item: any, idx: number) => (
            <div key={idx} className="grid grid-cols-12 gap-2 items-end">
              <div className="col-span-5">
                <label className="block text-xs text-slate-400 mb-1">المنتج</label>
                <select required value={item.productId} onChange={e => updateItem(idx, 'productId', e.target.value)} className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white">
                  <option value="">اختر</option>
                  {products.map((p: any) => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
              </div>
              <div className="col-span-3">
                <label className="block text-xs text-slate-400 mb-1">الكمية</label>
                <Input type="number" min={1} value={item.quantity} onChange={e => updateItem(idx, 'quantity', e.target.value)} />
              </div>
              <div className="col-span-3">
                <label className="block text-xs text-slate-400 mb-1">التكلفة</label>
                <Input type="number" value={item.unitCost} onChange={e => updateItem(idx, 'unitCost', e.target.value)} />
              </div>
              <div className="col-span-1">
                <button type="button" onClick={() => removeItem(idx)} className="p-2 rounded-lg hover:bg-red-500/10 text-red-400"><X className="h-4 w-4" /></button>
              </div>
            </div>
          ))}
          <Button type="button" variant="ghost" size="sm" onClick={addItem}><Plus className="h-4 w-4" /> إضافة منتج</Button>
          <Input label="ملاحظات" value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} />
          <div className="flex justify-end gap-3">
            <Button type="button" variant="ghost" onClick={() => setModalOpen(false)}><X className="h-4 w-4" /> إلغاء</Button>
            <Button type="submit">حفظ</Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
