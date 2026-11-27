import { Controller, ForbiddenException, Get, Req, UseGuards } from '@nestjs/common';
import { prisma } from '@scc/database';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

/**
 * Read-only procurement exceptions based on ACTUAL records. We intentionally
 * do not claim PO/receipt matching: current SupplierInvoice schema lacks a
 * source-verified link to purchase order and accepted goods receipt.
 */
@Controller('field-procurement-review')
@UseGuards(JwtAuthGuard)
export class FieldProcurementReviewController {
  @Get('exceptions')
  async exceptions(@Req() req: any) {
    const actor = req?.user;
    if (!actor?.tenantId || !actor?.userId ||
      !['SUPER_ADMIN', 'ADMIN', 'MANAGER', 'AUDITOR'].includes(actor.role)) {
      throw new ForbiddenException('Company purchasing audit role required');
    }
    const tenantId = actor.tenantId as string;
    const invoices = await prisma.supplierInvoice.findMany({
        where: { tenantId },
        select: { id: true, invoiceNumber: true, supplierId: true,
          total: true, paidAmount: true, currency: true, dueDate: true,
          status: true, supplier: { select: { tenantId: true, name: true, isActive: true } } },
        orderBy: { createdAt: 'desc' }, take: 500,
      });
    const now = new Date();
    const findings: { invoiceId: string; invoiceNumber: string; supplierId: string;
      supplierName: string; code: string; severity: 'INFO' | 'REVIEW';
      explanation: string; requiresHumanReview: true }[] = [];
    for (const invoice of invoices) {
      // The existing invoice->supplier FK is not composite-tenant-bound.
      // Never expose a supplier record belonging to another tenant.
      if (invoice.supplier.tenantId !== tenantId) continue;
      const amount = Number(invoice.total.toString());
      const paid = Number(invoice.paidAmount.toString());
      if (!Number.isFinite(amount) || !Number.isFinite(paid)) continue;
      const row = { invoiceId: invoice.id, invoiceNumber: invoice.invoiceNumber,
        supplierId: invoice.supplierId, supplierName: invoice.supplier.name,
        requiresHumanReview: true as const };
      if (paid > amount + 0.005) findings.push({ ...row,
        code: 'PAYMENTS_ABOVE_INVOICE_TOTAL', severity: 'REVIEW',
        explanation: 'المبالغ المسجلة كمدفوعة تتجاوز قيمة الفاتورة؛ يلزم تدقيق التسويات والمرتجعات' });
      if (invoice.dueDate && invoice.dueDate < now &&
          amount > paid + 0.005) findings.push({ ...row,
        code: 'OVERDUE_SUPPLIER_INVOICE', severity: 'INFO',
        explanation: 'فاتورة مستحقة بتاريخ سابق وبها رصيد غير مسدد' });
      if (!invoice.supplier.isActive && amount > paid + 0.005) findings.push({ ...row,
        code: 'OPEN_INVOICE_INACTIVE_SUPPLIER', severity: 'REVIEW',
        explanation: 'فاتورة لها رصيد مفتوح رغم تعطيل سجل المورد؛ يتطلب التحقق من السبب' });
    }
    return { tenantScoped: true, asOf: now.toISOString(),
      invoicesScanned: invoices.length, purchaseOrdersRecorded: null,
      sampleLimited: invoices.length === 500,
      source: 'SCC380_SUPPLIER_INVOICES',
      matchToPurchaseOrders: 'NOT_VERIFIED',
      matchToGoodsReceipts: 'NOT_VERIFIED',
      findings: findings.slice(0, 200),
      automaticSanctions: false,
      note: 'These are accounting review indicators, not evidence of employee misconduct',
    };
  }
}
