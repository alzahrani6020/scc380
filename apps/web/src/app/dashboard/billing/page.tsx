'use client';

import { useEffect, useState } from 'react';
import api from '@/lib/api';
import { CreditCard, Calendar, CheckCircle2, XCircle, Crown } from 'lucide-react';

export default function BillingPage() {
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get('/billing/subscriptions').then((res) => setItems(res.data.data || [])).catch(console.error).finally(() => setLoading(false));
  }, []);

  const planColors: Record<string, string> = {
    BASIC: 'bg-slate-500/20 text-slate-400',
    PROFESSIONAL: 'bg-blue-500/20 text-blue-400',
    ENTERPRISE: 'bg-violet-500/20 text-violet-400',
    GOVERNMENT: 'bg-amber-500/20 text-amber-400',
  };

  return (
    <div className="space-y-6 animate-fade-in-up">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <CreditCard className="h-6 w-6 text-primary-400" />
            الاشتراكات
          </h1>
          <p className="text-slate-400 text-sm mt-1">{items.length} اشتراك</p>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-64">
          <div className="w-10 h-10 border-4 border-primary-500/30 border-t-primary-500 rounded-full animate-spin" />
        </div>
      ) : (
        <div className="space-y-4">
          {items.map((s) => (
            <div key={s.id} className="scc-card-hover">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-primary-500 to-primary-700 flex items-center justify-center text-white">
                    <Crown className="h-5 w-5" />
                  </div>
                  <div>
                    <h3 className="font-bold text-white">{s.plan}</h3>
                    <p className="text-slate-400 text-xs">{s.user?.firstName} {s.user?.lastName}</p>
                  </div>
                </div>
                <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${planColors[s.plan] || 'bg-slate-500/20 text-slate-400'}`}>{s.plan}</span>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                <div>
                  <p className="text-slate-500 text-xs">السعر</p>
                  <p className="text-white font-medium">{Number(s.totalPrice).toLocaleString()} ر.س</p>
                </div>
                <div>
                  <p className="text-slate-500 text-xs">المقاعد</p>
                  <p className="text-white font-medium">{s.seats}</p>
                </div>
                <div>
                  <p className="text-slate-500 text-xs">الدورة</p>
                  <p className="text-white font-medium">{s.billingCycle}</p>
                </div>
                <div>
                  <p className="text-slate-500 text-xs">الحالة</p>
                  <span className={`inline-flex items-center gap-1 text-xs font-medium ${
                    s.status === 'ACTIVE' ? 'text-emerald-400' : s.status === 'CANCELLED' ? 'text-red-400' : 'text-amber-400'
                  }`}>
                    {s.status === 'ACTIVE' ? <CheckCircle2 className="h-3 w-3" /> : <XCircle className="h-3 w-3" />}
                    {s.status}
                  </span>
                </div>
              </div>
              <div className="mt-3 flex items-center gap-1 text-slate-500 text-xs">
                <Calendar className="h-3 w-3" />
                {new Date(s.startDate).toLocaleDateString('ar-SA')} - {s.endDate ? new Date(s.endDate).toLocaleDateString('ar-SA') : 'مفتوح'}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
