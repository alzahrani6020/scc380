import { test } from 'node:test';
import assert from 'node:assert/strict';
import { prisma } from '@scc/database';
import { AccountingPostingService } from '../src/accounting-core/accounting-posting.service';
import { AccountMappingService } from '../src/accounting-core/account-mapping.service';
import { InventoryService } from '../src/inventory/inventory.service';

test(
  'Inventory sale is atomic, tenant-scoped, blocks negative stock and posts COGS',
  { skip: process.env.ACCOUNTING_DB_E2E !== '1' ? 'ACCOUNTING_DB_E2E=1 is required' : false },
  async () => {
    const run = `${process.pid}-${Date.now()}`;
    const [tenantA, tenantB] = await Promise.all([
      prisma.tenant.create({ data: { name: `INV A ${run}`, slug: `inv-a-${run}` } }),
      prisma.tenant.create({ data: { name: `INV B ${run}`, slug: `inv-b-${run}` } }),
    ]);

    try {
      const [inventory, cogs] = await Promise.all([
        prisma.chartOfAccount.create({
          data: { tenantId: tenantA.id, code: '1130', name: 'Inventory', type: 'ASSET' },
        }),
        prisma.chartOfAccount.create({
          data: { tenantId: tenantA.id, code: '5600', name: 'COGS', type: 'EXPENSE' },
        }),
      ]);

      const productA = await prisma.product.create({
        data: {
          tenantId: tenantA.id,
          name: 'Test Product A',
          sku: 'SHARED-SKU',
          costPrice: 5,
          salePrice: 10,
          currentStock: 10,
        },
      });
      const productB = await prisma.product.create({
        data: {
          tenantId: tenantB.id,
          name: 'Test Product B',
          sku: 'SHARED-SKU',
          costPrice: 7,
          salePrice: 14,
          currentStock: 4,
        },
      });
      assert.equal(productA.sku, productB.sku);

      const service = new InventoryService(
        new AccountMappingService(),
        new AccountingPostingService(),
      );

      const sale = await service.createMovement(
        {
          productId: productA.id,
          type: 'SALE',
          quantity: 3,
        },
        tenantA.id,
        'ADMIN',
      );

      assert.equal(sale.currentStock, 7);
      assert.equal(Number(sale.movement.totalCost), 15);
      assert.equal(sale.accountingPosted, true);
      assert.equal(sale.journal.lines.length, 2);

      const debit = sale.journal.lines.find((line: any) => line.accountId === cogs.id);
      const credit = sale.journal.lines.find((line: any) => line.accountId === inventory.id);
      assert.equal(Number(debit.debitAmount), 15);
      assert.equal(Number(credit.creditAmount), 15);

      await assert.rejects(
        () =>
          service.createMovement(
            {
              productId: productA.id,
              type: 'SALE',
              quantity: 8,
            },
            tenantA.id,
            'ADMIN',
          ),
        /Insufficient stock/,
      );

      const afterRejectedSale = await prisma.product.findUnique({ where: { id: productA.id } });
      assert.equal(afterRejectedSale!.currentStock, 7);
      assert.equal(
        await prisma.stockMovement.count({ where: { tenantId: tenantA.id, productId: productA.id } }),
        1,
      );

      await assert.rejects(
        () =>
          service.createMovement(
            {
              productId: productA.id,
              type: 'TRANSFER',
              quantity: 1,
            },
            tenantA.id,
            'ADMIN',
          ),
        /stock transfer workflow/,
      );
    } finally {
      await prisma.tenant.deleteMany({ where: { id: { in: [tenantA.id, tenantB.id] } } });
      await prisma.$disconnect();
    }
  },
);
