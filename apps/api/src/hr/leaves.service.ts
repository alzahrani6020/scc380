import { Injectable, NotFoundException } from '@nestjs/common';
import { prisma, tenantWhere } from '@scc/database';

@Injectable()
export class LeavesService {
  async findAll(req: any, query: any) {
    const where: any = { ...tenantWhere(req) };
    if (query.employeeId) where.employeeId = query.employeeId;
    if (query.type) where.type = query.type;
    if (query.status) where.status = query.status;
    if (query.from && query.to) {
      where.startDate = { gte: new Date(query.from), lte: new Date(query.to) };
    }
    const [data, count] = await Promise.all([
      prisma.leave.findMany({ where, include: { employee: { select: { firstName: true, lastName: true, employeeCode: true } } }, orderBy: { createdAt: 'desc' }, take: 200 }),
      prisma.leave.count({ where }),
    ]);
    return { data, count };
  }

  async findOne(req: any, id: string) {
    const where = { ...tenantWhere(req), id };
    const item = await prisma.leave.findFirst({ where, include: { employee: { select: { firstName: true, lastName: true, employeeCode: true } } } });
    if (!item) throw new NotFoundException('Leave request not found');
    return item;
  }

  async create(req: any, dto: any) {
    const data: any = { ...dto, tenantId: req.tenantId || req.user?.tenantId };
    data.startDate = new Date(dto.startDate);
    data.endDate = new Date(dto.endDate);
    return prisma.leave.create({ data });
  }

  async update(req: any, id: string, dto: any) {
    const where = { ...tenantWhere(req), id };
    const existing = await prisma.leave.findFirst({ where });
    if (!existing) throw new NotFoundException('Leave request not found');
    const data: any = { ...dto };
    if (dto.startDate) data.startDate = new Date(dto.startDate);
    if (dto.endDate) data.endDate = new Date(dto.endDate);
    if (dto.status === 'APPROVED') data.approvedAt = new Date();
    return prisma.leave.update({ where: { id }, data });
  }

  async remove(req: any, id: string) {
    const where = { ...tenantWhere(req), id };
    const existing = await prisma.leave.findFirst({ where });
    if (!existing) throw new NotFoundException('Leave request not found');
    return prisma.leave.delete({ where: { id } });
  }
}
