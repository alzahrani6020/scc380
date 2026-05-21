import { Injectable, NotFoundException } from '@nestjs/common';
import { prisma, tenantWhere } from '@scc/database';

@Injectable()
export class DealsService {
  async findAll(req: any, query: any) {
    const where: any = { ...tenantWhere(req) };
    if (query.stage) where.stage = query.stage;
    if (query.assignedToId) where.assignedToId = query.assignedToId;
    if (query.search) {
      where.OR = [
        { title: { contains: query.search, mode: 'insensitive' } },
        { description: { contains: query.search, mode: 'insensitive' } },
      ];
    }
    const [data, count] = await Promise.all([
      prisma.deal.findMany({ where, orderBy: { createdAt: 'desc' }, take: 100 }),
      prisma.deal.count({ where }),
    ]);
    return { data, count };
  }

  async findOne(req: any, id: string) {
    const where = { ...tenantWhere(req), id };
    const deal = await prisma.deal.findFirst({ where });
    if (!deal) throw new NotFoundException('Deal not found');
    return deal;
  }

  async create(req: any, dto: any) {
    const data = { ...dto, tenantId: req.tenantId || req.user?.tenantId };
    if (dto.expectedClose) data.expectedClose = new Date(dto.expectedClose);
    return prisma.deal.create({ data });
  }

  async update(req: any, id: string, dto: any) {
    const where = { ...tenantWhere(req), id };
    const existing = await prisma.deal.findFirst({ where });
    if (!existing) throw new NotFoundException('Deal not found');
    const data = { ...dto };
    if (dto.expectedClose) data.expectedClose = new Date(dto.expectedClose);
    if (dto.actualClose) data.actualClose = new Date(dto.actualClose);
    if (dto.stage === 'CLOSED_WON' || dto.stage === 'CLOSED_LOST') {
      data.actualClose = new Date();
    }
    return prisma.deal.update({ where: { id }, data });
  }

  async remove(req: any, id: string) {
    const where = { ...tenantWhere(req), id };
    const existing = await prisma.deal.findFirst({ where });
    if (!existing) throw new NotFoundException('Deal not found');
    return prisma.deal.delete({ where: { id } });
  }
}
