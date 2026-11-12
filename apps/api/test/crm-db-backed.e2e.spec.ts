import 'reflect-metadata';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { prisma } from '@scc/database';
import {
  CompaniesController,
  CreateCompanyDto,
  ListCompaniesQueryDto,
  UpdateCompanyDto,
} from '../src/crm/companies.controller';
import { CompaniesService } from '../src/crm/companies.service';
import {
  PipelinesController,
  CreatePipelineDto,
  UpdatePipelineDto,
  CreateStageDto,
  UpdateStageDto,
} from '../src/crm/pipelines.controller';
import { PipelinesService } from '../src/crm/pipelines.service';
import { DealsController, CreateDealDto, UpdateDealDto } from '../src/crm/deals.controller';
import { DealsService } from '../src/crm/deals.service';
import { ActivitiesController, CreateActivityDto, UpdateActivityDto } from '../src/crm/activities.controller';
import { ActivitiesService } from '../src/crm/activities.service';
import { JwtAuthGuard } from '../src/auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../src/auth/guards/permissions.guard';
import { ListDealsQueryDto } from '../src/crm/dto/list-deals-query.dto';
import { ListActivitiesQueryDto } from '../src/crm/dto/list-activities-query.dto';

Reflect.defineMetadata('design:paramtypes', [CompaniesService], CompaniesController);
Reflect.defineMetadata('design:paramtypes', [PipelinesService], PipelinesController);
Reflect.defineMetadata('design:paramtypes', [DealsService], DealsController);
Reflect.defineMetadata('design:paramtypes', [ActivitiesService], ActivitiesController);

Reflect.defineMetadata('design:paramtypes', [Object, ListCompaniesQueryDto], CompaniesController.prototype, 'findAll');
Reflect.defineMetadata('design:paramtypes', [Object, CreateCompanyDto], CompaniesController.prototype, 'create');
Reflect.defineMetadata('design:paramtypes', [Object, String, UpdateCompanyDto], CompaniesController.prototype, 'update');

Reflect.defineMetadata('design:paramtypes', [Object, ListDealsQueryDto], DealsController.prototype, 'findAll');
Reflect.defineMetadata('design:paramtypes', [Object, CreateDealDto], DealsController.prototype, 'create');
Reflect.defineMetadata('design:paramtypes', [Object, String, UpdateDealDto], DealsController.prototype, 'update');

Reflect.defineMetadata('design:paramtypes', [Object, ListActivitiesQueryDto], ActivitiesController.prototype, 'findAll');
Reflect.defineMetadata('design:paramtypes', [Object, CreateActivityDto], ActivitiesController.prototype, 'create');
Reflect.defineMetadata('design:paramtypes', [Object, String, UpdateActivityDto], ActivitiesController.prototype, 'update');

Reflect.defineMetadata('design:paramtypes', [Object, CreatePipelineDto], PipelinesController.prototype, 'create');
Reflect.defineMetadata('design:paramtypes', [Object, String, UpdatePipelineDto], PipelinesController.prototype, 'update');
Reflect.defineMetadata('design:paramtypes', [Object, String, CreateStageDto], PipelinesController.prototype, 'createStage');
Reflect.defineMetadata('design:paramtypes', [Object, String, String, UpdateStageDto], PipelinesController.prototype, 'updateStage');

async function createApp() {
  const moduleRef = await Test.createTestingModule({
    controllers: [CompaniesController, PipelinesController, DealsController, ActivitiesController],
    providers: [CompaniesService, PipelinesService, DealsService, ActivitiesService],
  })
    .overrideGuard(JwtAuthGuard)
    .useValue({
      canActivate: (context: any) => {
        const req = context.switchToHttp().getRequest();
        const tenantId = req.headers['x-test-tenant'];
        req.user = { role: 'ADMIN', tenantId };
        return true;
      },
    })
    .overrideGuard(PermissionsGuard)
    .useValue({ canActivate: () => true })
    .compile();

  const app = moduleRef.createNestApplication();
  app.setGlobalPrefix('api');
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));
  await app.listen(0, '127.0.0.1');
  const address = app.getHttpServer().address();
  const port = typeof address === 'object' && address ? address.port : 0;
  return { app, base: `http://127.0.0.1:${port}/api` };
}

async function http(base: string, tenantId: string, path: string, init: RequestInit = {}) {
  const headers = new Headers(init.headers || {});
  headers.set('x-test-tenant', tenantId);
  if (init.body && !headers.has('content-type')) headers.set('content-type', 'application/json');
  return fetch(`${base}${path}`, { ...init, headers });
}

async function json(res: Response) {
  const body = await res.json();
  return body as any;
}

test(
  'CRM DB-backed HTTP E2E enforces tenant isolation across companies, pipelines, deals and activities',
  { skip: process.env.CRM_DB_E2E !== '1' ? 'CRM_DB_E2E=1 is required' : false },
  async () => {
    const run = `${process.pid}-${Date.now()}`;
    const tenantA = await prisma.tenant.create({
      data: { name: `CRM E2E A ${run}`, slug: `crm-e2e-a-${run}` },
    });
    const tenantB = await prisma.tenant.create({
      data: { name: `CRM E2E B ${run}`, slug: `crm-e2e-b-${run}` },
    });

    const companyA = await prisma.company.create({ data: { tenantId: tenantA.id, name: `Company A ${run}` } });
    const companyB = await prisma.company.create({ data: { tenantId: tenantB.id, name: `Company B ${run}` } });

    const contactA = await prisma.contact.create({
      data: { tenantId: tenantA.id, firstName: 'Ali', lastName: 'A', email: `a-${run}@example.test`, companyId: companyA.id },
    });
    const contactB = await prisma.contact.create({
      data: { tenantId: tenantB.id, firstName: 'Badr', lastName: 'B', email: `b-${run}@example.test`, companyId: companyB.id },
    });

    const pipelineA = await prisma.pipeline.create({ data: { tenantId: tenantA.id, name: `Pipeline A ${run}`, isDefault: true } });
    const pipelineB = await prisma.pipeline.create({ data: { tenantId: tenantB.id, name: `Pipeline B ${run}`, isDefault: true } });

    const stageA = await prisma.pipelineStage.create({
      data: { tenantId: tenantA.id, pipelineId: pipelineA.id, name: 'Lead A', code: 'LEAD_A', order: 1, probability: 10 },
    });
    const stageB = await prisma.pipelineStage.create({
      data: { tenantId: tenantB.id, pipelineId: pipelineB.id, name: 'Lead B', code: 'LEAD_B', order: 1, probability: 20 },
    });

    const dealA = await prisma.deal.create({
      data: {
        tenantId: tenantA.id,
        title: `Deal A ${run}`,
        contactId: contactA.id,
        companyId: companyA.id,
        pipelineId: pipelineA.id,
        pipelineStageId: stageA.id,
      },
    });
    const dealB = await prisma.deal.create({
      data: {
        tenantId: tenantB.id,
        title: `Deal B ${run}`,
        contactId: contactB.id,
        companyId: companyB.id,
        pipelineId: pipelineB.id,
        pipelineStageId: stageB.id,
      },
    });

    const activityA = await prisma.activity.create({
      data: { tenantId: tenantA.id, type: 'TASK', subject: `Activity A ${run}`, contactId: contactA.id, dealId: dealA.id },
    });
    const activityB = await prisma.activity.create({
      data: { tenantId: tenantB.id, type: 'TASK', subject: `Activity B ${run}`, contactId: contactB.id, dealId: dealB.id },
    });

    const { app, base } = await createApp();

    try {
      for (const [path, ownId, otherId] of [
        ['/crm/companies', companyA.id, companyB.id],
        ['/crm/deals', dealA.id, dealB.id],
        ['/crm/activities', activityA.id, activityB.id],
      ] as const) {
        const listA = await http(base, tenantA.id, path);
        assert.equal(listA.status, 200);
        const bodyA = await json(listA);
        assert.ok(bodyA.data.some((row: any) => row.id === ownId));
        assert.ok(!bodyA.data.some((row: any) => row.id === otherId));

        const listB = await http(base, tenantB.id, path);
        assert.equal(listB.status, 200);
        const bodyB = await json(listB);
        assert.ok(bodyB.data.some((row: any) => row.id === otherId));
        assert.ok(!bodyB.data.some((row: any) => row.id === ownId));

        const foreignRead = await http(base, tenantA.id, `${path}/${otherId}`);
        assert.equal(foreignRead.status, 404);
      }

      const pipelinesA = await http(base, tenantA.id, '/crm/pipelines');
      assert.equal(pipelinesA.status, 200);
      const pipelinesABody = await json(pipelinesA);
      assert.ok(pipelinesABody.some((row: any) => row.id === pipelineA.id));
      assert.ok(!pipelinesABody.some((row: any) => row.id === pipelineB.id));

      const foreignPipelineRead = await http(base, tenantA.id, `/crm/pipelines/${pipelineB.id}`);
      assert.equal(foreignPipelineRead.status, 404);

      const activityList = await http(base, tenantA.id, '/crm/activities');
      const activityListBody = await json(activityList);
      const hydrated = activityListBody.data.find((row: any) => row.id === activityA.id);
      assert.equal(hydrated.contact.id, contactA.id);
      assert.equal(hydrated.deal.id, dealA.id);

      const createCompany = await http(base, tenantA.id, '/crm/companies', {
        method: 'POST',
        body: JSON.stringify({ name: `Created Company A ${run}` }),
      });
      assert.equal(createCompany.status, 201);
      const createdCompany = await json(createCompany);
      assert.equal(createdCompany.tenantId, tenantA.id);

      const createPipeline = await http(base, tenantA.id, '/crm/pipelines', {
        method: 'POST',
        body: JSON.stringify({ name: `Created Pipeline A ${run}` }),
      });
      assert.equal(createPipeline.status, 201);
      const createdPipeline = await json(createPipeline);
      assert.equal(createdPipeline.tenantId, tenantA.id);

      const createDeal = await http(base, tenantA.id, '/crm/deals', {
        method: 'POST',
        body: JSON.stringify({
          title: `Created Deal A ${run}`,
          contactId: contactA.id,
          companyId: companyA.id,
          pipelineId: pipelineA.id,
          pipelineStageId: stageA.id,
        }),
      });
      assert.equal(createDeal.status, 201);
      const createdDeal = await json(createDeal);
      assert.equal(createdDeal.tenantId, tenantA.id);

      const createActivity = await http(base, tenantA.id, '/crm/activities', {
        method: 'POST',
        body: JSON.stringify({
          type: 'TASK',
          subject: `Created Activity A ${run}`,
          contactId: contactA.id,
          dealId: dealA.id,
        }),
      });
      assert.equal(createActivity.status, 201);
      const createdActivity = await json(createActivity);
      assert.equal(createdActivity.tenantId, tenantA.id);

      const crossContactDeal = await http(base, tenantA.id, '/crm/deals', {
        method: 'POST',
        body: JSON.stringify({ title: 'Cross contact', contactId: contactB.id }),
      });
      assert.equal(crossContactDeal.status, 400);

      const crossCompanyDeal = await http(base, tenantA.id, '/crm/deals', {
        method: 'POST',
        body: JSON.stringify({ title: 'Cross company', contactId: contactA.id, companyId: companyB.id }),
      });
      assert.equal(crossCompanyDeal.status, 400);

      const crossPipelineDeal = await http(base, tenantA.id, '/crm/deals', {
        method: 'POST',
        body: JSON.stringify({ title: 'Cross pipeline', contactId: contactA.id, pipelineId: pipelineB.id }),
      });
      assert.equal(crossPipelineDeal.status, 400);

      const crossStageDeal = await http(base, tenantA.id, '/crm/deals', {
        method: 'POST',
        body: JSON.stringify({ title: 'Cross stage', contactId: contactA.id, pipelineStageId: stageB.id }),
      });
      assert.equal(crossStageDeal.status, 400);

      const crossContactActivity = await http(base, tenantA.id, '/crm/activities', {
        method: 'POST',
        body: JSON.stringify({ type: 'TASK', subject: 'Cross contact activity', contactId: contactB.id }),
      });
      assert.equal(crossContactActivity.status, 400);

      const crossDealActivity = await http(base, tenantA.id, '/crm/activities', {
        method: 'POST',
        body: JSON.stringify({ type: 'TASK', subject: 'Cross deal activity', dealId: dealB.id }),
      });
      assert.equal(crossDealActivity.status, 400);

      for (const [path, otherId] of [
        ['/crm/companies', companyB.id],
        ['/crm/pipelines', pipelineB.id],
        ['/crm/deals', dealB.id],
        ['/crm/activities', activityB.id],
      ] as const) {
        const patch = await http(base, tenantA.id, `${path}/${otherId}`, {
          method: 'PATCH',
          body: JSON.stringify(path.includes('activities') ? { subject: 'Hacked' } : path.includes('deals') ? { title: 'Hacked' } : { name: 'Hacked' }),
        });
        assert.equal(patch.status, 404);

        const del = await http(base, tenantA.id, `${path}/${otherId}`, { method: 'DELETE' });
        assert.equal(del.status, 404);
      }

      assert.ok(await prisma.company.findUnique({ where: { id: companyB.id } }));
      assert.ok(await prisma.pipeline.findUnique({ where: { id: pipelineB.id } }));
      assert.ok(await prisma.deal.findUnique({ where: { id: dealB.id } }));
      assert.ok(await prisma.activity.findUnique({ where: { id: activityB.id } }));
    } finally {
      await app.close();
      await prisma.tenant.deleteMany({ where: { id: { in: [tenantA.id, tenantB.id] } } });
      await prisma.$disconnect();
    }
  },
);
