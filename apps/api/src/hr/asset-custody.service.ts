import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, prisma, tenantWhere } from '@scc/database';

const CLOSED_STATUSES = new Set(['RETURNED', 'LOST', 'DAMAGED']);

@Injectable()
export class HrAssetCustodyService {
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
    if (!CLOSED_STATUSES.has(dto.status)) throw new BadRequestException('Unsupported custody close status');
    const assignment = await prisma.assetCustodyAssignment.findFirst({
      where: { ...tenantWhere(tenantId), id },
    });
    if (!assignment) throw new NotFoundException('Custody assignment not found');
    if (assignment.status !== 'ACTIVE') throw new ConflictException('Custody assignment is already closed');

    return prisma.assetCustodyAssignment.update({
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
