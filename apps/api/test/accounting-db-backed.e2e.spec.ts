import { test } from 'node:test';
import assert from 'node:assert/strict';
import { prisma } from '@scc/database';
import { AccountingPostingService } from '../src/accounting-core/accounting-posting.service';
import { AccountingDualWriteService } from '../src/accounting-core/accounting-dual-write.service';
import { CurrencyAccountingService } from '../src/accounting-core/currency-accounting.service';
import { AccountMappingService } from '../src/accounting-core/account-mapping.service';
import { InvoicesService } from '../src/erp/invoices.service';
import { PaymentsService } from '../src/finance/payments.service';
import { SupplierInvoiceService } from '../src/supplier-invoice/supplier-invoice.service';
import { ExpensesService } from '../src/finance/expenses.service';
import { ReportsService } from '../src/reports/reports.service';
import { FinancialPeriodsService } from '../src/finance/financial-periods.service';
import { BankReconciliationService } from '../src/finance/bank-reconciliation.service';
import { BankAccountsService } from '../src/finance/bank-accounts.service';
import { YearEndClosingService } from '../src/finance/year-end-closing.service';

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
      const currencyAccounting = new CurrencyAccountingService();
      const invoices = new InvoicesService(mapping, dualWrite, currencyAccounting);
      const payments = new PaymentsService(mapping, dualWrite, currencyAccounting);
      const supplierInvoices = new SupplierInvoiceService(mapping, dualWrite, currencyAccounting);
      const expenses = new ExpensesService(mapping, dualWrite);
      const reports = new ReportsService();
      const periods = new FinancialPeriodsService();
      const bankReconciliation = new BankReconciliationService();
      const bankAccounts = new BankAccountsService();
      const yearEndClosing = new YearEndClosingService(dualWrite);
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

      const modernOnlyTrial = await reports.getTrialBalance(tenantA.id, 'ADMIN');
      const modernCash = modernOnlyTrial.accounts.find(account => account.id === cashA.id);
      const modernRevenue = modernOnlyTrial.accounts.find(account => account.id === revenueA.id);
      assert.equal(modernCash?.debit, 100);
      assert.equal(modernRevenue?.credit, 100);
      assert.equal(modernOnlyTrial.totals.debit, 100);
      assert.equal(modernOnlyTrial.totals.credit, 100);

      await prisma.journalEntry.createMany({
        data: [
          {
            tenantId: tenantA.id,
            entryNumber: `HIST-${run}-D`,
            date: new Date('2026-11-11T12:00:00.000Z'),
            description: 'Historical cash debit',
            reference: `HIST-${run}`,
            debitAmount: 30,
            creditAmount: 0,
            accountId: cashA.id,
            status: 'POSTED',
          },
          {
            tenantId: tenantA.id,
            entryNumber: `HIST-${run}-C`,
            date: new Date('2026-11-11T12:00:00.000Z'),
            description: 'Historical revenue credit',
            reference: `HIST-${run}`,
            debitAmount: 0,
            creditAmount: 30,
            accountId: revenueA.id,
            status: 'POSTED',
          },
        ],
      });

      const historicalTrial = await reports.getTrialBalance(tenantA.id, 'ADMIN');
      const historicalCash = historicalTrial.accounts.find(account => account.id === cashA.id);
      const historicalRevenue = historicalTrial.accounts.find(account => account.id === revenueA.id);
      assert.equal(historicalCash?.debit, 130);
      assert.equal(historicalRevenue?.credit, 130);
      assert.equal(historicalTrial.totals.debit, 130);
      assert.equal(historicalTrial.totals.credit, 130);


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

      const approvedExpense = await expenses.create(reqA, {
        category: 'OFFICE',
        amount: 75,
        currency: 'SAR',
        description: 'Office expense E2E',
        incurredAt: '2026-11-18T12:00:00.000Z',
        status: 'APPROVED',
        debitAccountId: expenseA.id,
        creditAccountId: cashA.id,
      });
      const expenseHeader = await prisma.journalEntryHeader.findFirst({
        where: { tenantId: tenantA.id, sourceType: 'EXPENSE', sourceId: approvedExpense.id },
        include: { lines: true },
      });
      assert.ok(expenseHeader);
      assert.equal(expenseHeader.lines.length, 2);
      assert.deepEqual(
        new Set(expenseHeader.lines.map(line => line.accountId)),
        new Set([expenseA.id, cashA.id]),
      );
      assert.equal(
        expenseHeader.lines.reduce((sum, line) => sum + Number(line.debitAmount), 0),
        75,
      );
      assert.equal(
        expenseHeader.lines.reduce((sum, line) => sum + Number(line.creditAmount), 0),
        75,
      );

      await assert.rejects(
        () => expenses.update(reqA, approvedExpense.id, { amount: 1 }),
        /Expense is posted/,
      );
      await assert.rejects(
        () => expenses.remove(reqA, approvedExpense.id),
        /Posted expense cannot be deleted/,
      );

      const pendingExpense = await expenses.create(reqA, {
        category: 'OTHER',
        amount: 25,
        currency: 'SAR',
        description: 'Pending expense E2E',
        incurredAt: '2026-11-19T12:00:00.000Z',
        status: 'PENDING',
      });
      assert.equal(
        await prisma.journalEntryHeader.count({
          where: { tenantId: tenantA.id, sourceType: 'EXPENSE', sourceId: pendingExpense.id },
        }),
        0,
      );
      await assert.rejects(
        () => expenses.update(reqA, pendingExpense.id, { status: 'APPROVED' }),
        /requires debitAccountId and creditAccountId/,
      );
      assert.equal(
        (await prisma.expense.findUnique({ where: { id: pendingExpense.id } }))!.status,
        'PENDING',
      );

      const postedPendingExpense = await expenses.update(reqA, pendingExpense.id, {
        status: 'APPROVED',
        debitAccountId: expenseA.id,
        creditAccountId: cashA.id,
      });
      assert.equal(postedPendingExpense.status, 'APPROVED');
      assert.equal(
        await prisma.journalEntryHeader.count({
          where: { tenantId: tenantA.id, sourceType: 'EXPENSE', sourceId: pendingExpense.id },
        }),
        1,
      );

      const trialBeforeDual = await reports.getTrialBalance(tenantA.id, 'ADMIN');
      const cashBeforeDual = trialBeforeDual.accounts.find(account => account.id === cashA.id)!;
      const revenueBeforeDual = trialBeforeDual.accounts.find(account => account.id === revenueA.id)!;

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

      const trialAfterDual = await reports.getTrialBalance(tenantA.id, 'ADMIN');
      const cashAfterDual = trialAfterDual.accounts.find(account => account.id === cashA.id)!;
      const revenueAfterDual = trialAfterDual.accounts.find(account => account.id === revenueA.id)!;
      assert.equal(cashAfterDual.debit - cashBeforeDual.debit, 250);
      assert.equal(revenueAfterDual.credit - revenueBeforeDual.credit, 250);

      const unifiedLedger = await reports.getGeneralLedger(
        cashA.id,
        tenantA.id,
        'ADMIN',
      );
      assert.ok(unifiedLedger.entries.some(entry => entry.id.startsWith('legacy:')));
      assert.ok(unifiedLedger.entries.some(entry => entry.id.startsWith('line:')));
      assert.equal(
        unifiedLedger.entries.filter(entry => entry.reference === `DUAL-${run}`).length,
        1,
      );

      // AR/AP aging E2E isolated tenant keeps bucket totals deterministic.
      const agingSupplierB = await prisma.supplier.create({
        data: {
          tenantId: tenantB.id,
          name: 'Aging Supplier B',
          code: `AGING-SUP-${run}`,
          isActive: true,
        },
      });

      const arCurrent = await prisma.invoice.create({
        data: {
          tenantId: tenantB.id,
          invoiceNumber: `AR-CURRENT-${run}`,
          contactId: contactB.id,
          type: 'STANDARD',
          status: 'SENT',
          subtotal: 100,
          taxAmount: 0,
          total: 100,
          issueDate: new Date('2026-12-01T12:00:00.000Z'),
          dueDate: new Date('2027-01-15T23:59:59.999Z'),
        },
      });
      const ar30 = await prisma.invoice.create({
        data: {
          tenantId: tenantB.id,
          invoiceNumber: `AR-30-${run}`,
          contactId: contactB.id,
          type: 'STANDARD',
          status: 'PARTIAL',
          subtotal: 200,
          taxAmount: 0,
          total: 200,
          issueDate: new Date('2026-11-15T12:00:00.000Z'),
          dueDate: new Date('2026-12-15T23:59:59.999Z'),
        },
      });
      const ar60 = await prisma.invoice.create({
        data: {
          tenantId: tenantB.id,
          invoiceNumber: `AR-60-${run}`,
          contactId: contactB.id,
          type: 'STANDARD',
          status: 'SENT',
          subtotal: 300,
          taxAmount: 0,
          total: 300,
          issueDate: new Date('2026-10-01T12:00:00.000Z'),
          dueDate: new Date('2026-11-15T23:59:59.999Z'),
        },
      });
      const ar90plus = await prisma.invoice.create({
        data: {
          tenantId: tenantB.id,
          invoiceNumber: `AR-90PLUS-${run}`,
          contactId: contactB.id,
          type: 'STANDARD',
          status: 'OVERDUE',
          subtotal: 400,
          taxAmount: 0,
          total: 400,
          issueDate: new Date('2026-08-01T12:00:00.000Z'),
          dueDate: new Date('2026-09-01T23:59:59.999Z'),
        },
      });
      await prisma.payment.createMany({
        data: [
          {
            tenantId: tenantB.id,
            invoiceId: ar30.id,
            amount: 50,
            status: 'COMPLETED',
            paidAt: new Date('2026-12-20T12:00:00.000Z'),
          },
          {
            tenantId: tenantB.id,
            invoiceId: ar60.id,
            amount: 100,
            status: 'COMPLETED',
            paidAt: new Date('2027-01-05T12:00:00.000Z'),
          },
        ],
      });

      const arAging = await reports.getReceivablesAging(
        tenantB.id,
        'ADMIN',
        '2026-12-31',
      );
      assert.equal(arAging.totalOutstanding, 950);
      assert.deepEqual(arAging.buckets, {
        current: 100,
        days1to30: 150,
        days31to60: 300,
        days61to90: 0,
        days91plus: 400,
      });
      assert.equal(arAging.parties.length, 1);
      assert.equal(arAging.parties[0].partyId, contactB.id);
      assert.equal(arAging.parties[0].invoiceCount, 4);
      assert.equal(arAging.parties[0].outstanding, 950);
      assert.equal(
        arAging.invoices.find((row) => row.id === ar60.id)?.paidAmount,
        0,
      );
      assert.equal(
        arAging.invoices.find((row) => row.id === ar90plus.id)?.bucket,
        'days91plus',
      );
      assert.equal(
        arAging.invoices.some((row) => row.id === arCurrent.id),
        true,
      );

      const apCurrent = await prisma.supplierInvoice.create({
        data: {
          tenantId: tenantB.id,
          invoiceNumber: `AP-CURRENT-${run}`,
          supplierId: agingSupplierB.id,
          issueDate: new Date('2026-12-01T12:00:00.000Z'),
          dueDate: null,
          subtotal: 120,
          taxAmount: 0,
          total: 120,
        },
      });
      const ap60 = await prisma.supplierInvoice.create({
        data: {
          tenantId: tenantB.id,
          invoiceNumber: `AP-60-${run}`,
          supplierId: agingSupplierB.id,
          issueDate: new Date('2026-11-01T12:00:00.000Z'),
          dueDate: new Date('2026-11-20T23:59:59.999Z'),
          subtotal: 250,
          taxAmount: 0,
          total: 250,
        },
      });
      const ap90 = await prisma.supplierInvoice.create({
        data: {
          tenantId: tenantB.id,
          invoiceNumber: `AP-90-${run}`,
          supplierId: agingSupplierB.id,
          issueDate: new Date('2026-09-01T12:00:00.000Z'),
          dueDate: new Date('2026-10-15T23:59:59.999Z'),
          subtotal: 400,
          taxAmount: 0,
          total: 400,
          status: 'PARTIAL',
        },
      });
      const ap90plus = await prisma.supplierInvoice.create({
        data: {
          tenantId: tenantB.id,
          invoiceNumber: `AP-90PLUS-${run}`,
          supplierId: agingSupplierB.id,
          issueDate: new Date('2026-08-01T12:00:00.000Z'),
          dueDate: new Date('2026-09-01T23:59:59.999Z'),
          subtotal: 500,
          taxAmount: 0,
          total: 500,
        },
      });
      await prisma.supplierPayment.createMany({
        data: [
          {
            tenantId: tenantB.id,
            supplierId: agingSupplierB.id,
            supplierInvoiceId: ap90.id,
            amount: 100,
            paymentDate: new Date('2026-12-01T12:00:00.000Z'),
          },
          {
            tenantId: tenantB.id,
            supplierId: agingSupplierB.id,
            supplierInvoiceId: ap90plus.id,
            amount: 100,
            paymentDate: new Date('2027-01-05T12:00:00.000Z'),
          },
        ],
      });

      const apAging = await reports.getPayablesAging(
        tenantB.id,
        'ADMIN',
        '2026-12-31',
      );
      assert.equal(apAging.totalOutstanding, 1170);
      assert.deepEqual(apAging.buckets, {
        current: 120,
        days1to30: 0,
        days31to60: 250,
        days61to90: 300,
        days91plus: 500,
      });
      assert.equal(apAging.parties.length, 1);
      assert.equal(apAging.parties[0].partyId, agingSupplierB.id);
      assert.equal(apAging.parties[0].outstanding, 1170);
      assert.equal(
        apAging.invoices.find((row) => row.id === ap90plus.id)?.paidAmount,
        0,
      );
      assert.equal(
        apAging.invoices.find((row) => row.id === apCurrent.id)?.bucket,
        'current',
      );

      await assert.rejects(
        () => reports.getReceivablesAging(tenantB.id, 'ADMIN', 'not-a-date'),
        /Invalid asOfDate/,
      );

      // Year-end close E2E isolated fiscal year validates close, reporting, reversal, and re-close.
      const fyCash = await prisma.chartOfAccount.create({
        data: {
          tenantId: tenantB.id,
          code: `FY-CASH-${run}`,
          name: 'FY Close Cash',
          type: 'ASSET',
        },
      });
      const fyRevenue = await prisma.chartOfAccount.create({
        data: {
          tenantId: tenantB.id,
          code: `FY-REV-${run}`,
          name: 'FY Close Revenue',
          type: 'REVENUE',
        },
      });
      const fyExpense = await prisma.chartOfAccount.create({
        data: {
          tenantId: tenantB.id,
          code: `FY-EXP-${run}`,
          name: 'FY Close Expense',
          type: 'EXPENSE',
        },
      });
      const fyRetained = await prisma.chartOfAccount.create({
        data: {
          tenantId: tenantB.id,
          code: `FY-RE-${run}`,
          name: 'Retained Earnings E2E',
          type: 'EQUITY',
        },
      });

      const fyH1 = await prisma.financialPeriod.create({
        data: {
          tenantId: tenantB.id,
          name: 'FY2028 H1',
          year: 2028,
          startDate: new Date('2028-01-01T00:00:00.000Z'),
          endDate: new Date('2028-06-30T23:59:59.999Z'),
        },
      });
      const fyH2 = await prisma.financialPeriod.create({
        data: {
          tenantId: tenantB.id,
          name: 'FY2028 H2',
          year: 2028,
          startDate: new Date('2028-07-01T00:00:00.000Z'),
          endDate: new Date('2028-12-31T23:59:59.999Z'),
        },
      });

      await dualWrite.post({
        tenantId: tenantB.id,
        entryNumber: `FY-REV-JV-${run}`,
        date: new Date('2028-03-15T12:00:00.000Z'),
        description: 'FY revenue',
        sourceType: 'FY_E2E',
        sourceId: `fy-rev-${run}`,
        lines: [
          { accountId: fyCash.id, debitAmount: 1000 },
          { accountId: fyRevenue.id, creditAmount: 1000 },
        ],
      });
      await dualWrite.post({
        tenantId: tenantB.id,
        entryNumber: `FY-EXP-JV-${run}`,
        date: new Date('2028-08-15T12:00:00.000Z'),
        description: 'FY expense',
        sourceType: 'FY_E2E',
        sourceId: `fy-exp-${run}`,
        lines: [
          { accountId: fyExpense.id, debitAmount: 300 },
          { accountId: fyCash.id, creditAmount: 300 },
        ],
      });
      await prisma.financialPeriod.update({
        where: { id: fyH1.id },
        data: { isClosed: true, closedAt: new Date() },
      });

      const reqBAdmin = {
        user: { tenantId: tenantB.id, role: 'ADMIN', id: `admin-b-${run}` },
      };
      const fyPreview = await yearEndClosing.preview(
        reqBAdmin,
        2028,
        fyRetained.id,
      );
      assert.equal(fyPreview.revenue, 1000);
      assert.equal(fyPreview.expenses, 300);
      assert.equal(fyPreview.netIncome, 700);
      assert.equal(fyPreview.closingLines.length, 2);

      const fyCloseV1 = await yearEndClosing.close(reqBAdmin, {
        year: 2028,
        retainedEarningsAccountId: fyRetained.id,
      });
      assert.equal(fyCloseV1.record.version, 1);
      assert.equal(fyCloseV1.record.status, 'CLOSED');
      assert.equal(Number(fyCloseV1.record.netIncome), 700);
      assert.ok(fyCloseV1.closingJournal);
      assert.equal(fyCloseV1.closingJournal.type, 'CLOSING');
      assert.equal(fyCloseV1.closingJournal.lines.length, 3);

      const finalAfterClose = await prisma.financialPeriod.findUnique({
        where: { id: fyH2.id },
      });
      assert.equal(finalAfterClose?.isClosed, true);

      const incomeAfterClose = await reports.getIncomeStatement(
        tenantB.id,
        'ADMIN',
        '2028-01-01T00:00:00.000Z',
        '2028-12-31T23:59:59.999Z',
      );
      assert.equal(incomeAfterClose.revenues.total, 1000);
      assert.equal(incomeAfterClose.expenses.total, 300);
      assert.equal(incomeAfterClose.netIncome, 700);

      const trialAfterClose = await reports.getTrialBalance(
        tenantB.id,
        'ADMIN',
        '2028-01-01T00:00:00.000Z',
        '2028-12-31T23:59:59.999Z',
      );
      assert.equal(
        trialAfterClose.accounts.find((a) => a.id === fyRevenue.id)?.balance,
        0,
      );
      assert.equal(
        trialAfterClose.accounts.find((a) => a.id === fyExpense.id)?.balance,
        0,
      );
      assert.equal(
        trialAfterClose.accounts.find((a) => a.id === fyRetained.id)?.balance,
        700,
      );
      assert.equal(trialAfterClose.balanced, true);

      await assert.rejects(
        () =>
          yearEndClosing.reverse(
            { user: { tenantId: tenantB.id, role: 'MANAGER' } },
            2028,
          ),
        /Only ADMIN or SUPER_ADMIN/,
      );

      const fyReverse = await yearEndClosing.reverse(reqBAdmin, 2028);
      assert.equal(fyReverse.record.status, 'REVERSED');
      assert.ok(fyReverse.reversalJournal);
      assert.equal(fyReverse.reversalJournal.type, 'REVERSING');

      const finalAfterReverse = await prisma.financialPeriod.findUnique({
        where: { id: fyH2.id },
      });
      assert.equal(finalAfterReverse?.isClosed, false);

      const incomeAfterReverse = await reports.getIncomeStatement(
        tenantB.id,
        'ADMIN',
        '2028-01-01T00:00:00.000Z',
        '2028-12-31T23:59:59.999Z',
      );
      assert.equal(incomeAfterReverse.netIncome, 700);

      const trialAfterReverse = await reports.getTrialBalance(
        tenantB.id,
        'ADMIN',
        '2028-01-01T00:00:00.000Z',
        '2028-12-31T23:59:59.999Z',
      );
      assert.equal(
        trialAfterReverse.accounts.find((a) => a.id === fyRevenue.id)?.balance,
        1000,
      );
      assert.equal(
        trialAfterReverse.accounts.find((a) => a.id === fyExpense.id)?.balance,
        300,
      );
      assert.equal(
        trialAfterReverse.accounts.find((a) => a.id === fyRetained.id)?.balance,
        0,
      );

      const fyCloseV2 = await yearEndClosing.close(reqBAdmin, {
        year: 2028,
        retainedEarningsAccountId: fyRetained.id,
      });
      assert.equal(fyCloseV2.record.version, 2);
      assert.equal(fyCloseV2.record.status, 'CLOSED');
      assert.equal(Number(fyCloseV2.record.netIncome), 700);

      const closeHistory = await yearEndClosing.list(reqBAdmin, 2028);
      assert.equal(closeHistory.length, 2);
      assert.equal(closeHistory[0].version, 2);
      assert.equal(closeHistory[1].version, 1);
      assert.equal(closeHistory[1].status, 'REVERSED');

      const jan2027 = await periods.create(reqA, {
        name: 'January 2027',
        year: 2027,
        month: 1,
        startDate: '2027-01-01T00:00:00.000Z',
        endDate: '2027-01-31T23:59:59.999Z',
      });
      assert.equal(jan2027.isClosed, false);

      await assert.rejects(
        () =>
          periods.create(reqA, {
            name: 'Overlapping January 2027',
            year: 2027,
            month: 2,
            startDate: '2027-01-15T00:00:00.000Z',
            endDate: '2027-02-15T23:59:59.999Z',
          }),
        /overlaps/,
      );

      const draftLegacy = await prisma.journalEntry.create({
        data: {
          tenantId: tenantA.id,
          entryNumber: `DRAFT-PERIOD-${run}`,
          date: new Date('2027-01-05T12:00:00.000Z'),
          description: 'Draft legacy period close blocker',
          debitAmount: 1,
          creditAmount: 0,
          accountId: cashA.id,
          status: 'DRAFT',
        },
      });

      await assert.rejects(
        () => periods.close(reqA, jan2027.id),
        /draft journal entries/,
      );

      await prisma.journalEntry.delete({ where: { id: draftLegacy.id } });

      await posting.post({
        tenantId: tenantA.id,
        entryNumber: `JV-PERIOD-${run}`,
        date: new Date('2027-01-10T12:00:00.000Z'),
        description: 'Balanced period close test',
        sourceType: 'PERIOD_E2E',
        sourceId: `period-${run}`,
        lines: [
          { accountId: cashA.id, debitAmount: 20 },
          { accountId: revenueA.id, creditAmount: 20 },
        ],
      });

      const closedJan = await periods.close(reqA, jan2027.id);
      assert.equal(closedJan.isClosed, true);
      assert.ok(closedJan.closedAt);

      await assert.rejects(
        () =>
          posting.post({
            tenantId: tenantA.id,
            entryNumber: `JV-PERIOD-CLOSED-${run}`,
            date: new Date('2027-01-11T12:00:00.000Z'),
            description: 'Closed period reject test',
            lines: [
              { accountId: cashA.id, debitAmount: 5 },
              { accountId: revenueA.id, creditAmount: 5 },
            ],
          }),
        /Financial period "January 2027" is closed/,
      );

      await assert.rejects(
        () =>
          periods.reopen(
            { user: { tenantId: tenantA.id, role: 'MANAGER' } },
            jan2027.id,
          ),
        /Only ADMIN or SUPER_ADMIN/,
      );

      const reopenedJan = await periods.reopen(reqA, jan2027.id);
      assert.equal(reopenedJan.isClosed, false);
      assert.equal(reopenedJan.closedAt, null);

      const postAfterReopen = await posting.post({
        tenantId: tenantA.id,
        entryNumber: `JV-PERIOD-REOPEN-${run}`,
        date: new Date('2027-01-12T12:00:00.000Z'),
        description: 'Reopened period posting',
        lines: [
          { accountId: cashA.id, debitAmount: 5 },
          { accountId: revenueA.id, creditAmount: 5 },
        ],
      });
      assert.equal(postAfterReopen.status, 'POSTED');


      // Bank reconciliation E2E dedicated account keeps the expected ledger balance deterministic.
      const bankGl = await prisma.chartOfAccount.create({
        data: {
          tenantId: tenantA.id,
          code: `1150-${run}`,
          name: 'Bank Reconciliation Clearing',
          type: 'ASSET',
        },
      });
      const bankAccount = await prisma.bankAccount.create({
        data: {
          tenantId: tenantA.id,
          bankName: 'E2E Bank',
          accountName: 'Operating Account',
          accountNumber: `E2E-BANK-${run}`,
          currency: 'SAR',
          chartAccountId: bankGl.id,
          isActive: true,
        },
      });

      const febPosting = await dualWrite.post({
        tenantId: tenantA.id,
        entryNumber: `JV-BANK-REC-${run}`,
        date: new Date('2027-02-10T12:00:00.000Z'),
        description: 'Bank reconciliation movement',
        reference: `BANK-REC-${run}`,
        sourceType: 'BANK_RECON_E2E',
        sourceId: `bank-rec-${run}`,
        lines: [
          { accountId: bankGl.id, debitAmount: 100 },
          { accountId: revenueA.id, creditAmount: 100 },
        ],
      });
      const bankLedgerLine = febPosting.lines.find(line => line.accountId === bankGl.id)!;
      assert.ok(bankLedgerLine);

      const reconciliation = await bankReconciliation.create(reqA, {
        bankAccountId: bankAccount.id,
        startDate: '2027-02-01T00:00:00.000Z',
        endDate: '2027-02-28T23:59:59.999Z',
        openingBalance: 0,
        endingBalance: 100,
      });
      assert.equal(reconciliation.status, 'DRAFT');

      await bankReconciliation.addLines(reqA, reconciliation.id, [
        {
          transactionDate: '2027-02-10T12:00:00.000Z',
          amount: 100,
          reference: `BANK-REC-${run}`,
          description: 'Customer deposit',
          externalId: `BANK-LINE-${run}`,
        },
      ]);

      const beforeAutoMatch = await bankReconciliation.findOne(reqA, reconciliation.id);
      const statementLine = beforeAutoMatch.lines[0];
      const candidates = await bankReconciliation.getMatchCandidates(
        reqA,
        reconciliation.id,
        statementLine.id,
      );
      assert.equal(candidates.candidates.length, 1);
      assert.equal(candidates.candidates[0].kind, 'MODERN');
      assert.equal(candidates.candidates[0].id, bankLedgerLine.id);

      const autoMatched = await bankReconciliation.autoMatch(reqA, reconciliation.id);
      assert.equal(autoMatched.autoMatched, 1);
      assert.equal(autoMatched.lines.length, 1);
      assert.equal(autoMatched.lines[0].status, 'MATCHED');
      assert.equal(autoMatched.lines[0].matchedJournalEntryLineId, bankLedgerLine.id);
      assert.equal(autoMatched.lines[0].matchedLegacyJournalEntryId, null);

      const completedReconciliation = await bankReconciliation.complete(reqA, reconciliation.id);
      assert.equal(completedReconciliation.status, 'COMPLETED');
      assert.equal(Number(completedReconciliation.ledgerBalance), 100);
      assert.equal(Number(completedReconciliation.difference), 0);
      assert.ok(completedReconciliation.completedAt);

      await assert.rejects(
        () =>
          bankReconciliation.addLines(reqA, reconciliation.id, [
            {
              transactionDate: '2027-02-11T12:00:00.000Z',
              amount: 1,
              reference: `BANK-LATE-${run}`,
            },
          ]),
        /Completed reconciliation is immutable/,
      );

      await assert.rejects(
        () =>
          bankReconciliation.reopen(
            { user: { tenantId: tenantA.id, role: 'MANAGER' } },
            reconciliation.id,
          ),
        /Only ADMIN or SUPER_ADMIN/,
      );

      const reopenedReconciliation = await bankReconciliation.reopen(reqA, reconciliation.id);
      assert.equal(reopenedReconciliation.status, 'DRAFT');

      await assert.rejects(
        () => bankAccounts.remove(reqA, bankAccount.id),
        /reconciliation history/,
      );


    } finally {
      await prisma.tenant.deleteMany({ where: { id: { in: [tenantA.id, tenantB.id] } } });
      await prisma.$disconnect();
    }
  },
);
