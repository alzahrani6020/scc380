import 'reflect-metadata';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { CompaniesController } from '../src/crm/companies.controller';
import { CompaniesService } from '../src/crm/companies.service';
import { PipelinesController } from '../src/crm/pipelines.controller';
import { PipelinesService } from '../src/crm/pipelines.service';
import { DealsController } from '../src/crm/deals.controller';
import { DealsService } from '../src/crm/deals.service';
import { ActivitiesController } from '../src/crm/activities.controller';
import { ActivitiesService } from '../src/crm/activities.service';
import { JwtAuthGuard } from '../src/auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../src/auth/guards/permissions.guard';


Reflect.defineMetadata('design:paramtypes', [CompaniesService], CompaniesController);
Reflect.defineMetadata('design:paramtypes', [PipelinesService], PipelinesController);
Reflect.defineMetadata('design:paramtypes', [DealsService], DealsController);
Reflect.defineMetadata('design:paramtypes', [ActivitiesService], ActivitiesController);

async function createApp() {
  const calls: any[] = [];
  const companies = {
    findAll: async (_req: any, query: any) => {
      calls.push(['companies.findAll', query]);
      return { data: [], count: 0, page: query.page, limit: query.limit };
    },
    findOne: async (_req: any, id: string) => ({ id, name: 'Company' }),
    create: async (_req: any, dto: any) => dto,
    update: async (_req: any, id: string, dto: any) => ({ id, ...dto }),
    remove: async (_req: any, id: string) => ({ id }),
  };
  const pipelines = {
    findAll: async () => [],
    findOne: async (_req: any, id: string) => ({ id, stages: [] }),
    create: async (_req: any, dto: any) => dto,
    update: async (_req: any, id: string, dto: any) => ({ id, ...dto }),
    remove: async (_req: any, id: string) => ({ id }),
    createStage: async (_req: any, id: string, dto: any) => ({ pipelineId: id, ...dto }),
    updateStage: async (_req: any, id: string, stageId: string, dto: any) => ({ pipelineId: id, id: stageId, ...dto }),
    removeStage: async (_req: any, id: string, stageId: string) => ({ pipelineId: id, id: stageId }),
  };
  const deals = {
    findAll: async (_req: any, query: any) => {
      calls.push(['deals.findAll', query]);
      return { data: [], count: 0, page: query.page, limit: query.limit };
    },
    findOne: async (_req: any, id: string) => ({ id, title: 'Deal' }),
    create: async (_req: any, dto: any) => dto,
    update: async (_req: any, id: string, dto: any) => ({ id, ...dto }),
    remove: async (_req: any, id: string) => ({ id }),
  };
  const activities = {
    findAll: async (_req: any, query: any) => {
      calls.push(['activities.findAll', query]);
      return { data: [], count: 0, page: query.page, limit: query.limit };
    },
    findOne: async (_req: any, id: string) => ({ id, subject: 'Activity' }),
    create: async (_req: any, dto: any) => dto,
    update: async (_req: any, id: string, dto: any) => ({ id, ...dto }),
    remove: async (_req: any, id: string) => ({ id }),
  };

  const moduleRef = await Test.createTestingModule({
    controllers: [CompaniesController, PipelinesController, DealsController, ActivitiesController],
    providers: [
      { provide: CompaniesService, useValue: companies },
      { provide: PipelinesService, useValue: pipelines },
      { provide: DealsService, useValue: deals },
      { provide: ActivitiesService, useValue: activities },
    ],
  })
    .overrideGuard(JwtAuthGuard)
    .useValue({ canActivate: (context: any) => {
      context.switchToHttp().getRequest().user = { role: 'ADMIN', tenantId: 't1' };
      return true;
    } })
    .overrideGuard(PermissionsGuard)
    .useValue({ canActivate: () => true })
    .compile();

  const app = moduleRef.createNestApplication();
  app.setGlobalPrefix('api');
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));
  await app.listen(0, '127.0.0.1');
  const address = app.getHttpServer().address();
  const port = typeof address === 'object' && address ? address.port : 0;
  return { app, calls, base: `http://127.0.0.1:${port}/api` };
}

test('CRM HTTP contracts validate pagination/search and expose all four modules', async () => {
  const { app, calls, base } = await createApp();
  try {
    const companies = await fetch(`${base}/crm/companies?page=2&limit=20&search=acme&active=true`);
    assert.equal(companies.status, 200);
    assert.deepEqual(await companies.json(), { data: [], count: 0, page: 2, limit: 20 });

    const deals = await fetch(`${base}/crm/deals?page=3&limit=25&search=renewal&stage=LEAD`);
    assert.equal(deals.status, 200);
    assert.deepEqual(await deals.json(), { data: [], count: 0, page: 3, limit: 25 });

    const activities = await fetch(`${base}/crm/activities?page=4&limit=10&search=follow&type=TASK&sort=recent`);
    assert.equal(activities.status, 200);
    assert.deepEqual(await activities.json(), { data: [], count: 0, page: 4, limit: 10 });

    const pipelines = await fetch(`${base}/crm/pipelines`);
    assert.equal(pipelines.status, 200);
    assert.deepEqual(await pipelines.json(), []);

    assert.equal(calls.find((c) => c[0] === 'companies.findAll')?.[1].search, 'acme');
    assert.equal(calls.find((c) => c[0] === 'deals.findAll')?.[1].search, 'renewal');
    assert.equal(calls.find((c) => c[0] === 'activities.findAll')?.[1].search, 'follow');
  } finally {
    await app.close();
  }
});

test('CRM HTTP contracts reject invalid bounds, enums and unknown query keys', async () => {
  const { app, base } = await createApp();
  try {
    const tooLarge = await fetch(`${base}/crm/deals?limit=101`);
    assert.equal(tooLarge.status, 400);

    const badStage = await fetch(`${base}/crm/deals?stage=NOT_A_STAGE`);
    assert.equal(badStage.status, 400);

    const badActivityType = await fetch(`${base}/crm/activities?type=NOT_A_TYPE`);
    assert.equal(badActivityType.status, 400);

    const badSort = await fetch(`${base}/crm/activities?sort=oldest`);
    assert.equal(badSort.status, 400);

    const unknown = await fetch(`${base}/crm/companies?tenantId=t2`);
    assert.equal(unknown.status, 400);
  } finally {
    await app.close();
  }
});

test('CRM mutation DTOs reject malformed payloads before services run', async () => {
  const { app, base } = await createApp();
  try {
    const badCompany = await fetch(`${base}/crm/companies`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ name: '', tenantId: 't2' }),
    });
    assert.equal(badCompany.status, 400);

    const badDeal = await fetch(`${base}/crm/deals`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ title: 'X', contactId: 'c1', probability: 150 }),
    });
    assert.equal(badDeal.status, 400);

    const badActivity = await fetch(`${base}/crm/activities`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ type: 'TASK', subject: '' }),
    });
    assert.equal(badActivity.status, 400);

    const badStage = await fetch(`${base}/crm/pipelines/p1/stages`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ name: 'Won', code: 'WON', order: -1, probability: 110 }),
    });
    assert.equal(badStage.status, 400);
  } finally {
    await app.close();
  }
});
