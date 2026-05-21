import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { prisma, tenantWhere } from '@scc/database';

@Injectable()
export class ChartOfAccountsService {
  async findAll(req: any, type?: string) {
    const where: any = { ...tenantWhere(req) };
    if (type) where.type = type;
    const [data, count] = await Promise.all([
      prisma.chartOfAccount.findMany({ where, orderBy: { code: 'asc' } }),
      prisma.chartOfAccount.count({ where }),
    ]);
    return { data, count };
  }

  async findOne(req: any, id: string) {
    const where = { ...tenantWhere(req), id };
    const item = await prisma.chartOfAccount.findFirst({ where });
    if (!item) throw new NotFoundException('Account not found');
    return item;
  }

  async create(req: any, dto: any) {
    const tenantId = req.tenantId || req.user?.tenantId;
    const existing = await prisma.chartOfAccount.findFirst({
      where: { tenantId, code: dto.code },
    });
    if (existing) throw new ConflictException('Account code already exists');
    return prisma.chartOfAccount.create({
      data: { ...dto, tenantId },
    });
  }

  async update(req: any, id: string, dto: any) {
    const where = { ...tenantWhere(req), id };
    const existing = await prisma.chartOfAccount.findFirst({ where });
    if (!existing) throw new NotFoundException('Account not found');
    return prisma.chartOfAccount.update({ where: { id }, data: dto });
  }

  async remove(req: any, id: string) {
    const where = { ...tenantWhere(req), id };
    const existing = await prisma.chartOfAccount.findFirst({ where });
    if (!existing) throw new NotFoundException('Account not found');
    return prisma.chartOfAccount.delete({ where: { id } });
  }
}
