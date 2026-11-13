import { Injectable, NotFoundException, BadRequestException, ForbiddenException } from '@nestjs/common';
import { Prisma, prisma, withTenant } from '@scc/database';
import { AccountMappingService, AccountingRole } from '../accounting-core/account-mapping.service';
import { AccountingDualWriteService } from '../accounting-core/accounting-dual-write.service';
import { CurrencyAccountingService } from '../accounting-core/currency-accounting.service';

@Injectable()
export class InvoicesService {
  private readonly RETENTION_YEARS = 6;

  constructor(
    private readonly accountMapping: AccountMappingService,
    private readonly dualWrite: AccountingDualWriteService,
    private readonly currencyAccounting: CurrencyAccountingService,
  ) {}

  private async guardZatcaLocked(tenantId: string, id: string) {
    const invoice = await prisma.invoice.findFirst({
      where: withTenant({ id }, tenantId),
      select: { id: true, zatcaStatus: true, invoiceNumber: true, type: true, status: true },
    });
    if (!invoice) throw new NotFoundException('الفاتورة غير موجودة');
    if (invoice.zatcaStatus === 'CLEARED' || invoice.zatcaStatus === 'REPORTED') {
      throw new ForbiddenException('الفاتورة مُبلَّغة لـ ZATCA — لا يمكن التعديل أو الحذف');
    }
    return invoice;
  }

  private async validateInvoiceSeries(tenantId: string, invoiceNumber: string, excludeId?: string) {
    const tenant = await prisma.tenant.findUnique({ where: { id: tenantId }, select: { settings: true } });
    const settings = (tenant?.settings || {}) as Record<string, any>;
    const series = settings.invoiceSeries as string | undefined;

    if (series && !invoiceNumber.startsWith(series)) {
      throw new BadRequestException(`رقم الفاتورة يجب أن يبدأ بالسلسلة "${series}"`);
    }

    const existing = await prisma.invoice.findFirst({
      where: withTenant({ invoiceNumber, NOT: excludeId ? { id: excludeId } : undefined }, tenantId),
    });
    if (existing) {
      throw new BadRequestException('رقم الفاتورة مستخدم مسبقاً');
    }
  }

  private enforceServerTimestamp(data: any) {
    const now = new Date();
    return {
      ...data,
      issueDate: now,
      createdAt: now,
    };
  }

  private isPostingEligible(invoice: { type: string; status: string }) {
    return (
      invoice.type === 'STANDARD' &&
      !['DRAFT', 'CANCELLED'].includes(invoice.status)
    );
  }

  private async postInvoiceInTransaction(
    tx: Prisma.TransactionClient,
    tenantId: string,
    invoice: {
      id: string;
      invoiceNumber: string;
      issueDate: Date;
      type: string;
      status: string;
      subtotal: Prisma.Decimal;
      discount: Prisma.Decimal | null;
      taxAmount: Prisma.Decimal;
      total: Prisma.Decimal;
      currency: string | null;
      exchangeRate: Prisma.Decimal | null;
    },
  ) {
    if (!this.isPostingEligible(invoice)) return;

    const enabled = await this.accountMapping.isAutoPostingEnabledInTransaction(tx, tenantId);
    if (!enabled) return;

    const roles: AccountingRole[] = [
      'ACCOUNTS_RECEIVABLE',
      'SALES_REVENUE',
      ...(invoice.taxAmount.gt(0) ? ['VAT_PAYABLE' as const] : []),
    ];
    const accounts = await this.accountMapping.resolveInTransaction(tx, tenantId, roles);

    const revenueAmount = invoice.subtotal.sub(invoice.discount ?? new Prisma.Decimal(0));
    if (invoice.total.lte(0) || revenueAmount.lt(0)) {
      throw new BadRequestException('Invoice accounting amounts must be positive');
    }
    if (!invoice.total.equals(revenueAmount.add(invoice.taxAmount))) {
      throw new BadRequestException('Invoice total must equal net revenue plus tax');
    }

    const fx = await this.currencyAccounting.resolveRateInTransaction(
      tx,
      tenantId,
      invoice.currency || 'SAR',
      invoice.issueDate,
      invoice.exchangeRate ?? undefined,
    );
    const baseTotal = this.currencyAccounting.convert(invoice.total, fx.exchangeRate);
    const baseTax = this.currencyAccounting.convert(invoice.taxAmount, fx.exchangeRate);
    const baseRevenue = baseTotal.sub(baseTax);

    const lines: Array<{
      accountId: string;
      debitAmount?: Prisma.Decimal;
      creditAmount?: Prisma.Decimal;
      foreignDebitAmount?: Prisma.Decimal;
      foreignCreditAmount?: Prisma.Decimal;
      description: string;
    }> = [
      {
        accountId: accounts.ACCOUNTS_RECEIVABLE.id,
        debitAmount: baseTotal,
        foreignDebitAmount: invoice.total,
        description: `Accounts receivable - ${invoice.invoiceNumber}`,
      },
    ];

    if (revenueAmount.gt(0)) {
      lines.push({
        accountId: accounts.SALES_REVENUE.id,
        creditAmount: baseRevenue,
        foreignCreditAmount: revenueAmount,
        description: `Sales revenue - ${invoice.invoiceNumber}`,
      });
    }
    if (invoice.taxAmount.gt(0)) {
      lines.push({
        accountId: accounts.VAT_PAYABLE.id,
        creditAmount: baseTax,
        foreignCreditAmount: invoice.taxAmount,
        description: `VAT payable - ${invoice.invoiceNumber}`,
      });
    }

    await this.dualWrite.postInTransaction(tx, {
      tenantId,
      entryNumber: `INV-${invoice.id}`,
      date: invoice.issueDate,
      description: `Sales invoice ${invoice.invoiceNumber}`,
      reference: invoice.invoiceNumber,
      sourceType: 'INVOICE',
      sourceId: invoice.id,
      transactionCurrency: fx.transactionCurrency,
      exchangeRate: fx.exchangeRate,
      lines,
    });
  }

  async findAll(tenantId: string, filters?: { status?: string; search?: string }) {
    const where = withTenant({}, tenantId);
    if (filters?.status) where.status = filters.status;
    if (filters?.search) {
      where.OR = [
        { invoiceNumber: { contains: filters.search, mode: 'insensitive' } },
        { notes: { contains: filters.search, mode: 'insensitive' } },
      ];
    }
    return prisma.invoice.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: { items: true },
    });
  }

  async findOne(tenantId: string, id: string) {
    const invoice = await prisma.invoice.findFirst({
      where: withTenant({ id }, tenantId),
      include: { items: true },
    });
    if (!invoice) throw new NotFoundException('الفاتورة غير موجودة');
    return invoice;
  }

  async create(tenantId: string, data: any) {
    const { items, ...invoiceData } = data;
    await this.validateInvoiceSeries(tenantId, invoiceData.invoiceNumber);

    const lockedData = this.enforceServerTimestamp(invoiceData);
    const retentionUntil = new Date();
    retentionUntil.setFullYear(retentionUntil.getFullYear() + this.RETENTION_YEARS);

    return prisma.$transaction(async tx => {
      const fx = await this.currencyAccounting.resolveRateInTransaction(
        tx,
        tenantId,
        lockedData.currency || 'SAR',
        lockedData.issueDate,
        lockedData.exchangeRate,
      );
      const baseTotal = this.currencyAccounting.convert(lockedData.total, fx.exchangeRate);

      const invoice = await tx.invoice.create({
        data: {
          ...lockedData,
          tenantId,
          currency: fx.transactionCurrency,
          exchangeRate: fx.exchangeRate,
          baseTotal,
          retentionUntil,
          items: items?.length ? { create: items.map((item: any) => ({ ...item, tenantId })) } : undefined,
        },
        include: { items: true },
      });

      await this.postInvoiceInTransaction(tx, tenantId, invoice);
      return invoice;
    });
  }

  async update(tenantId: string, id: string, data: any) {
    const invoice = await this.guardZatcaLocked(tenantId, id);

    if (data.invoiceNumber && data.invoiceNumber !== invoice.invoiceNumber) {
      await this.validateInvoiceSeries(tenantId, data.invoiceNumber, id);
    }

    if (data.issueDate || data.createdAt) {
      throw new ForbiddenException('تغيير تاريخ الفاتورة محظور — يتم تحديده تلقائياً من الخادم');
    }

    const postedJournal = await prisma.journalEntryHeader.findFirst({
      where: { tenantId, sourceType: 'INVOICE', sourceId: id },
      select: { id: true },
    });
    if (postedJournal) {
      const lockedFields = [
        'invoiceNumber',
        'type',
        'subtotal',
        'taxRate',
        'taxAmount',
        'discount',
        'total',
        'currency',
        'exchangeRate',
        'baseTotal',
      ];
      const changedLockedField = lockedFields.find(field =>
        Object.prototype.hasOwnProperty.call(data, field),
      );
      if (changedLockedField) {
        throw new ForbiddenException(
          `الفاتورة مُرحّلة محاسبياً — لا يمكن تعديل الحقل ${changedLockedField}; استخدم مستند تصحيح/عكس`,
        );
      }
      if (data.status === 'CANCELLED') {
        throw new ForbiddenException(
          'الفاتورة مُرحّلة محاسبياً — الإلغاء يتطلب مستند عكس/إشعار دائن',
        );
      }
    }

    const wasEligible = this.isPostingEligible(invoice);

    return prisma.$transaction(async tx => {
      const updated = await tx.invoice.update({
        where: { id },
        data,
        include: { items: true },
      });

      if (!wasEligible && this.isPostingEligible(updated)) {
        await this.postInvoiceInTransaction(tx, tenantId, updated);
      }

      return updated;
    });
  }

  async delete(tenantId: string, id: string) {
    await this.guardZatcaLocked(tenantId, id);
    return prisma.invoice.delete({ where: { id } });
  }
}
