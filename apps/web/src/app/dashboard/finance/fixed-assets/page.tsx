'use client';

import { useEffect, useMemo, useState } from 'react';
import { Calculator, Landmark, Plus, RefreshCw } from 'lucide-react';
import api from '@/lib/api';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import Modal from '@/components/ui/Modal';
import Select from '@/components/ui/Select';

type Category = {
  id: string;
  name: string;
  code?: string | null;
  usefulLifeYears: number;
  depreciationMethod: string;
  depreciationRate: number | string;
};

type Asset = {
  id: string;
  name: string;
  code?: string | null;
  category: Category;
  acquisitionCost: number | string;
  salvageValue: number | string;
  accumulatedDepreciation: number | string;
  currentValue: number | string;
  status: string;
};

export default function FixedAssetsPage() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [assets, setAssets] = useState<Asset[]>([]);
  const [accounts, setAccounts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [categoryOpen, setCategoryOpen] = useState(false);
  const [assetOpen, setAssetOpen] = useState(false);
  const [deprOpen, setDeprOpen] = useState(false);
  const [selected, setSelected] = useState<Asset | null>(null);
  const [busy, setBusy] = useState(false);
  const [categoryForm, setCategoryForm] = useState<any>({
    name: '',
    code: '',
    usefulLifeYears: 5,
    depreciationMethod: 'STRAIGHT_LINE',
    depreciationRate: 0,
  });
  const [assetForm, setAssetForm] = useState<any>({
    name: '',
    code: '',
    categoryId: '',
    acquisitionCost: '',
    salvageValue: 0,
    purchaseDate: '',
    startDate: '',
    location: '',
  });
  const [deprForm, setDeprForm] = useState<any>({
    period: new Date().toISOString().slice(0, 7),
    expenseAccountId: '',
    accumulatedDepreciationAccountId: '',
  });

  const expenseAccounts = useMemo(
    () => accounts.filter((a) => a.type === 'EXPENSE' && a.isActive !== false),
    [accounts],
  );
  const assetAccounts = useMemo(
    () => accounts.filter((a) => a.type === 'ASSET' && a.isActive !== false),
    [accounts],
  );

  const load = () => {
    setLoading(true);
    Promise.all([
      api.get('/finance/fixed-assets/categories').then((r) => setCategories(r.data?.data || [])),
      api.get('/finance/fixed-assets').then((r) => setAssets(r.data?.data || [])),
      api.get('/finance/chart-of-accounts').then((r) => setAccounts(r.data?.data || [])),
    ])
      .catch((err) => alert(err.response?.data?.message || 'تعذر تحميل الأصول الثابتة'))
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const createCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      await api.post('/finance/fixed-assets/categories', {
        ...categoryForm,
        usefulLifeYears: Number(categoryForm.usefulLifeYears),
        depreciationRate: Number(categoryForm.depreciationRate || 0),
        code: categoryForm.code || undefined,
      });
      setCategoryOpen(false);
      load();
    } catch (err: any) {
      alert(err.response?.data?.message || 'تعذر إنشاء فئة الأصل');
    } finally {
      setBusy(false);
    }
  };

  const createAsset = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      await api.post('/finance/fixed-assets', {
        ...assetForm,
        acquisitionCost: Number(assetForm.acquisitionCost),
        salvageValue: Number(assetForm.salvageValue || 0),
        code: assetForm.code || undefined,
        startDate: assetForm.startDate || undefined,
      });
      setAssetOpen(false);
      load();
    } catch (err: any) {
      alert(err.response?.data?.message || 'تعذر إنشاء الأصل');
    } finally {
      setBusy(false);
    }
  };

  const openDepreciation = (asset: Asset) => {
    setSelected(asset);
    setDeprForm({
      period: new Date().toISOString().slice(0, 7),
      expenseAccountId: '',
      accumulatedDepreciationAccountId: '',
    });
    setDeprOpen(true);
  };

  const postDepreciation = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selected) return;
    setBusy(true);
    try {
      const preview = await api.get(
        `/finance/fixed-assets/${selected.id}/depreciation-preview?period=${encodeURIComponent(deprForm.period)}`,
      );
      if (!confirm(`قيمة الاستهلاك لهذه الفترة: ${Number(preview.data.depreciationAmount).toLocaleString()} ر.س. هل تريد الترحيل؟`)) {
        return;
      }
      await api.post(`/finance/fixed-assets/${selected.id}/depreciation`, deprForm);
      setDeprOpen(false);
      load();
    } catch (err: any) {
      alert(err.response?.data?.message || 'تعذر ترحيل الاستهلاك');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-6 animate-fade-in-up">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <Landmark className="h-6 w-6 text-primary-400" />
            الأصول الثابتة
          </h1>
          <p className="text-slate-400 text-sm mt-1">
            سجل الأصول، القيم الدفترية، والاستهلاك المرحّل محاسبيًا
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="ghost" onClick={() => setCategoryOpen(true)}><Plus className="h-4 w-4" /> فئة أصل</Button>
          <Button onClick={() => setAssetOpen(true)}><Plus className="h-4 w-4" /> أصل جديد</Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="scc-card-hover">
          <p className="text-slate-400 text-xs">تكلفة الاقتناء</p>
          <p className="text-xl font-bold text-white">
            {assets.reduce((s, a) => s + Number(a.acquisitionCost || 0), 0).toLocaleString()} ر.س
          </p>
        </div>
        <div className="scc-card-hover">
          <p className="text-slate-400 text-xs">مجمع الاستهلاك</p>
          <p className="text-xl font-bold text-white">
            {assets.reduce((s, a) => s + Number(a.accumulatedDepreciation || 0), 0).toLocaleString()} ر.س
          </p>
        </div>
        <div className="scc-card-hover">
          <p className="text-slate-400 text-xs">صافي القيمة الدفترية</p>
          <p className="text-xl font-bold text-white">
            {assets.reduce((s, a) => s + Number(a.currentValue || 0), 0).toLocaleString()} ر.س
          </p>
        </div>
      </div>

      <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-slate-800/50 text-slate-400 border-b border-slate-700">
              <th className="p-3 text-right">الأصل</th>
              <th className="p-3 text-center">الفئة</th>
              <th className="p-3 text-center">التكلفة</th>
              <th className="p-3 text-center">مجمع الاستهلاك</th>
              <th className="p-3 text-center">القيمة الدفترية</th>
              <th className="p-3 text-center">الحالة</th>
              <th className="p-3 text-center">الإجراء</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={7} className="p-8 text-center text-slate-500">جارٍ التحميل...</td></tr>
            ) : assets.length === 0 ? (
              <tr><td colSpan={7} className="p-8 text-center text-slate-500">لا توجد أصول ثابتة</td></tr>
            ) : assets.map((asset) => (
              <tr key={asset.id} className="border-b border-slate-800/50">
                <td className="p-3 text-white font-medium">
                  {asset.name}
                  <div className="text-xs text-slate-500">{asset.code || 'بدون رمز'}</div>
                </td>
                <td className="p-3 text-center text-slate-300">{asset.category?.name}</td>
                <td className="p-3 text-center text-slate-300">{Number(asset.acquisitionCost).toLocaleString()}</td>
                <td className="p-3 text-center text-slate-300">{Number(asset.accumulatedDepreciation).toLocaleString()}</td>
                <td className="p-3 text-center text-slate-300">{Number(asset.currentValue).toLocaleString()}</td>
                <td className="p-3 text-center text-slate-300">{asset.status}</td>
                <td className="p-3 text-center">
                  <button
                    disabled={asset.status !== 'ACTIVE'}
                    onClick={() => openDepreciation(asset)}
                    className="inline-flex items-center gap-1 rounded-lg px-3 py-1.5 text-primary-400 hover:bg-primary-500/10 disabled:opacity-40"
                  >
                    <Calculator className="h-4 w-4" />
                    استهلاك
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Modal isOpen={categoryOpen} onClose={() => setCategoryOpen(false)} title="فئة أصل جديدة">
        <form onSubmit={createCategory} className="space-y-4">
          <Input label="اسم الفئة" required value={categoryForm.name} onChange={(e) => setCategoryForm({ ...categoryForm, name: e.target.value })} />
          <Input label="الرمز" value={categoryForm.code} onChange={(e) => setCategoryForm({ ...categoryForm, code: e.target.value })} />
          <Select label="طريقة الاستهلاك" value={categoryForm.depreciationMethod} onChange={(e) => setCategoryForm({ ...categoryForm, depreciationMethod: e.target.value })} options={[
            { value: 'STRAIGHT_LINE', label: 'القسط الثابت' },
            { value: 'DECLINING_BALANCE', label: 'الرصيد المتناقص' },
            { value: 'UNITS_OF_PRODUCTION', label: 'وحدات الإنتاج — يتطلب إعدادًا إضافيًا' },
          ]} />
          <Input label="العمر الإنتاجي بالسنوات" type="number" required value={categoryForm.usefulLifeYears} onChange={(e) => setCategoryForm({ ...categoryForm, usefulLifeYears: e.target.value })} />
          <Input label="نسبة الاستهلاك السنوية % (للرصيد المتناقص)" type="number" value={categoryForm.depreciationRate} onChange={(e) => setCategoryForm({ ...categoryForm, depreciationRate: e.target.value })} />
          <div className="flex justify-end"><Button type="submit" isLoading={busy}>حفظ</Button></div>
        </form>
      </Modal>

      <Modal isOpen={assetOpen} onClose={() => setAssetOpen(false)} title="أصل ثابت جديد">
        <form onSubmit={createAsset} className="space-y-4">
          <Input label="اسم الأصل" required value={assetForm.name} onChange={(e) => setAssetForm({ ...assetForm, name: e.target.value })} />
          <Input label="رمز الأصل" value={assetForm.code} onChange={(e) => setAssetForm({ ...assetForm, code: e.target.value })} />
          <Select label="الفئة" required value={assetForm.categoryId} onChange={(e) => setAssetForm({ ...assetForm, categoryId: e.target.value })} options={categories.map((c) => ({ value: c.id, label: c.name }))} />
          <div className="grid grid-cols-2 gap-3">
            <Input label="تكلفة الاقتناء" type="number" required value={assetForm.acquisitionCost} onChange={(e) => setAssetForm({ ...assetForm, acquisitionCost: e.target.value })} />
            <Input label="القيمة التخريدية" type="number" value={assetForm.salvageValue} onChange={(e) => setAssetForm({ ...assetForm, salvageValue: e.target.value })} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Input label="تاريخ الشراء" type="date" required value={assetForm.purchaseDate} onChange={(e) => setAssetForm({ ...assetForm, purchaseDate: e.target.value })} />
            <Input label="بدء الاستهلاك" type="date" value={assetForm.startDate} onChange={(e) => setAssetForm({ ...assetForm, startDate: e.target.value })} />
          </div>
          <Input label="الموقع" value={assetForm.location} onChange={(e) => setAssetForm({ ...assetForm, location: e.target.value })} />
          <div className="flex justify-end"><Button type="submit" isLoading={busy}>حفظ الأصل</Button></div>
        </form>
      </Modal>

      <Modal isOpen={deprOpen} onClose={() => setDeprOpen(false)} title={selected ? `ترحيل استهلاك — ${selected.name}` : 'ترحيل الاستهلاك'}>
        <form onSubmit={postDepreciation} className="space-y-4">
          <Input label="الفترة" type="month" required value={deprForm.period} onChange={(e) => setDeprForm({ ...deprForm, period: e.target.value })} />
          <Select label="حساب مصروف الاستهلاك" required value={deprForm.expenseAccountId} onChange={(e) => setDeprForm({ ...deprForm, expenseAccountId: e.target.value })} options={expenseAccounts.map((a) => ({ value: a.id, label: `${a.code} — ${a.name}` }))} />
          <Select label="حساب مجمع الاستهلاك" required value={deprForm.accumulatedDepreciationAccountId} onChange={(e) => setDeprForm({ ...deprForm, accumulatedDepreciationAccountId: e.target.value })} options={assetAccounts.map((a) => ({ value: a.id, label: `${a.code} — ${a.name}` }))} />
          <div className="flex justify-end">
            <Button type="submit" isLoading={busy}><RefreshCw className="h-4 w-4" /> معاينة ثم ترحيل</Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
