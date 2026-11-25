'use client';
import { useCallback, useEffect, useState } from 'react';
import api from '@/lib/api';
import Link from 'next/link';
type FileRow = { id: string; title: string; fileName: string; mimeType: string; sizeBytes: number };
type RequestRow = { id: string; fileId: string; scope: string; status: string; startLine: number | null; endLine: number | null; file: { fileName: string } };
type HrDocumentIndex = { id: string; title: string; fileName: string; mimeType: string };
type InvoiceIndex = { id: string; invoiceNumber: string; status: string };
type SourceResult<T> = { status: 'idle' | 'loading' | 'loaded' | 'denied'; items: T[] };
const initialSource = <T,>(): SourceResult<T> => ({ status: 'idle', items: [] });
export default function TenantFileCenter() {
  const [files, setFiles] = useState<FileRow[]>([]);
  const [requests, setRequests] = useState<RequestRow[]>([]);
  const [hasMoreFiles, setHasMoreFiles] = useState(false);
  const [hasMoreRequests, setHasMoreRequests] = useState(false);
  const [loadingMoreFiles, setLoadingMoreFiles] = useState(false);
  const [loadingMoreRequests, setLoadingMoreRequests] = useState(false);
  const [filesLoad, setFilesLoad] = useState<'loading' | 'loaded' | 'error'>('loading');
  const [requestsLoad, setRequestsLoad] = useState<'loading' | 'loaded' | 'error'>('loading');
  const [hrSource, setHrSource] = useState<SourceResult<HrDocumentIndex>>(initialSource);
  const [erpSource, setErpSource] = useState<SourceResult<InvoiceIndex>>(initialSource);
  const [fileId, setFileId] = useState('');
  const [scope, setScope] = useState<'FULL' | 'PARTIAL'>('FULL');
  const [startLine, setStartLine] = useState(1);
  const [endLine, setEndLine] = useState(1);
  const [invoiceNumber, setInvoiceNumber] = useState('');
  const selectedFile = files.find(f => f.id === fileId);
  const isPdf = selectedFile?.mimeType === 'application/pdf';
  const [uploadTitle, setUploadTitle] = useState('');
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState('');
  const refresh = useCallback(async () => {
    setFilesLoad('loading');
    setRequestsLoad('loading');
    const [fileResult, requestResult] = await Promise.allSettled([
      api.get<FileRow[]>('/owner-files'),
      api.get<RequestRow[]>('/owner-files/requests/mine'),
    ]);
    if (fileResult.status === 'fulfilled' && Array.isArray(fileResult.value.data)) {
      setFiles(fileResult.value.data);
      setHasMoreFiles(fileResult.value.data.length === 100);
      setFilesLoad('loaded');
      setFileId(current => fileResult.value.data.some(file => file.id === current) ? current : '');
    } else {
      setFilesLoad('error');
    }
    if (requestResult.status === 'fulfilled' && Array.isArray(requestResult.value.data)) {
      setRequests(requestResult.value.data);
      setHasMoreRequests(requestResult.value.data.length === 100);
      setRequestsLoad('loaded');
    } else {
      setRequestsLoad('error');
    }
  },[]);
  useEffect(() => { void refresh(); },[refresh]);
  async function loadMoreFiles() {
    if (loadingMoreFiles || !hasMoreFiles || filesLoad !== 'loaded') return;
    setLoadingMoreFiles(true);
    try {
      const result = await api.get<FileRow[]>('/owner-files', { params: { offset: files.length } });
      if (!Array.isArray(result.data)) throw new Error('Invalid file list');
      setFiles(previous => [...previous, ...result.data.filter(file => !previous.some(old => old.id === file.id))]);
      setHasMoreFiles(result.data.length === 100);
    } catch {
      setNotice('تعذر تحميل ملفات أقدم؛ الملفات الحالية محفوظة في العرض.');
    } finally {
      setLoadingMoreFiles(false);
    }
  }
  async function loadMoreRequests() {
    if (loadingMoreRequests || !hasMoreRequests || requestsLoad !== 'loaded') return;
    setLoadingMoreRequests(true);
    try {
      const result = await api.get<RequestRow[]>('/owner-files/requests/mine', { params: { offset: requests.length } });
      if (!Array.isArray(result.data)) throw new Error('Invalid request list');
      setRequests(previous => [...previous, ...result.data.filter(request => !previous.some(old => old.id === request.id))]);
      setHasMoreRequests(result.data.length === 100);
    } catch {
      setNotice('تعذر تحميل طلبات أقدم؛ حالة الطلبات المحملة لم تتغير.');
    } finally {
      setLoadingMoreRequests(false);
    }
  }
  async function loadOriginalSources() {
    setHrSource({ status: 'loading', items: [] });
    setErpSource({ status: 'loading', items: [] });
    // These existing endpoints apply hr:documents:read and erp:read respectively.
    // Do not copy content into commercial storage or fall back to privileged access.
    const [hr, erp] = await Promise.allSettled([
      api.get<{ data: HrDocumentIndex[] }>('/hr/employee-documents'),
      api.get<InvoiceIndex[] | { data: InvoiceIndex[] }>('/erp/invoices'),
    ]);
    if (hr.status === 'fulfilled') {
      const items = hr.value.data?.data;
      setHrSource({ status: 'loaded', items: Array.isArray(items) ? items : [] });
    } else setHrSource({ status: 'denied', items: [] });
    if (erp.status === 'fulfilled') {
      const payload = erp.value.data;
      const items = Array.isArray(payload) ? payload : payload?.data;
      setErpSource({ status: 'loaded', items: Array.isArray(items) ? items : [] });
    } else setErpSource({ status: 'denied', items: [] });
  }
  async function upload() {
    if (!uploadFile || !uploadTitle.trim()) { setNotice('اختر ملفًا وعنوانًا'); return; }
    if (uploadFile.size > 1048576 || !['application/pdf','text/plain','text/csv'].includes(uploadFile.type)) {
      setNotice('يجب أن يكون الملف PDF أو نصيًا وألا يتجاوز 1 ميجابايت'); return;
    }
    setBusy(true);
    try {
      const dataUrl = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => typeof reader.result === 'string' ? resolve(reader.result) : reject(new Error('Invalid result'));
        reader.onerror = () => reject(new Error('Cannot read file'));
        reader.readAsDataURL(uploadFile);
      });
      await api.post('/owner-files', { title: uploadTitle.trim(), fileName: uploadFile.name,
        mimeType: uploadFile.type, contentBase64: dataUrl.slice(dataUrl.indexOf(',') + 1) });
      setUploadFile(null); setUploadTitle('');
      setNotice('سُجل الملف في مساحة الشركة.');
      await refresh();
    } catch (err: any) {
      const status = err?.response?.status;
      setNotice(status === 403 ? 'لا تملك صلاحية رفع ملفات الشركة.' :
        status === 413 ? 'حجم الملف يتجاوز الحد المسموح.' :
        status === 400 ? 'الملف أو بياناته غير صالحة. تحقق من النوع والحجم والعنوان.' :
        status === 503 ? 'خدمة الملفات غير متاحة مؤقتًا. تحقق من الاتصال ثم أعد المحاولة.' :
        'تعذر رفع الملف؛ لم يثبت حفظه. أعد المحاولة.');
    }
    finally { setBusy(false); }
  }
  async function requestFile() {
    if (filesLoad !== 'loaded') { setNotice('تعذر التحقق من قائمة الملفات، أعد تحديثها.'); return; }
    if (!fileId) { setNotice('اختر الملف أولًا'); return; }
    if (scope === 'PARTIAL' && (!Number.isInteger(startLine) || !Number.isInteger(endLine) || startLine < 1 || endLine < startLine || endLine - startLine >= 500)) {
      setNotice('حدد نطاقًا صحيحًا لا يتجاوز 500 صفحة أو سطر.'); return;
    }
    setBusy(true);
    try {
      await api.post('/owner-files/requests', { fileId, scope, ...(scope === 'PARTIAL' ? { startLine, endLine } : {}) });
      setNotice('سُجل الطلب، ولا يتيح التنزيل حتى الموافقة أو الدفع المثبت.');
      await refresh();
    } catch (err: any) {
      const status = err?.response?.status;
      setNotice(status === 400 ? 'النطاق غير صالح لنوع الملف أو يتجاوز عدد صفحاته/أسطره.' :
        status === 403 ? 'ليست لديك صلاحية إنشاء طلب لهذه الشركة.' :
        status === 404 ? 'الملف المحدد لم يعد موجودًا لهذه الشركة؛ حدث القائمة.' :
        status === 503 ? 'خدمة الطلبات غير متاحة مؤقتًا. تحقق من قائمة طلباتك قبل إعادة الإرسال لتجنب التكرار.' :
        'تعذر تأكيد إنشاء الطلب. حدّث الطلبات قبل إعادة الإرسال لتجنب التكرار.');
    }
    finally { setBusy(false); }
  }
  async function download(id: string, fileName: string) {
    setBusy(true);
    try {
      const args = invoiceNumber.trim() ? '?invoiceNumber='+encodeURIComponent(invoiceNumber.trim()) : '';
      const response = await api.get('/owner-files/requests/'+encodeURIComponent(id)+'/download'+args,{responseType:'blob'});
      const blob = new Blob([response.data],{type: typeof response.headers['content-type'] === 'string' ? response.headers['content-type'] : 'application/octet-stream'});
      const url = URL.createObjectURL(blob);
      const safeName = fileName.replace(/[\\/\x00-\x1f\x7f]/g, '_').trim() || 'scc380-file-'+id;
      const a = document.createElement('a'); a.href=url; a.download=safeName; document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(url),1000);
      setNotice('استلم المتصفح استجابة ملف؛ حفظ الملف على الجهاز لم يتم التحقق منه.');
    } catch (err: any) {
      const status = err?.response?.status;
      setNotice(status === 403 ? 'التنزيل غير مصرح به؛ يتطلب موافقة المالك السارية.' :
        status === 404 ? 'طلب التنزيل غير موجود لحسابك أو شركتك.' :
        status === 503 ? 'خدمة التنزيل غير متاحة مؤقتًا؛ لم يثبت تسليم الملف.' :
        'تعذر تنزيل الملف؛ لم يثبت تسليمه.');
    }
    finally { setBusy(false); }
  }
  return <main dir="rtl" className="mx-auto max-w-5xl space-y-5 px-4 py-8 text-white">
    <h1 className="text-2xl font-bold">مركز ملفات الشركة</h1>
    <section className="space-y-3 rounded-xl border border-slate-700 bg-slate-900 p-4">
      <h2 className="font-semibold">فهرس المستندات من الأنظمة القائمة</h2>
      <p className="text-xs text-slate-400">الفهرس للقراءة فقط. مستندات الموظفين والفواتير تبقى في أنظمتها، وتظل صلاحيات عرضها وتنزيلها كما هي. لا تُباع ولا تُنسخ إلى الملفات التجارية تلقائيًا.</p>
      <button type="button" onClick={()=>void loadOriginalSources()} disabled={hrSource.status==='loading' || erpSource.status==='loading'} className="rounded border border-slate-600 px-3 py-2 disabled:opacity-50">عرض المستندات المصرح بها</button>
      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-2">
          <h3 className="font-semibold">مستندات الموظفين (HR)</h3>
          {hrSource.status==='denied' && <p className="text-sm text-amber-300">غير متاحة لهذه الجلسة أو تعذر الاتصال؛ لم يتم تجاوز صلاحيات HR.</p>}
          {hrSource.status==='loaded' && !hrSource.items.length && <p className="text-sm text-slate-400">لا توجد مستندات ضمن الصلاحيات الحالية.</p>}
          {hrSource.items.map(doc=><p key={doc.id} className="break-words text-sm">{doc.title} — {doc.fileName}</p>)}
          <Link href="/dashboard/hr/documents" className="text-blue-300 underline">فتح مستندات HR الأصلية</Link>
        </div>
        <div className="space-y-2">
          <h3 className="font-semibold">الفواتير (ERP)</h3>
          {erpSource.status==='denied' && <p className="text-sm text-amber-300">غير متاحة لهذه الجلسة أو تعذر الاتصال؛ لم يتم تجاوز صلاحيات ERP.</p>}
          {erpSource.status==='loaded' && !erpSource.items.length && <p className="text-sm text-slate-400">لا توجد فواتير ضمن الصلاحيات الحالية.</p>}
          {erpSource.items.map(inv=><p key={inv.id} className="break-words text-sm">{inv.invoiceNumber} — {inv.status}</p>)}
          <Link href="/dashboard/erp" className="text-blue-300 underline">فتح الفواتير الأصلية</Link>
        </div>
      </div>
    </section>
    <p className="text-sm text-slate-300">ملفات هذه الشركة فقط. التنزيل يتطلب قرار المالك أو فاتورة مسددة تطابق الملف والمشتري. التنزيل الجزئي يدعم صفحات PDF أو أسطر الملفات النصية.</p>
    <nav className="flex flex-wrap gap-3 text-sm">
      <Link href="/owner/files" className="text-blue-300 underline">لوحة مراجعة طلبات المالك (للمخولين فقط)</Link>
      <Link href="/dashboard" className="text-blue-300 underline">العودة إلى لوحة التحكم</Link>
    </nav>
    <section className="space-y-3 rounded-xl border border-slate-700 bg-slate-900 p-4">
      <h2 className="font-semibold">رفع ملف تجاري — لمدير الشركة فقط</h2>
      <label className="block">عنوان الملف<input value={uploadTitle} onChange={e=>setUploadTitle(e.target.value)} maxLength={160} className="mt-2 block w-full rounded bg-slate-950 p-2"/></label>
      <input aria-label="اختيار الملف" type="file" accept=".txt,.csv,.pdf" onChange={e=>setUploadFile(e.target.files?.[0] || null)} className="block w-full"/>
      <p className="text-xs text-slate-400">ملفات PDF أو نص حتى 1 ميجابايت. يمكن طلب صفحات محددة من PDF أو أسطر من الملفات النصية.</p>
      <button type="button" onClick={()=>void upload()} disabled={busy} className="rounded bg-blue-600 px-4 py-2 disabled:opacity-50">رفع الملف</button>
    </section>
    <div className="space-y-3 rounded-xl border border-slate-700 bg-slate-900 p-4">
      {filesLoad === 'loading' && <p role="status" className="text-slate-300">جارٍ تحميل قائمة الملفات... إذا كانت الخدمة تستعيد تشغيلها فقد يستغرق الاتصال نحو دقيقة. لا تعِد إرسال طلب تنزيل قبل ظهور حالته.</p>}
      {filesLoad === 'error' && <p role="alert" className="text-red-300">فشل تحميل الملفات. لن يُفسر ذلك على أنه عدم وجود ملفات. اضغط تحديث الطلبات لإعادة المحاولة.</p>}
      {filesLoad === 'loaded' && files.length === 0 && <p className="text-slate-400">لا توجد ملفات تجارية مسجلة لهذه الشركة.</p>}
      <label className="block">الملف<select disabled={filesLoad !== 'loaded' || busy} value={fileId} onChange={e=>{ setFileId(e.target.value); setScope('FULL'); }} className="mt-2 block w-full rounded bg-slate-950 p-2">
        <option value="">اختر ملفًا</option>{files.map(f=><option key={f.id} value={f.id}>{f.title} — {f.fileName} ({f.mimeType})</option>)}
      </select></label>
      {filesLoad === 'loaded' && hasMoreFiles && <button type="button" disabled={loadingMoreFiles || busy} onClick={() => void loadMoreFiles()} className="rounded border border-slate-600 px-3 py-2 disabled:opacity-50">{loadingMoreFiles ? 'جارٍ تحميل ملفات أقدم...' : 'تحميل 100 ملف أقدم'}</button>}
      <label className="block">النطاق<select value={scope} onChange={e=>setScope(e.target.value as 'FULL'|'PARTIAL')} className="mt-2 block rounded bg-slate-950 p-2">
        <option value="FULL">كامل</option><option value="PARTIAL">جزئي — صفحات PDF أو أسطر نصية</option>
      </select></label>
      {scope==='PARTIAL' && <div className="flex flex-wrap gap-3">
        <label>من {isPdf ? 'الصفحة' : 'السطر'}<input aria-label="من السطر" type="number" min={1} value={startLine} onChange={e=>setStartLine(Number(e.target.value))} className="mr-2 w-20 rounded bg-slate-950 p-2"/></label>
        <label>إلى {isPdf ? 'الصفحة' : 'السطر'}<input aria-label="إلى السطر" type="number" min={1} value={endLine} onChange={e=>setEndLine(Number(e.target.value))} className="mr-2 w-20 rounded bg-slate-950 p-2"/></label>
      </div>}
      <button disabled={busy || filesLoad !== 'loaded' || !fileId} onClick={()=>void requestFile()} type="button" className="rounded bg-blue-600 px-4 py-2 disabled:opacity-50">إرسال طلب تنزيل</button>
    </div>
    <div className="rounded-xl border border-slate-700 bg-slate-900 p-4">
      <label className="block text-sm">رقم فاتورة مدفوعة (اختياري)
        <input value={invoiceNumber} maxLength={80} onChange={e=>setInvoiceNumber(e.target.value)} disabled aria-disabled="true" placeholder="غير متاح حتى تفعيل مزود دفع موثق" className="mt-2 block w-full rounded bg-slate-950 p-2 disabled:opacity-50"/>
      </label>
      <p className="mt-2 text-xs text-amber-300">التنزيل المدفوع غير مفعل حتى ربط مزود دفع حقيقي والتحقق من إشعارات التسوية. اطلب موافقة المالك للتنزيل حاليًا.</p>
    </div>
    <button type="button" onClick={()=>void refresh()} className="rounded border px-4 py-2">تحديث الطلبات</button>
    {notice && <p role="status" className="text-amber-300">{notice}</p>}
    {requestsLoad === 'loading' && <p role="status" className="text-slate-300">جارٍ تحميل طلبات التنزيل...</p>}
    {requestsLoad === 'error' && <p role="alert" className="text-red-300">تعذر تحميل الطلبات. حالة الموافقة غير معروفة؛ أعد التحديث قبل إرسال طلب جديد.</p>}
    {requestsLoad === 'loaded' && requests.length === 0 && <p className="text-slate-400">لا توجد طلبات تنزيل مسجلة لحسابك.</p>}
    {requestsLoad === 'loaded' && requests.map(r=><section key={r.id} className="rounded-lg border border-slate-700 bg-slate-900 p-4">
      <p className="break-all text-sm">الطلب {r.id} — {r.scope} — {r.status}</p>
      <button type="button" disabled={busy || r.status === 'REJECTED' || r.status === 'REVOKED' || (r.status !== 'APPROVED' && !invoiceNumber.trim())} onClick={()=>void download(r.id, r.file.fileName)} className="mt-2 rounded bg-blue-600 px-3 py-2 disabled:opacity-50">تنزيل بعد التحقق</button>
      {r.status === 'PENDING' && !invoiceNumber.trim() && <p className="mt-2 text-xs text-slate-400">يلزم اعتماد المالك أو إدخال رقم فاتورة مدفوعة ومتحقق منها لإتاحة التنزيل.</p>}
      {(r.status === 'REJECTED' || r.status === 'REVOKED') && <p className="mt-2 text-xs text-slate-400">التنزيل غير متاح لهذا الطلب؛ يلزم إنشاء طلب جديد.</p>}
    </section>)}
    {requestsLoad === 'loaded' && hasMoreRequests && <button type="button" disabled={loadingMoreRequests || busy} onClick={() => void loadMoreRequests()} className="rounded border border-slate-600 px-3 py-2 disabled:opacity-50">{loadingMoreRequests ? 'جارٍ تحميل طلبات أقدم...' : 'تحميل 100 طلب أقدم'}</button>}
  </main>;
}
