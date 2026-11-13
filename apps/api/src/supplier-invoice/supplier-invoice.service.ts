import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PaymentMethod, Prisma, prisma, tenantWhere } from '@scc/database';
import { AccountMappingService } from '../accounting-core/account-mapping.service';
import { AccountingDualWriteService } from '../accounting-core/accounting-dual-write.service';
import { CurrencyAccountingService } from '../accounting-core/currency-accounting.service';

@Injectable()
export class SupplierInvoiceService {
  constructor(
    private readonly accountMapping: AccountMappingService,
    private readonly dualWrite: AccountingDualWriteService,
    private readonly currencyAccounting: CurrencyAccountingService,
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
      currency: string;
      exchangeRate: Prisma.Decimal | null;
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
    const fx = await this.currencyAccounting.resolveRateInTransaction(
      tx,
      tenantId,
      invoice.currency,
      invoice.issueDate,
      invoice.exchangeRate ?? undefined,
    );
    const baseTotal = this.currencyAccounting.convert(invoice.total, fx.exchangeRate);

    const lines: Array<{
      accountId: string;
      debitAmount?: Prisma.Decimal;
      creditAmount?: Prisma.Decimal;
      foreignDebitAmount?: Prisma.Decimal;
      foreignCreditAmount?: Prisma.Decimal;
      description: string;
    }> = debitLines.map((line) => ({
      accountId: line.accountId,
      debitAmount: this.currencyAccounting.convert(line.debitAmount, fx.exchangeRate),
      foreignDebitAmount: line.debitAmount,
      description: line.description,
    }));

    if (invoice.taxAmount.gt(0)) {
      lines.push({
        accountId: accounts.VAT_RECEIVABLE.id,
        debitAmount: this.currencyAccounting.convert(invoice.taxAmount, fx.exchangeRate),
        foreignDebitAmount: invoice.taxAmount,
        description: `Input VAT - ${invoice.invoiceNumber}`,
      });
    }

    const baseDebit = lines.reduce(
      (sum, line) => sum.add(line.debitAmount ?? 0),
      new Prisma.Decimal(0),
    );
    const roundingDifference = baseTotal.sub(baseDebit);
    if (!roundingDifference.isZero()) {
      const target = [...lines].reverse().find((line) => (line.debitAmount ?? new Prisma.Decimal(0)).gt(0));
      if (!target) throw new BadRequestException('Unable to balance supplier invoice FX rounding');
      target.debitAmount = (target.debitAmount ?? new Prisma.Decimal(0)).add(roundingDifference);
    }

    lines.push({
      accountId: accounts.ACCOUNTS_PAYABLE.id,
      creditAmount: baseTotal,
      foreignCreditAmount: invoice.total,
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
      transactionCurrency: fx.transactionCurrency,
      exchangeRate: fx.exchangeRate,
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
      const issueDate = invoiceData.issueDate ? new Date(invoiceData.issueDate) : new Date();
      if (Number.isNaN(issueDate.getTime())) throw new BadRequestException('Invalid supplier invoice date');
      const fx = await this.currencyAccounting.resolveRateInTransaction(
        tx,
        tenantId,
        invoiceData.currency || 'SAR',
        issueDate,
        invoiceData.exchangeRate,
      );
      const baseTotal = this.currencyAccounting.convert(total, fx.exchangeRate);

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
          issueDate,
          subtotal,
          taxAmount,
          total,
          currency: fx.transactionCurrency,
          exchangeRate: fx.exchangeRate,
          baseTotal,
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

      const paymentDate = data.paymentDate ? new Date(data.paymentDate) : new Date();
      if (Number.isNaN(paymentDate.getTime())) throw new BadRequestException('Invalid supplier payment date');

      const paymentCurrency = this.currencyAccounting.normalizeCurrency(
        data.currency || inv.currency || 'SAR',
      );
      const invoiceCurrency = this.currencyAccounting.normalizeCurrency(inv.currency || 'SAR');
      if (paymentCurrency !== invoiceCurrency) {
        throw new BadRequestException(
          `Supplier payment currency ${paymentCurrency} does not match invoice currency ${invoiceCurrency}`,
        );
      }

      const invoiceFx = await this.currencyAccounting.resolveRateInTransaction(
        tx,
        tenantId,
        invoiceCurrency,
        inv.issueDate,
        inv.exchangeRate ?? undefined,
      );
      const paymentFx = await this.currencyAccounting.resolveRateInTransaction(
        tx,
        tenantId,
        paymentCurrency,
        paymentDate,
        data.exchangeRate,
      );
      const basePayable = this.currencyAccounting.convert(amount, invoiceFx.exchangeRate);
      const baseSettlement = this.currencyAccounting.convert(amount, paymentFx.exchangeRate);
      const realizedDifference = baseSettlement.sub(basePayable);

      const payment = await tx.supplierPayment.create({
        data: {
          tenantId,
          supplierId: inv.supplierId,
          supplierInvoiceId: id,
          amount,
          currency: paymentFx.transactionCurrency,
          exchangeRate: paymentFx.exchangeRate,
          baseAmount: baseSettlement,
          realizedFxDifference: realizedDifference,
          method,
          reference: data.reference,
          paymentDate,
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
        const fxAccounts = realizedDifference.isZero()
          ? null
          : await this.currencyAccounting.resolveFxAccountsInTransaction(tx, tenantId);

        const lines: any[] = [
          {
            accountId: accounts.ACCOUNTS_PAYABLE.id,
            debitAmount: basePayable,
            foreignDebitAmount: amount,
            description: `Accounts payable settlement - ${inv.invoiceNumber}`,
          },
          {
            accountId: settlement.id,
            creditAmount: baseSettlement,
            foreignCreditAmount: amount,
            description: `Supplier settlement - ${inv.invoiceNumber}`,
          },
        ];

        if (realizedDifference.gt(0)) {
          lines.push({
            accountId: fxAccounts!.loss.id,
            debitAmount: realizedDifference,
            description: `Realized FX loss - ${inv.invoiceNumber}`,
          });
        } else if (realizedDifference.lt(0)) {
          lines.push({
            accountId: fxAccounts!.gain.id,
            creditAmount: realizedDifference.abs(),
            description: `Realized FX gain - ${inv.invoiceNumber}`,
          });
        }

        await this.dualWrite.postInTransaction(tx, {
          tenantId,
          entryNumber: `APPAY-${payment.id}`,
          date: payment.paymentDate,
          description: `Supplier payment ${inv.invoiceNumber}`,
          reference: payment.reference || payment.id,
          sourceType: 'SUPPLIER_PAYMENT',
          sourceId: payment.id,
          transactionCurrency: paymentFx.transactionCurrency,
          exchangeRate: paymentFx.exchangeRate,
          lines,
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
