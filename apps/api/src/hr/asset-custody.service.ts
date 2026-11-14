import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, prisma, tenantWhere } from '@scc/database';
import { AccountingPostingService } from '../accounting-core/accounting-posting.service';

const CLOSED_STATUSES = new Set(['RETURNED', 'LOST', 'DAMAGED']);

@Injectable()
export class HrAssetCustodyService {
  constructor(private readonly accountingPosting: AccountingPostingService) {}
  async listCategories(req: any) {
    return prisma.fixedAssetCategory.findMany({
      where: tenantWhere(req.user?.tenantId),
      orderBy: { name: 'asc' },
    });
  }

  async createCategory(req: any, dto: any) {
    const tenantId = req.user?.tenantId;
    return prisma.fixedAssetCategory.create({
      data: {
        tenantId,
        name: dto.name,
        code: dto.code || null,
        depreciationRate: Number(dto.depreciationRate || 0),
        usefulLifeYears: Number(dto.usefulLifeYears || 5),
        depreciationMethod: dto.depreciationMethod || 'STRAIGHT_LINE',
      },
    });
  }

  async listAssets(req: any, query: any) {
    const tenantId = req.user?.tenantId;
    const where: any = { ...tenantWhere(tenantId) };
    if (query.status) where.status = query.status;
    if (query.categoryId) where.categoryId = query.categoryId;
    const data = await prisma.fixedAsset.findMany({
      where,
      include: {
        category: true,
        custodyAssignments: {
          where: { status: 'ACTIVE' },
          include: { employee: { select: { id: true, employeeCode: true, firstName: true, lastName: true } } },
          take: 1,
        },
      },
      orderBy: { createdAt: 'desc' },
    });
    return { data, count: data.length };
  }

  async createAsset(req: any, dto: any) {
    const tenantId = req.user?.tenantId;
    const category = await prisma.fixedAssetCategory.findFirst({
      where: { ...tenantWhere(tenantId), id: dto.categoryId },
    });
    if (!category) throw new NotFoundException('Fixed asset category not found');
    const acquisitionCost = Number(dto.acquisitionCost);
    const salvageValue = Number(dto.salvageValue || 0);
    if (!Number.isFinite(acquisitionCost) || acquisitionCost < 0) {
      throw new BadRequestException('Acquisition cost must be non-negative');
    }
    if (!Number.isFinite(salvageValue) || salvageValue < 0 || salvageValue > acquisitionCost) {
      throw new BadRequestException('Invalid salvage value');
    }
    return prisma.fixedAsset.create({
      data: {
        tenantId,
        name: dto.name,
        code: dto.code || null,
        categoryId: category.id,
        acquisitionCost,
        salvageValue,
        currentValue: acquisitionCost,
        usefulLifeYears: Number(dto.usefulLifeYears || category.usefulLifeYears || 5),
        depreciationMethod: dto.depreciationMethod || category.depreciationMethod,
        purchaseDate: new Date(dto.purchaseDate),
        startDate: dto.startDate ? new Date(dto.startDate) : new Date(dto.purchaseDate),
        location: dto.location || null,
        notes: dto.notes || null,
      },
    });
  }

  async listAssignments(req: any, query: any) {
    const tenantId = req.user?.tenantId;
    const where: any = { ...tenantWhere(tenantId) };
    if (query.employeeId) where.employeeId = query.employeeId;
    if (query.assetId) where.assetId = query.assetId;
    if (query.status) where.status = query.status;
    const data = await prisma.assetCustodyAssignment.findMany({
      where,
      include: {
        asset: { include: { category: true } },
        employee: { select: { id: true, employeeCode: true, firstName: true, lastName: true, status: true } },
      },
      orderBy: { assignedAt: 'desc' },
    });
    return { data, count: data.length };
  }

  async assign(req: any, dto: any) {
    const tenantId = req.user?.tenantId;
    const [asset, employee] = await Promise.all([
      prisma.fixedAsset.findFirst({ where: { ...tenantWhere(tenantId), id: dto.assetId } }),
      prisma.employee.findFirst({ where: { ...tenantWhere(tenantId), id: dto.employeeId } }),
    ]);
    if (!asset) throw new NotFoundException('Fixed asset not found');
    if (!employee) throw new NotFoundException('Employee not found');
    if (asset.status !== 'ACTIVE') throw new ConflictException('Only active fixed assets can be assigned');
    if (employee.status !== 'ACTIVE') throw new ConflictException('Only active employees can receive custody');

    const existing = await prisma.assetCustodyAssignment.findFirst({
      where: { ...tenantWhere(tenantId), assetId: asset.id, status: 'ACTIVE' },
    });
    if (existing) throw new ConflictException('Fixed asset already has an active custody assignment');

    try {
      return await prisma.assetCustodyAssignment.create({
        data: {
          tenantId,
          assetId: asset.id,
          employeeId: employee.id,
          assignedAt: dto.assignedAt ? new Date(dto.assignedAt) : new Date(),
          expectedReturnAt: dto.expectedReturnAt ? new Date(dto.expectedReturnAt) : null,
          conditionOut: dto.conditionOut || null,
          assignedById: req.user?.userId || req.user?.id || null,
          notes: dto.notes || null,
          status: 'ACTIVE',
        },
        include: {
          asset: { include: { category: true } },
          employee: { select: { id: true, employeeCode: true, firstName: true, lastName: true } },
        },
      });
    } catch (error: any) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw new ConflictException('Fixed asset already has an active custody assignment');
      }
      throw error;
    }
  }

  async closeAssignment(req: any, id: string, dto: any) {
    const tenantId = req.user?.tenantId;
    if (!tenantId) throw new BadRequestException('Tenant is required');
    if (!CLOSED_STATUSES.has(dto.status)) throw new BadRequestException('Unsupported custody close status');

    return prisma.$transaction(async tx => {
      const assignment = await tx.assetCustodyAssignment.findFirst({
        where: { ...tenantWhere(tenantId), id },
        include: { asset: true },
      });
      if (!assignment) throw new NotFoundException('Custody assignment not found');
      if (assignment.status !== 'ACTIVE') throw new ConflictException('Custody assignment is already closed');
      if(dto.status==='LOST'||dto.status==='DAMAGED') {
        if(!dto.governanceCaseId) {
          throw new BadRequestException('Completed investigation case required for loss or impairment');
        }
        const investigation=await tx.hrGovernanceCase.findFirst({
          where:{
            tenantId,id:dto.governanceCaseId,employeeId:assignment.employeeId,
            category:'INVESTIGATIONS',status:{in:['RESOLVED','CLOSED']},
          },
          select:{id:true},
        });
        if(!investigation)throw new ConflictException('Resolved investigation for custodian is required');
        const approvals=await tx.hrGovernanceEvent.findMany({
          where:{tenantId,caseId:investigation.id,action:'CUSTODY_LOSS_REVIEW'},
          select:{details:true},
        });
        const linked=approvals.some(row=>{
          try{return JSON.parse(row.details)?.custodyAssignmentId===assignment.id;}
          catch{return false;}
        });
        if(!linked)throw new ConflictException('Investigation does not document this exact custody assignment');
      }

      const asset = assignment.asset;
      const currentValue = Number(asset.currentValue);
      const acquisitionCost = Number(asset.acquisitionCost);
      const accumulatedDepreciation = Number(asset.accumulatedDepreciation);

      if (dto.status === 'LOST') {
        if (!dto.assetAccountId || !dto.accumulatedDepreciationAccountId || !dto.lossAccountId) {
          throw new BadRequestException('Asset, accumulated depreciation, and loss accounts are required for lost assets');
        }

        const reconciliationGap = Math.abs((accumulatedDepreciation + currentValue) - acquisitionCost);
        if (reconciliationGap > 0.01) {
          throw new ConflictException('Asset carrying values do not reconcile to acquisition cost');
        }

        const lines: any[] = [];
        if (accumulatedDepreciation > 0) {
          lines.push({
            accountId: dto.accumulatedDepreciationAccountId,
            debitAmount: accumulatedDepreciation,
            description: 'Clear accumulated depreciation on lost asset',
          });
        }
        if (currentValue > 0) {
          lines.push({
            accountId: dto.lossAccountId,
            debitAmount: currentValue,
            description: 'Loss on lost fixed asset',
          });
        }
        lines.push({
          accountId: dto.assetAccountId,
          creditAmount: acquisitionCost,
          description: 'Derecognize lost fixed asset',
        });

        await this.accountingPosting.postInTransaction(tx, {
          tenantId,
          date: new Date(),
          entryNumber: `ASSET-LOST-${asset.id.slice(-10)}`,
          description: `Write off lost fixed asset ${asset.name}`,
          reference: `ASSET-CUSTODY-${assignment.id}`,
          sourceType: 'FIXED_ASSET_LOSS',
          sourceId: assignment.id,
          lines,
        });

        await tx.fixedAsset.update({
          where: { id: asset.id },
          data: { currentValue: 0, status: 'DISPOSED' },
        });
      }

      if (dto.status === 'DAMAGED') {
        const impairmentAmount = Number(dto.impairmentAmount);
        if (!Number.isFinite(impairmentAmount) || impairmentAmount <= 0) {
          throw new BadRequestException('A positive impairment amount is required for damaged assets');
        }
        if (impairmentAmount > currentValue) {
          throw new BadRequestException('Impairment amount cannot exceed current book value');
        }
        if (!dto.assetAccountId || !dto.lossAccountId) {
          throw new BadRequestException('Asset and impairment loss accounts are required for damaged assets');
        }

        await this.accountingPosting.postInTransaction(tx, {
          tenantId,
          date: new Date(),
          entryNumber: `ASSET-IMPAIR-${assignment.id.slice(-10)}`,
          description: `Impairment of damaged fixed asset ${asset.name}`,
          reference: `ASSET-CUSTODY-${assignment.id}`,
          sourceType: 'FIXED_ASSET_IMPAIRMENT',
          sourceId: assignment.id,
          lines: [
            {
              accountId: dto.lossAccountId,
              debitAmount: impairmentAmount,
              description: 'Fixed asset impairment loss',
            },
            {
              accountId: dto.assetAccountId,
              creditAmount: impairmentAmount,
              description: 'Reduce carrying value of damaged fixed asset',
            },
          ],
        });

        const newValue = Math.max(0, currentValue - impairmentAmount);
        await tx.fixedAsset.update({
          where: { id: asset.id },
          data: {
            currentValue: newValue,
            status: newValue === 0 ? 'DISPOSED' : 'ACTIVE',
          },
        });
      }

      return tx.assetCustodyAssignment.update({
        where: { id },
        data: {
          status: dto.status,
          returnedAt: new Date(),
          conditionIn: dto.conditionIn || null,
          returnedById: req.user?.userId || req.user?.id || null,
          notes: dto.notes !== undefined ? dto.notes : assignment.notes,
        },
        include: {
          asset: { include: { category: true } },
          employee: { select: { id: true, employeeCode: true, firstName: true, lastName: true } },
        },
      });
    });
  }

  async selfAssignments(req: any) {
    const tenantId = req.user?.tenantId;
    const userId = req.user?.userId || req.user?.id;
    const employee = await prisma.employee.findFirst({ where: { ...tenantWhere(tenantId), userId } });
    if (!employee) throw new NotFoundException('User is not linked to an employee profile');
    return prisma.assetCustodyAssignment.findMany({
      where: { ...tenantWhere(tenantId), employeeId: employee.id },
      include: { asset: { include: { category: true } } },
      orderBy: { assignedAt: 'desc' },
    });
  }
}
