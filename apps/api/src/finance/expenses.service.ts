import { Injectable, NotFoundException } from '@nestjs/common';
import { prisma, tenantWhere } from '@scc/database';

@Injectable()
export class ExpensesService {
  async findAll(req: any, query: any) {
    const where: any = { ...tenantWhere(req) };
    if (query.category) where.category = query.category;
    if (query.status) where.status = query.status;
    const [data, count] = await Promise.all([
      prisma.expense.findMany({ where, orderBy: { incurredAt: 'desc' }, take: 200 }),
      prisma.expense.count({ where }),
    ]);
    return { data, count };
  }

  async findOne(req: any, id: string) {
    const where = { ...tenantWhere(req), id };
    const item = await prisma.expense.findFirst({ where });
    if (!item) throw new NotFoundException('Expense not found');
    return item;
  }

  async create(req: any, dto: any) {
    const data: any = { ...dto, tenantId: req.tenantId || req.user?.tenantId };
    if (dto.incurredAt) data.incurredAt = new Date(dto.incurredAt);
    return prisma.expense.create({ data });
  }

  async update(req: any, id: string, dto: any) {
    const where = { ...tenantWhere(req), id };
    const existing = await prisma.expense.findFirst({ where });
    if (!existing) throw new NotFoundException('Expense not found');
    return prisma.expense.update({ where: { id }, data: dto });
  }

  async remove(req: any, id: string) {
    const where = { ...tenantWhere(req), id };
    const existing = await prisma.expense.findFirst({ where });
    if (!existing) throw new NotFoundException('Expense not found');
    return prisma.expense.delete({ where: { id } });
  }
}
