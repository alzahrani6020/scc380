import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { prisma, tenantWhere } from '@scc/database';

@Injectable()
export class ActivitiesService {
  /** Referential integrity: linked contact/deal/assignee must belong to the caller's tenant. */
  private async assertRefsInTenant(
    tenantId: string | null | undefined,
    refs: { contactId?: string; dealId?: string; assignedToId?: string },
  ) {
    const scope = tenantWhere(tenantId ?? undefined);
    if (refs.contactId) {
      const contact = await prisma.contact.findFirst({ where: { id: refs.contactId, ...scope } });
      if (!contact) throw new BadRequestException('Contact not found in your tenant');
    }
    if (refs.dealId) {
      const deal = await prisma.deal.findFirst({ where: { id: refs.dealId, ...scope } });
      if (!deal) throw new BadRequestException('Deal not found in your tenant');
    }
    if (refs.assignedToId) {
      const user = await prisma.user.findFirst({ where: { id: refs.assignedToId, ...scope } });
      if (!user) throw new BadRequestException('Assignee not found in your tenant');
    }
  }

  async findAll(req: any, query: any) {
    const page = Math.max(1, Number.parseInt(query.page || '1', 10) || 1);
    const limit = Math.min(100, Math.max(1, Number.parseInt(query.limit || '25', 10) || 25));
    const where: any = { ...tenantWhere(req.user?.tenantId) };
    if (query.type) where.type = query.type;
    if (query.contactId) where.contactId = query.contactId;
    if (query.dealId) where.dealId = query.dealId;
    if (query.assignedToId) where.assignedToId = query.assignedToId;
    const [data, count] = await Promise.all([
      prisma.activity.findMany({
        where,
        orderBy: { scheduledAt: 'asc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.activity.count({ where }),
    ]);
    return { data, count, page, limit };
  }

  async findOne(req: any, id: string) {
    const where = { ...tenantWhere(req.user?.tenantId), id };
    const activity = await prisma.activity.findFirst({ where });
    if (!activity) throw new NotFoundException('Activity not found');
    return activity;
  }

  async create(req: any, dto: any) {
    await this.assertRefsInTenant(req.user?.tenantId, dto);
    const data = { ...dto, tenantId: req.user?.tenantId };
    if (dto.scheduledAt) data.scheduledAt = new Date(dto.scheduledAt);
    return prisma.activity.create({ data });
  }

  async update(req: any, id: string, dto: any) {
    const where = { ...tenantWhere(req.user?.tenantId), id };
    const existing = await prisma.activity.findFirst({ where });
    if (!existing) throw new NotFoundException('Activity not found');
    await this.assertRefsInTenant(req.user?.tenantId, dto);
    const data = { ...dto };
    if (dto.scheduledAt) data.scheduledAt = new Date(dto.scheduledAt);
    if (dto.completedAt) data.completedAt = new Date(dto.completedAt);
    return prisma.activity.update({ where: { id }, data });
  }

  async remove(req: any, id: string) {
    const where = { ...tenantWhere(req.user?.tenantId), id };
    const existing = await prisma.activity.findFirst({ where });
    if (!existing) throw new NotFoundException('Activity not found');
    return prisma.activity.delete({ where: { id } });
  }
}
