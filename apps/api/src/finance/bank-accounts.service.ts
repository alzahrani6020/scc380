import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { prisma, tenantWhere } from '@scc/database';

@Injectable()
export class BankAccountsService {
  private async assertChartAccount(tenantId: string, chartAccountId?: string | null) {
    if (!chartAccountId) return;
    const account = await prisma.chartOfAccount.findFirst({
      where: { id: chartAccountId, tenantId, isActive: true, type: 'ASSET' },
      select: { id: true },
    });
    if (!account) throw new ConflictException('Bank GL account must be an active ASSET account for tenant');
  }

  async findAll(req: any) {
    const where = tenantWhere(req.user?.tenantId);
    const [data, count] = await Promise.all([
      prisma.bankAccount.findMany({ where, orderBy: { createdAt: 'desc' } }),
      prisma.bankAccount.count({ where }),
    ]);
    return { data, count };
  }

  async findOne(req: any, id: string) {
    const where = { ...tenantWhere(req.user?.tenantId), id };
    const item = await prisma.bankAccount.findFirst({ where });
    if (!item) throw new NotFoundException('Bank account not found');
    return item;
  }

  async create(req: any, dto: any) {
    const tenantId = req.user?.tenantId;
    const existing = await prisma.bankAccount.findFirst({
      where: { tenantId, accountNumber: dto.accountNumber },
    });
    await this.assertChartAccount(tenantId, dto.chartAccountId);
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
    const where = { ...tenantWhere(req.user?.tenantId), id };
    const existing = await prisma.bankAccount.findFirst({ where });
    if (!existing) throw new NotFoundException('Bank account not found');
    if (dto.chartAccountId !== undefined) {
      await this.assertChartAccount(existing.tenantId, dto.chartAccountId);
    }
    if (dto.isDefault) {
      await prisma.bankAccount.updateMany({
        where: { tenantId: existing.tenantId },
        data: { isDefault: false },
      });
    }
    return prisma.bankAccount.update({ where: { id }, data: dto });
  }

  async remove(req: any, id: string) {
    const where = { ...tenantWhere(req.user?.tenantId), id };
    const existing = await prisma.bankAccount.findFirst({ where });
    if (!existing) throw new NotFoundException('Bank account not found');
    const reconciliationCount = await prisma.bankReconciliation.count({
      where: { tenantId: existing.tenantId, bankAccountId: id },
    });
    if (reconciliationCount > 0) {
      throw new ConflictException('Bank account has reconciliation history and cannot be deleted');
    }
    return prisma.bankAccount.delete({ where: { id } });
  }
}
