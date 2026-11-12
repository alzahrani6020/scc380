import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PaymentMethod, Prisma, prisma, tenantWhere } from '@scc/database';
import { AccountMappingService } from '../accounting-core/account-mapping.service';
import { AccountingDualWriteService } from '../accounting-core/accounting-dual-write.service';

@Injectable()
export class PaymentsService {
  constructor(
    private readonly accountMapping: AccountMappingService,
    private readonly dualWrite: AccountingDualWriteService,
  ) {}

  async findAll(req: any, query: any) {
    const where: any = { ...tenantWhere(req.user?.tenantId) };
    if (query.invoiceId) where.invoiceId = query.invoiceId;
    if (query.status) where.status = query.status;
    const [data, count] = await Promise.all([
      prisma.payment.findMany({ where, orderBy: { paidAt: 'desc' }, take: 200 }),
      prisma.payment.count({ where }),
    ]);
    return { data, count };
  }

  async findOne(req: any, id: string) {
    const where = { ...tenantWhere(req.user?.tenantId), id };
    const item = await prisma.payment.findFirst({ where });
    if (!item) throw new NotFoundException('Payment not found');
    return item;
  }

  private async loadInvoiceForSettlement(
    tx: Prisma.TransactionClient,
    tenantId: string,
    invoiceId: string,
  ) {
    const invoice = await tx.invoice.findFirst({
      where: { id: invoiceId, tenantId },
      select: {
        id: true,
        invoiceNumber: true,
        type: true,
        status: true,
        total: true,
        currency: true,
      },
    });
    if (!invoice) throw new BadRequestException('Invoice not found for tenant');
    if (invoice.type !== 'STANDARD') {
      throw new BadRequestException('Payments can only settle STANDARD invoices');
    }
    if (['DRAFT', 'CANCELLED'].includes(invoice.status)) {
      throw new BadRequestException(`Invoice status ${invoice.status} cannot accept settlement`);
    }
    return invoice;
  }

  private async priorCompletedAmount(
    tx: Prisma.TransactionClient,
    tenantId: string,
    invoiceId: string,
    excludePaymentId?: string,
  ) {
    const aggregate = await tx.payment.aggregate({
      _sum: { amount: true },
      where: {
        tenantId,
        invoiceId,
        status: 'COMPLETED',
        ...(excludePaymentId ? { NOT: { id: excludePaymentId } } : {}),
      },
    });
    return aggregate._sum.amount ?? new Prisma.Decimal(0);
  }

  private async applyCompletedPayment(
    tx: Prisma.TransactionClient,
    tenantId: string,
    payment: {
      id: string;
      invoiceId: string | null;
      amount: Prisma.Decimal;
      currency: string | null;
      method: PaymentMethod;
      status: string;
      reference: string | null;
      paidAt: Date;
    },
    excludePaymentId?: string,
  ) {
    if (payment.status !== 'COMPLETED') return;

    const autoPosting = await this.accountMapping.isAutoPostingEnabledInTransaction(tx, tenantId);
    if (!payment.invoiceId) {
      if (autoPosting) {
        throw new BadRequestException(
          'Completed auto-posting payment requires invoiceId for a known counter-account',
        );
      }
      return;
    }

    const invoice = await this.loadInvoiceForSettlement(tx, tenantId, payment.invoiceId);
    const invoiceCurrency = invoice.currency || 'SAR';
    const paymentCurrency = payment.currency || 'SAR';
    if (paymentCurrency !== invoiceCurrency) {
      throw new BadRequestException(
        `Payment currency ${paymentCurrency} does not match invoice currency ${invoiceCurrency}`,
      );
    }
    if (payment.amount.lte(0)) {
      throw new BadRequestException('Payment amount must be greater than zero');
    }

    const priorPaid = await this.priorCompletedAmount(
      tx,
      tenantId,
      invoice.id,
      excludePaymentId,
    );
    const newPaid = priorPaid.add(payment.amount);
    if (newPaid.gt(invoice.total)) {
      throw new BadRequestException('Payment exceeds invoice outstanding balance');
    }

    await tx.invoice.update({
      where: { id: invoice.id },
      data: {
        paidAmount: newPaid,
        status: newPaid.equals(invoice.total) ? 'PAID' : 'PARTIAL',
        ...(newPaid.equals(invoice.total) ? { paidAt: payment.paidAt } : {}),
      },
    });

    if (!autoPosting) return;

    const invoiceJournal = await tx.journalEntryHeader.findFirst({
      where: { tenantId, sourceType: 'INVOICE', sourceId: invoice.id },
      select: { id: true },
    });
    if (!invoiceJournal) {
      throw new ConflictException(
        'Invoice has no posted accounting journal; backfill invoice before payment posting',
      );
    }

    const accounts = await this.accountMapping.resolveInTransaction(
      tx,
      tenantId,
      ['ACCOUNTS_RECEIVABLE'],
    );
    const settlementAccount = await this.accountMapping.resolvePaymentAccountInTransaction(
      tx,
      tenantId,
      payment.method,
    );

    await this.dualWrite.postInTransaction(tx, {
      tenantId,
      entryNumber: `PAY-${payment.id}`,
      date: payment.paidAt,
      description: `Customer payment for invoice ${invoice.invoiceNumber}`,
      reference: payment.reference || payment.id,
      sourceType: 'PAYMENT',
      sourceId: payment.id,
      lines: [
        {
          accountId: settlementAccount.id,
          debitAmount: payment.amount,
          description: `Settlement received - ${invoice.invoiceNumber}`,
        },
        {
          accountId: accounts.ACCOUNTS_RECEIVABLE.id,
          creditAmount: payment.amount,
          description: `Accounts receivable settlement - ${invoice.invoiceNumber}`,
        },
      ],
    });
  }

  async create(req: any, dto: any) {
    const tenantId = req.user?.tenantId;
    if (!tenantId) throw new BadRequestException('Tenant is required');

    const data: any = { ...dto, tenantId };
    if (dto.paidAt) data.paidAt = new Date(dto.paidAt);

    return prisma.$transaction(async tx => {
      const payment = await tx.payment.create({ data });
      await this.applyCompletedPayment(tx, tenantId, payment);
      return payment;
    });
  }

  async update(req: any, id: string, dto: any) {
    const tenantId = req.user?.tenantId;
    const where = { ...tenantWhere(tenantId), id };
    const existing = await prisma.payment.findFirst({ where });
    if (!existing) throw new NotFoundException('Payment not found');

    const postedJournal = await prisma.journalEntryHeader.findFirst({
      where: { tenantId, sourceType: 'PAYMENT', sourceId: id },
      select: { id: true },
    });
    if (postedJournal) {
      const lockedFields = [
        'invoiceId',
        'amount',
        'currency',
        'method',
        'reference',
        'paidAt',
        'status',
      ];
      const changed = lockedFields.find(field =>
        Object.prototype.hasOwnProperty.call(dto, field),
      );
      if (changed) {
        throw new ForbiddenException(
          `Payment is posted; field ${changed} requires a reversal/refund flow`,
        );
      }
    }

    if (
      existing.status === 'COMPLETED' &&
      dto.status &&
      dto.status !== existing.status
    ) {
      throw new ForbiddenException(
        'Completed payment cannot change status directly; use reversal/refund flow',
      );
    }

    const data: any = { ...dto };
    if (dto.paidAt) data.paidAt = new Date(dto.paidAt);
    const becomesCompleted =
      existing.status !== 'COMPLETED' &&
      (dto.status === 'COMPLETED');

    return prisma.$transaction(async tx => {
      const updated = await tx.payment.update({ where: { id }, data });
      if (becomesCompleted) {
        await this.applyCompletedPayment(tx, tenantId, updated, id);
      }
      return updated;
    });
  }

  async remove(req: any, id: string) {
    const tenantId = req.user?.tenantId;
    const where = { ...tenantWhere(tenantId), id };
    const existing = await prisma.payment.findFirst({ where });
    if (!existing) throw new NotFoundException('Payment not found');

    if (existing.status === 'COMPLETED') {
      throw new ForbiddenException(
        'Completed payment cannot be deleted; use reversal/refund flow',
      );
    }
    const postedJournal = await prisma.journalEntryHeader.findFirst({
      where: { tenantId, sourceType: 'PAYMENT', sourceId: id },
      select: { id: true },
    });
    if (postedJournal) {
      throw new ForbiddenException(
        'Posted payment cannot be deleted; use reversal/refund flow',
      );
    }

    return prisma.payment.delete({ where: { id } });
  }
}
