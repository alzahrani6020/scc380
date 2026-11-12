import { test } from 'node:test';
import assert from 'node:assert/strict';
import { prisma } from '@scc/database';
import { AccountingPostingService } from '../src/accounting-core/accounting-posting.service';
import { AccountingDualWriteService } from '../src/accounting-core/accounting-dual-write.service';
import { AccountMappingService } from '../src/accounting-core/account-mapping.service';

test(
  'Accounting DB-backed E2E validates balanced posting, periods, mapping, tenant isolation and dual-write',
  { skip: process.env.ACCOUNTING_DB_E2E !== '1' ? 'ACCOUNTING_DB_E2E=1 is required' : false },
  async () => {
    const run = `${process.pid}-${Date.now()}`;
    const tenantA = await prisma.tenant.create({
      data: { name: `ACC E2E A ${run}`, slug: `acc-e2e-a-${run}` },
    });
    const tenantB = await prisma.tenant.create({
      data: { name: `ACC E2E B ${run}`, slug: `acc-e2e-b-${run}` },
    });

    try {
      const [cashA, revenueA, cashB] = await Promise.all([
        prisma.chartOfAccount.create({
          data: { tenantId: tenantA.id, code: '1110', name: 'Cash', type: 'ASSET' },
        }),
        prisma.chartOfAccount.create({
          data: { tenantId: tenantA.id, code: '4100', name: 'Sales Revenue', type: 'REVENUE' },
        }),
        prisma.chartOfAccount.create({
          data: { tenantId: tenantB.id, code: '1110', name: 'Cash B', type: 'ASSET' },
        }),
      ]);

      await prisma.financialPeriod.createMany({
        data: [
          {
            tenantId: tenantA.id,
            name: 'November 2026',
            year: 2026,
            month: 11,
            startDate: new Date('2026-11-01T00:00:00.000Z'),
            endDate: new Date('2026-11-30T23:59:59.999Z'),
            isClosed: false,
          },
          {
            tenantId: tenantA.id,
            name: 'December 2026',
            year: 2026,
            month: 12,
            startDate: new Date('2026-12-01T00:00:00.000Z'),
            endDate: new Date('2026-12-31T23:59:59.999Z'),
            isClosed: true,
            closedAt: new Date('2026-12-31T23:59:59.999Z'),
          },
        ],
      });

      const posting = new AccountingPostingService();
      const mapping = new AccountMappingService();
      const dualWrite = new AccountingDualWriteService(posting);

      const mapped = await mapping.resolve(tenantA.id, ['CASH', 'SALES_REVENUE']);
      assert.equal(mapped.CASH.id, cashA.id);
      assert.equal(mapped.SALES_REVENUE.id, revenueA.id);

      const posted = await posting.post({
        tenantId: tenantA.id,
        entryNumber: `JV-E2E-${run}`,
        date: new Date('2026-11-12T12:00:00.000Z'),
        description: 'E2E balanced posting',
        sourceType: 'E2E',
        sourceId: `balanced-${run}`,
        lines: [
          { accountId: cashA.id, debitAmount: 100 },
          { accountId: revenueA.id, creditAmount: 100 },
        ],
      });

      assert.equal(posted.status, 'POSTED');
      assert.equal(posted.lines.length, 2);
      assert.equal(
        posted.lines.reduce((sum, line) => sum + Number(line.debitAmount), 0),
        posted.lines.reduce((sum, line) => sum + Number(line.creditAmount), 0),
      );

      await assert.rejects(
        () =>
          posting.post({
            tenantId: tenantA.id,
            entryNumber: `JV-UNBAL-${run}`,
            date: new Date('2026-11-12T12:00:00.000Z'),
            description: 'Unbalanced',
            lines: [
              { accountId: cashA.id, debitAmount: 100 },
              { accountId: revenueA.id, creditAmount: 99 },
            ],
          }),
        /Journal is not balanced/,
      );

      await assert.rejects(
        () =>
          posting.post({
            tenantId: tenantA.id,
            entryNumber: `JV-CLOSED-${run}`,
            date: new Date('2026-12-15T12:00:00.000Z'),
            description: 'Closed period',
            lines: [
              { accountId: cashA.id, debitAmount: 10 },
              { accountId: revenueA.id, creditAmount: 10 },
            ],
          }),
        /Financial period "December 2026" is closed/,
      );

      await assert.rejects(
        () =>
          posting.post({
            tenantId: tenantA.id,
            entryNumber: `JV-TENANT-${run}`,
            date: new Date('2026-11-12T12:00:00.000Z'),
            description: 'Tenant isolation',
            lines: [
              { accountId: cashB.id, debitAmount: 10 },
              { accountId: revenueA.id, creditAmount: 10 },
            ],
          }),
        /outside tenant/,
      );

      const dual = await dualWrite.post({
        tenantId: tenantA.id,
        entryNumber: `JV-DUAL-${run}`,
        date: new Date('2026-11-13T12:00:00.000Z'),
        description: 'E2E dual write',
        reference: `DUAL-${run}`,
        sourceType: 'E2E_DUAL',
        sourceId: `dual-${run}`,
        lines: [
          { accountId: cashA.id, debitAmount: 250 },
          { accountId: revenueA.id, creditAmount: 250 },
        ],
      });

      assert.equal(dual.lines.length, 2);

      const legacyRows = await prisma.journalEntry.findMany({
        where: { tenantId: tenantA.id, reference: `DUAL-${run}` },
        orderBy: { entryNumber: 'asc' },
      });
      assert.equal(legacyRows.length, 2);
      assert.deepEqual(
        legacyRows.map(row => row.entryNumber),
        [`LEG-${tenantA.id}-JV-DUAL-${run}-L1`, `LEG-${tenantA.id}-JV-DUAL-${run}-L2`],
      );
      assert.equal(
        legacyRows.reduce((sum, row) => sum + Number(row.debitAmount), 0),
        legacyRows.reduce((sum, row) => sum + Number(row.creditAmount), 0),
      );
    } finally {
      await prisma.tenant.deleteMany({ where: { id: { in: [tenantA.id, tenantB.id] } } });
      await prisma.$disconnect();
    }
  },
);
