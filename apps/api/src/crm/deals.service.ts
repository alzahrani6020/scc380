import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { prisma, tenantWhere } from '@scc/database';

@Injectable()
export class DealsService {
  /** Referential integrity: linked contact/assignee must belong to the caller's tenant. */
  private async assertRefsInTenant(
    tenantId: string | null | undefined,
    refs: { contactId?: string; assignedToId?: string; companyId?: string; pipelineId?: string; pipelineStageId?: string },
  ) {
    const scope = tenantWhere(tenantId);
    if (refs.contactId) {
      const contact = await prisma.contact.findFirst({
        where: { id: refs.contactId, ...scope },
      });
      if (!contact) throw new BadRequestException('Contact not found in your tenant');
    }
    if (refs.assignedToId) {
      const user = await prisma.user.findFirst({
        where: { id: refs.assignedToId, ...scope, status: 'ACTIVE' },
        select: { id: true },
      });
      if (!user) throw new BadRequestException('Assignee not found in your tenant');
    }
    if (refs.companyId) {
      const company = await prisma.company.findFirst({
        where: { id: refs.companyId, ...scope, isActive: true },
        select: { id: true },
      });
      if (!company) throw new BadRequestException('Company not found in your tenant');
    }
    if (refs.pipelineId) {
      const pipeline = await prisma.pipeline.findFirst({
        where: { id: refs.pipelineId, ...scope, isActive: true },
        select: { id: true },
      });
      if (!pipeline) throw new BadRequestException('Pipeline not found in your tenant');
    }
    if (refs.pipelineStageId) {
      const stage = await prisma.pipelineStage.findFirst({
        where: { id: refs.pipelineStageId, ...scope, isActive: true },
        select: { id: true, pipelineId: true, probability: true, isWon: true, isLost: true },
      });
      if (!stage) throw new BadRequestException('Pipeline stage not found in your tenant');
      if (refs.pipelineId && stage.pipelineId !== refs.pipelineId) {
        throw new BadRequestException('Pipeline stage does not belong to the selected pipeline');
      }
    }
  }

  private tenantIdFor(req: any) {
    return req.user?.role === 'SUPER_ADMIN' ? req.tenantId : req.user?.tenantId;
  }

  async findAll(req: any, query: any) {
    const tenantId = this.tenantIdFor(req);
    const page = Math.max(1, Number.parseInt(query.page || '1', 10) || 1);
    const limit = Math.min(100, Math.max(1, Number.parseInt(query.limit || '25', 10) || 25));
    const where: any = { ...tenantWhere(tenantId) };
    if (query.stage) where.stage = query.stage;
    if (query.assignedToId) where.assignedToId = query.assignedToId;
    if (query.companyId) where.companyId = query.companyId;
    if (query.pipelineId) where.pipelineId = query.pipelineId;
    if (query.pipelineStageId) where.pipelineStageId = query.pipelineStageId;
    if (query.search) {
      where.OR = [
        { title: { contains: query.search, mode: 'insensitive' } },
        { description: { contains: query.search, mode: 'insensitive' } },
      ];
    }
    const [data, count] = await Promise.all([
      prisma.deal.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.deal.count({ where }),
    ]);
    return { data, count, page, limit };
  }

  async findOne(req: any, id: string) {
    const tenantId = this.tenantIdFor(req);
    const where = { ...tenantWhere(tenantId), id };
    const deal = await prisma.deal.findFirst({ where });
    if (!deal) throw new NotFoundException('Deal not found');
    return deal;
  }

  async create(req: any, dto: any) {
    const tenantId = this.tenantIdFor(req);
    await this.assertRefsInTenant(tenantId, dto);
    const data: any = { ...dto, tenantId };
    if (dto.expectedClose) data.expectedClose = new Date(dto.expectedClose);
    if (dto.pipelineStageId) {
      const stage = await prisma.pipelineStage.findFirst({
        where: { id: dto.pipelineStageId, ...tenantWhere(tenantId) },
        select: { pipelineId: true, order: true, probability: true, isWon: true, isLost: true },
      });
      if (stage) {
        data.pipelineId = dto.pipelineId || stage.pipelineId;
        data.stageOrder = stage.order;
        if (dto.probability === undefined) data.probability = stage.probability;
        if (stage.isWon) data.stage = 'CLOSED_WON';
        if (stage.isLost) data.stage = 'CLOSED_LOST';
      }
    }
    return prisma.deal.create({ data });
  }

  async update(req: any, id: string, dto: any) {
    const tenantId = this.tenantIdFor(req);
    const where = { ...tenantWhere(tenantId), id };
    const existing = await prisma.deal.findFirst({ where });
    if (!existing) throw new NotFoundException('Deal not found');
    await this.assertRefsInTenant(tenantId, dto);
    const data: any = { ...dto };
    if (dto.pipelineId && dto.pipelineId !== existing.pipelineId && !dto.pipelineStageId) {
      data.pipelineStageId = null;
      data.stageOrder = 0;
    }
    if (dto.expectedClose) data.expectedClose = new Date(dto.expectedClose);
    if (dto.actualClose) data.actualClose = new Date(dto.actualClose);
    if (dto.pipelineStageId) {
      const stage = await prisma.pipelineStage.findFirst({
        where: { id: dto.pipelineStageId, ...tenantWhere(tenantId) },
        select: { pipelineId: true, order: true, probability: true, isWon: true, isLost: true },
      });
      if (stage) {
        const effectivePipelineId = dto.pipelineId || existing.pipelineId || stage.pipelineId;
        if (effectivePipelineId !== stage.pipelineId) {
          throw new BadRequestException('Pipeline stage does not belong to the selected pipeline');
        }
        data.pipelineId = stage.pipelineId;
        data.stageOrder = stage.order;
        if (dto.probability === undefined) data.probability = stage.probability;
        if (stage.isWon) data.stage = 'CLOSED_WON';
        if (stage.isLost) data.stage = 'CLOSED_LOST';
      }
    }
    if (data.stage === 'CLOSED_WON' || data.stage === 'CLOSED_LOST') {
      data.actualClose = data.actualClose || new Date();
    }
    return prisma.deal.update({ where: { id }, data });
  }

  async remove(req: any, id: string) {
    const tenantId = this.tenantIdFor(req);
    const where = { ...tenantWhere(tenantId), id };
    const existing = await prisma.deal.findFirst({ where });
    if (!existing) throw new NotFoundException('Deal not found');
    return prisma.deal.delete({ where: { id } });
  }
}
