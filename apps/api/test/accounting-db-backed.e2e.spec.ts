import { test } from 'node:test';
import assert from 'node:assert/strict';
import { prisma } from '@scc/database';
import { AccountingPostingService } from '../src/accounting-core/accounting-posting.service';
import { AccountingDualWriteService } from '../src/accounting-core/accounting-dual-write.service';
import { AccountMappingService } from '../src/accounting-core/account-mapping.service';
import { InvoicesService } from '../src/erp/invoices.service';
import { PaymentsService } from '../src/finance/payments.service';
import { SupplierInvoiceService } from '../src/supplier-invoice/supplier-invoice.service';

test(
  'Accounting DB-backed E2E validates balanced posting, periods, mapping, tenant isolation and dual-write',
  { skip: process.env.ACCOUNTING_DB_E2E !== '1' ? 'ACCOUNTING_DB_E2E=1 is required' : false },
  async () => {
    const run = `${process.pid}-${Date.now()}`;
    const tenantA = await prisma.tenant.create({
      data: {
        name: `ACC E2E A ${run}`,
        slug: `acc-e2e-a-${run}`,
        settings: { accounting: { autoPostingEnabled: true } },
      },
    });
    const tenantB = await prisma.tenant.create({
      data: {
        name: `ACC E2E B ${run}`,
        slug: `acc-e2e-b-${run}`,
        settings: { accounting: { autoPostingEnabled: true } },
      },
    });

    try {
      const [cashA, arA, revenueA, vatA, vatReceivableA, apA, expenseA, cashB] = await Promise.all([
        prisma.chartOfAccount.create({
          data: { tenantId: tenantA.id, code: '1110', name: 'Cash', type: 'ASSET' },
        }),
        prisma.chartOfAccount.create({
          data: { tenantId: tenantA.id, code: '1120', name: 'Accounts Receivable', type: 'ASSET' },
        }),
        prisma.chartOfAccount.create({
          data: { tenantId: tenantA.id, code: '4100', name: 'Sales Revenue', type: 'REVENUE' },
        }),
        prisma.chartOfAccount.create({
          data: { tenantId: tenantA.id, code: '2110', name: 'VAT Payable', type: 'LIABILITY' },
        }),
        prisma.chartOfAccount.create({
          data: { tenantId: tenantA.id, code: '1140', name: 'VAT Receivable', type: 'ASSET' },
        }),
        prisma.chartOfAccount.create({
          data: { tenantId: tenantA.id, code: '2100', name: 'Accounts Payable', type: 'LIABILITY' },
        }),
        prisma.chartOfAccount.create({
          data: { tenantId: tenantA.id, code: '5000', name: 'General Expense', type: 'EXPENSE' },
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
      const invoices = new InvoicesService(mapping, dualWrite);
      const payments = new PaymentsService(mapping, dualWrite);
      const supplierInvoices = new SupplierInvoiceService(mapping, dualWrite);
      const reqA: any = { user: { tenantId: tenantA.id, role: 'ADMIN' } };

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

      const contactA = await prisma.contact.create({
        data: { tenantId: tenantA.id, firstName: 'Accounting', lastName: 'Customer' },
      });

      const salesInvoice = await invoices.create(tenantA.id, {
        invoiceNumber: `INV-E2E-${run}`,
        contactId: contactA.id,
        type: 'STANDARD',
        status: 'SENT',
        subtotal: 1000,
        taxRate: 15,
        taxAmount: 150,
        discount: 0,
        total: 1150,
        currency: 'SAR',
        dueDate: new Date('2026-11-30T00:00:00.000Z'),
      });

      const invoiceHeader = await prisma.journalEntryHeader.findFirst({
        where: { tenantId: tenantA.id, sourceType: 'INVOICE', sourceId: salesInvoice.id },
        include: { lines: true },
      });
      assert.ok(invoiceHeader);
      assert.equal(invoiceHeader.status, 'POSTED');
      assert.equal(invoiceHeader.lines.length, 3);
      assert.deepEqual(
        new Set(invoiceHeader.lines.map(line => line.accountId)),
        new Set([arA.id, revenueA.id, vatA.id]),
      );
      assert.equal(
        invoiceHeader.lines.reduce((sum, line) => sum + Number(line.debitAmount), 0),
        1150,
      );
      assert.equal(
        invoiceHeader.lines.reduce((sum, line) => sum + Number(line.creditAmount), 0),
        1150,
      );

      const invoiceLegacy = await prisma.journalEntry.findMany({
        where: { tenantId: tenantA.id, reference: salesInvoice.invoiceNumber },
      });
      assert.equal(invoiceLegacy.length, 3);
      assert.equal(
        invoiceLegacy.reduce((sum, row) => sum + Number(row.debitAmount), 0),
        invoiceLegacy.reduce((sum, row) => sum + Number(row.creditAmount), 0),
      );

      const payment1 = await payments.create(reqA, {
        invoiceId: salesInvoice.id,
        amount: 500,
        currency: 'SAR',
        method: 'CASH',
        status: 'COMPLETED',
        reference: `PAY-CASH-${run}`,
        paidAt: '2026-11-14T12:00:00.000Z',
      });
      const payment1Header = await prisma.journalEntryHeader.findFirst({
        where: { tenantId: tenantA.id, sourceType: 'PAYMENT', sourceId: payment1.id },
        include: { lines: true },
      });
      assert.ok(payment1Header);
      assert.equal(payment1Header.lines.length, 2);
      assert.equal(
        payment1Header.lines.reduce((sum, line) => sum + Number(line.debitAmount), 0),
        500,
      );
      assert.equal(
        payment1Header.lines.reduce((sum, line) => sum + Number(line.creditAmount), 0),
        500,
      );
      let settledInvoice = await prisma.invoice.findUnique({ where: { id: salesInvoice.id } });
      assert.equal(Number(settledInvoice!.paidAmount), 500);
      assert.equal(settledInvoice!.status, 'PARTIAL');

      const payment2 = await payments.create(reqA, {
        invoiceId: salesInvoice.id,
        amount: 650,
        currency: 'SAR',
        method: 'CASH',
        status: 'PENDING',
        reference: `PAY-PENDING-${run}`,
        paidAt: '2026-11-15T12:00:00.000Z',
      });
      assert.equal(
        await prisma.journalEntryHeader.count({
          where: { tenantId: tenantA.id, sourceType: 'PAYMENT', sourceId: payment2.id },
        }),
        0,
      );
      settledInvoice = await prisma.invoice.findUnique({ where: { id: salesInvoice.id } });
      assert.equal(Number(settledInvoice!.paidAmount), 500);

      const completedPayment2 = await payments.update(reqA, payment2.id, { status: 'COMPLETED' });
      assert.equal(completedPayment2.status, 'COMPLETED');
      assert.equal(
        await prisma.journalEntryHeader.count({
          where: { tenantId: tenantA.id, sourceType: 'PAYMENT', sourceId: payment2.id },
        }),
        1,
      );
      settledInvoice = await prisma.invoice.findUnique({ where: { id: salesInvoice.id } });
      assert.equal(Number(settledInvoice!.paidAmount), 1150);
      assert.equal(settledInvoice!.status, 'PAID');
      assert.ok(settledInvoice!.paidAt);

      await assert.rejects(
        () =>
          payments.create(reqA, {
            invoiceId: salesInvoice.id,
            amount: 1,
            currency: 'SAR',
            method: 'CASH',
            status: 'COMPLETED',
            reference: `PAY-OVER-${run}`,
          }),
        /Payment exceeds invoice outstanding balance/,
      );
      assert.equal(
        await prisma.payment.count({
          where: { tenantId: tenantA.id, reference: `PAY-OVER-${run}` },
        }),
        0,
      );

      await assert.rejects(
        () => payments.update(reqA, payment1.id, { amount: 1 }),
        /Payment is posted/,
      );
      await assert.rejects(
        () => payments.remove(reqA, payment1.id),
        /Completed payment cannot be deleted/,
      );

      const draftInvoice = await invoices.create(tenantA.id, {
        invoiceNumber: `INV-DRAFT-${run}`,
        contactId: contactA.id,
        type: 'STANDARD',
        status: 'DRAFT',
        subtotal: 200,
        taxRate: 15,
        taxAmount: 30,
        discount: 0,
        total: 230,
        currency: 'SAR',
        dueDate: new Date('2026-11-30T00:00:00.000Z'),
      });
      assert.equal(
        await prisma.journalEntryHeader.count({
          where: { tenantId: tenantA.id, sourceType: 'INVOICE', sourceId: draftInvoice.id },
        }),
        0,
      );

      const issuedDraft = await invoices.update(tenantA.id, draftInvoice.id, { status: 'SENT' });
      assert.equal(issuedDraft.status, 'SENT');
      assert.equal(
        await prisma.journalEntryHeader.count({
          where: { tenantId: tenantA.id, sourceType: 'INVOICE', sourceId: draftInvoice.id },
        }),
        1,
      );

      const viewedDraft = await invoices.update(tenantA.id, draftInvoice.id, { status: 'VIEWED' });
      assert.equal(viewedDraft.status, 'VIEWED');
      assert.equal(
        await prisma.journalEntryHeader.count({
          where: { tenantId: tenantA.id, sourceType: 'INVOICE', sourceId: draftInvoice.id },
        }),
        1,
      );

      await assert.rejects(
        () => invoices.update(tenantA.id, draftInvoice.id, { total: 1 }),
        /الفاتورة مُرحّلة محاسبياً/,
      );
      assert.equal(
        Number((await prisma.invoice.findUnique({ where: { id: draftInvoice.id } }))!.total),
        230,
      );

      const contactB = await prisma.contact.create({
        data: { tenantId: tenantB.id, firstName: 'Rollback', lastName: 'Customer' },
      });
      const rollbackInvoiceNumber = `INV-ROLLBACK-${run}`;
      await assert.rejects(
        () =>
          invoices.create(tenantB.id, {
            invoiceNumber: rollbackInvoiceNumber,
            contactId: contactB.id,
            type: 'STANDARD',
            status: 'SENT',
            subtotal: 100,
            taxRate: 15,
            taxAmount: 15,
            discount: 0,
            total: 115,
            currency: 'SAR',
            dueDate: new Date('2026-11-30T00:00:00.000Z'),
          }),
        /Missing active accounting mappings/,
      );
      assert.equal(
        await prisma.invoice.findFirst({
          where: { tenantId: tenantB.id, invoiceNumber: rollbackInvoiceNumber },
        }),
        null,
      );

      const draftB = await invoices.create(tenantB.id, {
        invoiceNumber: `INV-DRAFT-ROLLBACK-${run}`,
        contactId: contactB.id,
        type: 'STANDARD',
        status: 'DRAFT',
        subtotal: 100,
        taxRate: 15,
        taxAmount: 15,
        discount: 0,
        total: 115,
        currency: 'SAR',
        dueDate: new Date('2026-11-30T00:00:00.000Z'),
      });
      await assert.rejects(
        () => invoices.update(tenantB.id, draftB.id, { status: 'SENT' }),
        /Missing active accounting mappings/,
      );
      assert.equal(
        (await prisma.invoice.findUnique({ where: { id: draftB.id } }))!.status,
        'DRAFT',
      );

      const supplierA = await prisma.supplier.create({
        data: {
          tenantId: tenantA.id,
          name: 'Accounting Supplier',
          code: `SUP-${run}`,
          isActive: true,
        },
      });

      const supplierInvoice = await supplierInvoices.create(tenantA.id, {
        invoiceNumber: `APINV-${run}`,
        supplierId: supplierA.id,
        issueDate: new Date('2026-11-16T12:00:00.000Z'),
        taxAmount: 15,
        items: [
          {
            description: 'Professional service',
            quantity: 1,
            unitPrice: 100,
            accountId: expenseA.id,
          },
        ],
      });

      const supplierHeader = await prisma.journalEntryHeader.findFirst({
        where: {
          tenantId: tenantA.id,
          sourceType: 'SUPPLIER_INVOICE',
          sourceId: supplierInvoice.id,
        },
        include: { lines: true },
      });
      assert.ok(supplierHeader);
      assert.equal(supplierHeader.lines.length, 3);
      assert.deepEqual(
        new Set(supplierHeader.lines.map(line => line.accountId)),
        new Set([expenseA.id, vatReceivableA.id, apA.id]),
      );
      assert.equal(
        supplierHeader.lines.reduce((sum, line) => sum + Number(line.debitAmount), 0),
        115,
      );
      assert.equal(
        supplierHeader.lines.reduce((sum, line) => sum + Number(line.creditAmount), 0),
        115,
      );

      const supplierPayment = await supplierInvoices.addPayment(
        supplierInvoice.id,
        tenantA.id,
        'ADMIN',
        {
          amount: 115,
          method: 'CASH',
          reference: `APPAY-CASH-${run}`,
          paymentDate: '2026-11-17T12:00:00.000Z',
        },
      );
      const supplierPaymentHeader = await prisma.journalEntryHeader.findFirst({
        where: {
          tenantId: tenantA.id,
          sourceType: 'SUPPLIER_PAYMENT',
          sourceId: supplierPayment.id,
        },
        include: { lines: true },
      });
      assert.ok(supplierPaymentHeader);
      assert.equal(supplierPaymentHeader.lines.length, 2);
      assert.deepEqual(
        new Set(supplierPaymentHeader.lines.map(line => line.accountId)),
        new Set([apA.id, cashA.id]),
      );
      const settledSupplierInvoice = await prisma.supplierInvoice.findUnique({
        where: { id: supplierInvoice.id },
      });
      assert.equal(Number(settledSupplierInvoice!.paidAmount), 115);
      assert.equal(settledSupplierInvoice!.status, 'PAID');

      await assert.rejects(
        () => supplierInvoices.remove(supplierInvoice.id, tenantA.id, 'ADMIN'),
        /مُرحّلة محاسبياً/,
      );

      const missingAccountInvoiceNumber = `APINV-MISSING-${run}`;
      await assert.rejects(
        () =>
          supplierInvoices.create(tenantA.id, {
            invoiceNumber: missingAccountInvoiceNumber,
            supplierId: supplierA.id,
            taxAmount: 15,
            items: [
              {
                description: 'No mapped account',
                quantity: 1,
                unitPrice: 100,
              },
            ],
          }),
        /يحتاج accountId/,
      );
      assert.equal(
        await prisma.supplierInvoice.findFirst({
          where: { tenantId: tenantA.id, invoiceNumber: missingAccountInvoiceNumber },
        }),
        null,
      );

      const bankSupplierInvoice = await supplierInvoices.create(tenantA.id, {
        invoiceNumber: `APINV-BANK-${run}`,
        supplierId: supplierA.id,
        taxAmount: 0,
        items: [
          {
            description: 'Bank settlement test',
            quantity: 1,
            unitPrice: 10,
            accountId: expenseA.id,
          },
        ],
      });
      await assert.rejects(
        () =>
          supplierInvoices.addPayment(bankSupplierInvoice.id, tenantA.id, 'ADMIN', {
            amount: 10,
            method: 'BANK_TRANSFER',
            reference: `APPAY-BANK-${run}`,
          }),
        /Missing accounting payment-method mapping for BANK_TRANSFER/,
      );
      assert.equal(
        await prisma.supplierPayment.count({
          where: {
            tenantId: tenantA.id,
            supplierInvoiceId: bankSupplierInvoice.id,
            reference: `APPAY-BANK-${run}`,
          },
        }),
        0,
      );
      assert.equal(
        Number((await prisma.supplierInvoice.findUnique({
          where: { id: bankSupplierInvoice.id },
        }))!.paidAmount),
        0,
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
