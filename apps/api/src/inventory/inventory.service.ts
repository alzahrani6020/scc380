import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { prisma, tenantWhere } from '@scc/database';
import { AccountingPostingService } from '../accounting-core/accounting-posting.service';
import { AccountMappingService } from '../accounting-core/account-mapping.service';
import { CreateCategoryDto, CreateProductDto, CreateStockMovementDto, CreateWarehouseDto } from './dto/create-product.dto';

@Injectable()
export class InventoryService {
  constructor(
    private readonly mapping: AccountMappingService,
    private readonly posting: AccountingPostingService,
  ) {}
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
    if (!tenantId) throw new BadRequestException('Tenant is required for inventory movements');
    if (dto.type === 'TRANSFER') {
      throw new BadRequestException(
        'Manual TRANSFER movements are not allowed; use the stock transfer workflow',
      );
    }
    if (dto.type === 'ADJUSTMENT' && !dto.adjustmentDirection) {
      throw new BadRequestException('ADJUSTMENT requires adjustmentDirection');
    }

    return prisma.$transaction(async (tx) => {
      const product = await tx.product.findFirst({
        where: {
          id: dto.productId,
          tenantId,
          isActive: true,
          isService: false,
        },
      });
      if (!product) throw new NotFoundException('Active stock product not found');

      const warehouse = dto.warehouseId
        ? await tx.warehouse.findFirst({
            where: { id: dto.warehouseId, tenantId, isActive: true },
            select: { id: true, branchId: true },
          })
        : null;
      if (dto.warehouseId && !warehouse) {
        throw new BadRequestException('Active warehouse not found for tenant');
      }

      const unitCost = dto.unitCost === undefined
        ? Number(product.costPrice)
        : Number(dto.unitCost);
      if (!Number.isFinite(unitCost) || unitCost < 0) {
        throw new BadRequestException('unitCost must be a non-negative number');
      }
      const totalCost = Number((unitCost * dto.quantity).toFixed(2));

      const decreasesStock =
        dto.type === 'OUT' ||
        dto.type === 'SALE' ||
        (dto.type === 'ADJUSTMENT' && dto.adjustmentDirection === 'DECREASE');

      if (decreasesStock) {
        const updated = await tx.product.updateMany({
          where: {
            id: product.id,
            tenantId,
            currentStock: { gte: dto.quantity },
          },
          data: { currentStock: { decrement: dto.quantity } },
        });
        if (updated.count !== 1) {
          throw new ConflictException(
            `Insufficient stock: available=${product.currentStock} requested=${dto.quantity}`,
          );
        }
      } else {
        await tx.product.update({
          where: { id: product.id },
          data: { currentStock: { increment: dto.quantity } },
        });
      }

      const movement = await tx.stockMovement.create({
        data: {
          tenantId,
          productId: product.id,
          warehouseId: warehouse?.id || null,
          type: dto.type,
          quantity: dto.quantity,
          unitCost,
          totalCost,
          reference: dto.reference || null,
          notes: dto.notes || null,
        },
      });

      let journal: any = null;
      if (totalCost > 0) {
        const inventoryMapping = await this.mapping.resolveInTransaction(
          tx,
          tenantId,
          dto.type === 'SALE' ? ['INVENTORY', 'COGS'] : ['INVENTORY'],
        );
        const inventoryAccount = inventoryMapping.INVENTORY;

        let counterpartId: string;
        if (dto.type === 'SALE') {
          counterpartId = inventoryMapping.COGS.id;
        } else {
          if (!dto.counterAccountId) {
            throw new BadRequestException(
              `${dto.type} inventory movement requires counterAccountId for balanced accounting`,
            );
          }
          const counterpart = await tx.chartOfAccount.findFirst({
            where: {
              id: dto.counterAccountId,
              tenantId,
              isActive: true,
            },
            select: { id: true },
          });
          if (!counterpart) {
            throw new BadRequestException('Active counter account not found for tenant');
          }
          if (counterpart.id === inventoryAccount.id) {
            throw new BadRequestException('Counter account cannot equal the inventory account');
          }
          counterpartId = counterpart.id;
        }

        const increase = !decreasesStock;
        journal = await this.posting.postInTransaction(tx, {
          tenantId,
          entryNumber: `INV-MOV-${movement.id}`,
          description: `Inventory ${dto.type}: ${product.name}`,
          reference: dto.reference || movement.id,
          sourceType: 'INVENTORY_MOVEMENT',
          sourceId: movement.id,
          lines: increase
            ? [
                {
                  accountId: inventoryAccount.id,
                  debitAmount: totalCost,
                  description: `Inventory increase - ${product.name}`,
                  branchId: warehouse?.branchId || undefined,
                },
                {
                  accountId: counterpartId,
                  creditAmount: totalCost,
                  description: `Inventory counterpart - ${product.name}`,
                  branchId: warehouse?.branchId || undefined,
                },
              ]
            : [
                {
                  accountId: counterpartId,
                  debitAmount: totalCost,
                  description:
                    dto.type === 'SALE'
                      ? `Cost of goods sold - ${product.name}`
                      : `Inventory issue - ${product.name}`,
                  branchId: warehouse?.branchId || undefined,
                },
                {
                  accountId: inventoryAccount.id,
                  creditAmount: totalCost,
                  description: `Inventory decrease - ${product.name}`,
                  branchId: warehouse?.branchId || undefined,
                },
              ],
        });
      }

      const updatedProduct = await tx.product.findUnique({
        where: { id: product.id },
        select: { id: true, currentStock: true },
      });

      return {
        movement,
        currentStock: updatedProduct?.currentStock ?? product.currentStock,
        accountingPosted: Boolean(journal),
        journal,
      };
    });
  }

  // ─── Dashboard ───
  async getInventoryStats(tenantId: string | undefined, userRole: string) {
    const tw = userRole === 'SUPER_ADMIN' ? {} : tenantWhere(tenantId);
    const [totalProducts, products, movementsToday] = await Promise.all([
      prisma.product.count({ where: tw }),
      prisma.product.findMany({
        where: tw,
        select: { currentStock: true, minStockLevel: true, costPrice: true },
      }),
      prisma.stockMovement.count({
        where: { ...tw, createdAt: { gte: new Date(new Date().setHours(0, 0, 0, 0)) } },
      }),
    ]);

    return {
      totalProducts,
      lowStock: products.filter((product) => product.currentStock <= product.minStockLevel).length,
      totalStockValue: products.reduce(
        (sum, product) => sum + product.currentStock * Number(product.costPrice || 0),
        0,
      ),
      movementsToday,
    };
  }

}
