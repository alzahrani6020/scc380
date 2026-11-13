import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import {
  AccountingScheduleFrequency,
  AccountingScheduleKind,
  AccountingScheduleStatus,
  JournalType,
  Prisma,
  prisma,
} from '@scc/database';
import { AccountingPostingService } from '../accounting-core/accounting-posting.service';

type ScheduleLineInput = {
  accountId: string;
  debitAmount?: Prisma.Decimal.Value;
  creditAmount?: Prisma.Decimal.Value;
  description?: string;
  costCenterId?: string;
  projectId?: string;
  branchId?: string;
};

type ScheduleInput = {
  name: string;
  kind: AccountingScheduleKind;
  frequency: AccountingScheduleFrequency;
  startDate: string | Date;
  endDate?: string | Date | null;
  autoReverse?: boolean;
  reverseAfterDays?: number;
  entryPrefix: string;
  description: string;
  lines: ScheduleLineInput[];
};

@Injectable()
export class AccountingSchedulesService {
  private readonly logger = new Logger(AccountingSchedulesService.name);

  constructor(private readonly posting: AccountingPostingService) {}

  private asDate(value: string | Date, label: string) {
    const date = value instanceof Date ? new Date(value) : new Date(value);
    if (Number.isNaN(date.getTime())) throw new BadRequestException(`Invalid ${label}`);
    date.setUTCHours(0, 0, 0, 0);
    return date;
  }

  private normalizePrefix(value: string) {
    const prefix = String(value || '').trim().toUpperCase();
    if (!/^[A-Z0-9-]{2,24}$/.test(prefix)) {
      throw new BadRequestException('Entry prefix must be 2-24 characters using A-Z, 0-9, or hyphen');
    }
    return prefix;
  }

  private validateAmounts(lines: ScheduleLineInput[]) {
    if (!Array.isArray(lines) || lines.length < 2) {
      throw new BadRequestException('Accounting schedule requires at least two lines');
    }

    let debit = new Prisma.Decimal(0);
    let credit = new Prisma.Decimal(0);
    for (const [index, line] of lines.entries()) {
      const dr = new Prisma.Decimal(line.debitAmount ?? 0);
      const cr = new Prisma.Decimal(line.creditAmount ?? 0);
      if (dr.isNegative() || cr.isNegative()) {
        throw new BadRequestException(`Line ${index + 1}: debit and credit cannot be negative`);
      }
      if (dr.gt(0) === cr.gt(0)) {
        throw new BadRequestException(`Line ${index + 1}: exactly one side must be positive`);
      }
      debit = debit.add(dr);
      credit = credit.add(cr);
    }
    if (!debit.equals(credit)) {
      throw new BadRequestException(
        `Schedule is not balanced: debit=${debit.toFixed(2)} credit=${credit.toFixed(2)}`,
      );
    }
  }

  private async validateReferences(
    tx: Prisma.TransactionClient,
    tenantId: string,
    lines: ScheduleLineInput[],
  ) {
    const accountIds = [...new Set(lines.map(line => line.accountId).filter(Boolean))];
    const accounts = await tx.chartOfAccount.findMany({
      where: { tenantId, id: { in: accountIds }, isActive: true },
      select: { id: true },
    });
    if (accounts.length !== accountIds.length) {
      throw new BadRequestException('One or more schedule accounts are missing, inactive, or outside tenant');
    }

    const dimensions: Array<{
      ids: string[];
      load: (ids: string[]) => Promise<{ id: string }[]>;
      label: string;
    }> = [
      {
        ids: [...new Set(lines.map(line => line.costCenterId).filter((v): v is string => Boolean(v)))],
        load: ids =>
          tx.costCenter.findMany({
            where: { tenantId, id: { in: ids }, isActive: true },
            select: { id: true },
          }),
        label: 'cost center',
      },
      {
        ids: [...new Set(lines.map(line => line.projectId).filter((v): v is string => Boolean(v)))],
        load: ids =>
          tx.project.findMany({
            where: { tenantId, id: { in: ids } },
            select: { id: true },
          }),
        label: 'project',
      },
      {
        ids: [...new Set(lines.map(line => line.branchId).filter((v): v is string => Boolean(v)))],
        load: ids =>
          tx.branch.findMany({
            where: { tenantId, id: { in: ids }, isActive: true },
            select: { id: true },
          }),
        label: 'branch',
      },
    ];

    for (const dimension of dimensions) {
      if (dimension.ids.length === 0) continue;
      const found = await dimension.load(dimension.ids);
      if (found.length !== dimension.ids.length) {
        throw new BadRequestException(`One or more schedule ${dimension.label} references are invalid`);
      }
    }
  }

  private advance(date: Date, frequency: AccountingScheduleFrequency, anchorDay: number) {
    const months =
      frequency === AccountingScheduleFrequency.MONTHLY
        ? 1
        : frequency === AccountingScheduleFrequency.QUARTERLY
          ? 3
          : 12;
    const originalDay = anchorDay;
    const targetIndex = date.getUTCFullYear() * 12 + date.getUTCMonth() + months;
    const targetYear = Math.floor(targetIndex / 12);
    const targetMonth = targetIndex % 12;
    const lastDay = new Date(Date.UTC(targetYear, targetMonth + 1, 0)).getUTCDate();
    return new Date(
      Date.UTC(targetYear, targetMonth, Math.min(originalDay, lastDay), 12, 0, 0, 0),
    );
  }

  private nextStatus(nextRunDate: Date, endDate: Date | null) {
    return endDate && nextRunDate > endDate
      ? AccountingScheduleStatus.COMPLETED
      : AccountingScheduleStatus.ACTIVE;
  }

  private effectiveAutoReverse(kind: AccountingScheduleKind, requested?: boolean) {
    if (kind === AccountingScheduleKind.ACCRUAL) return true;
    if (kind === AccountingScheduleKind.PREPAID) return false;
    return Boolean(requested);
  }

  async list(tenantId: string, query: any = {}) {
    if (!tenantId) throw new BadRequestException('Tenant is required');
    const where: any = { tenantId };
    if (query.kind) where.kind = query.kind;
    if (query.status) where.status = query.status;
    return prisma.accountingSchedule.findMany({
      where,
      include: {
        lines: { orderBy: { lineNumber: 'asc' } },
        runs: { orderBy: { scheduledDate: 'desc' }, take: 12 },
      },
      orderBy: [{ status: 'asc' }, { nextRunDate: 'asc' }],
    });
  }

  async listRuns(tenantId: string, scheduleId?: string) {
    if (!tenantId) throw new BadRequestException('Tenant is required');
    return prisma.accountingScheduleRun.findMany({
      where: { tenantId, ...(scheduleId ? { scheduleId } : {}) },
      include: { schedule: { select: { name: true, kind: true, entryPrefix: true } } },
      orderBy: { scheduledDate: 'desc' },
      take: 200,
    });
  }

  async get(tenantId: string, id: string) {
    const item = await prisma.accountingSchedule.findFirst({
      where: { id, tenantId },
      include: {
        lines: { orderBy: { lineNumber: 'asc' } },
        runs: { orderBy: { scheduledDate: 'desc' }, take: 50 },
      },
    });
    if (!item) throw new NotFoundException('Accounting schedule not found');
    return item;
  }

  async create(tenantId: string, userId: string | undefined, input: ScheduleInput) {
    if (!tenantId) throw new BadRequestException('Tenant is required');
    this.validateAmounts(input.lines);

    const startDate = this.asDate(input.startDate, 'startDate');
    const endDate = input.endDate ? this.asDate(input.endDate, 'endDate') : null;
    if (endDate && endDate < startDate) {
      throw new BadRequestException('Schedule end date must be on or after start date');
    }
    const reverseAfterDays = Number(input.reverseAfterDays ?? 1);
    if (!Number.isInteger(reverseAfterDays) || reverseAfterDays < 1 || reverseAfterDays > 31) {
      throw new BadRequestException('reverseAfterDays must be an integer between 1 and 31');
    }

    const prefix = this.normalizePrefix(input.entryPrefix);
    if (!String(input.name || '').trim()) throw new BadRequestException('Schedule name is required');
    if (!String(input.description || '').trim()) throw new BadRequestException('Schedule description is required');
    return prisma.$transaction(async tx => {
      await this.validateReferences(tx, tenantId, input.lines);
      return tx.accountingSchedule.create({
        data: {
          tenantId,
          name: String(input.name || '').trim(),
          kind: input.kind,
          frequency: input.frequency,
          startDate,
          endDate,
          nextRunDate: startDate,
          anchorDay: startDate.getUTCDate(),
          autoReverse: this.effectiveAutoReverse(input.kind, input.autoReverse),
          reverseAfterDays,
          entryPrefix: prefix,
          description: String(input.description || '').trim(),
          createdBy: userId || null,
          lines: {
            create: input.lines.map((line, index) => ({
              lineNumber: index + 1,
              accountId: line.accountId,
              debitAmount: new Prisma.Decimal(line.debitAmount ?? 0),
              creditAmount: new Prisma.Decimal(line.creditAmount ?? 0),
              description: line.description,
              costCenterId: line.costCenterId,
              projectId: line.projectId,
              branchId: line.branchId,
            })),
          },
        },
        include: { lines: { orderBy: { lineNumber: 'asc' } } },
      });
    });
  }

  async update(tenantId: string, id: string, input: Partial<ScheduleInput>) {
    const current = await this.get(tenantId, id);
    const lines = input.lines ?? current.lines.map(line => ({
      accountId: line.accountId,
      debitAmount: line.debitAmount,
      creditAmount: line.creditAmount,
      description: line.description || undefined,
      costCenterId: line.costCenterId || undefined,
      projectId: line.projectId || undefined,
      branchId: line.branchId || undefined,
    }));
    this.validateAmounts(lines);

    if (input.startDate && current.runs.length > 0) {
      throw new ConflictException('Start date cannot be changed after the schedule has posting history');
    }
    const startDate = input.startDate ? this.asDate(input.startDate, 'startDate') : current.startDate;
    const endDate =
      input.endDate === null
        ? null
        : input.endDate
          ? this.asDate(input.endDate, 'endDate')
          : current.endDate;
    if (endDate && endDate < startDate) {
      throw new BadRequestException('Schedule end date must be on or after start date');
    }

    const kind = input.kind ?? current.kind;
    const frequency = input.frequency ?? current.frequency;
    const reverseAfterDays = Number(input.reverseAfterDays ?? current.reverseAfterDays);
    if (!Number.isInteger(reverseAfterDays) || reverseAfterDays < 1 || reverseAfterDays > 31) {
      throw new BadRequestException('reverseAfterDays must be an integer between 1 and 31');
    }

    return prisma.$transaction(async tx => {
      await this.validateReferences(tx, tenantId, lines);
      if (input.lines) {
        await tx.accountingScheduleLine.deleteMany({ where: { scheduleId: id } });
      }

      return tx.accountingSchedule.update({
        where: { id },
        data: {
          name: input.name === undefined ? undefined : String(input.name).trim(),
          kind,
          frequency,
          startDate,
          endDate,
          nextRunDate: input.startDate ? startDate : undefined,
          anchorDay: input.startDate ? startDate.getUTCDate() : undefined,
          autoReverse: this.effectiveAutoReverse(kind, input.autoReverse ?? current.autoReverse),
          reverseAfterDays,
          entryPrefix:
            input.entryPrefix === undefined ? undefined : this.normalizePrefix(input.entryPrefix),
          description:
            input.description === undefined ? undefined : String(input.description).trim(),
          ...(input.lines
            ? {
                lines: {
                  create: lines.map((line, index) => ({
                    lineNumber: index + 1,
                    accountId: line.accountId,
                    debitAmount: new Prisma.Decimal(line.debitAmount ?? 0),
                    creditAmount: new Prisma.Decimal(line.creditAmount ?? 0),
                    description: line.description,
                    costCenterId: line.costCenterId,
                    projectId: line.projectId,
                    branchId: line.branchId,
                  })),
                },
              }
            : {}),
        },
        include: { lines: { orderBy: { lineNumber: 'asc' } } },
      });
    });
  }

  async pause(tenantId: string, id: string) {
    await this.get(tenantId, id);
    return prisma.accountingSchedule.update({
      where: { id },
      data: { status: AccountingScheduleStatus.PAUSED },
    });
  }

  async resume(tenantId: string, id: string) {
    const current = await this.get(tenantId, id);
    if (current.endDate && current.nextRunDate > current.endDate) {
      throw new ConflictException('Schedule has passed its end date');
    }
    return prisma.accountingSchedule.update({
      where: { id },
      data: { status: AccountingScheduleStatus.ACTIVE },
    });
  }

  async remove(tenantId: string, id: string) {
    const current = await this.get(tenantId, id);
    if (current.runs.length > 0) {
      throw new ConflictException('Schedule with posting history cannot be deleted; pause it instead');
    }
    await prisma.accountingSchedule.delete({ where: { id } });
    return { deleted: true };
  }

  private dateKey(date: Date) {
    return date.toISOString().slice(0, 10);
  }

  private async runOnce(scheduleId: string, scheduledDate: Date) {
    try {
      return await prisma.$transaction(async tx => {
        const schedule = await tx.accountingSchedule.findUnique({
          where: { id: scheduleId },
          include: { lines: { orderBy: { lineNumber: 'asc' } } },
        });
        if (!schedule) throw new NotFoundException('Accounting schedule not found');
        if (schedule.status !== AccountingScheduleStatus.ACTIVE) {
          throw new ConflictException('Accounting schedule is not active');
        }
        if (schedule.nextRunDate.getTime() !== scheduledDate.getTime()) {
          const existing = await tx.accountingScheduleRun.findUnique({
            where: {
              scheduleId_scheduledDate: { scheduleId, scheduledDate },
            },
          });
          if (existing) return existing;
          throw new ConflictException('Schedule cursor changed; reload before running');
        }
        if (schedule.endDate && scheduledDate > schedule.endDate) {
          await tx.accountingSchedule.update({
            where: { id: scheduleId },
            data: { status: AccountingScheduleStatus.COMPLETED },
          });
          throw new ConflictException('Schedule has completed');
        }

        const existing = await tx.accountingScheduleRun.findUnique({
          where: {
            scheduleId_scheduledDate: { scheduleId, scheduledDate },
          },
        });
        if (existing) return existing;

        const snapshot = {
          name: schedule.name,
          kind: schedule.kind,
          frequency: schedule.frequency,
          description: schedule.description,
          entryPrefix: schedule.entryPrefix,
          scheduledDate: scheduledDate.toISOString(),
          lines: schedule.lines.map(line => ({
            lineNumber: line.lineNumber,
            accountId: line.accountId,
            debitAmount: line.debitAmount.toFixed(2),
            creditAmount: line.creditAmount.toFixed(2),
            description: line.description,
            costCenterId: line.costCenterId,
            projectId: line.projectId,
            branchId: line.branchId,
          })),
        };

        const key = this.dateKey(scheduledDate);
        const journal = await this.posting.postInTransaction(tx, {
          tenantId: schedule.tenantId,
          entryNumber: `${schedule.entryPrefix}-${key.replace(/-/g, '')}`,
          date: scheduledDate,
          description: schedule.description,
          reference: `SCHEDULE-${schedule.id}-${key}`,
          type: JournalType.ADJUSTING,
          sourceType: 'ACCOUNTING_SCHEDULE',
          sourceId: `${schedule.id}:${key}`,
          lines: schedule.lines.map(line => ({
            accountId: line.accountId,
            debitAmount: line.debitAmount,
            creditAmount: line.creditAmount,
            description: line.description || schedule.description,
            costCenterId: line.costCenterId || undefined,
            projectId: line.projectId || undefined,
            branchId: line.branchId || undefined,
          })),
        });

        const reversalDueDate = schedule.autoReverse
          ? new Date(scheduledDate.getTime() + schedule.reverseAfterDays * 86400000)
          : null;
        const run = await tx.accountingScheduleRun.create({
          data: {
            tenantId: schedule.tenantId,
            scheduleId: schedule.id,
            scheduledDate,
            postingJournalId: journal.id,
            reversalDueDate,
            snapshot,
          },
        });

        const nextRunDate = this.advance(scheduledDate, schedule.frequency, schedule.anchorDay);
        await tx.accountingSchedule.update({
          where: { id: schedule.id },
          data: {
            nextRunDate,
            lastRunAt: new Date(),
            status: this.nextStatus(nextRunDate, schedule.endDate),
          },
        });

        return run;
      });
    } catch (error: any) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        const existing = await prisma.accountingScheduleRun.findUnique({
          where: { scheduleId_scheduledDate: { scheduleId, scheduledDate } },
        });
        if (existing) return existing;
      }
      throw error;
    }
  }

  private async reverseRun(runId: string, reversalDate?: Date) {
    return prisma.$transaction(async tx => {
      const run = await tx.accountingScheduleRun.findUnique({
        where: { id: runId },
        include: { schedule: true },
      });
      if (!run) throw new NotFoundException('Accounting schedule run not found');
      if (run.reversalJournalId) return run;

      const original = await tx.journalEntryHeader.findFirst({
        where: {
          id: run.postingJournalId,
          tenantId: run.tenantId,
          status: 'POSTED',
        },
        include: { lines: { orderBy: { lineNumber: 'asc' } } },
      });
      if (!original) throw new ConflictException('Original schedule journal not found');

      const date = reversalDate ?? run.reversalDueDate ?? new Date();
      const key = this.dateKey(run.scheduledDate);
      const reversal = await this.posting.postInTransaction(tx, {
        tenantId: run.tenantId,
        entryNumber: `REV-${run.schedule.entryPrefix}-${key.replace(/-/g, '')}`,
        date,
        description: `Reversal: ${original.description}`,
        reference: `SCHEDULE-REV-${run.id}`,
        type: JournalType.REVERSING,
        sourceType: 'ACCOUNTING_SCHEDULE_REVERSAL',
        sourceId: run.id,
        reversalOfId: original.id,
        lines: original.lines.map(line => ({
          accountId: line.accountId,
          debitAmount: line.creditAmount,
          creditAmount: line.debitAmount,
          description: `Reversal: ${line.description || original.description}`,
          costCenterId: line.costCenterId || undefined,
          projectId: line.projectId || undefined,
          branchId: line.branchId || undefined,
        })),
      });

      return tx.accountingScheduleRun.update({
        where: { id: run.id },
        data: {
          status: 'REVERSED',
          reversalJournalId: reversal.id,
          reversedAt: new Date(),
        },
      });
    });
  }

  async reverse(tenantId: string, runId: string, role?: string, date?: string) {
    if (!['ADMIN', 'SUPER_ADMIN'].includes(String(role || ''))) {
      throw new ConflictException('Only ADMIN or SUPER_ADMIN can reverse schedule runs');
    }
    const run = await prisma.accountingScheduleRun.findFirst({
      where: { id: runId, tenantId },
      select: { id: true },
    });
    if (!run) throw new NotFoundException('Accounting schedule run not found');
    return this.reverseRun(run.id, date ? this.asDate(date, 'reversalDate') : undefined);
  }

  private async processDueReversals(tenantId: string | undefined, asOf: Date) {
    const runs = await prisma.accountingScheduleRun.findMany({
      where: {
        ...(tenantId ? { tenantId } : {}),
        status: 'POSTED',
        reversalJournalId: null,
        reversalDueDate: { not: null, lte: asOf },
        schedule: { autoReverse: true },
      },
      select: { id: true, reversalDueDate: true },
      orderBy: { reversalDueDate: 'asc' },
      take: 500,
    });

    const results: any[] = [];
    for (const run of runs) {
      try {
        const reversed = await this.reverseRun(run.id, run.reversalDueDate || asOf);
        results.push({ runId: run.id, status: 'REVERSED', reversalJournalId: reversed.reversalJournalId });
      } catch (error: any) {
        results.push({ runId: run.id, status: 'ERROR', error: error?.message || String(error) });
      }
    }
    return results;
  }

  async runDue(tenantId?: string, asOfInput?: string | Date) {
    const asOf = asOfInput ? this.asDate(asOfInput, 'asOf') : new Date();
    const reversals = await this.processDueReversals(tenantId, asOf);

    const schedules = await prisma.accountingSchedule.findMany({
      where: {
        ...(tenantId ? { tenantId } : {}),
        status: AccountingScheduleStatus.ACTIVE,
        nextRunDate: { lte: asOf },
      },
      select: { id: true },
      orderBy: { nextRunDate: 'asc' },
      take: 500,
    });

    const postings: any[] = [];
    for (const row of schedules) {
      let iterations = 0;
      while (iterations < 120) {
        iterations += 1;
        const schedule = await prisma.accountingSchedule.findUnique({
          where: { id: row.id },
          select: { id: true, status: true, nextRunDate: true, endDate: true },
        });
        if (!schedule || schedule.status !== AccountingScheduleStatus.ACTIVE) break;
        if (schedule.nextRunDate > asOf) break;
        if (schedule.endDate && schedule.nextRunDate > schedule.endDate) {
          await prisma.accountingSchedule.update({
            where: { id: schedule.id },
            data: { status: AccountingScheduleStatus.COMPLETED },
          });
          break;
        }

        try {
          const run = await this.runOnce(schedule.id, schedule.nextRunDate);
          postings.push({
            scheduleId: schedule.id,
            scheduledDate: schedule.nextRunDate,
            status: 'POSTED',
            runId: run.id,
            postingJournalId: run.postingJournalId,
          });
        } catch (error: any) {
          postings.push({
            scheduleId: schedule.id,
            scheduledDate: schedule.nextRunDate,
            status: 'ERROR',
            error: error?.message || String(error),
          });
          break;
        }
      }
      if (iterations >= 120) {
        postings.push({ scheduleId: row.id, status: 'LIMIT_REACHED' });
      }
    }

    return { asOf, postings, reversals };
  }

  @Cron('15 2 * * *')
  async runAutomaticSchedules() {
    const result = await this.runDue(undefined, new Date());
    const errors = [
      ...result.postings.filter(item => item.status === 'ERROR'),
      ...result.reversals.filter(item => item.status === 'ERROR'),
    ];
    if (errors.length > 0) {
      this.logger.error(`Accounting schedule automatic run completed with ${errors.length} error(s)`);
      for (const error of errors.slice(0, 20)) this.logger.error(JSON.stringify(error));
    } else if (result.postings.length > 0 || result.reversals.length > 0) {
      this.logger.log(
        `Accounting schedules processed: postings=${result.postings.length} reversals=${result.reversals.length}`,
      );
    }
  }
}
