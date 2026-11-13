import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, prisma, tenantWhere } from '@scc/database';
import { AccountingPostingService } from '../accounting-core/accounting-posting.service';

@Injectable()
export class FixedAssetsService {
  constructor(private readonly posting: AccountingPostingService) {}

  private decimal(value: Prisma.Decimal.Value) {
    return new Prisma.Decimal(value);
  }

  private async getCategory(tenantId: string, id: string) {
    const category = await prisma.fixedAssetCategory.findFirst({
      where: { ...tenantWhere(tenantId), id },
    });
    if (!category) throw new NotFoundException('Fixed asset category not found');
    return category;
  }

  private async getAsset(tenantId: string, id: string) {
    const asset = await prisma.fixedAsset.findFirst({
      where: { ...tenantWhere(tenantId), id },
      include: { category: true, entries: { orderBy: { period: 'asc' } } },
    });
    if (!asset) throw new NotFoundException('Fixed asset not found');
    return asset;
  }

  private parsePeriod(period: string) {
    if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(period)) {
      throw new BadRequestException('period must use YYYY-MM');
    }
    const [year, month] = period.split('-').map(Number);
    const start = new Date(Date.UTC(year, month - 1, 1, 0, 0, 0, 0));
    const end = new Date(Date.UTC(year, month, 0, 23, 59, 59, 999));
    return { year, month, start, end };
  }

  async listCategories(req: any) {
    const tenantId = req.user?.tenantId;
    const data = await prisma.fixedAssetCategory.findMany({
      where: tenantWhere(tenantId),
      orderBy: { name: 'asc' },
    });
    return { data, count: data.length };
  }

  async createCategory(req: any, dto: any) {
    const tenantId = req.user?.tenantId;
    if (!tenantId) throw new BadRequestException('Tenant is required');
    if (!String(dto.name || '').trim()) throw new BadRequestException('Category name is required');
    const usefulLifeYears = Number(dto.usefulLifeYears ?? 5);
    if (!Number.isInteger(usefulLifeYears) || usefulLifeYears <= 0) {
      throw new BadRequestException('usefulLifeYears must be a positive integer');
    }
    const rate = Number(dto.depreciationRate ?? 0);
    if (!Number.isFinite(rate) || rate < 0 || rate > 100) {
      throw new BadRequestException('depreciationRate must be between 0 and 100');
    }
    if (dto.depreciationMethod === 'DECLINING_BALANCE' && rate <= 0) {
      throw new BadRequestException('DECLINING_BALANCE requires depreciationRate > 0');
    }
    return prisma.fixedAssetCategory.create({
      data: {
        tenantId,
        name: String(dto.name).trim(),
        code: dto.code ? String(dto.code).trim() : null,
        depreciationRate: rate,
        usefulLifeYears,
        depreciationMethod: dto.depreciationMethod || 'STRAIGHT_LINE',
      },
    });
  }

  async updateCategory(req: any, id: string, dto: any) {
    const tenantId = req.user?.tenantId;
    await this.getCategory(tenantId, id);
    if (dto.usefulLifeYears !== undefined) {
      const value = Number(dto.usefulLifeYears);
      if (!Number.isInteger(value) || value <= 0) {
        throw new BadRequestException('usefulLifeYears must be a positive integer');
      }
    }
    if (dto.depreciationRate !== undefined) {
      const value = Number(dto.depreciationRate);
      if (!Number.isFinite(value) || value < 0 || value > 100) {
        throw new BadRequestException('depreciationRate must be between 0 and 100');
      }
    }
    return prisma.fixedAssetCategory.update({
      where: { id },
      data: {
        ...(dto.name !== undefined ? { name: String(dto.name).trim() } : {}),
        ...(dto.code !== undefined ? { code: dto.code ? String(dto.code).trim() : null } : {}),
        ...(dto.depreciationRate !== undefined ? { depreciationRate: dto.depreciationRate } : {}),
        ...(dto.usefulLifeYears !== undefined ? { usefulLifeYears: dto.usefulLifeYears } : {}),
        ...(dto.depreciationMethod !== undefined ? { depreciationMethod: dto.depreciationMethod } : {}),
      },
    });
  }

  async removeCategory(req: any, id: string) {
    const tenantId = req.user?.tenantId;
    await this.getCategory(tenantId, id);
    const count = await prisma.fixedAsset.count({ where: { tenantId, categoryId: id } });
    if (count > 0) throw new ConflictException('Category has fixed assets and cannot be deleted');
    return prisma.fixedAssetCategory.delete({ where: { id } });
  }

  async listAssets(req: any) {
    const tenantId = req.user?.tenantId;
    const data = await prisma.fixedAsset.findMany({
      where: tenantWhere(tenantId),
      include: { category: true, _count: { select: { entries: true } } },
      orderBy: [{ status: 'asc' }, { name: 'asc' }],
    });
    return { data, count: data.length };
  }

  async findAsset(req: any, id: string) {
    return this.getAsset(req.user?.tenantId, id);
  }

  async createAsset(req: any, dto: any) {
    const tenantId = req.user?.tenantId;
    if (!tenantId) throw new BadRequestException('Tenant is required');
    const category = await this.getCategory(tenantId, dto.categoryId);
    const acquisitionCost = this.decimal(dto.acquisitionCost);
    const salvageValue = this.decimal(dto.salvageValue ?? 0);
    if (acquisitionCost.lte(0)) throw new BadRequestException('acquisitionCost must be positive');
    if (salvageValue.isNegative() || salvageValue.gte(acquisitionCost)) {
      throw new BadRequestException('salvageValue must be >= 0 and less than acquisitionCost');
    }
    const usefulLifeYears = Number(dto.usefulLifeYears ?? category.usefulLifeYears);
    if (!Number.isInteger(usefulLifeYears) || usefulLifeYears <= 0) {
      throw new BadRequestException('usefulLifeYears must be a positive integer');
    }
    const purchaseDate = new Date(dto.purchaseDate);
    const startDate = new Date(dto.startDate || dto.purchaseDate);
    if (Number.isNaN(purchaseDate.getTime()) || Number.isNaN(startDate.getTime())) {
      throw new BadRequestException('Invalid asset dates');
    }
    if (startDate < purchaseDate) throw new BadRequestException('startDate cannot be before purchaseDate');

    const code = dto.code ? String(dto.code).trim() : null;
    if (code) {
      const existing = await prisma.fixedAsset.findFirst({
        where: { tenantId, code },
        select: { id: true },
      });
      if (existing) throw new ConflictException('Fixed asset code already exists');
    }

    return prisma.fixedAsset.create({
      data: {
        tenantId,
        name: String(dto.name || '').trim(),
        code,
        categoryId: category.id,
        acquisitionCost,
        salvageValue,
        usefulLifeYears,
        depreciationMethod: dto.depreciationMethod || category.depreciationMethod,
        purchaseDate,
        startDate,
        currentValue: acquisitionCost,
        location: dto.location || null,
        notes: dto.notes || null,
      },
      include: { category: true },
    });
  }

  private calculateDepreciation(asset: any) {
    const cost = this.decimal(asset.acquisitionCost);
    const salvage = this.decimal(asset.salvageValue);
    const accumulated = this.decimal(asset.accumulatedDepreciation);
    const bookValue = this.decimal(asset.currentValue);
    const remaining = cost.sub(salvage).sub(accumulated);
    if (remaining.lte(0)) return new Prisma.Decimal(0);

    let amount: Prisma.Decimal;
    if (asset.depreciationMethod === 'STRAIGHT_LINE') {
      amount = cost.sub(salvage).div(asset.usefulLifeYears * 12);
    } else if (asset.depreciationMethod === 'DECLINING_BALANCE') {
      const annualRate = this.decimal(asset.category.depreciationRate);
      if (annualRate.lte(0)) {
        throw new BadRequestException('DECLINING_BALANCE asset category requires depreciationRate > 0');
      }
      amount = bookValue.mul(annualRate).div(100).div(12);
    } else {
      throw new BadRequestException(
        'UNITS_OF_PRODUCTION cannot be posted because production-unit data is not configured',
      );
    }

    if (amount.gt(remaining)) amount = remaining;
    return amount.toDecimalPlaces(2, Prisma.Decimal.ROUND_HALF_UP);
  }

  private async validateDepreciationAccounts(
    tx: Prisma.TransactionClient,
    tenantId: string,
    expenseAccountId: string,
    accumulatedAccountId: string,
  ) {
    const accounts = await tx.chartOfAccount.findMany({
      where: {
        tenantId,
        id: { in: [expenseAccountId, accumulatedAccountId] },
        isActive: true,
      },
      select: { id: true, type: true, code: true, name: true },
    });
    const expense = accounts.find((x) => x.id === expenseAccountId);
    const accumulated = accounts.find((x) => x.id === accumulatedAccountId);
    if (!expense || expense.type !== 'EXPENSE') {
      throw new BadRequestException('Depreciation expense account must be an active EXPENSE account');
    }
    if (!accumulated || accumulated.type !== 'ASSET') {
      throw new BadRequestException('Accumulated depreciation account must be an active ASSET account');
    }
    if (expense.id === accumulated.id) {
      throw new BadRequestException('Depreciation accounts must be different');
    }
  }

  async previewDepreciation(req: any, id: string, period: string) {
    const tenantId = req.user?.tenantId;
    const asset = await this.getAsset(tenantId, id);
    const p = this.parsePeriod(period);
    if (asset.status !== 'ACTIVE') throw new ConflictException('Only ACTIVE assets can be depreciated');
    if (asset.startDate > p.end) throw new ConflictException('Asset depreciation has not started for this period');
    const existing = asset.entries.find((x) => x.period === period);
    if (existing) throw new ConflictException('Depreciation already posted for this period');
    const amount = this.calculateDepreciation(asset);
    const accumulated = this.decimal(asset.accumulatedDepreciation).add(amount);
    const bookValue = this.decimal(asset.acquisitionCost).sub(accumulated);
    return {
      assetId: asset.id,
      period,
      depreciationAmount: Number(amount),
      accumulatedDepreciation: Number(accumulated),
      bookValue: Number(bookValue),
      salvageValue: Number(asset.salvageValue),
    };
  }

  async postDepreciation(req: any, id: string, dto: any) {
    const tenantId = req.user?.tenantId;
    if (!tenantId) throw new BadRequestException('Tenant is required');
    const p = this.parsePeriod(dto.period);

    return prisma.$transaction(async (tx) => {
      const asset = await tx.fixedAsset.findFirst({
        where: { tenantId, id },
        include: { category: true },
      });
      if (!asset) throw new NotFoundException('Fixed asset not found');
      if (asset.status !== 'ACTIVE') throw new ConflictException('Only ACTIVE assets can be depreciated');
      if (asset.startDate > p.end) throw new ConflictException('Asset depreciation has not started for this period');

      const duplicate = await tx.depreciationEntry.findFirst({
        where: { tenantId, assetId: id, period: dto.period },
        select: { id: true },
      });
      if (duplicate) throw new ConflictException('Depreciation already posted for this period');

      await this.validateDepreciationAccounts(
        tx,
        tenantId,
        dto.expenseAccountId,
        dto.accumulatedDepreciationAccountId,
      );

      const amount = this.calculateDepreciation(asset);
      if (amount.lte(0)) throw new ConflictException('Asset is already fully depreciated');

      const accumulated = this.decimal(asset.accumulatedDepreciation).add(amount);
      const bookValue = this.decimal(asset.acquisitionCost).sub(accumulated);
      const fullyDepreciated = bookValue.lte(this.decimal(asset.salvageValue));

      const journal = await this.posting.postInTransaction(tx, {
        tenantId,
        entryNumber: dto.entryNumber || `DEP-${dto.period}-${asset.id}`,
        date: p.end,
        description: `Depreciation ${asset.name} - ${dto.period}`,
        reference: asset.code || asset.id,
        sourceType: 'FIXED_ASSET_DEPRECIATION',
        sourceId: `${asset.id}:${dto.period}`,
        lines: [
          {
            accountId: dto.expenseAccountId,
            debitAmount: amount,
            description: `Depreciation expense - ${asset.name}`,
            costCenterId: dto.costCenterId,
            projectId: dto.projectId,
            branchId: dto.branchId,
          },
          {
            accountId: dto.accumulatedDepreciationAccountId,
            creditAmount: amount,
            description: `Accumulated depreciation - ${asset.name}`,
            costCenterId: dto.costCenterId,
            projectId: dto.projectId,
            branchId: dto.branchId,
          },
        ],
      });

      const entry = await tx.depreciationEntry.create({
        data: {
          tenantId,
          assetId: asset.id,
          period: dto.period,
          depreciationAmount: amount,
          accumulatedDepreciation: accumulated,
          bookValue,
        },
      });

      await tx.fixedAsset.update({
        where: { id: asset.id },
        data: {
          accumulatedDepreciation: accumulated,
          currentValue: bookValue,
          ...(fullyDepreciated ? { status: 'FULLY_DEPRECIATED' } : {}),
        },
      });

      return { entry, journal };
    });
  }
}
