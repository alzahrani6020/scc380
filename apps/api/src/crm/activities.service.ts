import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { prisma, tenantWhere } from '@scc/database';

@Injectable()
export class ActivitiesService {
  private tenantIdFor(req: any) {
    return req.user?.role === 'SUPER_ADMIN' ? req.tenantId : req.user?.tenantId;
  }

  private async assertRefsInTenant(
    tenantId: string | null | undefined,
    refs: { contactId?: string; dealId?: string; assignedToId?: string },
  ) {
    const scope = tenantWhere(tenantId);
    if (refs.contactId) {
      const contact = await prisma.contact.findFirst({ where: { id: refs.contactId, ...scope } });
      if (!contact) throw new BadRequestException('Contact not found in your tenant');
    }
    if (refs.dealId) {
      const deal = await prisma.deal.findFirst({ where: { id: refs.dealId, ...scope } });
      if (!deal) throw new BadRequestException('Deal not found in your tenant');
    }
    if (refs.assignedToId) {
      const user = await prisma.user.findFirst({
        where: { id: refs.assignedToId, ...scope, status: 'ACTIVE' },
        select: { id: true },
      });
      if (!user) throw new BadRequestException('Assignee not found in your tenant');
    }
  }

  async findAll(req: any, query: any) {
    const tenantId = this.tenantIdFor(req);
    const page = query.page ?? 1;
    const limit = query.limit ?? 25;
    const where: any = { ...tenantWhere(tenantId) };
    if (query.type) where.type = query.type;
    if (query.contactId) where.contactId = query.contactId;
    if (query.dealId) where.dealId = query.dealId;
    if (query.assignedToId) where.assignedToId = query.assignedToId;
    const [data, count] = await Promise.all([
      prisma.activity.findMany({
        where,
        orderBy: query.sort === 'recent' ? { createdAt: 'desc' } : { scheduledAt: 'asc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.activity.count({ where }),
    ]);
    return { data, count, page, limit };
  }

  async findOne(req: any, id: string) {
    const tenantId = this.tenantIdFor(req);
    const activity = await prisma.activity.findFirst({ where: { ...tenantWhere(tenantId), id } });
    if (!activity) throw new NotFoundException('Activity not found');
    return activity;
  }

  async create(req: any, dto: any) {
    const tenantId = this.tenantIdFor(req);
    await this.assertRefsInTenant(tenantId, dto);
    const data: any = { ...dto, tenantId };
    if (dto.scheduledAt) data.scheduledAt = new Date(dto.scheduledAt);
    if (dto.remindAt) data.remindAt = new Date(dto.remindAt);
    return prisma.activity.create({ data });
  }

  async update(req: any, id: string, dto: any) {
    const tenantId = this.tenantIdFor(req);
    const existing = await prisma.activity.findFirst({ where: { ...tenantWhere(tenantId), id } });
    if (!existing) throw new NotFoundException('Activity not found');
    await this.assertRefsInTenant(tenantId, dto);
    const data: any = { ...dto };
    if (dto.scheduledAt) data.scheduledAt = new Date(dto.scheduledAt);
    if (dto.completedAt) data.completedAt = new Date(dto.completedAt);
    if (dto.remindAt) {
      data.remindAt = new Date(dto.remindAt);
      data.reminded = false;
    }
    return prisma.activity.update({ where: { id }, data });
  }

  async remove(req: any, id: string) {
    const tenantId = this.tenantIdFor(req);
    const existing = await prisma.activity.findFirst({ where: { ...tenantWhere(tenantId), id } });
    if (!existing) throw new NotFoundException('Activity not found');
    return prisma.activity.delete({ where: { id } });
  }
}
