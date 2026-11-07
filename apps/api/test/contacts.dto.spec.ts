import 'reflect-metadata';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { BadRequestException, ValidationPipe } from '@nestjs/common';
import { CreateContactDto } from '../src/crm/dto/create-contact.dto';
import { UpdateContactDto } from '../src/crm/dto/update-contact.dto';
import { ListContactsQueryDto } from '../src/crm/dto/list-contacts-query.dto';

// Same pipe as main.ts: whitelist strips non-DTO fields, transform instantiates DTOs.
const pipe = new ValidationPipe({ whitelist: true, transform: true });
const body = (value: unknown, metatype: any) => pipe.transform(value, { type: 'body', metatype });
const query = (value: unknown) => pipe.transform(value, { type: 'query', metatype: ListContactsQueryDto });

test('valid create payload passes with all mirrored form fields', async () => {
  const out = (await body({
    firstName: 'أحمد',
    lastName: 'علي',
    email: 'ahmed@example.com',
    phone: '0501234567',
    phone2: '',
    companyName: 'شركة التجارة',
    jobTitle: 'مدير',
    idNumber: '1020304050',
    vatNumber: '310122393500003',
    crNumber: '1010123456',
    city: 'الرياض',
    region: 'الرياض',
    address: 'حي النرجس',
    country: 'SA',
    type: 'CUSTOMER',
    status: 'ACTIVE',
  }, CreateContactDto)) as CreateContactDto;
  assert.equal(out.firstName, 'أحمد');
  assert.equal(out.type, 'CUSTOMER');
  assert.equal(out.status, 'ACTIVE');
  // '' optional fields are normalized to undefined
  assert.equal('phone2' in out, true);
  assert.equal(out.phone2, undefined);
});

test('system/ownership fields are stripped by the whitelist: id, createdAt, updatedAt', async () => {
  const out = (await body({
    firstName: 'أحمد',
    lastName: 'علي',
    id: 'hacked-id',
    createdAt: '2010-01-01T00:00:00Z',
    updatedAt: '2010-01-01T00:00:00Z',
    unknownField: 'x',
  }, CreateContactDto)) as CreateContactDto;
  assert.equal((out as any).id, undefined);
  assert.equal((out as any).createdAt, undefined);
  assert.equal((out as any).updatedAt, undefined);
  assert.equal((out as any).unknownField, undefined);
});

test('tenantId stays allowed in the DTO but the service gates it by role', async () => {
  const out = (await body({ firstName: 'A', lastName: 'B', tenantId: 't9' }, CreateContactDto)) as CreateContactDto;
  assert.equal(out.tenantId, 't9'); // honored only for SUPER_ADMIN (service-level gate, see service spec)
});

test('missing required firstName/lastName is rejected', async () => {
  await assert.rejects(() => body({ lastName: 'علي' }, CreateContactDto), BadRequestException);
  await assert.rejects(() => body({ firstName: '', lastName: 'علي' }, CreateContactDto), BadRequestException);
});

test('invalid email is rejected; empty email is accepted (treated as absent)', async () => {
  await assert.rejects(
    () => body({ firstName: 'A', lastName: 'B', email: 'not-an-email' }, CreateContactDto),
    BadRequestException,
  );
  const out = (await body({ firstName: 'A', lastName: 'B', email: '' }, CreateContactDto)) as CreateContactDto;
  assert.equal(out.email, undefined);
});

test('invalid type/status enums are rejected', async () => {
  await assert.rejects(
    () => body({ firstName: 'A', lastName: 'B', type: 'NOT_A_TYPE' }, CreateContactDto),
    BadRequestException,
  );
  await assert.rejects(
    () => body({ firstName: 'A', lastName: 'B', status: 'GHOST' }, CreateContactDto),
    BadRequestException,
  );
});

test('update DTO accepts partial payloads and strips system fields', async () => {
  const out = (await body({ firstName: 'جديد', tenantId: 'evil', id: 'evil' }, UpdateContactDto)) as UpdateContactDto;
  assert.equal(out.firstName, 'جديد');
  assert.equal((out as any).id, undefined);
});

test('query defaults: page=1, limit=25 when omitted', async () => {
  const out = (await query({})) as ListContactsQueryDto;
  assert.equal(out.page, 1);
  assert.equal(out.limit, 25);
});

test('query transforms numeric strings explicitly', async () => {
  const out = (await query({ page: '2', limit: '10', search: 'أحمد' })) as ListContactsQueryDto;
  assert.equal(out.page, 2);
  assert.equal(out.limit, 10);
  assert.equal(out.search, 'أحمد');
});

test('query rejects limit above 100 and non-integer page', async () => {
  await assert.rejects(() => query({ limit: '500' }), BadRequestException);
  await assert.rejects(() => query({ page: 'abc' }), BadRequestException);
  await assert.rejects(() => query({ page: '1.5' }), BadRequestException);
});

test('query rejects invalid type/status filter values', async () => {
  await assert.rejects(() => query({ type: 'EVERYTHING' }), BadRequestException);
  await assert.rejects(() => query({ status: 'MAYBE' }), BadRequestException);
});

test('query passes type/status filters through', async () => {
  const out = (await query({ type: 'LEAD', status: 'CONVERTED' })) as ListContactsQueryDto;
  assert.equal(out.type, 'LEAD');
  assert.equal(out.status, 'CONVERTED');
});
