'use client';

import React, { useState, useEffect } from 'react';
import jsPDF from 'jspdf';
import * as XLSX from 'xlsx';
import api from '@/lib/api';
import { BookOpen, Calendar } from 'lucide-react';

type TabKey = 'trial' | 'income' | 'balance' | 'vat' | 'ledger' | 'cashflow';

export default function FinancialReportsPage() {
  const [activeTab, setActiveTab] = useState<TabKey>('trial');
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [accounts, setAccounts] = useState<any[]>([]);
  const [selectedAccountId, setSelectedAccountId] = useState('');
  const [vatFrom, setVatFrom] = useState('');
  const [vatTo, setVatTo] = useState('');

  const fetchReport = async (type: TabKey) => {
    setLoading(true);
    try {
      let res;
      switch (type) {
        case 'trial':
          res = await api.get('/reports/trial-balance');
          setData(res.data);
          break;
        case 'income':
          res = await api.get('/reports/income-statement');
          setData(res.data);
          break;
        case 'balance':
          res = await api.get('/reports/balance-sheet');
          setData(res.data);
          break;
        case 'vat':
          res = await api.get(`/reports/vat?from=${vatFrom}&to=${vatTo}`);
          setData(res.data);
          break;
        case 'ledger':
          if (!selectedAccountId) {
            setData(null);
            setLoading(false);
            return;
          }
          res = await api.get(`/reports/general-ledger/${selectedAccountId}`);
          setData(res.data);
          break;
        case 'cashflow':
          res = await api.get('/reports/cash-flow');
          setData(res.data);
          break;
      }
    } catch (e) {
      setData(null);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchReport(activeTab);
  }, [activeTab, selectedAccountId]);

  useEffect(() => {
    api.get('/finance/chart-of-accounts').then(r => {
      const accs = r.data?.data || [];
      setAccounts(accs);
      if (accs.length > 0 && !selectedAccountId) {
        setSelectedAccountId(accs[0].id);
      }
    }).catch(() => {});
  }, []);

  const exportToPDF = () => {
    const doc = new jsPDF();
    doc.setFontSize(18);
    doc.text('شركة التقنية المتقدمة', 105, 20, { align: 'center' });
    doc.setFontSize(12);
    doc.text(`تقرير: ${tabs.find(t => t.key === activeTab)?.label}`, 105, 35, { align: 'center' });
    doc.text(`التاريخ: ${new Date().toLocaleDateString('ar-SA')}`, 105, 45, { align: 'center' });

    if (activeTab === 'trial' && data?.accounts) {
      let y = 60;
      doc.setFontSize(10);
      data.accounts.forEach((acc: any) => {
        doc.text(`${acc.code} | ${acc.name} | مدين: ${acc.debit.toFixed(2)} | دائن: ${acc.credit.toFixed(2)} | رصيد: ${acc.balance.toFixed(2)}`, 20, y);
        y += 8;
      });
    } else if (activeTab === 'income' && data) {
      let y = 60;
      doc.setFontSize(10);
      doc.text('الإيرادات:', 20, y); y += 8;
      data.revenues.items.forEach((item: any) => { doc.text(`${item.name}: ${item.amount.toFixed(2)}`, 25, y); y += 8; });
      doc.text(`إجمالي الإيرادات: ${data.revenues.total.toFixed(2)}`, 20, y); y += 12;
      doc.text('المصروفات:', 20, y); y += 8;
      data.expenses.items.forEach((item: any) => { doc.text(`${item.name}: ${item.amount.toFixed(2)}`, 25, y); y += 8; });
      doc.text(`إجمالي المصروفات: ${data.expenses.total.toFixed(2)}`, 20, y); y += 12;
      doc.text(`صافي الدخل: ${data.netIncome.toFixed(2)}`, 20, y);
    } else if (activeTab === 'balance' && data) {
      let y = 60;
      doc.setFontSize(10);
      doc.text('الأصول:', 20, y); y += 8;
      data.assets.items.forEach((item: any) => { doc.text(`${item.name}: ${item.amount.toFixed(2)}`, 25, y); y += 8; });
      doc.text(`إجمالي الأصول: ${data.assets.total.toFixed(2)}`, 20, y); y += 12;
      doc.text('الخصوم:', 20, y); y += 8;
      data.liabilities.items.forEach((item: any) => { doc.text(`${item.name}: ${item.amount.toFixed(2)}`, 25, y); y += 8; });
      doc.text(`إجمالي الخصوم: ${data.liabilities.total.toFixed(2)}`, 20, y); y += 12;
      doc.text('حقوق الملكية:', 20, y); y += 8;
      data.equity.items.forEach((item: any) => { doc.text(`${item.name}: ${item.amount.toFixed(2)}`, 25, y); y += 8; });
      doc.text(`إجمالي حقوق الملكية: ${data.equity.total.toFixed(2)}`, 20, y);
    }

    doc.save(`report-${activeTab}-${Date.now()}.pdf`);
  };

  const exportToExcel = () => {
    let sheetData: any[] = [];
    if (activeTab === 'trial' && data?.accounts) {
      sheetData = data.accounts.map((a: any) => ({
        'الكود': a.code,
        'الحساب': a.name,
        'النوع': a.type,
        'مدين': a.debit,
        'دائن': a.credit,
        'الرصيد': a.balance,
      }));
    } else if (activeTab === 'income' && data) {
      sheetData = [
        ...data.revenues.items.map((i: any) => ({ 'البند': i.name, 'المبلغ': i.amount, 'النوع': 'إيراد' })),
        { 'البند': 'إجمالي الإيرادات', 'المبلغ': data.revenues.total, 'النوع': '' },
        ...data.expenses.items.map((i: any) => ({ 'البند': i.name, 'المبلغ': i.amount, 'النوع': 'مصروف' })),
        { 'البند': 'إجمالي المصروفات', 'المبلغ': data.expenses.total, 'النوع': '' },
        { 'البند': 'صافي الدخل', 'المبلغ': data.netIncome, 'النوع': '' },
      ];
    } else if (activeTab === 'balance' && data) {
      sheetData = [
        ...data.assets.items.map((i: any) => ({ 'البند': i.name, 'المبلغ': i.amount, 'القسم': 'أصول' })),
        { 'البند': 'إجمالي الأصول', 'المبلغ': data.assets.total, 'القسم': '' },
        ...data.liabilities.items.map((i: any) => ({ 'البند': i.name, 'المبلغ': i.amount, 'القسم': 'خصوم' })),
        { 'البند': 'إجمالي الخصوم', 'المبلغ': data.liabilities.total, 'القسم': '' },
        ...data.equity.items.map((i: any) => ({ 'البند': i.name, 'المبلغ': i.amount, 'القسم': 'حقوق ملكية' })),
        { 'البند': 'إجمالي حقوق الملكية', 'المبلغ': data.equity.total, 'القسم': '' },
      ];
    } else if (activeTab === 'ledger' && data?.entries) {
      sheetData = data.entries.map((e: any) => ({
        'التاريخ': new Date(e.date).toLocaleDateString('ar-SA'),
        'الوصف': e.description,
        'المرجع': e.reference,
        'مدين': e.debit,
        'دائن': e.credit,
        'الرصيد': e.balance,
      }));
    } else if (activeTab === 'cashflow' && data) {
      sheetData = [
        ...data.operating.items.map((i: any) => ({ 'التاريخ': new Date(i.date).toLocaleDateString('ar-SA'), 'الوصف': i.description, 'المبلغ': i.amount, 'النوع': 'تشغيلي' })),
        { 'الوصف': 'إجمالي التدفقات التشغيلية', 'المبلغ': data.operating.total, 'النوع': '' },
        ...data.investing.items.map((i: any) => ({ 'التاريخ': new Date(i.date).toLocaleDateString('ar-SA'), 'الوصف': i.description, 'المبلغ': i.amount, 'النوع': 'استثماري' })),
        { 'الوصف': 'إجمالي التدفقات الاستثمارية', 'المبلغ': data.investing.total, 'النوع': '' },
        ...data.financing.items.map((i: any) => ({ 'التاريخ': new Date(i.date).toLocaleDateString('ar-SA'), 'الوصف': i.description, 'المبلغ': i.amount, 'النوع': 'تمويلي' })),
        { 'الوصف': 'إجمالي التدفقات التمويلية', 'المبلغ': data.financing.total, 'النوع': '' },
        { 'الوصف': 'صافي التغير في النقدية', 'المبلغ': data.netChange, 'النوع': '' },
        { 'الوصف': 'الرصيد الافتتاحي', 'المبلغ': data.openingBalance, 'النوع': '' },
        { 'الوصف': 'الرصيد الختامي', 'المبلغ': data.closingBalance, 'النوع': '' },
      ];
    }

    const ws = XLSX.utils.json_to_sheet(sheetData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Report');
    XLSX.writeFile(wb, `report-${activeTab}-${Date.now()}.xlsx`);
  };

  const tabs = [
    { key: 'trial' as TabKey, label: 'ميزان المراجعة' },
    { key: 'income' as TabKey, label: 'قائمة الدخل' },
    { key: 'balance' as TabKey, label: 'الميزانية العمومية' },
    { key: 'vat' as TabKey, label: 'تقرير VAT' },
    { key: 'ledger' as TabKey, label: 'دفتر الأستاذ' },
    { key: 'cashflow' as TabKey, label: 'التدفقات النقدية' },
  ];

  return (
    <div className="min-h-screen bg-slate-950 text-white p-4" dir="rtl">
      <h1 className="text-2xl font-bold mb-4 flex items-center gap-2">
        <BookOpen className="h-6 w-6 text-primary-400" />
        التقارير المالية
      </h1>

      <div className="flex gap-2 mb-4 overflow-x-auto">
        {tabs.map(tab => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`px-4 py-2 rounded-lg font-bold whitespace-nowrap transition-colors ${
              activeTab === tab.key ? 'bg-blue-600 text-white' : 'bg-slate-800 text-slate-400 hover:bg-slate-700'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div className="flex items-center gap-3 mb-4 flex-wrap">
        {activeTab === 'ledger' && (
          <select
            value={selectedAccountId}
            onChange={(e) => setSelectedAccountId(e.target.value)}
            className="bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white"
          >
            <option value="">اختر الحساب</option>
            {accounts.map(acc => (
              <option key={acc.id} value={acc.id}>{acc.code} — {acc.name}</option>
            ))}
          </select>
        )}
        {activeTab === 'vat' && (
          <>
            <div className="flex items-center gap-2">
              <Calendar className="h-4 w-4 text-slate-400" />
              <input type="date" value={vatFrom} onChange={e => setVatFrom(e.target.value)} className="bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white" />
              <span className="text-slate-400">إلى</span>
              <input type="date" value={vatTo} onChange={e => setVatTo(e.target.value)} className="bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white" />
              <button onClick={() => fetchReport('vat')} className="px-3 py-2 rounded-lg bg-primary-600 hover:bg-primary-500 text-sm font-bold">عرض</button>
            </div>
          </>
        )}
        <div className="flex gap-2 mr-auto">
          <button onClick={exportToPDF} className="px-4 py-2 rounded-lg bg-red-600 hover:bg-red-500 font-bold text-sm">📄 تصدير PDF</button>
          <button onClick={exportToExcel} className="px-4 py-2 rounded-lg bg-green-600 hover:bg-green-500 font-bold text-sm">📊 تصدير Excel</button>
        </div>
      </div>

      {loading ? (
        <div className="text-center py-12 text-slate-500">جاري التحميل...</div>
      ) : !data ? (
        <div className="text-center py-12 text-slate-500">لا توجد بيانات</div>
      ) : (
        <div className="bg-slate-900 rounded-xl border border-slate-800 p-6">
          {activeTab === 'trial' && (
            <>
              <h2 className="text-xl font-bold mb-4">ميزان المراجعة</h2>
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-700 text-slate-400">
                    <th className="text-right p-3">الكود</th>
                    <th className="text-right p-3">الحساب</th>
                    <th className="text-right p-3">النوع</th>
                    <th className="text-left p-3">مدين</th>
                    <th className="text-left p-3">دائن</th>
                    <th className="text-left p-3">الرصيد</th>
                  </tr>
                </thead>
                <tbody>
                  {data.accounts?.map((acc: any) => (
                    <tr key={acc.code} className="border-b border-slate-800/50">
                      <td className="p-3 font-mono">{acc.code}</td>
                      <td className="p-3">{acc.name}</td>
                      <td className="p-3 text-slate-400">{acc.type}</td>
                      <td className="p-3 text-left">{acc.debit > 0 ? acc.debit.toFixed(2) : ''}</td>
                      <td className="p-3 text-left">{acc.credit > 0 ? acc.credit.toFixed(2) : ''}</td>
                      <td className="p-3 text-left font-bold">{acc.balance.toFixed(2)}</td>
                    </tr>
                  ))}
                  <tr className="bg-slate-800/50 font-bold">
                    <td className="p-3" colSpan={3}>الإجمالي</td>
                    <td className="p-3 text-left">{data.totals?.debit?.toFixed(2)}</td>
                    <td className="p-3 text-left">{data.totals?.credit?.toFixed(2)}</td>
                    <td></td>
                  </tr>
                </tbody>
              </table>
              <div className={`mt-4 text-center font-bold ${data.balanced ? 'text-green-400' : 'text-red-400'}`}>
                {data.balanced ? '✅ الميزان متوازن' : '❌ الميزان غير متوازن'}
              </div>
            </>
          )}

          {activeTab === 'income' && (
            <>
              <h2 className="text-xl font-bold mb-4">قائمة الدخل (Profit & Loss)</h2>
              <div className="space-y-4">
                <div className="p-4 rounded-lg bg-green-900/20 border border-green-800/30">
                  <h3 className="font-bold text-green-400 mb-2">الإيرادات</h3>
                  {data.revenues?.items?.map((item: any) => (
                    <div key={item.code} className="flex justify-between py-1">
                      <span>{item.name}</span>
                      <span>{item.amount.toFixed(2)} ريال</span>
                    </div>
                  ))}
                  <div className="border-t border-green-800/30 mt-2 pt-2 flex justify-between font-bold">
                    <span>إجمالي الإيرادات</span>
                    <span>{data.revenues?.total?.toFixed(2)} ريال</span>
                  </div>
                </div>
                <div className="p-4 rounded-lg bg-red-900/20 border border-red-800/30">
                  <h3 className="font-bold text-red-400 mb-2">المصروفات</h3>
                  {data.expenses?.items?.map((item: any) => (
                    <div key={item.code} className="flex justify-between py-1">
                      <span>{item.name}</span>
                      <span>{item.amount.toFixed(2)} ريال</span>
                    </div>
                  ))}
                  <div className="border-t border-red-800/30 mt-2 pt-2 flex justify-between font-bold">
                    <span>إجمالي المصروفات</span>
                    <span>{data.expenses?.total?.toFixed(2)} ريال</span>
                  </div>
                </div>
                <div className="p-4 rounded-lg bg-blue-900/20 border border-blue-800/30">
                  <div className="flex justify-between font-bold text-xl">
                    <span>صافي الدخل</span>
                    <span className={data.netIncome >= 0 ? 'text-green-400' : 'text-red-400'}>
                      {data.netIncome?.toFixed(2)} ريال
                    </span>
                  </div>
                </div>
              </div>
            </>
          )}

          {activeTab === 'balance' && (
            <>
              <h2 className="text-xl font-bold mb-4">الميزانية العمومية (Balance Sheet)</h2>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="p-4 rounded-lg bg-slate-800 border border-slate-700">
                  <h3 className="font-bold text-blue-400 mb-3">الأصول</h3>
                  {data.assets?.items?.map((item: any) => (
                    <div key={item.code} className="flex justify-between py-1">
                      <span>{item.name}</span>
                      <span>{item.amount.toFixed(2)}</span>
                    </div>
                  ))}
                  <div className="border-t border-slate-700 mt-2 pt-2 flex justify-between font-bold">
                    <span>الإجمالي</span>
                    <span>{data.assets?.total?.toFixed(2)}</span>
                  </div>
                </div>
                <div className="p-4 rounded-lg bg-slate-800 border border-slate-700">
                  <h3 className="font-bold text-red-400 mb-3">الخصوم</h3>
                  {data.liabilities?.items?.map((item: any) => (
                    <div key={item.code} className="flex justify-between py-1">
                      <span>{item.name}</span>
                      <span>{item.amount.toFixed(2)}</span>
                    </div>
                  ))}
                  <div className="border-t border-slate-700 mt-2 pt-2 flex justify-between font-bold">
                    <span>الإجمالي</span>
                    <span>{data.liabilities?.total?.toFixed(2)}</span>
                  </div>
                </div>
                <div className="p-4 rounded-lg bg-slate-800 border border-slate-700">
                  <h3 className="font-bold text-green-400 mb-3">حقوق الملكية</h3>
                  {data.equity?.items?.map((item: any) => (
                    <div key={item.code} className="flex justify-between py-1">
                      <span>{item.name}</span>
                      <span>{item.amount.toFixed(2)}</span>
                    </div>
                  ))}
                  <div className="border-t border-slate-700 mt-2 pt-2 flex justify-between font-bold">
                    <span>الإجمالي</span>
                    <span>{data.equity?.total?.toFixed(2)}</span>
                  </div>
                </div>
              </div>
              <div className={`mt-4 text-center font-bold ${data.balanced ? 'text-green-400' : 'text-red-400'}`}>
                {data.balanced ? '✅ الميزانية متوازنة' : '⚠️ الميزانية تحتاج تسوية'}
              </div>
            </>
          )}

          {activeTab === 'vat' && (
            <>
              <h2 className="text-xl font-bold mb-4">تقرير ضريبة القيمة المضافة (VAT)</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                <div className="p-4 rounded-lg bg-green-900/20 border border-green-800/30">
                  <h3 className="font-bold text-green-400 mb-3">ضريبة المخرجات (مبيعات)</h3>
                  <div className="flex justify-between py-1">
                    <span>إجمالي المبيعات</span>
                    <span>{data.outputVat?.totalSales?.toFixed(2)} ريال</span>
                  </div>
                  <div className="flex justify-between py-1 font-bold">
                    <span>ضريبة المخرجات (15%)</span>
                    <span>{data.outputVat?.vatAmount?.toFixed(2)} ريال</span>
                  </div>
                </div>
                <div className="p-4 rounded-lg bg-blue-900/20 border border-blue-800/30">
                  <h3 className="font-bold text-blue-400 mb-3">ضريبة المدخلات (مشتريات)</h3>
                  <div className="flex justify-between py-1">
                    <span>إجمالي المصروفات</span>
                    <span>{data.inputVat?.totalExpenses?.toFixed(2)} ريال</span>
                  </div>
                  <div className="flex justify-between py-1 font-bold">
                    <span>ضريبة المدخلات (15%)</span>
                    <span>{data.inputVat?.vatAmount?.toFixed(2)} ريال</span>
                  </div>
                </div>
              </div>
              <div className="p-6 rounded-lg bg-slate-800 border border-slate-700 text-center">
                <div className="text-slate-400 mb-2">صافي VAT المستحق للدفع</div>
                <div className="text-3xl font-bold text-red-400">{data.netVatPayable?.toFixed(2)} ريال</div>
              </div>
            </>
          )}

          {activeTab === 'ledger' && (
            <>
              <h2 className="text-xl font-bold mb-4">دفتر الأستاذ العام</h2>
              {selectedAccountId ? (
                <>
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-slate-700 text-slate-400">
                        <th className="text-right p-3">التاريخ</th>
                        <th className="text-right p-3">الوصف</th>
                        <th className="text-right p-3">المرجع</th>
                        <th className="text-left p-3">مدين</th>
                        <th className="text-left p-3">دائن</th>
                        <th className="text-left p-3">الرصيد</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.entries?.map((entry: any) => (
                        <tr key={entry.id} className="border-b border-slate-800/50">
                          <td className="p-3">{new Date(entry.date).toLocaleDateString('ar-SA')}</td>
                          <td className="p-3">{entry.description}</td>
                          <td className="p-3 font-mono text-slate-400">{entry.reference || '—'}</td>
                          <td className="p-3 text-left">{entry.debit > 0 ? entry.debit.toFixed(2) : ''}</td>
                          <td className="p-3 text-left">{entry.credit > 0 ? entry.credit.toFixed(2) : ''}</td>
                          <td className="p-3 text-left font-bold">{entry.balance.toFixed(2)}</td>
                        </tr>
                      ))}
                      <tr className="bg-slate-800/50 font-bold">
                        <td className="p-3" colSpan={5}>الرصيد النهائي</td>
                        <td className="p-3 text-left">{data.finalBalance?.toFixed(2)}</td>
                      </tr>
                    </tbody>
                  </table>
                </>
              ) : (
                <div className="text-center py-12 text-slate-500">اختر حساباً من القائمة أعلاه</div>
              )}
            </>
          )}

          {activeTab === 'cashflow' && (
            <>
              <h2 className="text-xl font-bold mb-4">قائمة التدفقات النقدية</h2>
              <div className="space-y-4">
                <div className="p-4 rounded-lg bg-emerald-900/20 border border-emerald-800/30">
                  <h3 className="font-bold text-emerald-400 mb-2">الأنشطة التشغيلية</h3>
                  {data.operating?.items?.length > 0 ? data.operating.items.map((item: any, i: number) => (
                    <div key={i} className="flex justify-between py-1">
                      <span>{item.description}</span>
                      <span className={item.amount >= 0 ? 'text-emerald-400' : 'text-red-400'}>{item.amount.toFixed(2)} ريال</span>
                    </div>
                  )) : <div className="text-slate-500 text-sm">لا توجد بيانات</div>}
                  <div className="border-t border-emerald-800/30 mt-2 pt-2 flex justify-between font-bold">
                    <span>إجمالي التدفقات التشغيلية</span>
                    <span className={data.operating?.total >= 0 ? 'text-emerald-400' : 'text-red-400'}>{data.operating?.total?.toFixed(2)} ريال</span>
                  </div>
                </div>
                <div className="p-4 rounded-lg bg-blue-900/20 border border-blue-800/30">
                  <h3 className="font-bold text-blue-400 mb-2">الأنشطة الاستثمارية</h3>
                  {data.investing?.items?.length > 0 ? data.investing.items.map((item: any, i: number) => (
                    <div key={i} className="flex justify-between py-1">
                      <span>{item.description}</span>
                      <span className={item.amount >= 0 ? 'text-blue-400' : 'text-red-400'}>{item.amount.toFixed(2)} ريال</span>
                    </div>
                  )) : <div className="text-slate-500 text-sm">لا توجد بيانات</div>}
                  <div className="border-t border-blue-800/30 mt-2 pt-2 flex justify-between font-bold">
                    <span>إجمالي التدفقات الاستثمارية</span>
                    <span className={data.investing?.total >= 0 ? 'text-blue-400' : 'text-red-400'}>{data.investing?.total?.toFixed(2)} ريال</span>
                  </div>
                </div>
                <div className="p-4 rounded-lg bg-purple-900/20 border border-purple-800/30">
                  <h3 className="font-bold text-purple-400 mb-2">الأنشطة التمويلية</h3>
                  {data.financing?.items?.length > 0 ? data.financing.items.map((item: any, i: number) => (
                    <div key={i} className="flex justify-between py-1">
                      <span>{item.description}</span>
                      <span className={item.amount >= 0 ? 'text-purple-400' : 'text-red-400'}>{item.amount.toFixed(2)} ريال</span>
                    </div>
                  )) : <div className="text-slate-500 text-sm">لا توجد بيانات</div>}
                  <div className="border-t border-purple-800/30 mt-2 pt-2 flex justify-between font-bold">
                    <span>إجمالي التدفقات التمويلية</span>
                    <span className={data.financing?.total >= 0 ? 'text-purple-400' : 'text-red-400'}>{data.financing?.total?.toFixed(2)} ريال</span>
                  </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="p-4 rounded-lg bg-slate-800 border border-slate-700 text-center">
                    <div className="text-slate-400 text-sm mb-1">صافي التغير في النقدية</div>
                    <div className="text-xl font-bold text-white">{data.netChange?.toFixed(2)} ريال</div>
                  </div>
                  <div className="p-4 rounded-lg bg-slate-800 border border-slate-700 text-center">
                    <div className="text-slate-400 text-sm mb-1">الرصيد الافتتاحي</div>
                    <div className="text-xl font-bold text-white">{data.openingBalance?.toFixed(2)} ريال</div>
                  </div>
                  <div className="p-4 rounded-lg bg-slate-800 border border-slate-700 text-center">
                    <div className="text-slate-400 text-sm mb-1">الرصيد الختامي</div>
                    <div className="text-xl font-bold text-emerald-400">{data.closingBalance?.toFixed(2)} ريال</div>
                  </div>
                </div>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
