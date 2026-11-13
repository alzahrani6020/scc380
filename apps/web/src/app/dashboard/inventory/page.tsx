'use client';

import { useEffect, useMemo, useState } from 'react';
import { ArrowDownUp, PackagePlus, Warehouse } from 'lucide-react';
import api from '@/lib/api';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import Modal from '@/components/ui/Modal';
import Select from '@/components/ui/Select';

type Product = {
  id: string;
  name: string;
  sku: string;
  barcode?: string | null;
  salePrice: number | string;
  costPrice: number | string;
  currentStock: number;
  minStockLevel: number;
  isActive: boolean;
  category?: { name: string } | null;
};

export default function InventoryPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [warehouses, setWarehouses] = useState<any[]>([]);
  const [accounts, setAccounts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [search, setSearch] = useState('');
  const [productOpen, setProductOpen] = useState(false);
  const [movementOpen, setMovementOpen] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [productForm, setProductForm] = useState<any>({
    name: '',
    sku: '',
    barcode: '',
    salePrice: '',
    costPrice: '',
    minStockLevel: 0,
  });
  const [movementForm, setMovementForm] = useState<any>({
    type: 'SALE',
    quantity: 1,
    warehouseId: '',
    unitCost: '',
    counterAccountId: '',
    adjustmentDirection: 'INCREASE',
    reference: '',
  });

  const activeAccounts = useMemo(
    () => accounts.filter((a) => a.isActive !== false),
    [accounts],
  );

  const load = () => {
    setLoading(true);
    Promise.all([
      api.get('/inventory/products').then((r) =>
        setProducts(Array.isArray(r.data) ? r.data : r.data?.data || []),
      ),
      api.get('/inventory/warehouses').then((r) =>
        setWarehouses(Array.isArray(r.data) ? r.data : r.data?.data || []),
      ),
      api.get('/finance/chart-of-accounts').then((r) =>
        setAccounts(Array.isArray(r.data) ? r.data : r.data?.data || []),
      ),
    ])
      .catch((err) => alert(err.response?.data?.message || 'تعذر تحميل المخزون'))
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const createProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      await api.post('/inventory/products', {
        name: productForm.name,
        sku: productForm.sku,
        barcode: productForm.barcode || undefined,
        salePrice: String(productForm.salePrice || '0'),
        costPrice: String(productForm.costPrice || '0'),
        currentStock: 0,
        minStockLevel: Number(productForm.minStockLevel || 0),
      });
      setProductOpen(false);
      setProductForm({ name: '', sku: '', barcode: '', salePrice: '', costPrice: '', minStockLevel: 0 });
      load();
    } catch (err: any) {
      alert(err.response?.data?.message || 'تعذر إنشاء المنتج');
    } finally {
      setBusy(false);
    }
  };

  const openMovement = (product: Product) => {
    setSelectedProduct(product);
    setMovementForm({
      type: 'SALE',
      quantity: 1,
      warehouseId: '',
      unitCost: String(product.costPrice || ''),
      counterAccountId: '',
      adjustmentDirection: 'INCREASE',
      reference: '',
    });
    setMovementOpen(true);
  };

  const createMovement = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedProduct) return;
    setBusy(true);
    try {
      const payload: any = {
        productId: selectedProduct.id,
        type: movementForm.type,
        quantity: Number(movementForm.quantity),
        warehouseId: movementForm.warehouseId || undefined,
        unitCost: movementForm.unitCost === '' ? undefined : String(movementForm.unitCost),
        reference: movementForm.reference || undefined,
      };
      if (movementForm.type === 'ADJUSTMENT') {
        payload.adjustmentDirection = movementForm.adjustmentDirection;
      }
      if (movementForm.type !== 'SALE') {
        payload.counterAccountId = movementForm.counterAccountId || undefined;
      }
      await api.post('/inventory/movements', payload);
      setMovementOpen(false);
      load();
    } catch (err: any) {
      alert(err.response?.data?.message || 'تعذر تسجيل حركة المخزون');
    } finally {
      setBusy(false);
    }
  };

  const filtered = products.filter((p) => {
    const q = search.trim().toLowerCase();
    return !q ||
      p.name.toLowerCase().includes(q) ||
      p.sku.toLowerCase().includes(q) ||
      Boolean(p.barcode?.includes(q));
  });

  const stockValue = products.reduce(
    (sum, p) => sum + p.currentStock * Number(p.costPrice || 0),
    0,
  );
  const lowStock = products.filter((p) => p.currentStock <= p.minStockLevel).length;

  return (
    <div className="space-y-6 animate-fade-in-up" dir="rtl">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <Warehouse className="h-6 w-6 text-primary-400" />
            إدارة المخزون
          </h1>
          <p className="text-slate-400 text-sm mt-1">
            مخزون فعلي مرتبط بالحركات والقيود المحاسبية
          </p>
        </div>
        <Button onClick={() => setProductOpen(true)}><PackagePlus className="h-4 w-4" /> منتج جديد</Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="scc-card-hover">
          <p className="text-slate-400 text-xs">عدد المنتجات</p>
          <p className="text-xl font-bold text-white">{products.length}</p>
        </div>
        <div className="scc-card-hover">
          <p className="text-slate-400 text-xs">قيمة المخزون بالتكلفة</p>
          <p className="text-xl font-bold text-white">{stockValue.toLocaleString()} ر.س</p>
        </div>
        <div className="scc-card-hover">
          <p className="text-slate-400 text-xs">منخفض المخزون</p>
          <p className={`text-xl font-bold ${lowStock ? 'text-red-400' : 'text-emerald-400'}`}>{lowStock}</p>
        </div>
      </div>

      <Input label="بحث" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="اسم المنتج، SKU أو الباركود" />

      <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-slate-800/50 border-b border-slate-700 text-slate-400">
              <th className="p-3 text-right">المنتج</th>
              <th className="p-3 text-right">SKU</th>
              <th className="p-3 text-left">التكلفة</th>
              <th className="p-3 text-left">سعر البيع</th>
              <th className="p-3 text-center">الرصيد</th>
              <th className="p-3 text-center">الإجراء</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={6} className="p-8 text-center text-slate-500">جارٍ التحميل...</td></tr>
            ) : filtered.length === 0 ? (
              <tr><td colSpan={6} className="p-8 text-center text-slate-500">لا توجد منتجات</td></tr>
            ) : filtered.map((p) => (
              <tr key={p.id} className="border-b border-slate-800/50">
                <td className="p-3 text-white font-medium">{p.name}</td>
                <td className="p-3 text-slate-300">{p.sku}</td>
                <td className="p-3 text-left text-slate-300">{Number(p.costPrice).toLocaleString()}</td>
                <td className="p-3 text-left text-slate-300">{Number(p.salePrice).toLocaleString()}</td>
                <td className={`p-3 text-center font-bold ${p.currentStock <= p.minStockLevel ? 'text-red-400' : 'text-emerald-400'}`}>
                  {p.currentStock}
                </td>
                <td className="p-3 text-center">
                  <button onClick={() => openMovement(p)} className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-primary-400 hover:bg-primary-500/10">
                    <ArrowDownUp className="h-4 w-4" />
                    حركة
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Modal isOpen={productOpen} onClose={() => setProductOpen(false)} title="منتج جديد">
        <form onSubmit={createProduct} className="space-y-4">
          <Input label="اسم المنتج" required value={productForm.name} onChange={(e) => setProductForm({ ...productForm, name: e.target.value })} />
          <Input label="SKU" required value={productForm.sku} onChange={(e) => setProductForm({ ...productForm, sku: e.target.value })} />
          <Input label="الباركود" value={productForm.barcode} onChange={(e) => setProductForm({ ...productForm, barcode: e.target.value })} />
          <div className="grid grid-cols-2 gap-3">
            <Input label="سعر التكلفة" type="number" step="0.0001" value={productForm.costPrice} onChange={(e) => setProductForm({ ...productForm, costPrice: e.target.value })} />
            <Input label="سعر البيع" type="number" step="0.0001" value={productForm.salePrice} onChange={(e) => setProductForm({ ...productForm, salePrice: e.target.value })} />
          </div>
          <Input label="حد إعادة الطلب" type="number" min="0" value={productForm.minStockLevel} onChange={(e) => setProductForm({ ...productForm, minStockLevel: e.target.value })} />
          <p className="text-xs text-slate-500">الرصيد الافتتاحي يُسجل بحركة مخزون حتى يبقى مرتبطًا محاسبيًا.</p>
          <div className="flex justify-end"><Button type="submit" isLoading={busy}>حفظ</Button></div>
        </form>
      </Modal>

      <Modal isOpen={movementOpen} onClose={() => setMovementOpen(false)} title={selectedProduct ? `حركة — ${selectedProduct.name}` : 'حركة مخزون'}>
        <form onSubmit={createMovement} className="space-y-4">
          <Select label="نوع الحركة" value={movementForm.type} onChange={(e) => setMovementForm({ ...movementForm, type: e.target.value })} options={[
            { value: 'SALE', label: 'بيع — يرحل تكلفة المبيعات تلقائيًا' },
            { value: 'IN', label: 'استلام / زيادة' },
            { value: 'OUT', label: 'صرف / نقصان' },
            { value: 'RETURN', label: 'مرتجع / زيادة' },
            { value: 'ADJUSTMENT', label: 'تسوية جرد' },
          ]} />
          {movementForm.type === 'ADJUSTMENT' && (
            <Select label="اتجاه التسوية" value={movementForm.adjustmentDirection} onChange={(e) => setMovementForm({ ...movementForm, adjustmentDirection: e.target.value })} options={[
              { value: 'INCREASE', label: 'زيادة' },
              { value: 'DECREASE', label: 'نقصان' },
            ]} />
          )}
          <div className="grid grid-cols-2 gap-3">
            <Input label="الكمية" type="number" min="1" required value={movementForm.quantity} onChange={(e) => setMovementForm({ ...movementForm, quantity: e.target.value })} />
            <Input label="تكلفة الوحدة" type="number" step="0.0001" value={movementForm.unitCost} onChange={(e) => setMovementForm({ ...movementForm, unitCost: e.target.value })} />
          </div>
          <Select label="المستودع (اختياري)" value={movementForm.warehouseId} onChange={(e) => setMovementForm({ ...movementForm, warehouseId: e.target.value })} options={[
            { value: '', label: 'بدون تحديد مستودع' },
            ...warehouses.filter((w) => w.isActive !== false).map((w) => ({ value: w.id, label: w.name })),
          ]} />
          {movementForm.type !== 'SALE' && (
            <Select label="الحساب المقابل" required value={movementForm.counterAccountId} onChange={(e) => setMovementForm({ ...movementForm, counterAccountId: e.target.value })} options={activeAccounts.map((a) => ({ value: a.id, label: `${a.code} — ${a.name}` }))} />
          )}
          <Input label="المرجع" value={movementForm.reference} onChange={(e) => setMovementForm({ ...movementForm, reference: e.target.value })} />
          <div className="flex justify-end"><Button type="submit" isLoading={busy}>ترحيل الحركة</Button></div>
        </form>
      </Modal>
    </div>
  );
}
