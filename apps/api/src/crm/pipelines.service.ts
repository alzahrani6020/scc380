import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { prisma, tenantWhere } from '@scc/database';

@Injectable()
export class PipelinesService {
  private tenantIdFor(req: any) {
    return req.user?.role === 'SUPER_ADMIN' ? req.tenantId : req.user?.tenantId;
  }

  private scope(req: any) {
    return tenantWhere(this.tenantIdFor(req));
  }

  async findAll(req: any) {
    return prisma.pipeline.findMany({
      where: this.scope(req),
      include: { stages: { where: { isActive: true }, orderBy: { order: 'asc' } } },
      orderBy: [{ isDefault: 'desc' }, { name: 'asc' }],
    });
  }

  async findOne(req: any, id: string) {
    const pipeline = await prisma.pipeline.findFirst({
      where: { id, ...this.scope(req) },
      include: { stages: { orderBy: { order: 'asc' } } },
    });
    if (!pipeline) throw new NotFoundException('Pipeline not found');
    return pipeline;
  }

  async create(req: any, dto: any) {
    const tenantId = this.tenantIdFor(req);
    if (!tenantId) throw new BadRequestException('Tenant context is required');
    const duplicate = await prisma.pipeline.findFirst({ where: { tenantId, name: dto.name }, select: { id: true } });
    if (duplicate) throw new BadRequestException('Pipeline name already exists in this tenant');
    return prisma.$transaction(async (tx) => {
      if (dto.isDefault) {
        await tx.pipeline.updateMany({ where: { tenantId, isDefault: true }, data: { isDefault: false } });
      }
      return tx.pipeline.create({ data: { ...dto, tenantId } });
    });
  }

  async update(req: any, id: string, dto: any) {
    const tenantId = this.tenantIdFor(req);
    const existing = await this.findOne(req, id);
    if (dto.name && dto.name !== existing.name) {
      const duplicate = await prisma.pipeline.findFirst({
        where: { tenantId, name: dto.name, NOT: { id } },
        select: { id: true },
      });
      if (duplicate) throw new BadRequestException('Pipeline name already exists in this tenant');
    }
    return prisma.$transaction(async (tx) => {
      if (dto.isDefault) {
        await tx.pipeline.updateMany({ where: { tenantId, isDefault: true, NOT: { id } }, data: { isDefault: false } });
      }
      return tx.pipeline.update({ where: { id }, data: dto });
    });
  }

  async remove(req: any, id: string) {
    const pipeline = await this.findOne(req, id);
    const linkedDeals = await prisma.deal.count({ where: { ...this.scope(req), pipelineId: id } });
    if (linkedDeals > 0) throw new BadRequestException('Pipeline is used by deals and cannot be deleted');
    return prisma.pipeline.delete({ where: { id: pipeline.id } });
  }

  async createStage(req: any, pipelineId: string, dto: any) {
    const tenantId = this.tenantIdFor(req);
    await this.findOne(req, pipelineId);
    if (dto.isWon && dto.isLost) throw new BadRequestException('A stage cannot be both won and lost');
    const duplicate = await prisma.pipelineStage.findFirst({
      where: { pipelineId, OR: [{ code: dto.code }, { order: dto.order }] },
      select: { id: true },
    });
    if (duplicate) throw new BadRequestException('Pipeline stage code or order already exists');
    return prisma.pipelineStage.create({ data: { ...dto, pipelineId, tenantId } });
  }

  async updateStage(req: any, pipelineId: string, stageId: string, dto: any) {
    await this.findOne(req, pipelineId);
    const stage = await prisma.pipelineStage.findFirst({
      where: { id: stageId, pipelineId, ...this.scope(req) },
    });
    if (!stage) throw new NotFoundException('Pipeline stage not found');
    if ((dto.isWon ?? stage.isWon) && (dto.isLost ?? stage.isLost)) {
      throw new BadRequestException('A stage cannot be both won and lost');
    }
    if (dto.code !== undefined || dto.order !== undefined) {
      const duplicate = await prisma.pipelineStage.findFirst({
        where: {
          pipelineId,
          NOT: { id: stageId },
          OR: [
            ...(dto.code !== undefined ? [{ code: dto.code }] : []),
            ...(dto.order !== undefined ? [{ order: dto.order }] : []),
          ],
        },
        select: { id: true },
      });
      if (duplicate) throw new BadRequestException('Pipeline stage code or order already exists');
    }
    return prisma.pipelineStage.update({ where: { id: stageId }, data: dto });
  }

  async removeStage(req: any, pipelineId: string, stageId: string) {
    await this.findOne(req, pipelineId);
    const stage = await prisma.pipelineStage.findFirst({
      where: { id: stageId, pipelineId, ...this.scope(req) },
    });
    if (!stage) throw new NotFoundException('Pipeline stage not found');
    const linkedDeals = await prisma.deal.count({ where: { ...this.scope(req), pipelineStageId: stageId } });
    if (linkedDeals > 0) throw new BadRequestException('Pipeline stage is used by deals and cannot be deleted');
    return prisma.pipelineStage.delete({ where: { id: stageId } });
  }
}
