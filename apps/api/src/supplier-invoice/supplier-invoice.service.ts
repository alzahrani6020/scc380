import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PaymentMethod, Prisma, prisma, tenantWhere } from '@scc/database';
import { AccountMappingService } from '../accounting-core/account-mapping.service';
import { AccountingDualWriteService } from '../accounting-core/accounting-dual-write.service';

@Injectable()
export class SupplierInvoiceService {
  constructor(
    private readonly accountMapping: AccountMappingService,
    private readonly dualWrite: AccountingDualWriteService,
  ) {}

  async findAll(tenantId: string, userRole: string) {
    const where = userRole === 'SUPER_ADMIN' ? {} : tenantWhere(tenantId);
    return prisma.supplierInvoice.findMany({
      where,
      include: { supplier: { select: { id: true, name: true, code: true } }, _count: { select: { payments: true } } },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(id: string, tenantId: string, userRole: string) {
    const where = userRole === 'SUPER_ADMIN' ? { id } : { id, tenantId };
    const inv = await prisma.supplierInvoice.findFirst({
      where,
      include: { supplier: true, items: true, payments: true },
    });
    if (!inv) throw new NotFoundException('فاتورة المورد غير موجودة');
    return inv;
  }

  private async validateSupplier(tx: Prisma.TransactionClient, tenantId: string, supplierId: string) {
    const supplier = await tx.supplier.findFirst({
      where: { id: supplierId, tenantId, isActive: true },
      select: { id: true },
    });
    if (!supplier) throw new BadRequestException('المورد غير موجود أو غير نشط لهذا المستأجر');
  }

  private groupDebitLines(items: Array<{ accountId?: string | null; total: Prisma.Decimal; description: string }>) {
    const grouped = new Map<string, { amount: Prisma.Decimal; descriptions: string[] }>();
    for (const item of items) {
      if (!item.accountId) {
        throw new BadRequestException(
          'كل بند في فاتورة المورد يحتاج accountId عند تفعيل الترحيل المحاسبي',
        );
      }
      const current = grouped.get(item.accountId) || {
        amount: new Prisma.Decimal(0),
        descriptions: [],
      };
      current.amount = current.amount.add(item.total);
      current.descriptions.push(item.description);
      grouped.set(item.accountId, current);
    }
    return [...grouped.entries()].map(([accountId, value]) => ({
      accountId,
      debitAmount: value.amount,
      description: value.descriptions.join(' / '),
    }));
  }

  private async postSupplierInvoiceInTransaction(
    tx: Prisma.TransactionClient,
    tenantId: string,
    invoice: {
      id: string;
      invoiceNumber: string;
      issueDate: Date;
      subtotal: Prisma.Decimal;
      taxAmount: Prisma.Decimal;
      total: Prisma.Decimal;
      status: string;
      items: Array<{
        accountId: string | null;
        total: Prisma.Decimal;
        description: string;
      }>;
    },
  ) {
    if (invoice.status === 'CANCELLED') return;
    const enabled = await this.accountMapping.isAutoPostingEnabledInTransaction(tx, tenantId);
    if (!enabled) return;

    const debitLines = this.groupDebitLines(invoice.items);
    const roles = [
      'ACCOUNTS_PAYABLE' as const,
      ...(invoice.taxAmount.gt(0) ? ['VAT_RECEIVABLE' as const] : []),
    ];
    const accounts = await this.accountMapping.resolveInTransaction(tx, tenantId, roles);

    const lines: Array<{
      accountId: string;
      debitAmount?: Prisma.Decimal;
      creditAmount?: Prisma.Decimal;
      description: string;
    }> = debitLines;

    if (invoice.taxAmount.gt(0)) {
      lines.push({
        accountId: accounts.VAT_RECEIVABLE.id,
        debitAmount: invoice.taxAmount,
        description: `Input VAT - ${invoice.invoiceNumber}`,
      });
    }

    lines.push({
      accountId: accounts.ACCOUNTS_PAYABLE.id,
      creditAmount: invoice.total,
      description: `Accounts payable - ${invoice.invoiceNumber}`,
    });

    await this.dualWrite.postInTransaction(tx, {
      tenantId,
      entryNumber: `AP-${invoice.id}`,
      date: invoice.issueDate,
      description: `Supplier invoice ${invoice.invoiceNumber}`,
      reference: invoice.invoiceNumber,
      sourceType: 'SUPPLIER_INVOICE',
      sourceId: invoice.id,
      lines,
    });
  }

  async create(tenantId: string, data: any) {
    if (!tenantId) throw new BadRequestException('Tenant is required');
    const { items, ...invoiceData } = data;
    if (!Array.isArray(items) || items.length === 0) {
      throw new BadRequestException('يجب إضافة بند واحد على الأقل للفاتورة');
    }

    const subtotal = items.reduce(
      (sum: number, item: any) => sum + Number(item.quantity) * Number(item.unitPrice),
      0,
    );
    const taxAmount = invoiceData.taxAmount ?? subtotal * 0.15;
    if (Number(taxAmount) < 0) throw new BadRequestException('قيمة الضريبة لا يمكن أن تكون سالبة');
    const total = subtotal + Number(taxAmount);

    return prisma.$transaction(async tx => {
      await this.validateSupplier(tx, tenantId, invoiceData.supplierId);

      const autoPosting = await this.accountMapping.isAutoPostingEnabledInTransaction(tx, tenantId);
      if (autoPosting) {
        for (const item of items) {
          if (!item.accountId) {
            throw new BadRequestException(
              'كل بند في فاتورة المورد يحتاج accountId عند تفعيل الترحيل المحاسبي',
            );
          }
        }
      }

      const invoice = await tx.supplierInvoice.create({
        data: {
          ...invoiceData,
          tenantId,
          subtotal,
          taxAmount,
          total,
          items: {
            create: items.map((item: any) => ({
              tenantId,
              description: item.description,
              quantity: Number(item.quantity),
              unitPrice: Number(item.unitPrice),
              total: Number(item.quantity) * Number(item.unitPrice),
              accountId: item.accountId || null,
            })),
          },
        },
        include: { items: true, supplier: true },
      });

      await this.postSupplierInvoiceInTransaction(tx, tenantId, invoice);
      return invoice;
    });
  }

  async addPayment(id: string, tenantId: string, userRole: string, data: any) {
    if (!tenantId) throw new BadRequestException('Tenant is required');

    return prisma.$transaction(async tx => {
      const inv = await tx.supplierInvoice.findFirst({
        where: { id, tenantId },
        include: { payments: true },
      });
      if (!inv) throw new NotFoundException('فاتورة المورد غير موجودة');
      if (inv.status === 'CANCELLED') {
        throw new BadRequestException('لا يمكن دفع فاتورة مورد ملغاة');
      }

      const amount = new Prisma.Decimal(data.amount);
      if (!amount.gt(0)) {
        throw new BadRequestException('قيمة الدفعة يجب أن تكون أكبر من صفر');
      }

      const currentPaid = inv.paidAmount;
      const remaining = inv.total.sub(currentPaid);
      if (amount.gt(remaining)) {
        throw new BadRequestException('قيمة الدفعة تتجاوز الرصيد المتبقي للفاتورة');
      }

      const method = (data.method || PaymentMethod.BANK_TRANSFER) as PaymentMethod;
      if (!Object.values(PaymentMethod).includes(method)) {
        throw new BadRequestException('طريقة دفع المورد غير مدعومة');
      }

      const payment = await tx.supplierPayment.create({
        data: {
          tenantId,
          supplierId: inv.supplierId,
          supplierInvoiceId: id,
          amount,
          method,
          reference: data.reference,
          paymentDate: data.paymentDate ? new Date(data.paymentDate) : new Date(),
          notes: data.notes,
        },
      });

      const totalPaid = currentPaid.add(amount);
      const status = totalPaid.equals(inv.total) ? 'PAID' : 'PARTIAL';
      await tx.supplierInvoice.update({
        where: { id },
        data: { paidAmount: totalPaid, status },
      });

      const enabled = await this.accountMapping.isAutoPostingEnabledInTransaction(tx, tenantId);
      if (enabled) {
        const invoiceJournal = await tx.journalEntryHeader.findFirst({
          where: { tenantId, sourceType: 'SUPPLIER_INVOICE', sourceId: id },
          select: { id: true },
        });
        if (!invoiceJournal) {
          throw new BadRequestException(
            'فاتورة المورد غير مرحّلة محاسبياً؛ رحّل الفاتورة قبل تسجيل الدفعة',
          );
        }

        const accounts = await this.accountMapping.resolveInTransaction(
          tx,
          tenantId,
          ['ACCOUNTS_PAYABLE'],
        );
        const settlement = await this.accountMapping.resolvePaymentAccountInTransaction(
          tx,
          tenantId,
          method,
        );

        await this.dualWrite.postInTransaction(tx, {
          tenantId,
          entryNumber: `APPAY-${payment.id}`,
          date: payment.paymentDate,
          description: `Supplier payment ${inv.invoiceNumber}`,
          reference: payment.reference || payment.id,
          sourceType: 'SUPPLIER_PAYMENT',
          sourceId: payment.id,
          lines: [
            {
              accountId: accounts.ACCOUNTS_PAYABLE.id,
              debitAmount: amount,
              description: `Accounts payable settlement - ${inv.invoiceNumber}`,
            },
            {
              accountId: settlement.id,
              creditAmount: amount,
              description: `Supplier settlement - ${inv.invoiceNumber}`,
            },
          ],
        });
      }

      return payment;
    });
  }

  async remove(id: string, tenantId: string, userRole: string) {
    const where = userRole === 'SUPER_ADMIN' ? { id } : { id, tenantId };
    const exists = await prisma.supplierInvoice.findFirst({
      where,
      include: { payments: { select: { id: true }, take: 1 } },
    });
    if (!exists) throw new NotFoundException('فاتورة المورد غير موجودة');

    const posted = await prisma.journalEntryHeader.findFirst({
      where: { tenantId: exists.tenantId, sourceType: 'SUPPLIER_INVOICE', sourceId: id },
      select: { id: true },
    });
    if (posted) {
      throw new ForbiddenException(
        'فاتورة المورد مُرحّلة محاسبياً — الحذف يتطلب عكساً/إشعاراً دائناً',
      );
    }
    if (exists.payments.length > 0 || Number(exists.paidAmount) > 0) {
      throw new BadRequestException('لا يمكن حذف فاتورة مورد عليها دفعات');
    }
    return prisma.supplierInvoice.delete({ where: { id } });
  }
}
