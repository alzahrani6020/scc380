import { randomUUID } from 'node:crypto';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { prisma } from '@scc/database';
import { PosService } from '../src/pos/pos.service';
import { PosController } from '../src/pos/pos.controller';
import { InventoryService } from '../src/inventory/inventory.service';
import { AccountMappingService } from '../src/accounting-core/account-mapping.service';
import { AccountingPostingService } from '../src/accounting-core/accounting-posting.service';
import { UsersService } from '../src/users/users.service';

test('POS: open-session ownership, atomic stock, idempotency, tenant isolation and settings persistence', {
  skip: process.env.CRM_DB_E2E !== '1' ? 'CRM_DB_E2E=1 required' : false,
}, async () => {
  // Daily report date must be bound from the query string, not a route param.
  const reportArgs = Reflect.getMetadata('__routeArguments__', PosController, 'getDailyReport') as Record<string, { data?: string; index?: number }> | undefined;
  assert.ok(reportArgs, 'daily report parameter metadata must exist');
  assert.ok(
    Object.entries(reportArgs).some(([key, value]) =>
      key.startsWith('4:') && value.index === 1 && value.data === 'date'),
    'GET /pos/reports/daily must read ?date=YYYY-MM-DD',
  );

  const unique = randomUUID().slice(0, 12);
  const [tenantA, tenantB] = await Promise.all([
    prisma.tenant.create({ data: { name: 'POS A '+unique, slug: 'pos-a-'+unique } }),
    prisma.tenant.create({ data: { name: 'POS B '+unique, slug: 'pos-b-'+unique } }),
  ]);
  const pos = new PosService();
  const users = new UsersService();
  try {
    const [userA, userB] = await Promise.all([
      prisma.user.create({ data: {
        email: 'pos-a-'+unique+'@example.test', firstName: 'POS', lastName: 'A',
        role: 'ADMIN', tenantId: tenantA.id,
        preferences: { keepExisting: true },
      } }),
      prisma.user.create({ data: {
        email: 'pos-b-'+unique+'@example.test', firstName: 'POS', lastName: 'B',
        role: 'ADMIN', tenantId: tenantB.id,
      } }),
    ]);
    const [productA, productB, productX] = await Promise.all([
      prisma.product.create({ data: {
        tenantId: tenantA.id, name: 'A', sku: 'POS-A', salePrice: 10,
        taxRate: 15, costPrice: 3, currentStock: 5,
      } }),
      prisma.product.create({ data: {
        tenantId: tenantA.id, name: 'B', sku: 'POS-B', salePrice: 10,
        taxRate: 15, costPrice: 4, currentStock: 1,
      } }),
      prisma.product.create({ data: {
        tenantId: tenantB.id, name: 'X', sku: 'POS-X', salePrice: 30,
        taxRate: 15, currentStock: 5,
      } }),
    ]);

    const dto = (id: string, items: { productId: string; quantity: number }[], amount: string) => ({
      clientOrderId: id,
      items: items.map(item => ({
        ...item, productName: 'Spoofed name', unitPrice: '0.0000',
      })),
      payments: [{ method: 'CASH', amount }],
    });

    await assert.rejects(() =>
      pos.createOrder(dto(randomUUID(), [{ productId: productA.id, quantity: 1 }], '11.50') as any,
        userA.id, tenantA.id, 'ADMIN'),
      /Open POS session is required/);

    const session = await pos.openSession({ openingCash: '0.00' }, userA.id, tenantA.id, 'ADMIN');
    assert.equal(session.userId, userA.id);
    await assert.rejects(() => pos.openSession({ openingCash: '0.00' }, userA.id, tenantA.id, 'ADMIN'),
      /already have an open session/);

    // An unconfigured chart must reject the sale without mutating order, stock,
    // payment, movement or journals.
    await assert.rejects(() =>
      pos.createOrder(dto(randomUUID(), [{ productId: productA.id, quantity: 1 }], '11.50') as any,
        userA.id, tenantA.id, 'ADMIN'),
      /Missing active accounting mappings/);
    assert.equal((await prisma.product.findUniqueOrThrow({ where: { id: productA.id } })).currentStock, 5);
    assert.equal(await prisma.posOrder.count({ where: { tenantId: tenantA.id } }), 0);
    assert.equal(await prisma.journalEntryHeader.count({ where: { tenantId: tenantA.id } }), 0);

    const journalAccounts = await Promise.all([
      ['1110', 'Cash', 'ASSET'],
      ['1130', 'Inventory', 'ASSET'],
      ['2100', 'Inventory opening counterpart', 'LIABILITY'],
      ['2110', 'VAT payable', 'LIABILITY'],
      ['4100', 'Sales revenue', 'REVENUE'],
      ['5600', 'Cost of goods sold', 'EXPENSE'],
    ].map(([code, name, type]) =>
      prisma.chartOfAccount.create({
        data: { tenantId: tenantA.id, code, name, type: type as any },
      })));
    const ledgerByCode = Object.fromEntries(journalAccounts.map(a => [a.code, a.id]));

    // A product belonging to another tenant must be rejected before any stock change.
    await assert.rejects(() =>
      pos.createOrder(dto(randomUUID(), [{ productId: productX.id, quantity: 1 }], '34.50') as any,
        userA.id, tenantA.id, 'ADMIN'),
      /not available in your tenant/);

    // Item A decrements first; item B shortage must roll back A and all order writes.
    const badKey = randomUUID();
    await assert.rejects(() =>
      pos.createOrder(dto(badKey, [
        { productId: productA.id, quantity: 2 }, { productId: productB.id, quantity: 2 },
      ], '46.00') as any, userA.id, tenantA.id, 'ADMIN'),
      /Insufficient stock/);
    assert.equal((await prisma.product.findUniqueOrThrow({ where: { id: productA.id } })).currentStock, 5);
    assert.equal(await prisma.posOrder.count({ where: { tenantId: tenantA.id } }), 0);
    assert.equal(await prisma.stockMovement.count({ where: { tenantId: tenantA.id, type: 'SALE' } }), 0);

    await assert.rejects(() =>
      pos.createOrder(dto(randomUUID(), [{ productId: productA.id, quantity: 1 }], '0.01') as any,
        userA.id, tenantA.id, 'ADMIN'),
      /Payment amount does not match/);

    const key = randomUUID();
    const order = await pos.createOrder(dto(key, [{ productId: productA.id, quantity: 2 }], '23.00') as any,
      userA.id, tenantA.id, 'ADMIN');
    assert.equal(order.sessionId, session.id);
    assert.equal(order.tenantId, tenantA.id);
    assert.equal(Number(order.total), 23);
    assert.equal(Number(order.items[0].unitPrice), 10, 'client may not override price');
    assert.equal(order.items[0].productName, 'A', 'client may not override product name');
    assert.equal((await prisma.product.findUniqueOrThrow({ where: { id: productA.id } })).currentStock, 3);
    assert.equal(await prisma.stockMovement.count({ where: { referenceId: order.id } }), 1);
    assert.equal(await prisma.posPayment.count({ where: { orderId: order.id } }), 1);
    const journal = await prisma.journalEntryHeader.findFirst({
      where: { tenantId: tenantA.id, sourceType: 'POS_ORDER', sourceId: order.id },
      include: { lines: true },
    });
    assert.ok(journal, 'a committed sale must have a posted journal');
    assert.equal(journal!.status, 'POSTED');
    assert.equal(journal!.lines.length, 5);
    const lineTotals = journal!.lines.reduce((acc, line) => ({
      debit: acc.debit + Number(line.debitAmount),
      credit: acc.credit + Number(line.creditAmount),
    }), { debit: 0, credit: 0 });
    assert.equal(lineTotals.debit, 29);
    assert.equal(lineTotals.credit, 29);
    assert.deepEqual(
      journal!.lines.map(l => [l.accountId, Number(l.debitAmount), Number(l.creditAmount)]),
      [
        [ledgerByCode['1110'], 23, 0],
        [ledgerByCode['4100'], 0, 20],
        [ledgerByCode['2110'], 0, 3],
        [ledgerByCode['5600'], 6, 0],
        [ledgerByCode['1130'], 0, 6],
      ]);


    const again = await pos.createOrder(dto(key, [{ productId: productA.id, quantity: 2 }], '23.00') as any,
      userA.id, tenantA.id, 'ADMIN');
    assert.equal(again.id, order.id);
    assert.equal(await prisma.posOrder.count({ where: { tenantId: tenantA.id } }), 1);
    assert.equal(await prisma.journalEntryHeader.count({
      where: { tenantId: tenantA.id, sourceType: 'POS_ORDER', sourceId: order.id },
    }), 1, 'duplicate retry must not repost the sale');

    assert.equal((await prisma.product.findUniqueOrThrow({ where: { id: productA.id } })).currentStock, 3);

    await assert.rejects(() =>
      pos.createOrder(dto(randomUUID(), [{ productId: productA.id, quantity: 4 }], '46.00') as any,
        userA.id, tenantA.id, 'ADMIN'), /Insufficient stock/);

    // Two terminals racing for a single remaining unit: at most one sale may commit.
    // A serialization conflict is an acceptable failure for the losing request.
    const raceProduct = await prisma.product.create({ data: {
      tenantId: tenantA.id, name: 'Race', sku: 'POS-RACE-'+unique,
      salePrice: 10, taxRate: 15, currentStock: 1,
    } });
    const raceKeys = [randomUUID(), randomUUID()];
    const race = await Promise.allSettled(raceKeys.map(id =>
      pos.createOrder(dto(id, [{ productId: raceProduct.id, quantity: 1 }], '11.50') as any,
        userA.id, tenantA.id, 'ADMIN')));
    const winners = race.filter(r => r.status === 'fulfilled');
    assert.equal(winners.length, 1, 'only one concurrent sale may commit');
    const winner = winners[0] as PromiseFulfilledResult<any>;
    assert.equal((await prisma.product.findUniqueOrThrow({ where: { id: raceProduct.id } })).currentStock, 0);
    assert.equal(await prisma.posOrder.count({
      where: { tenantId: tenantA.id, orderNumber: { in: raceKeys.map(id => 'POS-'+id) } },
    }), 1);
    assert.equal(await prisma.stockMovement.count({
      where: { productId: raceProduct.id, type: 'SALE' },
    }), 1);
    assert.equal(await prisma.posPayment.count({ where: { orderId: winner.value.id } }), 1);
    assert.equal(await prisma.journalEntryHeader.count({
      where: { tenantId: tenantA.id, sourceType: 'POS_ORDER', sourceId: winner.value.id },
    }), 1);


    // Concurrent duplicate submission must never create two invoices or stock movements.
    // The client may retry the same key after a serialization conflict.
    const duplicateProduct = await prisma.product.create({ data: {
      tenantId: tenantA.id, name: 'Duplicate', sku: 'POS-DUP-'+unique,
      salePrice: 10, taxRate: 15, currentStock: 2,
    } });
    const duplicateKey = randomUUID();
    const duplicateDto = dto(duplicateKey, [{ productId: duplicateProduct.id, quantity: 1 }], '11.50');
    const attempts = await Promise.allSettled([0, 1].map(() =>
      pos.createOrder(duplicateDto as any, userA.id, tenantA.id, 'ADMIN')));
    assert.ok(attempts.some(r => r.status === 'fulfilled'), 'at least one duplicate request must commit');
    const accepted = attempts.find(r => r.status === 'fulfilled') as PromiseFulfilledResult<any>;
    const confirmed = await pos.createOrder(duplicateDto as any, userA.id, tenantA.id, 'ADMIN');
    assert.equal(confirmed.id, accepted.value.id, 'retry must return original order');
    assert.equal(await prisma.posOrder.count({
      where: { tenantId: tenantA.id, orderNumber: 'POS-'+duplicateKey },
    }), 1);
    assert.equal((await prisma.product.findUniqueOrThrow({ where: { id: duplicateProduct.id } })).currentStock, 1);
    assert.equal(await prisma.stockMovement.count({ where: { productId: duplicateProduct.id, type: 'SALE' } }), 1);
    assert.equal(await prisma.posPayment.count({ where: { orderId: confirmed.id } }), 1);
    assert.equal(await prisma.journalEntryHeader.count({
      where: { tenantId: tenantA.id, sourceType: 'POS_ORDER', sourceId: confirmed.id },
    }), 1);


    // Verify the full public service pipeline: create product -> receive stock
    // (balanced opening journal) -> visible inventory -> POS sale -> stock
    // decrement and balanced sale journal.
    const inventory = new InventoryService(new AccountMappingService(), new AccountingPostingService());
    const receivedProduct = await inventory.createProduct({
      name: 'Real inventory flow', sku: 'POS-RECEIPT-'+unique,
      salePrice: '10.00', costPrice: '3.00', taxRate: '15.00',
    } as any, tenantA.id, 'ADMIN');
    assert.equal(receivedProduct.currentStock, 0);
    const receipt = await inventory.createMovement({
      productId: receivedProduct.id, type: 'IN', quantity: 2,
      unitCost: '3.00', counterAccountId: ledgerByCode['2100'],
    } as any, tenantA.id, 'ADMIN');
    assert.equal(receipt.currentStock, 2);
    assert.equal(receipt.accountingPosted, true);
    assert.equal(receipt.journal?.status, 'POSTED');
    assert.deepEqual(
      receipt.journal.lines.map((l: any) => [l.accountId, Number(l.debitAmount), Number(l.creditAmount)]),
      [[ledgerByCode['1130'], 6, 0], [ledgerByCode['2100'], 0, 6]],
    );
    const visibleInventory = await inventory.findAllProducts(tenantA.id, 'ADMIN');
    assert.equal(visibleInventory.find(p => p.id === receivedProduct.id)?.currentStock, 2);
    const flowOrder = await pos.createOrder(
      dto(randomUUID(), [{ productId: receivedProduct.id, quantity: 1 }], '11.50') as any,
      userA.id, tenantA.id, 'ADMIN',
    );
    assert.equal((await prisma.product.findUniqueOrThrow({ where: { id: receivedProduct.id } })).currentStock, 1);
    const saleLedger = await prisma.journalEntryHeader.findFirstOrThrow({
      where: { tenantId: tenantA.id, sourceType: 'POS_ORDER', sourceId: flowOrder.id },
      include: { lines: true },
    });
    assert.equal(saleLedger.status, 'POSTED');
    const saleDebit = saleLedger.lines.reduce((n, l) => n + Number(l.debitAmount), 0);
    const saleCredit = saleLedger.lines.reduce((n, l) => n + Number(l.creditAmount), 0);
    assert.equal(saleDebit, 14.5);
    assert.equal(saleCredit, 14.5);
    assert.equal(await prisma.stockMovement.count({
      where: { tenantId: tenantA.id, productId: receivedProduct.id, type: 'SALE', referenceId: flowOrder.id },
    }), 1);

    // POS-only payment methods must fail closed until mapped to an active
    // tenant account; they must never silently post to cash.
    const madaProduct = await prisma.product.create({ data: {
      tenantId: tenantA.id, name: 'Mada payment', sku: 'POS-MADA-'+unique,
      salePrice: 10, taxRate: 15, costPrice: 0, currentStock: 2,
    } });
    const madaDto = (orderId: string) => ({
      clientOrderId: orderId, items: [{
        productId: madaProduct.id, productName: 'Mada payment',
        quantity: 1, unitPrice: '10.00',
      }], payments: [{ method: 'MADA', amount: '11.50' }],
    });
    const madaOrderId = randomUUID();
    await assert.rejects(
      () => pos.createOrder(madaDto(madaOrderId) as any, userA.id, tenantA.id, 'ADMIN'),
      /Missing accounting payment-method mapping for POS MADA/,
    );
    assert.equal((await prisma.product.findUniqueOrThrow({ where: { id: madaProduct.id } })).currentStock, 2);
    assert.equal(await prisma.posOrder.count({ where: { tenantId: tenantA.id, orderNumber: 'POS-'+madaOrderId } }), 0);

    // Reject incorrect settlement-account classification without mutating stock.
    const invalidSettlement = await prisma.chartOfAccount.create({ data: {
      tenantId: tenantA.id, code: '1151', name: 'Invalid settlement classification', type: 'LIABILITY',
    } });
    await prisma.tenant.update({ where: { id: tenantA.id }, data: {
      settings: { accounting: { paymentMethodMapping: { MADA: invalidSettlement.code } } },
    } });
    await assert.rejects(
      () => pos.createOrder(madaDto(madaOrderId) as any, userA.id, tenantA.id, 'ADMIN'),
      /must be an ASSET account/,
    );
    assert.equal((await prisma.product.findUniqueOrThrow({ where: { id: madaProduct.id } })).currentStock, 2);

    const madaClearing = await prisma.chartOfAccount.create({ data: {
      tenantId: tenantA.id, code: '1150', name: 'Mada settlement clearing', type: 'ASSET',
    } });
    await prisma.tenant.update({ where: { id: tenantA.id }, data: {
      settings: { accounting: { paymentMethodMapping: { MADA: '1150' } } },
    } });
    const madaOrder = await pos.createOrder(madaDto(madaOrderId) as any, userA.id, tenantA.id, 'ADMIN');
    assert.equal((await prisma.product.findUniqueOrThrow({ where: { id: madaProduct.id } })).currentStock, 1);
    const madaJournal = await prisma.journalEntryHeader.findFirstOrThrow({
      where: { tenantId: tenantA.id, sourceType: 'POS_ORDER', sourceId: madaOrder.id },
      include: { lines: true },
    });
    assert.equal(madaJournal.status, 'POSTED');
    assert.deepEqual(
      madaJournal.lines.map(l => [l.accountId, Number(l.debitAmount), Number(l.creditAmount)]),
      [
        [madaClearing.id, 11.5, 0],
        [ledgerByCode['4100'], 0, 10],
        [ledgerByCode['2110'], 0, 1.5],
      ],
    );
    assert.equal(await prisma.posPayment.count({ where: { orderId: madaOrder.id, method: 'MADA' } }), 1);

    // Release drill: inspect the invoice, read the daily report, reconcile cash,
    // close the terminal and prove a different tenant cannot access the invoice.
    const fetchedOrder = await pos.findOrderById(flowOrder.id, tenantA.id, 'ADMIN');
    assert.equal(fetchedOrder.id, flowOrder.id);
    assert.equal(fetchedOrder.items.length, 1);
    assert.equal(fetchedOrder.payments.length, 1);
    assert.equal(Number(fetchedOrder.total), 11.5);
    await assert.rejects(
      () => pos.findOrderById(flowOrder.id, tenantB.id, 'ADMIN'),
      /Order not found/,
    );
    console.log('POS_RELEASE_DRILL_PASS invoice_retrieval_and_tenant_isolation');

    const daily = await pos.getDailyReport(tenantA.id, 'ADMIN');
    assert.ok(daily.totalOrders >= 1);
    assert.ok(Number(daily.totalSales) >= 11.5);
    assert.ok(daily.orders.some(item => item.id === flowOrder.id));
    const reportWithDate = await pos.getDailyReport(tenantA.id, 'ADMIN',
      new Date().toISOString().slice(0, 10));
    assert.ok(reportWithDate.orders.some(item => item.id === flowOrder.id));
    console.log('POS_RELEASE_DRILL_PASS daily_report_and_date_query');

    const sessionPayments = await prisma.posPayment.findMany({
      where: { tenantId: tenantA.id, order: { sessionId: session.id }, method: 'CASH' },
    });
    const cashReceived = sessionPayments.reduce((sum, payment) => sum + Number(payment.amount), 0);
    assert.ok(cashReceived > 0);
    await assert.rejects(
      () => pos.closeSession(session.id, { closingCash: String(cashReceived) } as any,
        tenantB.id, 'ADMIN'),
      /Open session not found/,
    );
    const closed = await pos.closeSession(session.id,
      { closingCash: String(cashReceived) } as any, tenantA.id, 'ADMIN');
    assert.equal(closed.status, 'CLOSED');
    assert.equal(Number(closed.expectedCash), cashReceived);
    assert.equal(Number(closed.closingCash), cashReceived);
    await assert.rejects(
      () => pos.closeSession(session.id, { closingCash: String(cashReceived) } as any,
        tenantA.id, 'ADMIN'),
      /Open session not found/,
    );
    console.log('POS_RELEASE_DRILL_PASS cash_reconciliation_terminal_close_and_double_close_rejection');

    assert.equal((await prisma.product.findUniqueOrThrow({
      where: { id: receivedProduct.id },
    })).currentStock, 1);
    const postedSale = await prisma.journalEntryHeader.findFirstOrThrow({
      where: { tenantId: tenantA.id, sourceType: 'POS_ORDER', sourceId: flowOrder.id },
      include: { lines: true },
    });
    assert.equal(postedSale.status, 'POSTED');
    assert.equal(postedSale.lines.reduce((n, line) => n + Number(line.debitAmount), 0),
      postedSale.lines.reduce((n, line) => n + Number(line.creditAmount), 0));
    console.log('POS_RELEASE_DRILL_PASS final_inventory_and_balanced_posted_journal');

    // Verify tax-rate accuracy for a mixed 15%/0% cart in this disposable DB.
    await pos.openSession({ openingCash: '0.00' } as any, userA.id, tenantA.id, 'ADMIN');
    const [standardVat, zeroVat] = await Promise.all([
      prisma.product.create({ data: {
        tenantId: tenantA.id, name: 'Standard VAT', sku: 'POS-VAT15-'+unique,
        salePrice: 10, taxRate: 15, costPrice: 0, currentStock: 1,
      } }),
      prisma.product.create({ data: {
        tenantId: tenantA.id, name: 'Zero VAT', sku: 'POS-VAT0-'+unique,
        salePrice: 10, taxRate: 0, costPrice: 0, currentStock: 2,
      } }),
    ]);
    const mixedOrder = await pos.createOrder(dto(randomUUID(), [
      { productId: standardVat.id, quantity: 1 },
      { productId: zeroVat.id, quantity: 1 },
    ], '21.50') as any, userA.id, tenantA.id, 'ADMIN');
    assert.equal(Number(mixedOrder.subtotal), 20);
    assert.equal(Number(mixedOrder.taxAmount), 1.5);
    assert.equal(Number(mixedOrder.taxRate), 7.5, 'header must show effective mixed VAT');
    assert.equal(Number(mixedOrder.items.find(i => i.productId === standardVat.id)?.taxRate), 15);
    assert.equal(Number(mixedOrder.items.find(i => i.productId === zeroVat.id)?.taxRate), 0);
    const mixedJournal = await prisma.journalEntryHeader.findFirstOrThrow({
      where: { tenantId: tenantA.id, sourceType: 'POS_ORDER', sourceId: mixedOrder.id },
      include: { lines: true },
    });
    assert.equal(mixedJournal.lines.reduce((v, line) => v + Number(line.debitAmount), 0),
      mixedJournal.lines.reduce((v, line) => v + Number(line.creditAmount), 0));

    const zeroOrder = await pos.createOrder(dto(randomUUID(), [
      { productId: zeroVat.id, quantity: 1 },
    ], '10.00') as any, userA.id, tenantA.id, 'ADMIN');
    assert.equal(Number(zeroOrder.taxRate), 0);
    assert.equal(Number(zeroOrder.taxAmount), 0);
    console.log('POS_RELEASE_DRILL_PASS mixed_and_zero_rate_vat_header');

    const actorA = { user: { userId: userA.id, tenantId: tenantA.id, role: 'ADMIN' } };
    const actorB = { user: { userId: userB.id, tenantId: tenantB.id, role: 'ADMIN' } };
    assert.equal((await users.getPreferences(actorA)).language, 'ar');
    await users.savePreferences(actorA, { language: 'en', notifyInvoices: false });
    assert.deepEqual(await users.getPreferences(actorA), {
      language: 'en', notifyInvoices: false, notifyEmployees: true,
      notifyFleet: true, notifyWeeklyReports: true,
    });
    const saved = await prisma.user.findUniqueOrThrow({ where: { id: userA.id } });
    assert.equal((saved.preferences as any).keepExisting, true);
    assert.equal((await users.getPreferences(actorB)).language, 'ar');
    await assert.rejects(
      () => users.savePreferences({ user: { userId: userB.id, tenantId: tenantA.id } }, { language: 'en' }),
      /User not found/);
  } finally {
    await prisma.tenant.deleteMany({ where: { id: { in: [tenantA.id, tenantB.id] } } });
  }
});
