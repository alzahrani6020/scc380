import { test } from 'node:test';
import assert from 'node:assert/strict';
import { prisma } from '@scc/database';
import { AccountingPostingService } from '../src/accounting-core/accounting-posting.service';
import { AccountingDualWriteService } from '../src/accounting-core/accounting-dual-write.service';
import { AccountMappingService } from '../src/accounting-core/account-mapping.service';
import { CurrencyAccountingService } from '../src/accounting-core/currency-accounting.service';
import { InvoicesService } from '../src/erp/invoices.service';
import { PaymentsService } from '../src/finance/payments.service';
import { SupplierInvoiceService } from '../src/supplier-invoice/supplier-invoice.service';

test(
  'AR/AP foreign invoices and settlements post base values with realized FX gain/loss',
  { skip: process.env.ACCOUNTING_DB_E2E !== '1' ? 'ACCOUNTING_DB_E2E=1 is required' : false },
  async () => {
    const run = `${process.pid}-${Date.now()}`;
    const tenant = await prisma.tenant.create({
      data: {
        name: `FX SETTLE ${run}`,
        slug: `fx-settle-${run}`,
        baseCurrency: 'SAR',
        settings: { accounting: { autoPostingEnabled: true } },
      },
    });

    try {
      const [cash, ar, revenue, vatPayable, vatReceivable, ap, expense, gain, loss] =
        await Promise.all([
          prisma.chartOfAccount.create({ data: { tenantId: tenant.id, code: '1110', name: 'Cash', type: 'ASSET' } }),
          prisma.chartOfAccount.create({ data: { tenantId: tenant.id, code: '1120', name: 'AR', type: 'ASSET' } }),
          prisma.chartOfAccount.create({ data: { tenantId: tenant.id, code: '4100', name: 'Sales', type: 'REVENUE' } }),
          prisma.chartOfAccount.create({ data: { tenantId: tenant.id, code: '2110', name: 'VAT payable', type: 'LIABILITY' } }),
          prisma.chartOfAccount.create({ data: { tenantId: tenant.id, code: '1140', name: 'VAT receivable', type: 'ASSET' } }),
          prisma.chartOfAccount.create({ data: { tenantId: tenant.id, code: '2100', name: 'AP', type: 'LIABILITY' } }),
          prisma.chartOfAccount.create({ data: { tenantId: tenant.id, code: '5000', name: 'Expense', type: 'EXPENSE' } }),
          prisma.chartOfAccount.create({ data: { tenantId: tenant.id, code: `FXG-${run}`, name: 'FX gain', type: 'REVENUE' } }),
          prisma.chartOfAccount.create({ data: { tenantId: tenant.id, code: `FXL-${run}`, name: 'FX loss', type: 'EXPENSE' } }),
        ]);

      await prisma.tenant.update({
        where: { id: tenant.id },
        data: { fxGainAccountId: gain.id, fxLossAccountId: loss.id },
      });
      await prisma.exchangeRate.create({
        data: {
          tenantId: tenant.id,
          fromCurrency: 'USD',
          toCurrency: 'SAR',
          rate: 3.75,
          effectiveDate: new Date('2000-01-01T00:00:00.000Z'),
          source: 'E2E',
        },
      });

      const posting = new AccountingPostingService();
      const mapping = new AccountMappingService();
      const dualWrite = new AccountingDualWriteService(posting);
      const currency = new CurrencyAccountingService();
      const invoices = new InvoicesService(mapping, dualWrite, currency);
      const payments = new PaymentsService(mapping, dualWrite, currency);
      const supplierInvoices = new SupplierInvoiceService(mapping, dualWrite, currency);
      const req: any = { user: { tenantId: tenant.id, role: 'ADMIN' } };

      const contact = await prisma.contact.create({
        data: { tenantId: tenant.id, firstName: 'FX', lastName: 'Customer' },
      });

      const customerInvoice = await invoices.create(tenant.id, {
        invoiceNumber: `FX-AR-${run}`,
        contactId: contact.id,
        type: 'STANDARD',
        status: 'SENT',
        subtotal: 100,
        taxRate: 0,
        taxAmount: 0,
        discount: 0,
        total: 100,
        currency: 'USD',
        dueDate: new Date(Date.now() + 86400000),
      });
      assert.equal(customerInvoice.currency, 'USD');
      assert.equal(Number(customerInvoice.exchangeRate), 3.75);
      assert.equal(Number(customerInvoice.baseTotal), 375);

      const arJournal = await prisma.journalEntryHeader.findFirstOrThrow({
        where: { tenantId: tenant.id, sourceType: 'INVOICE', sourceId: customerInvoice.id },
        include: { lines: true },
      });
      assert.equal(arJournal.transactionCurrency, 'USD');
      assert.equal(Number(arJournal.exchangeRate), 3.75);
      const arLine = arJournal.lines.find(line => line.accountId === ar.id)!;
      const revenueLine = arJournal.lines.find(line => line.accountId === revenue.id)!;
      assert.equal(Number(arLine.debitAmount), 375);
      assert.equal(Number(arLine.foreignDebitAmount), 100);
      assert.equal(Number(revenueLine.creditAmount), 375);
      assert.equal(Number(revenueLine.foreignCreditAmount), 100);

      const customerPayment = await payments.create(req, {
        invoiceId: customerInvoice.id,
        amount: 100,
        currency: 'USD',
        exchangeRate: 3.8,
        method: 'CASH',
        status: 'COMPLETED',
        reference: `FX-PAY-${run}`,
      });
      assert.equal(Number(customerPayment.baseAmount), 380);
      assert.equal(Number(customerPayment.realizedFxDifference), 5);

      const payJournal = await prisma.journalEntryHeader.findFirstOrThrow({
        where: { tenantId: tenant.id, sourceType: 'PAYMENT', sourceId: customerPayment.id },
        include: { lines: true },
      });
      assert.equal(Number(payJournal.lines.find(line => line.accountId === cash.id)!.debitAmount), 380);
      assert.equal(Number(payJournal.lines.find(line => line.accountId === ar.id)!.creditAmount), 375);
      assert.equal(Number(payJournal.lines.find(line => line.accountId === gain.id)!.creditAmount), 5);

      const supplier = await prisma.supplier.create({
        data: {
          tenantId: tenant.id,
          name: 'FX Supplier',
          code: `FX-SUP-${run}`,
          isActive: true,
        },
      });

      const supplierInvoice = await supplierInvoices.create(tenant.id, {
        invoiceNumber: `FX-AP-${run}`,
        supplierId: supplier.id,
        currency: 'USD',
        taxAmount: 0,
        items: [
          {
            description: 'USD service',
            quantity: 1,
            unitPrice: 100,
            accountId: expense.id,
          },
        ],
      });
      assert.equal(supplierInvoice.currency, 'USD');
      assert.equal(Number(supplierInvoice.exchangeRate), 3.75);
      assert.equal(Number(supplierInvoice.baseTotal), 375);

      const apJournal = await prisma.journalEntryHeader.findFirstOrThrow({
        where: { tenantId: tenant.id, sourceType: 'SUPPLIER_INVOICE', sourceId: supplierInvoice.id },
        include: { lines: true },
      });
      assert.equal(Number(apJournal.lines.find(line => line.accountId === expense.id)!.debitAmount), 375);
      assert.equal(Number(apJournal.lines.find(line => line.accountId === ap.id)!.creditAmount), 375);

      const supplierPayment = await supplierInvoices.addPayment(
        supplierInvoice.id,
        tenant.id,
        'ADMIN',
        {
          amount: 100,
          currency: 'USD',
          exchangeRate: 3.8,
          method: 'CASH',
          reference: `FX-APPAY-${run}`,
        },
      );
      assert.equal(Number(supplierPayment.baseAmount), 380);
      assert.equal(Number(supplierPayment.realizedFxDifference), 5);

      const apPayJournal = await prisma.journalEntryHeader.findFirstOrThrow({
        where: { tenantId: tenant.id, sourceType: 'SUPPLIER_PAYMENT', sourceId: supplierPayment.id },
        include: { lines: true },
      });
      assert.equal(Number(apPayJournal.lines.find(line => line.accountId === ap.id)!.debitAmount), 375);
      assert.equal(Number(apPayJournal.lines.find(line => line.accountId === loss.id)!.debitAmount), 5);
      assert.equal(Number(apPayJournal.lines.find(line => line.accountId === cash.id)!.creditAmount), 380);

      assert.equal(
        apPayJournal.lines.reduce((sum, line) => sum + Number(line.debitAmount), 0),
        apPayJournal.lines.reduce((sum, line) => sum + Number(line.creditAmount), 0),
      );
    } finally {
      await prisma.tenant.delete({ where: { id: tenant.id } });
      await prisma.$disconnect();
    }
  },
);
