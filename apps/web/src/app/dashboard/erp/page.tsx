'use client';

import { useEffect, useState } from 'react';
import api from '@/lib/api';
import { FileText, Plus, Search, Pencil, Trash2, X, ArrowUpRight, ArrowDownRight, Printer, QrCode, FileJson } from 'lucide-react';
import Modal from '@/components/ui/Modal';
import Input from '@/components/ui/Input';
import Select from '@/components/ui/Select';
import Button from '@/components/ui/Button';
import PdfExporter from '@/components/PdfExporter';
import InvoicePrintTemplate from '@/components/InvoicePrintTemplate';

const invoiceStatuses = [
  { value: 'DRAFT', label: 'مسودة' },
  { value: 'SENT', label: 'مرسلة' },
  { value: 'VIEWED', label: 'مشاهدة' },
  { value: 'PAID', label: 'مدفوعة' },
  { value: 'PARTIAL', label: 'جزئي' },
  { value: 'OVERDUE', label: 'متأخرة' },
  { value: 'CANCELLED', label: 'ملغاة' },
];

const invoiceTypes = [
  { value: 'STANDARD', label: 'عادية' },
  { value: 'CREDIT_NOTE', label: 'إشعار دائن' },
  { value: 'PROFORMA', label: 'بروفورما' },
  { value: 'QUOTE', label: 'عرض سعر' },
];

export default function ErpPage() {
  const [invoices, setInvoices] = useState<any[]>([]);
  const [contacts, setContacts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [formLoading, setFormLoading] = useState(false);
  const [formData, setFormData] = useState<any>({ items: [{ description: '', quantity: 1, unitPrice: 0 }] });
  const [printInvoice, setPrintInvoice] = useState<any>(null);
  const [zatcaModal, setZatcaModal] = useState<{ type: 'xml' | 'qr'; invoice: any } | null>(null);
  const [zatcaData, setZatcaData] = useState<string>('');

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = () => {
    Promise.all([
      api.get('/erp/invoices').then(r => setInvoices(r.data.data || [])),
      api.get('/crm/contacts').then(r => setContacts(r.data.data || [])),
    ]).catch(console.error).finally(() => setLoading(false));
  };

  const openCreate = () => {
    setEditing(null);
    setFormData({ type: 'STANDARD', status: 'DRAFT', currency: 'SAR', taxRate: 15, items: [{ description: '', quantity: 1, unitPrice: 0 }] });
    setIsModalOpen(true);
  };

  const openEdit = (item: any) => {
    setEditing(item);
    setFormData({
      ...item,
      issueDate: item.issueDate ? new Date(item.issueDate).toISOString().split('T')[0] : '',
      dueDate: item.dueDate ? new Date(item.dueDate).toISOString().split('T')[0] : '',
      items: item.items || [{ description: '', quantity: 1, unitPrice: 0 }],
    });
    setIsModalOpen(true);
  };

  const addItem = () => {
    setFormData({ ...formData, items: [...formData.items, { description: '', quantity: 1, unitPrice: 0 }] });
  };

  const removeItem = (index: number) => {
    setFormData({ ...formData, items: formData.items.filter((_: any, i: number) => i !== index) });
  };

  const updateItem = (index: number, field: string, value: any) => {
    const items = [...formData.items];
    items[index][field] = field === 'description' ? value : parseFloat(value) || 0;
    setFormData({ ...formData, items });
  };

  const calculateTotals = () => {
    const subtotal = formData.items.reduce((sum: number, item: any) => sum + (item.quantity * item.unitPrice), 0);
    const taxRate = parseFloat(formData.taxRate) || 0;
    const taxAmount = subtotal * (taxRate / 100);
    const total = subtotal + taxAmount;
    return { subtotal, taxAmount, total };
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormLoading(true);
    try {
      const totals = calculateTotals();
      const payload = {
        ...formData,
        subtotal: totals.subtotal,
        taxAmount: totals.taxAmount,
        total: totals.total,
      };
      if (editing) {
        await api.patch(`/erp/invoices/${editing.id}`, payload);
      } else {
        await api.post('/erp/invoices', payload);
      }
      setIsModalOpen(false);
      fetchData();
    } catch (err) {
      alert('حدث خطأ');
    } finally {
      setFormLoading(false);
    }
  };

  const handleDelete = async (id: string, zatcaStatus?: string) => {
    if (zatcaStatus === 'CLEARED' || zatcaStatus === 'REPORTED') {
      alert('الفاتورة مُبلَّغة لـ ZATCA — لا يمكن الحذف');
      return;
    }
    if (!confirm('هل أنت متأكد؟')) return;
    await api.delete(`/erp/invoices/${id}`);
    fetchData();
  };

  const isZatcaLocked = (zatcaStatus?: string) => zatcaStatus === 'CLEARED' || zatcaStatus === 'REPORTED';

  const filtered = invoices.filter((i) => i.invoiceNumber?.includes(search) || i.contact?.firstName?.includes(search));

  const contactOptions = contacts.map(c => ({ value: c.id, label: `${c.firstName} ${c.lastName}` }));

  const totalRevenue = invoices.filter(i => i.status === 'PAID').reduce((sum, i) => sum + Number(i.total), 0);
  const totalPending = invoices.filter(i => i.status === 'SENT' || i.status === 'OVERDUE').reduce((sum, i) => sum + Number(i.total), 0);
  const totalOverdue = invoices.filter(i => i.status === 'OVERDUE').reduce((sum, i) => sum + Number(i.total), 0);

  return (
    <div className="space-y-6 animate-fade-in-up">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <FileText className="h-6 w-6 text-primary-400" />
            الفواتير
          </h1>
          <p className="text-slate-400 text-sm mt-1">{invoices.length} فاتورة</p>
        </div>
        <Button onClick={openCreate}><Plus className="h-5 w-5" /> إنشاء فاتورة</Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="scc-card-hover">
          <div className="flex items-center gap-3 mb-2"><div className="w-8 h-8 rounded-lg bg-emerald-500/10 flex items-center justify-center"><ArrowUpRight className="h-4 w-4 text-emerald-400" /></div><p className="text-slate-400 text-sm">المدفوع</p></div>
          <p className="text-xl font-bold text-white">{totalRevenue.toLocaleString()} ر.س</p>
        </div>
        <div className="scc-card-hover">
          <div className="flex items-center gap-3 mb-2"><div className="w-8 h-8 rounded-lg bg-amber-500/10 flex items-center justify-center"><ArrowDownRight className="h-4 w-4 text-amber-400" /></div><p className="text-slate-400 text-sm">المعلق</p></div>
          <p className="text-xl font-bold text-white">{totalPending.toLocaleString()} ر.س</p>
        </div>
        <div className="scc-card-hover">
          <div className="flex items-center gap-3 mb-2"><div className="w-8 h-8 rounded-lg bg-red-500/10 flex items-center justify-center"><ArrowDownRight className="h-4 w-4 text-red-400" /></div><p className="text-slate-400 text-sm">المتأخر</p></div>
          <p className="text-xl font-bold text-white">{totalOverdue.toLocaleString()} ر.س</p>
        </div>
      </div>

      <div className="relative">
        <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-500" />
        <input type="text" placeholder="البحث..." className="scc-input pr-10" value={search} onChange={(e) => setSearch(e.target.value)} />
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-64">
          <div className="w-10 h-10 border-4 border-primary-500/30 border-t-primary-500 rounded-full animate-spin" />
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((inv) => (
            <div key={inv.id} className="scc-card-hover flex items-center justify-between group">
              <div>
                <h3 className="font-bold text-white text-sm">{inv.invoiceNumber}</h3>
                <p className="text-slate-400 text-xs">{inv.contact?.firstName} {inv.contact?.lastName}</p>
              </div>
              <div className="flex items-center gap-3">
                <div className="text-left">
                  <p className="text-white font-bold text-sm">{Number(inv.total).toLocaleString()} ر.س</p>
                  <div className="flex items-center gap-1 mt-1">
                    <span className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-medium ${
                      inv.status === 'PAID' ? 'bg-emerald-500/20 text-emerald-400' :
                      inv.status === 'OVERDUE' ? 'bg-red-500/20 text-red-400' :
                      inv.status === 'SENT' ? 'bg-blue-500/20 text-blue-400' :
                      'bg-slate-500/20 text-slate-400'
                    }`}>{invoiceStatuses.find(s => s.value === inv.status)?.label || inv.status}</span>
                    {inv.zatcaStatus && (
                      <span className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-medium ${
                        inv.zatcaStatus === 'REPORTED' ? 'bg-emerald-500/20 text-emerald-400' :
                        inv.zatcaStatus === 'PENDING' ? 'bg-amber-500/20 text-amber-400' :
                        inv.zatcaStatus === 'CLEARED' ? 'bg-blue-500/20 text-blue-400' :
                        'bg-red-500/20 text-red-400'
                      }`}>
                        {inv.zatcaStatus === 'REPORTED' ? 'مُبلَّغ' : inv.zatcaStatus === 'PENDING' ? 'معلق' : inv.zatcaStatus === 'CLEARED' ? 'مقبول' : 'مرفوض'}
                      </span>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button onClick={() => setPrintInvoice(inv)} className="p-1.5 rounded-lg hover:bg-blue-500/10 text-blue-400" title="طباعة / تصدير PDF"><Printer className="h-4 w-4" /></button>
                  <button onClick={() => { setZatcaModal({ type: 'xml', invoice: inv }); api.get(`/zatca/invoices/${inv.id}/xml`).then(r => setZatcaData(r.data?.xml || '')); }} className="p-1.5 rounded-lg hover:bg-emerald-500/10 text-emerald-400" title="ZATCA XML"><FileJson className="h-4 w-4" /></button>
                  <button onClick={() => { setZatcaModal({ type: 'qr', invoice: inv }); api.get(`/zatca/invoices/${inv.id}/qr`).then(r => setZatcaData(r.data?.qrData || '')); }} className="p-1.5 rounded-lg hover:bg-purple-500/10 text-purple-400" title="ZATCA QR"><QrCode className="h-4 w-4" /></button>
                  {!isZatcaLocked(inv.zatcaStatus) && (
                    <button onClick={() => openEdit(inv)} className="p-1.5 rounded-lg hover:bg-primary-500/10 text-primary-400"><Pencil className="h-4 w-4" /></button>
                  )}
                  {!isZatcaLocked(inv.zatcaStatus) && (
                    <button onClick={() => handleDelete(inv.id, inv.zatcaStatus)} className="p-1.5 rounded-lg hover:bg-red-500/10 text-red-400"><Trash2 className="h-4 w-4" /></button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ZATCA Modal */}
      <Modal isOpen={!!zatcaModal} onClose={() => { setZatcaModal(null); setZatcaData(''); }} title={zatcaModal?.type === 'xml' ? `ZATCA XML — ${zatcaModal?.invoice?.invoiceNumber}` : `ZATCA QR — ${zatcaModal?.invoice?.invoiceNumber}`} size="xl">
        {zatcaModal?.type === 'xml' ? (
          <div className="space-y-3">
            <textarea readOnly value={zatcaData} className="w-full h-96 bg-slate-950 border border-slate-800 rounded-lg p-4 text-xs font-mono text-slate-300" dir="ltr" />
            <div className="flex justify-end">
              <button onClick={() => { const blob = new Blob([zatcaData], { type: 'application/xml' }); const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = `${zatcaModal.invoice.invoiceNumber}.xml`; a.click(); URL.revokeObjectURL(url); }} className="px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-bold">تحميل XML</button>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="bg-slate-950 border border-slate-800 rounded-lg p-6 text-center">
              <div className="text-xs font-mono text-slate-400 break-all" dir="ltr">{zatcaData || 'جاري التحميل...'}</div>
            </div>
            <div className="flex justify-end">
              <button onClick={() => navigator.clipboard.writeText(zatcaData).then(() => alert('تم النسخ!'))} className="px-4 py-2 rounded-lg bg-purple-600 hover:bg-purple-500 text-white text-sm font-bold">نسخ QR Data</button>
            </div>
          </div>
        )}
      </Modal>

      {/* Print Modal */}
      <Modal isOpen={!!printInvoice} onClose={() => setPrintInvoice(null)} title="معاينة الفاتورة" size="xl">
        {printInvoice && (
          <PdfExporter filename={`invoice-${printInvoice.invoiceNumber}.pdf`} buttonLabel="تحميل PDF">
            <InvoicePrintTemplate invoice={printInvoice} />
          </PdfExporter>
        )}
      </Modal>

      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title={editing ? 'تعديل فاتورة' : 'فاتورة جديدة'} size="xl">
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Input label="رقم الفاتورة" required value={formData.invoiceNumber || ''} onChange={(e) => setFormData({ ...formData, invoiceNumber: e.target.value })} />
            <Select label="العميل" required options={contactOptions} value={formData.contactId || ''} onChange={(e) => setFormData({ ...formData, contactId: e.target.value })} />
            <Select label="النوع" options={invoiceTypes} value={formData.type || 'STANDARD'} onChange={(e) => setFormData({ ...formData, type: e.target.value })} />
            <Select label="الحالة" options={invoiceStatuses} value={formData.status || 'DRAFT'} onChange={(e) => setFormData({ ...formData, status: e.target.value })} />
            <Input label="تاريخ الإصدار" type="date" value={formData.issueDate || ''} readOnly disabled className="opacity-70 cursor-not-allowed" />
            <Input label="تاريخ الاستحقاق" type="date" value={formData.dueDate || ''} onChange={(e) => setFormData({ ...formData, dueDate: e.target.value })} />
            <Input label="نسبة الضريبة %" type="number" value={formData.taxRate || 15} onChange={(e) => setFormData({ ...formData, taxRate: e.target.value })} />
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="text-sm font-bold text-white">بنود الفاتورة</h4>
              <Button type="button" variant="ghost" size="sm" onClick={addItem}><Plus className="h-4 w-4" /> إضافة بند</Button>
            </div>
            {formData.items.map((item: any, index: number) => (
              <div key={index} className="grid grid-cols-12 gap-2 items-end">
                <div className="col-span-5"><Input value={item.description} onChange={(e) => updateItem(index, 'description', e.target.value)} placeholder="الوصف" /></div>
                <div className="col-span-2"><Input type="number" value={item.quantity} onChange={(e) => updateItem(index, 'quantity', e.target.value)} placeholder="الكمية" /></div>
                <div className="col-span-3"><Input type="number" value={item.unitPrice} onChange={(e) => updateItem(index, 'unitPrice', e.target.value)} placeholder="السعر" /></div>
                <div className="col-span-2">
                  <Button type="button" variant="danger" size="sm" onClick={() => removeItem(index)}><Trash2 className="h-3 w-3" /></Button>
                </div>
              </div>
            ))}
          </div>

          <div className="bg-slate-800/50 rounded-xl p-4 space-y-2">
            <div className="flex justify-between text-sm"><span className="text-slate-400">الإجمالي الفرعي</span><span className="text-white">{calculateTotals().subtotal.toLocaleString()} ر.س</span></div>
            <div className="flex justify-between text-sm"><span className="text-slate-400">الضريبة</span><span className="text-white">{calculateTotals().taxAmount.toLocaleString()} ر.س</span></div>
            <div className="flex justify-between text-base font-bold border-t border-slate-700 pt-2"><span className="text-white">الإجمالي</span><span className="text-primary-400">{calculateTotals().total.toLocaleString()} ر.س</span></div>
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <Button type="button" variant="ghost" onClick={() => setIsModalOpen(false)}><X className="h-4 w-4" /> إلغاء</Button>
            <Button type="submit" isLoading={formLoading}>{editing ? 'حفظ' : 'إنشاء'}</Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
