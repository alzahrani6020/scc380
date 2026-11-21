'use client';
import { useCallback, useEffect, useState } from 'react';
import api from '@/lib/api';
type FileRow = { id: string; title: string; fileName: string; mimeType: string; sizeBytes: number };
type RequestRow = { id: string; fileId: string; scope: string; status: string; startLine: number | null; endLine: number | null };
export default function TenantFileCenter() {
  const [files, setFiles] = useState<FileRow[]>([]);
  const [requests, setRequests] = useState<RequestRow[]>([]);
  const [fileId, setFileId] = useState('');
  const [scope, setScope] = useState<'FULL' | 'PARTIAL'>('FULL');
  const [startLine, setStartLine] = useState(1);
  const [endLine, setEndLine] = useState(1);
  const [invoiceNumber, setInvoiceNumber] = useState('');
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState('');
  const refresh = useCallback(async () => {
    try {
      const [a,b] = await Promise.all([api.get<FileRow[]>('/owner-files'),api.get<RequestRow[]>('/owner-files/requests/mine')]);
      setFiles(a.data || []);
      setRequests(b.data || []);
    } catch { setNotice('تعذر جلب الملفات أو الطلبات من الخادم.'); }
  },[]);
  useEffect(() => { void refresh(); },[refresh]);
  async function requestFile() {
    if (!fileId) { setNotice('اختر الملف أولًا'); return; }
    setBusy(true);
    try {
      await api.post('/owner-files/requests', { fileId, scope, ...(scope === 'PARTIAL' ? { startLine, endLine } : {}) });
      setNotice('سُجل الطلب، ولا يتيح التنزيل حتى الموافقة أو الدفع المثبت.');
      await refresh();
    } catch { setNotice('تعذر تسجيل الطلب. تحقق من نوع الملف والنطاق.'); }
    finally { setBusy(false); }
  }
  async function download(id: string) {
    setBusy(true);
    try {
      const args = invoiceNumber.trim() ? '?invoiceNumber='+encodeURIComponent(invoiceNumber.trim()) : '';
      const response = await api.get('/owner-files/requests/'+encodeURIComponent(id)+'/download'+args,{responseType:'blob'});
      const blob = new Blob([response.data],{type: typeof response.headers['content-type'] === 'string' ? response.headers['content-type'] : 'application/octet-stream'});
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a'); a.href=url; a.download='scc380-file-'+id; document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(url),1000);
      setNotice('استلم المتصفح استجابة ملف؛ حفظ الملف على الجهاز لم يتم التحقق منه.');
    } catch { setNotice('رُفض التنزيل أو فشل الاتصال؛ لم يثبت تسليم الملف.'); }
    finally { setBusy(false); }
  }
  return <main dir="rtl" className="mx-auto max-w-5xl space-y-5 px-4 py-8 text-white">
    <h1 className="text-2xl font-bold">مركز ملفات الشركة</h1>
    <p className="text-sm text-slate-300">ملفات هذه الشركة فقط. التنزيل يتطلب قرار المالك أو فاتورة مسددة تطابق الملف والمشتري. التنزيل الجزئي للملفات النصية فقط.</p>
    <div className="space-y-3 rounded-xl border border-slate-700 bg-slate-900 p-4">
      <label className="block">الملف<select value={fileId} onChange={e=>setFileId(e.target.value)} className="mt-2 block w-full rounded bg-slate-950 p-2">
        <option value="">اختر ملفًا</option>{files.map(f=><option key={f.id} value={f.id}>{f.title} — {f.fileName} ({f.mimeType})</option>)}
      </select></label>
      <label className="block">النطاق<select value={scope} onChange={e=>setScope(e.target.value as 'FULL'|'PARTIAL')} className="mt-2 block rounded bg-slate-950 p-2">
        <option value="FULL">كامل</option><option value="PARTIAL">جزئي — أسطر نصية</option>
      </select></label>
      {scope==='PARTIAL' && <div className="flex flex-wrap gap-3">
        <label>من السطر<input aria-label="من السطر" type="number" min={1} value={startLine} onChange={e=>setStartLine(Number(e.target.value))} className="mr-2 w-20 rounded bg-slate-950 p-2"/></label>
        <label>إلى السطر<input aria-label="إلى السطر" type="number" min={1} value={endLine} onChange={e=>setEndLine(Number(e.target.value))} className="mr-2 w-20 rounded bg-slate-950 p-2"/></label>
      </div>}
      <button disabled={busy} onClick={()=>void requestFile()} type="button" className="rounded bg-blue-600 px-4 py-2 disabled:opacity-50">إرسال طلب تنزيل</button>
    </div>
    <div className="rounded-xl border border-slate-700 bg-slate-900 p-4">
      <label className="block text-sm">رقم فاتورة مدفوعة (اختياري)
        <input value={invoiceNumber} maxLength={80} onChange={e=>setInvoiceNumber(e.target.value)} className="mt-2 block w-full rounded bg-slate-950 p-2"/>
      </label>
      <p className="mt-2 text-xs text-slate-400">لا تنشئ هذه الصفحة عملية دفع. يُتحقق من التسوية الفعلية في قاعدة الفواتير قبل التسليم.</p>
    </div>
    <button type="button" onClick={()=>void refresh()} className="rounded border px-4 py-2">تحديث الطلبات</button>
    {notice && <p role="status" className="text-amber-300">{notice}</p>}
    {requests.map(r=><section key={r.id} className="rounded-lg border border-slate-700 bg-slate-900 p-4">
      <p className="break-all text-sm">الطلب {r.id} — {r.scope} — {r.status}</p>
      <button type="button" disabled={busy} onClick={()=>void download(r.id)} className="mt-2 rounded bg-blue-600 px-3 py-2 disabled:opacity-50">تنزيل بعد التحقق</button>
    </section>)}
  </main>;
}
