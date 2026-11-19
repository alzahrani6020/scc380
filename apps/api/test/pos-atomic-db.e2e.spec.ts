import { randomUUID } from 'node:crypto';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { prisma } from '@scc/database';
import { PosService } from '../src/pos/pos.service';
import { UsersService } from '../src/users/users.service';

test('POS: open-session ownership, atomic stock, idempotency, tenant isolation and settings persistence', {
  skip: process.env.CRM_DB_E2E !== '1' ? 'CRM_DB_E2E=1 required' : false,
}, async () => {
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

    const again = await pos.createOrder(dto(key, [{ productId: productA.id, quantity: 2 }], '23.00') as any,
      userA.id, tenantA.id, 'ADMIN');
    assert.equal(again.id, order.id);
    assert.equal(await prisma.posOrder.count({ where: { tenantId: tenantA.id } }), 1);
    assert.equal((await prisma.product.findUniqueOrThrow({ where: { id: productA.id } })).currentStock, 3);

    await assert.rejects(() =>
      pos.createOrder(dto(randomUUID(), [{ productId: productA.id, quantity: 4 }], '46.00') as any,
        userA.id, tenantA.id, 'ADMIN'), /Insufficient stock/);

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
