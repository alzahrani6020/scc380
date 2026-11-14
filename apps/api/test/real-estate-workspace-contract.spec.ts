import 'reflect-metadata';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { PropertiesController } from '../src/real-estate/properties.controller';
import { UnitsController } from '../src/real-estate/units.controller';
import { LeaseContractsController } from '../src/real-estate/lease-contracts.controller';
import { RentPaymentsController } from '../src/real-estate/rent-payments.controller';
import { REQUIRE_PERMISSIONS_KEY } from '../src/auth/guards/permissions.guard';

const contracts = [
  { controller: PropertiesController, api: 'real-estate/properties', page: 'properties', methods: ['findAll', 'summary', 'findOne', 'create', 'update', 'remove'] },
  { controller: UnitsController, api: 'real-estate/units', page: 'units', methods: ['findAll', 'findOne', 'create', 'update', 'remove'] },
  { controller: LeaseContractsController, api: 'real-estate/contracts', page: 'contracts', methods: ['findAll', 'findOne', 'create', 'update', 'remove', 'renew', 'activate', 'paymentPreview', 'terminate', 'ejarSync'] },
  { controller: RentPaymentsController, api: 'real-estate/payments', page: 'payments', methods: ['findAll', 'findOne', 'create', 'update', 'remove', 'record', 'overdueReport'] },
] as const;

for (const { controller, api, page, methods } of contracts) {
  test(`real-estate workspace ${page} is wired to guarded API routes`, () => {
    assert.equal(Reflect.getMetadata('path', controller), api);
    assert.ok((Reflect.getMetadata('__guards__', controller) || []).length >= 2, `${page}: controller guards missing`);
    const file = readFileSync(join(__dirname, '../../web/src/app/dashboard/real-estate', page, 'page.tsx'), 'utf8');
    assert.ok(file.includes(`/real-estate/${page}`), `${page}: missing API client route`);
    for (const method of methods) {
      const handler = (controller.prototype as any)[method];
      assert.equal(typeof handler, 'function', `${page}:${method} missing`);
      const permissions = Reflect.getMetadata(REQUIRE_PERMISSIONS_KEY, handler);
      assert.ok(Array.isArray(permissions) && permissions.length > 0, `${page}:${method} lacks permission metadata`);
      assert.ok(permissions.every((permission: string) => permission.startsWith('real-estate:')), `${page}:${method} uses wrong permission namespace`);
    }
  });
}

test('unit form enum strings match Prisma schema and guard vacancy states', () => {
  const schema = readFileSync(join(__dirname, '../../../packages/database/prisma/schema.prisma'), 'utf8');
  const units = readFileSync(join(__dirname, '../../web/src/app/dashboard/real-estate/units/page.tsx'), 'utf8');
  const enumValues = (name: string) => {
    const prefix = 'enum ' + name + ' {';
    const start = schema.indexOf(prefix);
    assert.ok(start >= 0, name + ' missing');
    const end = schema.indexOf('}', start + prefix.length);
    assert.ok(end > start, name + ' not terminated');
    return new Set(schema.slice(start + prefix.length, end).split('\n').map(line => line.trim()).filter(Boolean));
  };
  const types = enumValues('UnitType');
  const statuses = enumValues('UnitStatus');
  const typeLine = units.split('\n').find(line => line.startsWith('const unitTypes=')) || '';
  const statusLine = units.split('\n').find(line => line.startsWith('const statuses=')) || '';
  for (const match of typeLine.matchAll(/value:'([^']+)'/g)) assert.ok(types.has(match[1]), `invalid UnitType ${match[1]}`);
  for (const match of statusLine.matchAll(/value:'([^']+)'/g)) assert.ok(statuses.has(match[1]), `invalid UnitStatus ${match[1]}`);
  assert.ok(typeLine.includes("value:'LAND_PLOT'"));
  assert.ok(statusLine.includes("value:'UNDER_MAINTENANCE'"));
});

test('lease workspace discloses amount per installment and supports all payment frequencies', () => {
  const schema = readFileSync(join(__dirname, '../../../packages/database/prisma/schema.prisma'), 'utf8');
  const page = readFileSync(join(__dirname, '../../web/src/app/dashboard/real-estate/contracts/page.tsx'), 'utf8');
  const start = schema.indexOf('enum PaymentFrequency {');
  assert.ok(start >= 0);
  const end = schema.indexOf('}', start);
  const allowed = schema.slice(start + 'enum PaymentFrequency {'.length, end).split('\n').map(s => s.trim()).filter(Boolean);
  const line = page.split('\n').find(s => s.startsWith('const frequencies=')) || '';
  const presented = [...line.matchAll(/value:'([^']+)'/g)].map(m => m[1]);
  assert.deepEqual(new Set(presented), new Set(allowed));
  assert.ok(page.includes('قيمة كل دفعة إيجار'));
  assert.ok(page.includes('ليست إجمالي قيمة العقد'));
  assert.ok(page.includes("/real-estate/contracts/'+id+'/activate"));
  assert.ok(page.includes("/real-estate/contracts/'+id+'/payment-preview"));
  assert.ok(page.includes('totalScheduledAmount'));
});
