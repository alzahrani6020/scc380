'use client';

import { format } from 'date-fns';
import { arSA } from 'date-fns/locale';

interface InvoicePrintTemplateProps {
  invoice: any;
}

export default function InvoicePrintTemplate({ invoice }: InvoicePrintTemplateProps) {
  if (!invoice) return null;

  const items = invoice.items || [];
  const subtotal = items.reduce((sum: number, item: any) => sum + (item.quantity * item.unitPrice), 0);
  const taxRate = Number(invoice.taxRate) || 15;
  const taxAmount = subtotal * (taxRate / 100);
  const total = subtotal + taxAmount;

  const statusLabels: Record<string, string> = {
    DRAFT: 'مسودة',
    SENT: 'مرسلة',
    VIEWED: 'مشاهدة',
    PAID: 'مدفوعة',
    PARTIAL: 'جزئي',
    OVERDUE: 'متأخرة',
    CANCELLED: 'ملغاة',
  };

  const typeLabels: Record<string, string> = {
    STANDARD: 'فاتورة',
    CREDIT_NOTE: 'إشعار دائن',
    PROFORMA: 'بروفورما',
    QUOTE: 'عرض سعر',
  };

  return (
    <div className="font-sans" style={{ direction: 'rtl', maxWidth: '800px', margin: '0 auto' }}>
      {/* Header */}
      <div className="border-b-2 border-slate-900 pb-6 mb-6">
        <div className="flex justify-between items-start">
          <div>
            <h1 className="text-3xl font-bold text-slate-900">SCC</h1>
            <p className="text-slate-600 text-sm mt-1">نظام إدارة العلاقات والموارد</p>
          </div>
          <div className="text-left">
            <h2 className="text-2xl font-bold text-slate-900">{typeLabels[invoice.type] || 'فاتورة'}</h2>
            <p className="text-slate-600 mt-1">رقم: {invoice.invoiceNumber}</p>
            <p className="text-slate-600">
              التاريخ: {invoice.issueDate ? format(new Date(invoice.issueDate), 'dd MMMM yyyy', { locale: arSA }) : '-'}
            </p>
          </div>
        </div>
      </div>

      {/* Client Info */}
      <div className="grid grid-cols-2 gap-8 mb-8 bg-slate-50 p-4 rounded-lg">
        <div>
          <h3 className="text-sm font-bold text-slate-700 mb-2">العميل</h3>
          <p className="text-slate-900 font-medium">
            {invoice.contact?.firstName} {invoice.contact?.lastName}
          </p>
          {invoice.contact?.email && <p className="text-slate-600 text-sm">{invoice.contact.email}</p>}
          {invoice.contact?.phone && <p className="text-slate-600 text-sm">{invoice.contact.phone}</p>}
        </div>
        <div>
          <h3 className="text-sm font-bold text-slate-700 mb-2">تفاصيل الفاتورة</h3>
          <div className="space-y-1 text-sm">
            <p className="flex justify-between"><span className="text-slate-600">الحالة:</span> <span>{statusLabels[invoice.status] || invoice.status}</span></p>
            <p className="flex justify-between"><span className="text-slate-600">تاريخ الاستحقاق:</span> <span>{invoice.dueDate ? format(new Date(invoice.dueDate), 'dd/MM/yyyy') : '-'}</span></p>
            <p className="flex justify-between"><span className="text-slate-600">نسبة الضريبة:</span> <span>{taxRate}%</span></p>
          </div>
        </div>
      </div>

      {/* Items Table */}
      <table className="w-full mb-8 border-collapse">
        <thead>
          <tr className="bg-slate-900 text-white">
            <th className="p-3 text-right text-sm font-bold rounded-tl-lg">#</th>
            <th className="p-3 text-right text-sm font-bold">البيان</th>
            <th className="p-3 text-center text-sm font-bold">الكمية</th>
            <th className="p-3 text-center text-sm font-bold">السعر</th>
            <th className="p-3 text-left text-sm font-bold rounded-tr-lg">الإجمالي</th>
          </tr>
        </thead>
        <tbody>
          {items.map((item: any, index: number) => (
            <tr key={index} className="border-b border-slate-200">
              <td className="p-3 text-sm text-slate-600">{index + 1}</td>
              <td className="p-3 text-sm text-slate-900">{item.description}</td>
              <td className="p-3 text-sm text-center text-slate-700">{item.quantity}</td>
              <td className="p-3 text-sm text-center text-slate-700">{Number(item.unitPrice).toLocaleString()} ر.س</td>
              <td className="p-3 text-sm text-left text-slate-900 font-medium">{(item.quantity * item.unitPrice).toLocaleString()} ر.س</td>
            </tr>
          ))}
          {items.length === 0 && (
            <tr>
              <td colSpan={5} className="p-6 text-center text-slate-500">لا توجد بنود</td>
            </tr>
          )}
        </tbody>
      </table>

      {/* Totals */}
      <div className="flex justify-end mb-8">
        <div className="w-72 space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-slate-600">الإجمالي الفرعي:</span>
            <span className="text-slate-900 font-medium">{subtotal.toLocaleString()} ر.س</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-slate-600">الضريبة ({taxRate}%):</span>
            <span className="text-slate-900 font-medium">{taxAmount.toLocaleString()} ر.س</span>
          </div>
          <div className="flex justify-between text-lg font-bold border-t-2 border-slate-900 pt-2">
            <span className="text-slate-900">الإجمالي:</span>
            <span className="text-slate-900">{total.toLocaleString()} ر.س</span>
          </div>
        </div>
      </div>

      {/* Notes */}
      {invoice.notes && (
        <div className="bg-slate-50 p-4 rounded-lg mb-8">
          <h3 className="text-sm font-bold text-slate-700 mb-2">ملاحظات</h3>
          <p className="text-slate-600 text-sm">{invoice.notes}</p>
        </div>
      )}

      {/* Footer */}
      <div className="border-t border-slate-300 pt-4 text-center text-xs text-slate-500">
        <p>تم إنشاء هذه الفاتورة إلكترونيًا عبر نظام SCC</p>
        <p className="mt-1">للاستفسارات: info@scc.sa</p>
      </div>
    </div>
  );
}
