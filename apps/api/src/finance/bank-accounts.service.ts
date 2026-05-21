import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { prisma, tenantWhere } from '@scc/database';

@Injectable()
export class BankAccountsService {
  async findAll(req: any) {
    const where = tenantWhere(req);
    const [data, count] = await Promise.all([
      prisma.bankAccount.findMany({ where, orderBy: { createdAt: 'desc' } }),
      prisma.bankAccount.count({ where }),
    ]);
    return { data, count };
  }

  async findOne(req: any, id: string) {
    const where = { ...tenantWhere(req), id };
    const item = await prisma.bankAccount.findFirst({ where });
    if (!item) throw new NotFoundException('Bank account not found');
    return item;
  }

  async create(req: any, dto: any) {
    const tenantId = req.tenantId || req.user?.tenantId;
    const existing = await prisma.bankAccount.findFirst({
      where: { tenantId, accountNumber: dto.accountNumber },
    });
    if (existing) throw new ConflictException('Account number already exists');
    if (dto.isDefault) {
      await prisma.bankAccount.updateMany({
        where: { tenantId },
        data: { isDefault: false },
      });
    }
    return prisma.bankAccount.create({ data: { ...dto, tenantId } });
  }

  async update(req: any, id: string, dto: any) {
    const where = { ...tenantWhere(req), id };
    const existing = await prisma.bankAccount.findFirst({ where });
    if (!existing) throw new NotFoundException('Bank account not found');
    if (dto.isDefault) {
      await prisma.bankAccount.updateMany({
        where: { tenantId: existing.tenantId },
        data: { isDefault: false },
      });
    }
    return prisma.bankAccount.update({ where: { id }, data: dto });
  }

  async remove(req: any, id: string) {
    const where = { ...tenantWhere(req), id };
    const existing = await prisma.bankAccount.findFirst({ where });
    if (!existing) throw new NotFoundException('Bank account not found');
    return prisma.bankAccount.delete({ where: { id } });
  }
}
