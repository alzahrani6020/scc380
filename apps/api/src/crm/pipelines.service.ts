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
    return prisma.$transaction(async (tx) => {
      if (dto.isDefault) {
        await tx.pipeline.updateMany({ where: { tenantId, isDefault: true }, data: { isDefault: false } });
      }
      return tx.pipeline.create({ data: { ...dto, tenantId } });
    });
  }

  async update(req: any, id: string, dto: any) {
    const tenantId = this.tenantIdFor(req);
    await this.findOne(req, id);
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
