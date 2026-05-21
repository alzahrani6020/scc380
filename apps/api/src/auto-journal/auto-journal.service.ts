import { Injectable } from '@nestjs/common';
import { prisma } from '@scc/database';

function generateEntryNumber(): string {
  const now = new Date();
  return `JV-${now.getFullYear()}${String(now.getMonth()+1).padStart(2,'0')}${String(now.getDate()).padStart(2,'0')}-${Date.now().toString(36).toUpperCase()}`;
}

@Injectable()
export class AutoJournalService {
  // ─── قيد عند إنشاء فاتورة ───
  async postInvoiceJournal(invoiceId: string, tenantId: string) {
    const invoice = await prisma.invoice.findUnique({
      where: { id: invoiceId },
      include: { items: true },
    });
    if (!invoice) return;

    const entries = [];

    // 1. Debit: Accounts Receivable (الذمم المدينة)
    entries.push({
      entryNumber: generateEntryNumber(),
      description: `فاتورة مبيعات #${invoice.invoiceNumber}`,
      reference: invoice.invoiceNumber,
      debitAmount: invoice.total,
      creditAmount: 0,
      tenantId,
      date: invoice.issueDate,
    });

    // 2. Credit: Revenue (الإيرادات)
    entries.push({
      entryNumber: generateEntryNumber(),
      description: `إيراد فاتورة #${invoice.invoiceNumber}`,
      reference: invoice.invoiceNumber,
      debitAmount: 0,
      creditAmount: invoice.subtotal,
      tenantId,
      date: invoice.issueDate,
    });

    // 3. Credit: VAT Payable (ضريبة القيمة المضافة)
    if (invoice.taxAmount > 0) {
      entries.push({
        entryNumber: generateEntryNumber(),
        description: `ضريبة فاتورة #${invoice.invoiceNumber}`,
        reference: invoice.invoiceNumber,
        debitAmount: 0,
        creditAmount: invoice.taxAmount,
        tenantId,
        date: invoice.issueDate,
      });
    }

    await prisma.journalEntry.createMany({ data: entries });
  }

  // ─── قيد عند دفع فاتورة ───
  async postPaymentJournal(paymentId: string, tenantId: string) {
    const payment = await prisma.payment.findUnique({ where: { id: paymentId } });
    if (!payment || payment.status !== 'COMPLETED') return;

    const entries = [];

    // 1. Debit: Bank (البنك)
    entries.push({
      entryNumber: generateEntryNumber(),
      description: `استلام دفع #${payment.reference || payment.id}`,
      reference: payment.reference,
      debitAmount: payment.amount,
      creditAmount: 0,
      tenantId,
      date: payment.paidAt || new Date(),
    });

    // 2. Credit: Accounts Receivable (الذمم المدينة)
    entries.push({
      entryNumber: generateEntryNumber(),
      description: `تصفية ذمم مدينة #${payment.reference || payment.id}`,
      reference: payment.reference,
      debitAmount: 0,
      creditAmount: payment.amount,
      tenantId,
      date: payment.paidAt || new Date(),
    });

    await prisma.journalEntry.createMany({ data: entries });
  }

  // ─── قيد عند مصروف ───
  async postExpenseJournal(expenseId: string, tenantId: string) {
    const expense = await prisma.expense.findUnique({ where: { id: expenseId } });
    if (!expense || expense.status !== 'APPROVED') return;

    const entries = [];

    // 1. Debit: Expense (المصروف)
    entries.push({
      entryNumber: generateEntryNumber(),
      description: `مصروف: ${expense.description}`,
      reference: expense.id,
      debitAmount: expense.amount,
      creditAmount: 0,
      tenantId,
      date: expense.incurredAt,
    });

    // 2. Credit: Bank or Accounts Payable
    entries.push({
      entryNumber: generateEntryNumber(),
      description: `دفع مصروف: ${expense.description}`,
      reference: expense.id,
      debitAmount: 0,
      creditAmount: expense.amount,
      tenantId,
      date: expense.incurredAt,
    });

    await prisma.journalEntry.createMany({ data: entries });
  }

  // ─── قيد عند بيع كاشير ───
  async postPosOrderJournal(orderId: string, tenantId: string) {
    const order = await prisma.posOrder.findUnique({
      where: { id: orderId },
      include: { payments: true },
    });
    if (!order || order.status !== 'COMPLETED') return;

    const entries = [];

    // 1. Debit: Cash/Bank (حسب طريقة الدفع)
    for (const payment of order.payments) {
      entries.push({
        entryNumber: generateEntryNumber(),
        description: `مبيعات كاشير #${order.orderNumber}`,
        reference: order.orderNumber,
        debitAmount: payment.amount,
        creditAmount: 0,
        tenantId,
        date: order.createdAt,
      });
    }

    // 2. Credit: Revenue
    entries.push({
      entryNumber: generateEntryNumber(),
      description: `إيراد مبيعات كاشير #${order.orderNumber}`,
      reference: order.orderNumber,
      debitAmount: 0,
      creditAmount: order.subtotal - order.discount,
      tenantId,
      date: order.createdAt,
    });

    // 3. Credit: VAT
    if (order.taxAmount > 0) {
      entries.push({
        entryNumber: generateEntryNumber(),
        description: `ضريبة مبيعات كاشير #${order.orderNumber}`,
        reference: order.orderNumber,
        debitAmount: 0,
        creditAmount: order.taxAmount,
        tenantId,
        date: order.createdAt,
      });
    }

    await prisma.journalEntry.createMany({ data: entries });
  }

  // ─── قيد عند حركة مخزون (شراء بضاعة) ───
  async postStockInJournal(movementId: string, tenantId: string) {
    const movement = await prisma.stockMovement.findUnique({
      where: { id: movementId },
      include: { product: true },
    });
    if (!movement || movement.type !== 'IN') return;

    const entries = [];

    // 1. Debit: Inventory (المخزون)
    entries.push({
      entryNumber: generateEntryNumber(),
      description: `شراء بضاعة: ${movement.product?.name || movement.productId}`,
      reference: movement.reference,
      debitAmount: movement.totalCost,
      creditAmount: 0,
      tenantId,
      date: movement.createdAt,
    });

    // 2. Credit: Accounts Payable (الموردين)
    entries.push({
      entryNumber: generateEntryNumber(),
      description: `التزام شراء بضاعة: ${movement.product?.name || movement.productId}`,
      reference: movement.reference,
      debitAmount: 0,
      creditAmount: movement.totalCost,
      tenantId,
      date: movement.createdAt,
    });

    await prisma.journalEntry.createMany({ data: entries });
  }

  // ─── قيد تكلفة البضاعة المباعة (COGS) ───
  async postCOGSJournal(productId: string, quantity: number, unitCost: number, tenantId: string, reference: string) {
    const totalCost = quantity * unitCost;
    const entries = [];

    // 1. Debit: COGS (تكلفة البضاعة المباعة)
    entries.push({
      entryNumber: generateEntryNumber(),
      description: `تكلفة بضاعة مباعة: ${reference}`,
      reference,
      debitAmount: totalCost,
      creditAmount: 0,
      tenantId,
      date: new Date(),
    });

    // 2. Credit: Inventory
    entries.push({
      entryNumber: generateEntryNumber(),
      description: `صرف مخزون: ${reference}`,
      reference,
      debitAmount: 0,
      creditAmount: totalCost,
      tenantId,
      date: new Date(),
    });

    await prisma.journalEntry.createMany({ data: entries });
  }
}
