'use client';

import { useEffect, useState } from 'react';
import api from '@/lib/api';
import { BookOpen, FileText } from 'lucide-react';

export default function GeneralLedgerPage() {
  const [accounts, setAccounts] = useState<any[]>([]);
  const [selectedAccountId, setSelectedAccountId] = useState('');
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    api.get('/finance/chart-of-accounts')
      .then(r => {
        const accs = r.data?.data || [];
        setAccounts(accs);
        if (accs.length > 0) {
          setSelectedAccountId(accs[0].id);
        }
      })
      .catch(console.error);
  }, []);

  useEffect(() => {
    if (!selectedAccountId) return;
    setLoading(true);
    api.get(`/reports/general-ledger/${selectedAccountId}`)
      .then(r => setData(r.data))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [selectedAccountId]);

  const selectedAccount = accounts.find(a => a.id === selectedAccountId);

  return (
    <div className="space-y-6 animate-fade-in-up">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <BookOpen className="h-6 w-6 text-primary-400" />
            دفتر الأستاذ العام
          </h1>
          <p className="text-slate-400 text-sm mt-1">عرض القيود والأرصدة لكل حساب</p>
        </div>
      </div>

      <div className="flex items-center gap-3">
        <select
          value={selectedAccountId}
          onChange={(e) => setSelectedAccountId(e.target.value)}
          className="bg-slate-800 border border-slate-700 rounded-lg px-4 py-2 text-sm text-white min-w-[300px]"
        >
          {accounts.map(acc => (
            <option key={acc.id} value={acc.id}>{acc.code} — {acc.name} ({acc.type})</option>
          ))}
        </select>
        {selectedAccount && (
          <div className="flex gap-3">
            <span className="px-3 py-1 rounded-full bg-slate-800 border border-slate-700 text-slate-400 text-sm">
              النوع: {selectedAccount.type}
            </span>
            <span className="px-3 py-1 rounded-full bg-slate-800 border border-slate-700 text-slate-400 text-sm">
              الحالة: {selectedAccount.isActive !== false ? 'نشط' : 'معطل'}
            </span>
          </div>
        )}
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-64">
          <div className="w-10 h-10 border-4 border-primary-500/30 border-t-primary-500 rounded-full animate-spin" />
        </div>
      ) : !data || data.entries?.length === 0 ? (
        <div className="bg-slate-900 rounded-xl border border-slate-800 p-8 text-center text-slate-500">
          <FileText className="h-12 w-12 mx-auto mb-3 text-slate-600" />
          <p>لا توجد قيود مسجلة لهذا الحساب</p>
        </div>
      ) : (
        <div className="bg-slate-900 rounded-xl border border-slate-800 overflow-hidden">
          <div className="p-4 border-b border-slate-800 flex items-center justify-between">
            <h2 className="font-bold text-white">{selectedAccount?.name}</h2>
            <span className="text-primary-400 font-bold">الرصيد النهائي: {data.finalBalance?.toLocaleString()} ر.س</span>
          </div>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-700 text-slate-400 bg-slate-800/50">
                <th className="text-right p-3">التاريخ</th>
                <th className="text-right p-3">الوصف</th>
                <th className="text-right p-3">المرجع</th>
                <th className="text-left p-3">مدين</th>
                <th className="text-left p-3">دائن</th>
                <th className="text-left p-3">الرصيد الجاري</th>
              </tr>
            </thead>
            <tbody>
              {data.entries.map((entry: any) => (
                <tr key={entry.id} className="border-b border-slate-800/50 hover:bg-slate-800/30">
                  <td className="p-3">{entry.date ? new Date(entry.date).toLocaleDateString('ar-SA') : '—'}</td>
                  <td className="p-3">{entry.description}</td>
                  <td className="p-3 font-mono text-slate-400">{entry.reference || '—'}</td>
                  <td className="p-3 text-left text-emerald-400">{entry.debit > 0 ? entry.debit.toLocaleString() : ''}</td>
                  <td className="p-3 text-left text-red-400">{entry.credit > 0 ? entry.credit.toLocaleString() : ''}</td>
                  <td className="p-3 text-left font-bold">{entry.balance.toLocaleString()}</td>
                </tr>
              ))}
              <tr className="bg-slate-800/50 font-bold">
                <td className="p-3" colSpan={5}>الرصيد النهائي</td>
                <td className="p-3 text-left text-primary-400">{data.finalBalance?.toLocaleString()}</td>
              </tr>
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
