'use client';

import { useEffect, useState } from 'react';
import api from '@/lib/api';
import { CheckCircle2, ClipboardList, XCircle } from 'lucide-react';
import Button from '@/components/ui/Button';
import Select from '@/components/ui/Select';

export default function HrRequestsPage() {
  const [items, setItems] = useState<any[]>([]);
  const [status, setStatus] = useState('');
  const [loading, setLoading] = useState(true);

  const load = () => {
    setLoading(true);
    const q = status ? '?status=' + encodeURIComponent(status) : '';
    api.get('/hr/requests' + q).then(r => setItems(r.data.data || [])).catch(console.error).finally(() => setLoading(false));
  };
  useEffect(() => { load(); }, [status]);

  const review = async (item: any, decision: 'approve'|'reject') => {
    const resolution = prompt(decision === 'reject' ? 'سبب الرفض (إلزامي)' : 'ملاحظة القرار (اختياري)') ?? '';
    if (decision === 'reject' && !resolution.trim()) return;
    await api.post(`/hr/requests/${item.id}/${decision}`, { resolution });
    load();
  };

  return <div className="space-y-6 animate-fade-in-up">
    <div>
      <h1 className="text-2xl font-bold text-white flex gap-2 items-center"><ClipboardList className="h-6 w-6 text-primary-400" /> طلبات الموارد البشرية</h1>
      <p className="text-slate-400 text-sm mt-1">طلبات الموظفين المرتبطة بملفاتهم الفعلية، مع قرار وملاحظة مراجعة.</p>
    </div>
    <div className="max-w-xs"><Select label="الحالة" value={status} onChange={e => setStatus(e.target.value)} options={[
      {value:'',label:'كل الحالات'},{value:'PENDING',label:'معلق'},{value:'APPROVED',label:'معتمد'},{value:'REJECTED',label:'مرفوض'},{value:'CANCELLED',label:'ملغي'}
    ]} /></div>
    {loading ? <div className="scc-card py-12 text-center text-slate-400">جاري التحميل...</div> :
      items.length === 0 ? <div className="scc-card py-12 text-center text-slate-400">لا توجد طلبات.</div> :
      <div className="space-y-3">{items.map(item => <div key={item.id} className="scc-card-hover flex justify-between gap-4">
        <div><div className="text-white font-semibold">{item.subject}</div><div className="text-slate-400 text-sm">{item.employee?.firstName} {item.employee?.lastName} · {item.employee?.employeeCode} · {item.type}</div><div className="text-slate-500 text-xs mt-1">{new Date(item.createdAt).toLocaleString('ar-SA')} · {item.status}</div>{item.resolution && <div className="text-slate-300 text-sm mt-2">{item.resolution}</div>}</div>
        {item.status === 'PENDING' && <div className="flex gap-2 shrink-0"><Button size="sm" onClick={() => review(item,'approve')}><CheckCircle2 className="h-4 w-4" /> اعتماد</Button><Button size="sm" variant="ghost" onClick={() => review(item,'reject')}><XCircle className="h-4 w-4" /> رفض</Button></div>}
      </div>)}</div>}
  </div>;
}
