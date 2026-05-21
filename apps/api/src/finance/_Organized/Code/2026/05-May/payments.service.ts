import { Injectable, NotFoundException } from '@nestjs/common';
import { prisma, tenantWhere } from '@scc/database';

@Injectable()
export class PaymentsService {
  async findAll(req: any, query: any) {
    const where: any = { ...tenantWhere(req) };
    if (query.invoiceId) where.invoiceId = query.invoiceId;
    if (query.status) where.status = query.status;
    const [data, count] = await Promise.all([
      prisma.payment.findMany({ where, orderBy: { paidAt: 'desc' }, take: 200 }),
      prisma.payment.count({ where }),
    ]);
    return { data, count };
  }

  async findOne(req: any, id: string) {
    const where = { ...tenantWhere(req), id };
    const item = await prisma.payment.findFirst({ where });
    if (!item) throw new NotFoundException('Payment not found');
    return item;
  }

  async create(req: any, dto: any) {
    const data: any = { ...dto, tenantId: req.tenantId || req.user?.tenantId };
    if (dto.paidAt) data.paidAt = new Date(dto.paidAt);
    return prisma.payment.create({ data });
  }

  async update(req: any, id: string, dto: any) {
    const where = { ...tenantWhere(req), id };
    const existing = await prisma.payment.findFirst({ where });
    if (!existing) throw new NotFoundException('Payment not found');
    return prisma.payment.update({ where: { id }, data: dto });
  }

  async remove(req: any, id: string) {
    const where = { ...tenantWhere(req), id };
    const existing = await prisma.payment.findFirst({ where });
    if (!existing) throw new NotFoundException('Payment not found');
    return prisma.payment.delete({ where: { id } });
  }
}
