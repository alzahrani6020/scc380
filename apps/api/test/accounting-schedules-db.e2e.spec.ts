import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  AccountingScheduleFrequency,
  AccountingScheduleKind,
  prisma,
} from '@scc/database';
import { AccountingPostingService } from '../src/accounting-core/accounting-posting.service';
import { AccountingSchedulesService } from '../src/finance/accounting-schedules.service';

test(
  'recurring adjustments are idempotent, preserve month-end anchors, and reverse accruals',
  { skip: process.env.ACCOUNTING_DB_E2E !== '1' ? 'ACCOUNTING_DB_E2E=1 is required' : false },
  async () => {
    const run = `${process.pid}-${Date.now()}`;
    const tenant = await prisma.tenant.create({
      data: {
        name: `Schedules E2E ${run}`,
        slug: `schedules-e2e-${run}`,
      },
    });

    try {
      const [expense, accruedLiability, prepaidAsset, cash] = await Promise.all([
        prisma.chartOfAccount.create({
          data: { tenantId: tenant.id, code: `EXP-${run}`, name: 'Accrued expense', type: 'EXPENSE' },
        }),
        prisma.chartOfAccount.create({
          data: { tenantId: tenant.id, code: `ACL-${run}`, name: 'Accrued liability', type: 'LIABILITY' },
        }),
        prisma.chartOfAccount.create({
          data: { tenantId: tenant.id, code: `PRE-${run}`, name: 'Prepaid asset', type: 'ASSET' },
        }),
        prisma.chartOfAccount.create({
          data: { tenantId: tenant.id, code: `CSH-${run}`, name: 'Cash', type: 'ASSET' },
        }),
      ]);

      const service = new AccountingSchedulesService(new AccountingPostingService());

      const accrual = await service.create(tenant.id, 'e2e-admin', {
        name: 'Month-end utilities accrual',
        kind: AccountingScheduleKind.ACCRUAL,
        frequency: AccountingScheduleFrequency.MONTHLY,
        startDate: '2027-01-31',
        endDate: '2027-03-31',
        autoReverse: false,
        reverseAfterDays: 1,
        entryPrefix: `ACR-${run}`.slice(0, 24),
        description: 'Monthly utilities accrual',
        lines: [
          { accountId: expense.id, debitAmount: 100 },
          { accountId: accruedLiability.id, creditAmount: 100 },
        ],
      });

      assert.equal(accrual.autoReverse, true);
      assert.equal(accrual.anchorDay, 31);

      const january = await service.runDue(tenant.id, '2027-01-31');
      assert.equal(january.postings.filter((x: any) => x.status === 'POSTED').length, 1);
      assert.equal(january.reversals.length, 0);

      const janRuns = await service.listRuns(tenant.id, accrual.id);
      assert.equal(janRuns.length, 1);
      assert.equal(janRuns[0].status, 'POSTED');
      assert.ok(janRuns[0].reversalDueDate);
      assert.equal(janRuns[0].snapshot?.kind, 'ACCRUAL');

      const janJournal = await prisma.journalEntryHeader.findUniqueOrThrow({
        where: { id: janRuns[0].postingJournalId },
        include: { lines: true },
      });
      assert.equal(janJournal.sourceType, 'ACCOUNTING_SCHEDULE');
      assert.equal(Number(janJournal.lines.find(line => line.accountId === expense.id)!.debitAmount), 100);
      assert.equal(Number(janJournal.lines.find(line => line.accountId === accruedLiability.id)!.creditAmount), 100);

      const duplicateAttempt = await service.runDue(tenant.id, '2027-01-31');
      assert.equal(duplicateAttempt.postings.length, 0);
      assert.equal((await service.listRuns(tenant.id, accrual.id)).length, 1);

      const feb1 = await service.runDue(tenant.id, '2027-02-01');
      assert.equal(feb1.reversals.filter((x: any) => x.status === 'REVERSED').length, 1);
      const reversedRun = (await service.listRuns(tenant.id, accrual.id))[0];
      assert.equal(reversedRun.status, 'REVERSED');
      assert.ok(reversedRun.reversalJournalId);

      const reversal = await prisma.journalEntryHeader.findUniqueOrThrow({
        where: { id: reversedRun.reversalJournalId! },
        include: { lines: true },
      });
      assert.equal(reversal.type, 'REVERSING');
      assert.equal(reversal.sourceType, 'ACCOUNTING_SCHEDULE_REVERSAL');
      assert.equal(reversal.reversalOfId, janJournal.id);
      assert.equal(Number(reversal.lines.find(line => line.accountId === accruedLiability.id)!.debitAmount), 100);
      assert.equal(Number(reversal.lines.find(line => line.accountId === expense.id)!.creditAmount), 100);

      const beforeFeb = await service.get(tenant.id, accrual.id);
      assert.equal(beforeFeb.nextRunDate.toISOString().slice(0, 10), '2027-02-28');

      const feb28 = await service.runDue(tenant.id, '2027-02-28');
      assert.equal(feb28.postings.filter((x: any) => x.status === 'POSTED').length, 1);
      const beforeMarch = await service.get(tenant.id, accrual.id);
      assert.equal(beforeMarch.nextRunDate.toISOString().slice(0, 10), '2027-03-31');

      const prepaid = await service.create(tenant.id, 'e2e-admin', {
        name: 'Prepaid insurance recognition',
        kind: AccountingScheduleKind.PREPAID,
        frequency: AccountingScheduleFrequency.MONTHLY,
        startDate: '2027-02-01',
        endDate: '2027-03-01',
        autoReverse: true,
        entryPrefix: `PRE-${run}`.slice(0, 24),
        description: 'Monthly prepaid insurance recognition',
        lines: [
          { accountId: expense.id, debitAmount: 50 },
          { accountId: prepaidAsset.id, creditAmount: 50 },
        ],
      });
      assert.equal(prepaid.autoReverse, false);

      const prepaidRun = await service.runDue(tenant.id, '2027-02-01');
      assert.equal(prepaidRun.postings.filter((x: any) => x.scheduleId === prepaid.id && x.status === 'POSTED').length, 1);
      const prepaidHistory = await service.listRuns(tenant.id, prepaid.id);
      assert.equal(prepaidHistory.length, 1);
      assert.equal(prepaidHistory[0].reversalDueDate, null);

      const blocked = await service.create(tenant.id, 'e2e-admin', {
        name: 'Closed-period recurring entry',
        kind: AccountingScheduleKind.RECURRING,
        frequency: AccountingScheduleFrequency.MONTHLY,
        startDate: '2027-04-01',
        entryPrefix: `BLK-${run}`.slice(0, 24),
        description: 'Must not post to closed period',
        lines: [
          { accountId: expense.id, debitAmount: 25 },
          { accountId: cash.id, creditAmount: 25 },
        ],
      });

      await prisma.financialPeriod.create({
        data: {
          tenantId: tenant.id,
          name: 'April 2027 closed',
          year: 2027,
          month: 4,
          startDate: new Date('2027-04-01T00:00:00.000Z'),
          endDate: new Date('2027-04-30T23:59:59.999Z'),
          isClosed: true,
          closedAt: new Date(),
        },
      });

      const closedAttempt = await service.runDue(tenant.id, '2027-04-01');
      const blockedResult = closedAttempt.postings.find((x: any) => x.scheduleId === blocked.id);
      assert.equal(blockedResult?.status, 'ERROR');
      assert.match(String(blockedResult?.error), /Financial period .* is closed/);
      assert.equal((await service.listRuns(tenant.id, blocked.id)).length, 0);
    } finally {
      await prisma.tenant.delete({ where: { id: tenant.id } });
      await prisma.$disconnect();
    }
  },
);
