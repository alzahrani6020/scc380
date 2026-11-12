import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, prisma, tenantWhere } from '@scc/database';
import { AccountMappingService } from '../accounting-core/account-mapping.service';
import { AccountingDualWriteService } from '../accounting-core/accounting-dual-write.service';

@Injectable()
export class ExpensesService {
  constructor(
    private readonly accountMapping: AccountMappingService,
    private readonly dualWrite: AccountingDualWriteService,
  ) {}

  async findAll(req: any, query: any) {
    const where: any = { ...tenantWhere(req.user?.tenantId) };
    if (query.category) where.category = query.category;
    if (query.status) where.status = query.status;
    const [data, count] = await Promise.all([
      prisma.expense.findMany({ where, orderBy: { incurredAt: 'desc' }, take: 200 }),
      prisma.expense.count({ where }),
    ]);
    return { data, count };
  }

  async findOne(req: any, id: string) {
    const where = { ...tenantWhere(req.user?.tenantId), id };
    const item = await prisma.expense.findFirst({ where });
    if (!item) throw new NotFoundException('Expense not found');
    return item;
  }

  private async postExpenseInTransaction(
    tx: Prisma.TransactionClient,
    tenantId: string,
    expense: {
      id: string;
      amount: Prisma.Decimal;
      description: string;
      incurredAt: Date;
      status: string;
      debitAccountId: string | null;
      creditAccountId: string | null;
    },
  ) {
    if (expense.status !== 'APPROVED') return;

    const enabled = await this.accountMapping.isAutoPostingEnabledInTransaction(tx, tenantId);
    if (!enabled) return;

    if (!expense.debitAccountId || !expense.creditAccountId) {
      throw new BadRequestException(
        'Approved expense requires debitAccountId and creditAccountId when auto-posting is enabled',
      );
    }
    if (expense.debitAccountId === expense.creditAccountId) {
      throw new BadRequestException('Expense debit and credit accounts must be different');
    }
    if (!expense.amount.gt(0)) {
      throw new BadRequestException('Expense amount must be greater than zero');
    }

    await this.dualWrite.postInTransaction(tx, {
      tenantId,
      entryNumber: `EXP-${expense.id}`,
      date: expense.incurredAt,
      description: `Expense: ${expense.description}`,
      reference: expense.id,
      sourceType: 'EXPENSE',
      sourceId: expense.id,
      lines: [
        {
          accountId: expense.debitAccountId,
          debitAmount: expense.amount,
          description: expense.description,
        },
        {
          accountId: expense.creditAccountId,
          creditAmount: expense.amount,
          description: expense.description,
        },
      ],
    });
  }

  async create(req: any, dto: any) {
    const tenantId = req.user?.tenantId;
    if (!tenantId) throw new BadRequestException('Tenant is required');

    const data: any = { ...dto, tenantId };
    if (dto.incurredAt) data.incurredAt = new Date(dto.incurredAt);

    return prisma.$transaction(async tx => {
      const expense = await tx.expense.create({ data });
      await this.postExpenseInTransaction(tx, tenantId, expense);
      return expense;
    });
  }

  async update(req: any, id: string, dto: any) {
    const tenantId = req.user?.tenantId;
    const where = { ...tenantWhere(tenantId), id };
    const existing = await prisma.expense.findFirst({ where });
    if (!existing) throw new NotFoundException('Expense not found');

    const posted = await prisma.journalEntryHeader.findFirst({
      where: { tenantId, sourceType: 'EXPENSE', sourceId: id },
      select: { id: true },
    });
    if (posted) {
      const lockedFields = [
        'category',
        'amount',
        'currency',
        'description',
        'incurredAt',
        'debitAccountId',
        'creditAccountId',
        'status',
      ];
      const changed = lockedFields.find(field =>
        Object.prototype.hasOwnProperty.call(dto, field),
      );
      if (changed) {
        throw new ForbiddenException(
          `Expense is posted; field ${changed} requires reversal/adjustment flow`,
        );
      }
    }

    const data: any = { ...dto };
    if (dto.incurredAt) data.incurredAt = new Date(dto.incurredAt);
    const wasApproved = existing.status === 'APPROVED';

    return prisma.$transaction(async tx => {
      const updated = await tx.expense.update({ where: { id }, data });
      if (!wasApproved && updated.status === 'APPROVED') {
        await this.postExpenseInTransaction(tx, tenantId, updated);
      }
      return updated;
    });
  }

  async remove(req: any, id: string) {
    const tenantId = req.user?.tenantId;
    const where = { ...tenantWhere(tenantId), id };
    const existing = await prisma.expense.findFirst({ where });
    if (!existing) throw new NotFoundException('Expense not found');

    const posted = await prisma.journalEntryHeader.findFirst({
      where: { tenantId, sourceType: 'EXPENSE', sourceId: id },
      select: { id: true },
    });
    if (posted) {
      throw new ForbiddenException(
        'Posted expense cannot be deleted; use reversal/adjustment flow',
      );
    }
    return prisma.expense.delete({ where: { id } });
  }
}
