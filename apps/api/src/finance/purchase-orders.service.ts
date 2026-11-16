import { Injectable, NotFoundException, ConflictException, BadRequestException } from '@nestjs/common';
import { prisma, tenantWhere, Prisma } from '@scc/database';

@Injectable()
export class PurchaseOrdersService {
  private async assertSupplier(tenantId: string | undefined, supplierId: string | undefined) {
    if (!tenantId) throw new BadRequestException('Tenant is required');
    if (!supplierId) return;
    const supplier = await prisma.supplier.findFirst({
      where: { id: supplierId, tenantId, isActive: true }, select: { id: true },
    });
    if (!supplier) throw new NotFoundException('Active supplier not found in tenant');
  }

  private assertAmounts(subtotalRaw: unknown, taxRaw: unknown, totalRaw: unknown) {
    // Decimal arithmetic: do not let floats, negative numbers or an inconsistent
    // header total enter the purchase-to-pay workflow.
    let subtotal: Prisma.Decimal;
    let tax: Prisma.Decimal;
    let total: Prisma.Decimal;
    try {
      if ([subtotalRaw, taxRaw, totalRaw].some(value => value === null || value === undefined)) {
        throw new Error('missing amount');
      }
      subtotal = new Prisma.Decimal(subtotalRaw as Prisma.Decimal.Value);
      tax = new Prisma.Decimal(taxRaw as Prisma.Decimal.Value);
      total = new Prisma.Decimal(totalRaw as Prisma.Decimal.Value);
    } catch { throw new BadRequestException('Invalid purchase order amounts'); }
    if (![subtotal, tax, total].every(value => value.isFinite() && value.decimalPlaces() <= 2 && value.gte(0)) ||
        !total.eq(subtotal.plus(tax))) {
      throw new BadRequestException('Purchase order total must equal subtotal plus tax');
    }
  }

  async findAll(req: any, query: any) {
    const where: any = { ...tenantWhere(req.user?.tenantId) };
    if (query.status) where.status = query.status;
    if (query.vendorId) where.vendorId = query.vendorId;
    const [data, count] = await Promise.all([
      prisma.purchaseOrder.findMany({ where, orderBy: { createdAt: 'desc' }, take: 100 }),
      prisma.purchaseOrder.count({ where }),
    ]);
    return { data, count };
  }

  async findOne(req: any, id: string) {
    const where = { ...tenantWhere(req.user?.tenantId), id };
    const item = await prisma.purchaseOrder.findFirst({ where });
    if (!item) throw new NotFoundException('Purchase order not found');
    return item;
  }

  async create(req: any, dto: any) {
    const tenantId = req.user?.tenantId;
    await this.assertSupplier(tenantId, dto.vendorId);
    this.assertAmounts(dto.subtotal, dto.taxAmount ?? 0, dto.total);
    const existing = await prisma.purchaseOrder.findFirst({
      where: { tenantId, poNumber: dto.poNumber },
    });
    if (existing) throw new ConflictException('PO number already exists');
    const data: any = {
      tenantId, poNumber: dto.poNumber, vendorId: dto.vendorId,
      subtotal: dto.subtotal, taxAmount: dto.taxAmount ?? 0, total: dto.total,
      notes: dto.notes, status: 'DRAFT',
    };
    if (dto.expectedDelivery) data.expectedDelivery = new Date(dto.expectedDelivery);
    return prisma.purchaseOrder.create({ data });
  }

  async update(req: any, id: string, dto: any) {
    const where = { ...tenantWhere(req.user?.tenantId), id };
    const existing = await prisma.purchaseOrder.findFirst({ where });
    if (!existing) throw new NotFoundException('Purchase order not found');
    if (dto.vendorId !== undefined) await this.assertSupplier(req.user?.tenantId, dto.vendorId);
    // Generic PATCH cannot jump approval or receipt stages or reopen terminal
    // purchase orders. Inventory receipts and financial posting remain separate
    // audited workflows; changing status here never creates journal entries.
    const transitions: Record<string, readonly string[]> = {
      DRAFT: ['SENT', 'CANCELLED'],
      SENT: ['APPROVED', 'REJECTED', 'CANCELLED'],
      APPROVED: ['PARTIALLY_RECEIVED', 'RECEIVED', 'CANCELLED'],
      PARTIALLY_RECEIVED: ['RECEIVED', 'CANCELLED'],
      REJECTED: [], RECEIVED: [], CANCELLED: [],
    };
    if (dto.status !== undefined && dto.status !== existing.status &&
        !transitions[existing.status]?.includes(dto.status)) {
      throw new ConflictException('Invalid purchase order status transition');
    }
    if (dto.subtotal !== undefined || dto.taxAmount !== undefined || dto.total !== undefined) {
      if (existing.status !== 'DRAFT') throw new ConflictException('Purchase order amounts are immutable after draft');
      this.assertAmounts(dto.subtotal ?? existing.subtotal, dto.taxAmount ?? existing.taxAmount, dto.total ?? existing.total);
    }
    if (dto.expectedDelivery !== undefined && existing.status !== 'DRAFT')
      throw new ConflictException('Purchase order delivery terms are immutable after draft');
    const data: any = {};
    for (const field of ['status','subtotal','taxAmount','total','expectedDelivery']) {
      if (dto[field] !== undefined) data[field] = dto[field];
    }
    if (dto.expectedDelivery) data.expectedDelivery = new Date(dto.expectedDelivery);
    const result = await prisma.purchaseOrder.updateMany({
      where: { id, tenantId: req.user?.tenantId, status: existing.status }, data,
    });
    if (result.count !== 1)
      throw new ConflictException('Purchase order changed concurrently; reload before retry');
    return prisma.purchaseOrder.findFirstOrThrow({
      where: { id, tenantId: req.user?.tenantId },
    });
  }

  async remove(req: any, id: string) {
    const where = { ...tenantWhere(req.user?.tenantId), id };
    const existing = await prisma.purchaseOrder.findFirst({ where });
    if (!existing) throw new NotFoundException('Purchase order not found');
    if (existing.status !== 'DRAFT') throw new ConflictException('Only draft purchase orders may be deleted');
    return prisma.purchaseOrder.delete({ where: { id } });
  }
}
