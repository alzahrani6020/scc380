import { Injectable, NotFoundException } from '@nestjs/common';
import { prisma, tenantWhere } from '@scc/database';
import { CreateCategoryDto, CreateProductDto, CreateStockMovementDto, CreateWarehouseDto } from './dto/create-product.dto';

@Injectable()
export class InventoryService {
  // ─── Products ───
  async findAllProducts(tenantId: string | undefined, userRole: string) {
    const tw = userRole === 'SUPER_ADMIN' ? {} : tenantWhere(tenantId);
    return prisma.product.findMany({
      where: tw,
      include: { category: true },
      orderBy: { name: 'asc' },
    });
  }

  async findProductById(id: string, tenantId: string | undefined, userRole: string) {
    const tw = userRole === 'SUPER_ADMIN' ? {} : tenantWhere(tenantId);
    const product = await prisma.product.findFirst({
      where: { id, ...tw },
      include: { category: true, stockMovements: { take: 20, orderBy: { createdAt: 'desc' } } },
    });
    if (!product) throw new NotFoundException('Product not found');
    return product;
  }

  async createProduct(dto: CreateProductDto, tenantId: string | undefined, userRole: string) {
    const data: any = { ...dto };
    if (userRole !== 'SUPER_ADMIN') data.tenantId = tenantId;
    return prisma.product.create({ data });
  }

  async updateProduct(id: string, dto: Partial<CreateProductDto>, tenantId: string | undefined, userRole: string) {
    const tw = userRole === 'SUPER_ADMIN' ? {} : tenantWhere(tenantId);
    return prisma.product.updateMany({
      where: { id, ...tw },
      data: dto,
    });
  }

  async deleteProduct(id: string, tenantId: string | undefined, userRole: string) {
    const tw = userRole === 'SUPER_ADMIN' ? {} : tenantWhere(tenantId);
    return prisma.product.deleteMany({ where: { id, ...tw } });
  }

  // ─── Categories ───
  async findAllCategories(tenantId: string | undefined, userRole: string) {
    const tw = userRole === 'SUPER_ADMIN' ? {} : tenantWhere(tenantId);
    return prisma.productCategory.findMany({ where: tw, orderBy: { name: 'asc' } });
  }

  async createCategory(dto: CreateCategoryDto, tenantId: string | undefined, userRole: string) {
    const data: any = { ...dto };
    if (userRole !== 'SUPER_ADMIN') data.tenantId = tenantId;
    return prisma.productCategory.create({ data });
  }

  // ─── Warehouses ───
  async findAllWarehouses(tenantId: string | undefined, userRole: string) {
    const tw = userRole === 'SUPER_ADMIN' ? {} : tenantWhere(tenantId);
    return prisma.warehouse.findMany({ where: tw, orderBy: { name: 'asc' } });
  }

  async createWarehouse(dto: CreateWarehouseDto, tenantId: string | undefined, userRole: string) {
    const data: any = { ...dto };
    if (userRole !== 'SUPER_ADMIN') data.tenantId = tenantId;
    return prisma.warehouse.create({ data });
  }

  // ─── Stock Movements ───
  async findAllMovements(tenantId: string | undefined, userRole: string) {
    const tw = userRole === 'SUPER_ADMIN' ? {} : tenantWhere(tenantId);
    return prisma.stockMovement.findMany({
      where: tw,
      include: { product: true, warehouse: true },
      orderBy: { createdAt: 'desc' },
    });
  }

  async createMovement(dto: CreateStockMovementDto, tenantId: string | undefined, userRole: string) {
    const product = await prisma.product.findFirst({
      where: { id: dto.productId, ...(userRole === 'SUPER_ADMIN' ? {} : tenantWhere(tenantId)) },
    });
    if (!product) throw new NotFoundException('Product not found');

    const unitCost = dto.unitCost ? parseFloat(dto.unitCost) : Number(product.costPrice);
    const totalCost = unitCost * dto.quantity;

    // Update product stock
    const stockChange = ['OUT', 'SALE'].includes(dto.type) ? -dto.quantity : dto.quantity;
    const newStock = product.currentStock + stockChange;

    const data: any = {
      ...dto,
      unitCost,
      totalCost,
      tenantId: userRole === 'SUPER_ADMIN' ? undefined : tenantId,
    };

    await prisma.product.update({
      where: { id: dto.productId },
      data: { currentStock: newStock >= 0 ? newStock : 0 },
    });

    return prisma.stockMovement.create({ data });
  }

  // ─── Dashboard ───
  async getInventoryStats(tenantId: string | undefined, userRole: string) {
    const tw = userRole === 'SUPER_ADMIN' ? {} : tenantWhere(tenantId);
    const [
      totalProducts,
      lowStock,
      totalStockValue,
      movementsToday,
    ] = await Promise.all([
      prisma.product.count({ where: tw }),
      prisma.product.count({ where: { ...tw, currentStock: { lte: prisma.product.fields.minStockLevel } } }),
      prisma.product.aggregate({ _sum: { currentStock: true, costPrice: true }, where: tw }),
      prisma.stockMovement.count({
        where: { ...tw, createdAt: { gte: new Date(new Date().setHours(0, 0, 0, 0)) } },
      }),
    ]);

    return {
      totalProducts,
      lowStock,
      totalStockValue: (totalStockValue._sum.currentStock || 0) * Number(totalStockValue._sum.costPrice || 0),
      movementsToday,
    };
  }
}
