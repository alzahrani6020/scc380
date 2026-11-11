import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { prisma, tenantWhere } from '@scc/database';

@Injectable()
export class DealsService {
  /** Referential integrity: linked contact/assignee must belong to the caller's tenant. */
  private async assertRefsInTenant(
    tenantId: string | null | undefined,
    refs: { contactId?: string; assignedToId?: string },
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
    const data = { ...dto, tenantId };
    if (dto.expectedClose) data.expectedClose = new Date(dto.expectedClose);
    return prisma.deal.create({ data });
  }

  async update(req: any, id: string, dto: any) {
    const tenantId = this.tenantIdFor(req);
    const where = { ...tenantWhere(tenantId), id };
    const existing = await prisma.deal.findFirst({ where });
    if (!existing) throw new NotFoundException('Deal not found');
    await this.assertRefsInTenant(tenantId, dto);
    const data = { ...dto };
    if (dto.expectedClose) data.expectedClose = new Date(dto.expectedClose);
    if (dto.actualClose) data.actualClose = new Date(dto.actualClose);
    if (dto.stage === 'CLOSED_WON' || dto.stage === 'CLOSED_LOST') {
      data.actualClose = new Date();
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
