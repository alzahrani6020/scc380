import 'reflect-metadata';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { BadRequestException, NotFoundException, ValidationPipe } from '@nestjs/common';
import { NotificationsService } from '../src/notifications/notifications.service';
import { ActivityReminderService } from '../src/crm/activity-reminder.service';
import { ListDealsQueryDto } from '../src/crm/dto/list-deals-query.dto';
import { ListActivitiesQueryDto } from '../src/crm/dto/list-activities-query.dto';

function matches(row: any, where: any): boolean {
  if (!where) return true;
  for (const [key, cond] of Object.entries(where)) {
    if (cond !== null && typeof cond === 'object') {
      if ('not' in (cond as any)) {
        if (row[key] === (cond as any).not) return false;
        continue;
      }
      if ('lte' in (cond as any)) {
        if (!(new Date(row[key]).getTime() <= new Date((cond as any).lte).getTime())) return false;
        continue;
      }
    }
    if (row[key] !== cond) return false;
  }
  return true;
}

function makeNotificationDb() {
  const users = [
    { id: 'u1', tenantId: 't1', status: 'ACTIVE' },
    { id: 'u2', tenantId: 't2', status: 'ACTIVE' },
    { id: 'u3', tenantId: 't1', status: 'INACTIVE' },
  ];
  const notifications: any[] = [
    { id: 'n1', tenantId: 't1', userId: 'u1', title: 'A', body: 'a', readAt: null, status: 'PENDING', createdAt: new Date('2026-01-03') },
    { id: 'n2', tenantId: 't2', userId: 'u2', title: 'B', body: 'b', readAt: null, status: 'PENDING', createdAt: new Date('2026-01-02') },
  ];
  return {
    users,
    notifications,
    user: {
      async findFirst({ where }: any) {
        return users.find((u) => matches(u, where)) ?? null;
      },
    },
    notification: {
      async findMany({ where, skip = 0, take = 25 }: any) {
        return notifications.filter((n) => matches(n, where)).slice(skip, skip + take);
      },
      async count({ where }: any) {
        return notifications.filter((n) => matches(n, where)).length;
      },
      async findFirst({ where }: any) {
        return notifications.find((n) => matches(n, where)) ?? null;
      },
      async create({ data }: any) {
        const row = { id: `n${notifications.length + 1}`, createdAt: new Date(), readAt: null, ...data };
        notifications.push(row);
        return row;
      },
      async update({ where, data }: any) {
        const row = notifications.find((n) => n.id === where.id);
        if (!row) throw new Error('not found');
        Object.assign(row, data);
        return row;
      },
      async updateMany({ where, data }: any) {
        const rows = notifications.filter((n) => matches(n, where));
        rows.forEach((n) => Object.assign(n, data));
        return { count: rows.length };
      },
      async delete({ where }: any) {
        const idx = notifications.findIndex((n) => n.id === where.id);
        if (idx < 0) throw new Error('not found');
        return notifications.splice(idx, 1)[0];
      },
    },
  };
}

test('notifications dynamically reject cross-tenant and inactive targets', async () => {
  const db = makeNotificationDb();
  const service = new NotificationsService(db as any);
  const req = { user: { role: 'ADMIN', tenantId: 't1', userId: 'u1' } };

  const ok = await service.create(req, { userId: 'u1', title: 'ok', body: 'ok' });
  assert.equal(ok.tenantId, 't1');

  await assert.rejects(
    () => service.create(req, { userId: 'u2', title: 'x', body: 'x' }),
    BadRequestException,
  );
  await assert.rejects(
    () => service.create(req, { userId: 'u3', title: 'x', body: 'x' }),
    BadRequestException,
  );
});

test('notifications dynamically isolate read and mutation by tenant/user', async () => {
  const db = makeNotificationDb();
  const service = new NotificationsService(db as any);
  const req = { user: { role: 'USER', tenantId: 't1', userId: 'u1' } };

  const list = await service.findAll(req, { page: 1, limit: 25 });
  assert.equal(list.count, 1);
  assert.equal(list.data[0].id, 'n1');

  await assert.rejects(() => service.markAsRead(req, 'n2'), NotFoundException);
  assert.equal(db.notifications.find((n) => n.id === 'n2')!.readAt, null);
});

test('SUPER_ADMIN notifications require explicit selected tenant', async () => {
  const db = makeNotificationDb();
  const service = new NotificationsService(db as any);
  const noTenant = { user: { role: 'SUPER_ADMIN', userId: 'root' } };
  const selected = { user: { role: 'SUPER_ADMIN', userId: 'root' }, tenantId: 't2' };

  const empty = await service.findAll(noTenant, { page: 1, limit: 25 });
  assert.equal(empty.count, 0);

  const scoped = await service.findAll(selected, { page: 1, limit: 25 });
  assert.equal(scoped.count, 1);
  assert.equal(scoped.data[0].tenantId, 't2');
});

test('dynamic reminder claims once and creates one in-app notification', async () => {
  const activity = {
    id: 'a1',
    tenantId: 't1',
    assignedToId: 'u1',
    subject: 'Follow up',
    scheduledAt: new Date('2026-01-02T10:00:00Z'),
    remindAt: new Date('2026-01-01T09:00:00Z'),
    reminded: false,
  };
  const created: any[] = [];
  const db: any = {
    activity: {
      async findMany() {
        return activity.reminded ? [] : [activity];
      },
    },
    async $transaction(fn: any) {
      return fn({
        activity: {
          async updateMany({ where, data }: any) {
            if (activity.id === where.id && activity.reminded === false) {
              Object.assign(activity, data);
              return { count: 1 };
            }
            return { count: 0 };
          },
        },
        notification: {
          async create({ data }: any) {
            created.push(data);
            return data;
          },
        },
      });
    },
  };

  const service = new ActivityReminderService(db);
  await service.deliverDueReminders();
  await service.deliverDueReminders();

  assert.equal(activity.reminded, true);
  assert.equal(created.length, 1);
  assert.equal(created[0].tenantId, 't1');
  assert.equal(created[0].userId, 'u1');
  assert.equal(created[0].type, 'CRM_ACTIVITY_REMINDER');
});

const pipe = new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true });

test('deal/activity query DTOs dynamically reject invalid filters and bounds', async () => {
  await assert.rejects(
    () => pipe.transform({ stage: 'INVALID' }, { type: 'query', metatype: ListDealsQueryDto }),
    BadRequestException,
  );
  await assert.rejects(
    () => pipe.transform({ limit: '101' }, { type: 'query', metatype: ListDealsQueryDto }),
    BadRequestException,
  );
  await assert.rejects(
    () => pipe.transform({ type: 'INVALID' }, { type: 'query', metatype: ListActivitiesQueryDto }),
    BadRequestException,
  );

  const valid = await pipe.transform(
    { page: '2', limit: '50' },
    { type: 'query', metatype: ListActivitiesQueryDto },
  ) as ListActivitiesQueryDto;
  assert.equal(valid.page, 2);
  assert.equal(valid.limit, 50);
});
