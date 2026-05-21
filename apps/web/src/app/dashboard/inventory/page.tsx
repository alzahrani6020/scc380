'use client';

import React, { useState, useEffect } from 'react';

interface Product {
  id: string;
  name: string;
  sku: string;
  barcode?: string;
  salePrice: number;
  costPrice: number;
  currentStock: number;
  minStockLevel: number;
  category?: { name: string };
}

export default function InventoryPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({
    name: '', sku: '', barcode: '', salePrice: '', costPrice: '', currentStock: '', minStockLevel: '5',
  });

  useEffect(() => {
    fetchProducts();
  }, []);

  const fetchProducts = async () => {
    setLoading(true);
    try {
      const res = await fetch('http://localhost:3001/inventory/products');
      if (res.ok) {
        const data = await res.json();
        setProducts(data);
      }
    } catch (e) {
      setProducts([
        { id: '1', name: 'لابتوب Dell', sku: 'LAP-DELL-001', barcode: '1234567890123', salePrice: 3200, costPrice: 2500, currentStock: 15, minStockLevel: 5, category: { name: 'إلكترونيات' } },
        { id: '2', name: 'ماوس لاسلكي', sku: 'MOUSE-WL-001', barcode: '1234567890124', salePrice: 75, costPrice: 45, currentStock: 50, minStockLevel: 10, category: { name: 'إلكترونيات' } },
        { id: '3', name: 'شاشة 27 بوصة', sku: 'MON-27-001', barcode: '1234567890125', salePrice: 1100, costPrice: 800, currentStock: 8, minStockLevel: 3, category: { name: 'إلكترونيات' } },
        { id: '4', name: 'مياه معدنية', sku: 'WAT-500-001', barcode: '1234567890126', salePrice: 2.5, costPrice: 1.5, currentStock: 200, minStockLevel: 50, category: { name: 'مواد غذائية' } },
        { id: '5', name: 'كرسي مكتبي', sku: 'CHR-OFF-001', barcode: '1234567890127', salePrice: 500, costPrice: 350, currentStock: 12, minStockLevel: 4, category: { name: 'أثاث مكتبي' } },
      ]);
    }
    setLoading(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch('http://localhost:3001/inventory/products', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: formData.name,
          sku: formData.sku,
          barcode: formData.barcode || undefined,
          salePrice: formData.salePrice,
          costPrice: formData.costPrice,
          currentStock: parseInt(formData.currentStock) || 0,
          minStockLevel: parseInt(formData.minStockLevel) || 5,
        }),
      });
      if (res.ok) {
        setShowForm(false);
        setFormData({ name: '', sku: '', barcode: '', salePrice: '', costPrice: '', currentStock: '', minStockLevel: '5' });
        fetchProducts();
      }
    } catch (e) {
      alert('فشل في إضافة المنتج');
    }
  };

  const filtered = products.filter(p =>
    p.name.toLowerCase().includes(search.toLowerCase()) ||
    p.sku.toLowerCase().includes(search.toLowerCase()) ||
    (p.barcode && p.barcode.includes(search))
  );

  const lowStock = filtered.filter(p => (p.currentStock || 0) <= (p.minStockLevel || 0));

  return (
    <div className="min-h-screen bg-slate-950 text-white p-4" dir="rtl">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-2xl font-bold">📦 إدارة المخزون</h1>
        <button
          onClick={() => setShowForm(!showForm)}
          className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 font-bold"
        >
          + منتج جديد
        </button>
      </div>

      {lowStock.length > 0 && (
        <div className="mb-4 p-3 rounded-lg bg-red-600/20 border border-red-600/30">
          ⚠️ <strong>{lowStock.length}</strong> منتجات منخفضة المخزون!
        </div>
      )}

      {showForm && (
        <form onSubmit={handleSubmit} className="mb-4 p-4 rounded-xl bg-slate-900 border border-slate-800 space-y-3">
          <h3 className="font-bold">إضافة منتج جديد</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <input required placeholder="اسم المنتج" className="p-2 rounded bg-slate-800 border border-slate-700" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} />
            <input required placeholder="SKU" className="p-2 rounded bg-slate-800 border border-slate-700" value={formData.sku} onChange={e => setFormData({...formData, sku: e.target.value})} />
            <input placeholder="الباركود" className="p-2 rounded bg-slate-800 border border-slate-700" value={formData.barcode} onChange={e => setFormData({...formData, barcode: e.target.value})} />
            <input required placeholder="سعر البيع" type="number" step="0.01" className="p-2 rounded bg-slate-800 border border-slate-700" value={formData.salePrice} onChange={e => setFormData({...formData, salePrice: e.target.value})} />
            <input placeholder="سعر التكلفة" type="number" step="0.01" className="p-2 rounded bg-slate-800 border border-slate-700" value={formData.costPrice} onChange={e => setFormData({...formData, costPrice: e.target.value})} />
            <input placeholder="المخزون الحالي" type="number" className="p-2 rounded bg-slate-800 border border-slate-700" value={formData.currentStock} onChange={e => setFormData({...formData, currentStock: e.target.value})} />
            <input placeholder="الحد الأدنى" type="number" className="p-2 rounded bg-slate-800 border border-slate-700" value={formData.minStockLevel} onChange={e => setFormData({...formData, minStockLevel: e.target.value})} />
          </div>
          <div className="flex gap-2">
            <button type="submit" className="px-4 py-2 rounded bg-green-600 hover:bg-green-500 font-bold">حفظ</button>
            <button type="button" onClick={() => setShowForm(false)} className="px-4 py-2 rounded bg-slate-700 hover:bg-slate-600">إلغاء</button>
          </div>
        </form>
      )}

      <input
        type="text"
        placeholder="🔍 بحث في المنتجات..."
        className="w-full p-3 rounded-lg bg-slate-800 border border-slate-700 mb-4"
        value={search}
        onChange={e => setSearch(e.target.value)}
      />

      {loading ? (
        <div className="text-center py-12 text-slate-500">جاري التحميل...</div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-800 text-slate-400">
                <th className="text-right p-3">المنتج</th>
                <th className="text-right p-3">SKU</th>
                <th className="text-right p-3">الفئة</th>
                <th className="text-right p-3">سعر التكلفة</th>
                <th className="text-right p-3">سعر البيع</th>
                <th className="text-right p-3">المخزون</th>
                <th className="text-right p-3">الحد الأدنى</th>
                <th className="text-right p-3">الهامش</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(p => {
                const margin = ((Number(p.salePrice) - Number(p.costPrice)) / Number(p.salePrice) * 100).toFixed(1);
                const isLow = p.currentStock <= p.minStockLevel;
                return (
                  <tr key={p.id} className="border-b border-slate-800/50 hover:bg-slate-800/30">
                    <td className="p-3">
                      <div className="font-medium">{p.name}</div>
                      {p.barcode && <div className="text-xs text-slate-500">{p.barcode}</div>}
                    </td>
                    <td className="p-3 text-slate-400">{p.sku}</td>
                    <td className="p-3 text-slate-400">{p.category?.name || '-'}</td>
                    <td className="p-3">{Number(p.costPrice).toFixed(2)}</td>
                    <td className="p-3">{Number(p.salePrice).toFixed(2)}</td>
                    <td className={`p-3 font-bold ${isLow ? 'text-red-400' : 'text-green-400'}`}>
                      {p.currentStock}
                    </td>
                    <td className="p-3 text-slate-500">{p.minStockLevel}</td>
                    <td className="p-3 text-blue-400">{margin}%</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
