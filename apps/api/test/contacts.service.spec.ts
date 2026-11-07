import 'reflect-metadata';
import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { NotFoundException } from '@nestjs/common';
import { ContactsService } from '../src/crm/contacts.service';
import { deriveAuditAction } from '../src/common/interceptors/audit-log.interceptor';

// ---------- in-memory fake for the PrismaClient contact model ----------

function matches(row: any, where: any): boolean {
  if (!where) return true;
  for (const [key, cond] of Object.entries(where)) {
    if (key === 'OR') {
      if (!(cond as any[]).some((c) => matches(row, c))) return false;
      continue;
    }
    if (cond !== null && typeof cond === 'object') {
      if ('contains' in (cond as any)) {
        const raw = row[key] == null ? '' : String(row[key]);
        if (!raw.toLowerCase().includes(String((cond as any).contains).toLowerCase())) return false;
        continue;
      }
    }
    if (row[key] !== cond) return false;
  }
  return true;
}

function makeFakeDb(seedRows: any[]) {
  const rows = [...seedRows];
  let seq = rows.length;
  return {
    rows,
    contact: {
      async findMany({ where, skip = 0, take }: any) {
        const filtered = rows
          .filter((r) => matches(r, where))
          .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
        return take === undefined ? filtered.slice(skip) : filtered.slice(skip, skip + take);
      },
      async count({ where }: any) {
        return rows.filter((r) => matches(r, where)).length;
      },
      async findFirst({ where }: any) {
        return rows.find((r) => matches(r, where)) ?? null;
      },
      async create({ data }: any) {
        seq += 1;
        const row = {
          id: `c${seq}`,
          createdAt: new Date('2026-01-01T00:00:00Z'),
          updatedAt: new Date('2026-01-01T00:00:00Z'),
          ...data,
        };
        rows.push(row);
        return row;
      },
      async update({ where, data }: any) {
        const row = rows.find((r) => r.id === where.id);
        if (!row) throw new Error('record not found');
        Object.assign(row, data);
        return row;
      },
      async delete({ where }: any) {
        const idx = rows.findIndex((r) => r.id === where.id);
        if (idx === -1) throw new Error('record not found');
        const [row] = rows.splice(idx, 1);
        return row;
      },
    },
  };
}

function seedRow(i: number, over: Partial<any> = {}) {
  return {
    id: `c${i}`,
    tenantId: i % 2 === 0 ? 't1' : 't2',
    firstName: `User${i}`,
    lastName: i === 2 ? 'ahmed' : 'smith',
    email: `user${i}@example.com`,
    phone: `05000000${i % 10}`,
    type: i % 3 === 0 ? 'CUSTOMER' : 'LEAD',
    status: i % 4 === 0 ? 'INACTIVE' : 'ACTIVE',
    createdAt: new Date(2026, 0, 1, 0, 0, i),
    ...over,
  };
}

const TENANT_USER = { role: 'ADMIN', tenantId: 't1' };
const SUPER = { role: 'SUPER_ADMIN', tenantId: undefined };

let db: ReturnType<typeof makeFakeDb>;
let service: ContactsService;

beforeEach(() => {
  db = makeFakeDb(Array.from({ length: 30 }, (_, i) => seedRow(i)));
  service = new ContactsService(db as any);
});

// ---------- contract shape ----------

test('findAll returns { data, count, page, limit } with data as array', async () => {
  const res = await service.findAll('t1', 'ADMIN', {});
  assert.ok(Array.isArray(res.data));
  assert.equal(typeof res.count, 'number');
  assert.equal(res.page, 1);
  assert.equal(res.limit, 25);
});

test('default pagination: first page capped at 25, count reflects tenant-scoped total', async () => {
  const res = await service.findAll('t1', 'ADMIN', {});
  assert.equal(res.data.length, 15); // tenant t1 has 15 of the 30 seeded rows
  assert.equal(res.count, 15);
  assert.equal(res.page, 1);
  assert.equal(res.limit, 25);
});

test('page 2 returns remaining items', async () => {
  const res = await service.findAll('t1', 'ADMIN', { page: 2, limit: 10 });
  assert.equal(res.data.length, 5);
  assert.equal(res.count, 15);
  assert.equal(res.page, 2);
  assert.equal(res.limit, 10);
});

test('limit is clamped to max 100 even when a larger value is passed', async () => {
  const big = makeFakeDb(Array.from({ length: 240 }, (_, i) => seedRow(i)));
  const svc = new ContactsService(big as any);
  const res = await svc.findAll('t1', 'ADMIN', { limit: 500 });
  assert.equal(res.limit, 100);
  assert.equal(res.data.length, 100); // t1 holds 120 of 240; take=100 leaves 20 for page 2
  const page2 = await svc.findAll('t1', 'ADMIN', { limit: 500, page: 2 });
  assert.equal(page2.data.length, 20);
});

test('page and limit are sanitized when non-positive values are passed', async () => {
  const res = await service.findAll('t1', 'ADMIN', { page: -3, limit: 0 });
  assert.equal(res.page, 1);
  assert.equal(res.limit, 25);
});

// ---------- filters ----------

test('search matches firstName case-insensitively (same where for count)', async () => {
  const res = await service.findAll('t1', 'ADMIN', { search: 'AHMED' });
  assert.equal(res.data.length, 1);
  assert.equal(res.count, 1);
  assert.equal(res.data[0].lastName, 'ahmed');
  assert.equal(res.data[0].tenantId, 't1');
});

test('search matches email and phone substrings', async () => {
  const byEmail = await service.findAll('t1', 'ADMIN', { search: 'user2@' });
  assert.ok(byEmail.count >= 1);
  const byPhone = await service.findAll('t1', 'ADMIN', { search: '05000000' });
  assert.equal(byPhone.count, 15);
});

test('non-matching search returns empty data with count 0', async () => {
  const res = await service.findAll('t1', 'ADMIN', { search: 'zzz-no-match' });
  assert.equal(res.data.length, 0);
  assert.equal(res.count, 0);
});

test('type and status filters narrow both data and count', async () => {
  const res = await service.findAll('t1', 'ADMIN', { type: 'CUSTOMER', status: 'ACTIVE' });
  assert.ok(res.data.every((c: any) => c.type === 'CUSTOMER' && c.status === 'ACTIVE'));
  // t1 rows are even indices; CUSTOMER at i%3==0 and ACTIVE at i%4!=0 → i=6 and i=18 only
  assert.equal(res.count, 2);
  assert.equal(res.data.length, 2);
});

// ---------- tenant isolation (phase 6) ----------

test('regular user only sees their own tenant rows', async () => {
  const res = await service.findAll('t1', 'ADMIN', {});
  assert.ok(res.data.every((c: any) => c.tenantId === 't1'));
});

test('findOne for another tenant id throws NotFound', async () => {
  const otherTenantRow = db.rows.find((r) => r.tenantId === 't2')!;
  await assert.rejects(
    () => service.findOne('t1', 'ADMIN', otherTenantRow.id),
    (err: any) => err instanceof NotFoundException && err.getStatus() === 404,
  );
});

test('update of another tenant contact throws NotFound (no cross-tenant write)', async () => {
  const otherTenantRow = db.rows.find((r) => r.tenantId === 't2')!;
  await assert.rejects(
    () => service.update('t1', 'ADMIN', otherTenantRow.id, { firstName: 'hacked' } as any),
    (err: any) => err instanceof NotFoundException,
  );
  assert.equal(db.rows.find((r) => r.id === otherTenantRow.id)!.firstName, otherTenantRow.firstName);
});

test('delete of another tenant contact throws NotFound (no cross-tenant delete)', async () => {
  const otherTenantRow = db.rows.find((r) => r.tenantId === 't2')!;
  const before = db.rows.length;
  await assert.rejects(
    () => service.delete('t1', 'ADMIN', otherTenantRow.id),
    (err: any) => err instanceof NotFoundException,
  );
  assert.equal(db.rows.length, before);
});

test('SUPER_ADMIN list is not tenant-scoped (existing behavior preserved)', async () => {
  const res = await service.findAll(undefined, 'SUPER_ADMIN', {});
  assert.equal(res.count, 30);
});

// ---------- tenantId / system-field immutability ----------

test('regular user cannot set tenantId on create — forced to own tenant', async () => {
  const row = await service.create('t1', 'ADMIN', {
    firstName: 'Ali',
    lastName: 'Saleh',
    tenantId: 't2', // malicious attempt
  } as any);
  assert.equal(row.tenantId, 't1');
});

test('regular user cannot move a contact via update — tenantId ignored', async () => {
  const mine = db.rows.find((r) => r.tenantId === 't1')!;
  await service.update('t1', 'ADMIN', mine.id, { tenantId: 't2', firstName: 'New' } as any);
  const after = db.rows.find((r) => r.id === mine.id)!;
  assert.equal(after.tenantId, 't1');
  assert.equal(after.firstName, 'New');
});

test('client-supplied id/createdAt/updatedAt are never written on create', async () => {
  const row = await service.create('t1', 'ADMIN', {
    firstName: 'Sara',
    lastName: 'Noor',
    id: 'hacked-id',
    createdAt: '2010-01-01T00:00:00Z',
    updatedAt: '2010-01-01T00:00:00Z',
  } as any);
  assert.notEqual(row.id, 'hacked-id');
  assert.ok(row.createdAt instanceof Date);
  assert.notEqual(row.createdAt.getFullYear(), 2010);
});

// ---------- SUPER_ADMIN create: A/B proven behavior (phase 7) ----------

test('SUPER_ADMIN without tenantId throws NotFoundException with the existing message', async () => {
  await assert.rejects(
    () => service.create(undefined, 'SUPER_ADMIN', { firstName: 'X', lastName: 'Y' } as any),
    (err: any) =>
      err instanceof NotFoundException &&
      err.getStatus() === 404 &&
      err.message === 'Super Admin must specify tenantId when creating',
  );
});

test('SUPER_ADMIN with tenantId creates the contact under that tenant', async () => {
  const row = await service.create(undefined, 'SUPER_ADMIN', {
    firstName: 'X',
    lastName: 'Y',
    tenantId: 't9',
  } as any);
  assert.equal(row.tenantId, 't9');
  assert.equal(db.rows.find((r) => r.id === row.id)!.tenantId, 't9');
});

test('SUPER_ADMIN can still reassign a contact via update (current behavior preserved)', async () => {
  const anyRow = db.rows[0];
  await service.update(undefined, 'SUPER_ADMIN', anyRow.id, { tenantId: 't7' } as any);
  assert.equal(db.rows.find((r) => r.id === anyRow.id)!.tenantId, 't7');
});

// ---------- audit action labels (phase 13) ----------

test('deriveAuditAction maps contacts mutations to CONTACT_* labels', () => {
  assert.equal(deriveAuditAction('POST', '/api/crm/contacts'), 'CONTACT_CREATED');
  assert.equal(deriveAuditAction('PATCH', '/api/crm/contacts/c1'), 'CONTACT_UPDATED');
  assert.equal(deriveAuditAction('PUT', '/api/crm/contacts/c1'), 'CONTACT_UPDATED');
  assert.equal(deriveAuditAction('DELETE', '/api/crm/contacts/c1'), 'CONTACT_DELETED');
  assert.equal(deriveAuditAction('POST', '/api/crm/deals'), 'POST'); // other routes unchanged
  assert.equal(deriveAuditAction('PATCH', '/api/crm/deals/d1'), 'PATCH');
});
