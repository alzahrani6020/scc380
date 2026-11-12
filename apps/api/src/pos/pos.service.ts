import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PosPaymentMethod, Prisma, prisma, tenantWhere } from '@scc/database';
import { AccountMappingService } from '../accounting-core/account-mapping.service';
import { AccountingDualWriteService } from '../accounting-core/accounting-dual-write.service';
import { ClosePosSessionDto, CreatePosOrderDto, CreatePosSessionDto } from './dto/pos.dto';

function generateOrderNumber(): string {
  return 'POS-' + Date.now().toString(36).toUpperCase();
}

@Injectable()
export class PosService {
  constructor(
    private readonly accountMapping: AccountMappingService,
    private readonly dualWrite: AccountingDualWriteService,
  ) {}

  async findActiveSession(userId: string, tenantId: string | undefined, userRole: string) {
    const tw = userRole === 'SUPER_ADMIN' ? {} : tenantWhere(tenantId);
    return prisma.posSession.findFirst({
      where: { ...tw, userId, status: 'OPEN' },
      include: { orders: { include: { items: true, payments: true } } },
    });
  }

  async openSession(dto: CreatePosSessionDto, userId: string, tenantId: string | undefined, userRole: string) {
    if (userRole !== 'SUPER_ADMIN' && !tenantId) {
      throw new BadRequestException('Tenant is required');
    }
    const existing = await this.findActiveSession(userId, tenantId, userRole);
    if (existing) throw new BadRequestException('You already have an open session');

    const data: any = {
      ...dto,
      openingCash: new Prisma.Decimal(dto.openingCash),
      userId,
      tenantId: userRole === 'SUPER_ADMIN' ? undefined : tenantId,
    };
    return prisma.posSession.create({ data });
  }

  async closeSession(sessionId: string, dto: ClosePosSessionDto, tenantId: string | undefined, userRole: string) {
    const tw = userRole === 'SUPER_ADMIN' ? {} : tenantWhere(tenantId);
    const session = await prisma.posSession.findFirst({
      where: { id: sessionId, ...tw, status: 'OPEN' },
      include: { orders: { include: { payments: true } } },
    });
    if (!session) throw new NotFoundException('Open session not found');

    const cashPayments = session.orders
      .flatMap(order => order.payments)
      .filter(payment => payment.method === 'CASH')
      .reduce((sum, payment) => sum.add(payment.amount), new Prisma.Decimal(0));
    const expectedCash = session.openingCash.add(cashPayments);

    return prisma.posSession.update({
      where: { id: sessionId },
      data: {
        status: 'CLOSED',
        closedAt: new Date(),
        closingCash: new Prisma.Decimal(dto.closingCash),
        expectedCash,
        notes: dto.notes,
      },
    });
  }

  async findAllOrders(tenantId: string | undefined, userRole: string) {
    const tw = userRole === 'SUPER_ADMIN' ? {} : tenantWhere(tenantId);
    return prisma.posOrder.findMany({
      where: tw,
      include: { items: true, payments: true, session: true },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOrderById(id: string, tenantId: string | undefined, userRole: string) {
    const tw = userRole === 'SUPER_ADMIN' ? {} : tenantWhere(tenantId);
    const order = await prisma.posOrder.findFirst({
      where: { id, ...tw },
      include: { items: true, payments: true },
    });
    if (!order) throw new NotFoundException('Order not found');
    return order;
  }

  async createOrder(dto: CreatePosOrderDto, sessionId: string, tenantId: string | undefined, userRole: string) {
    const tw = userRole === 'SUPER_ADMIN' ? {} : tenantWhere(tenantId);

    return prisma.$transaction(async tx => {
      const session = await tx.posSession.findFirst({
        where: { id: sessionId, ...tw, status: 'OPEN' },
      });
      if (!session) throw new BadRequestException('No open session found');

      const effectiveTenantId = session.tenantId;
      const productIds = [...new Set(dto.items.map(item => item.productId).filter((id): id is string => Boolean(id)))];
      const products = productIds.length
        ? await tx.product.findMany({
            where: { tenantId: effectiveTenantId, id: { in: productIds }, isActive: true },
          })
        : [];
      if (products.length !== productIds.length) {
        throw new BadRequestException('One or more POS products are missing, inactive, or outside tenant');
      }
      const productById = new Map(products.map(product => [product.id, product]));

      let subtotal = new Prisma.Decimal(0);
      let totalDiscount = new Prisma.Decimal(0);
      let totalTax = new Prisma.Decimal(0);
      let totalInventoryCost = new Prisma.Decimal(0);

      const orderItems = dto.items.map(item => {
        const quantity = item.quantity;
        const unitPrice = new Prisma.Decimal(item.unitPrice);
        const unitDiscount = new Prisma.Decimal(item.discount || 0);
        const taxRate = new Prisma.Decimal(item.taxRate || 15);
        if (unitPrice.lt(0) || unitDiscount.lt(0) || taxRate.lt(0)) {
          throw new BadRequestException('POS price, discount, and tax cannot be negative');
        }

        const itemSubtotal = unitPrice.mul(quantity);
        const itemDiscount = unitDiscount.mul(quantity);
        const taxableAmount = itemSubtotal.sub(itemDiscount);
        if (taxableAmount.lt(0)) {
          throw new BadRequestException('POS discount cannot exceed item subtotal');
        }
        const itemTax = taxableAmount.mul(taxRate).div(100);
        const itemTotal = taxableAmount.add(itemTax);

        subtotal = subtotal.add(itemSubtotal);
        totalDiscount = totalDiscount.add(itemDiscount);
        totalTax = totalTax.add(itemTax);

        const product = item.productId ? productById.get(item.productId) : undefined;
        if (product && !product.isService) {
          if (product.currentStock < quantity) {
            throw new BadRequestException(
              `Insufficient stock for ${product.name}: available=${product.currentStock}, requested=${quantity}`,
            );
          }
          totalInventoryCost = totalInventoryCost.add(product.costPrice.mul(quantity));
        }

        return {
          productId: item.productId,
          productName: item.productName,
          quantity,
          unitPrice,
          discount: itemDiscount,
          taxRate,
          total: itemTotal,
          tenantId: effectiveTenantId,
        };
      });

      const total = subtotal.sub(totalDiscount).add(totalTax);
      const parsedPayments = dto.payments.map(payment => {
        const method = payment.method as PosPaymentMethod;
        if (!Object.values(PosPaymentMethod).includes(method)) {
          throw new BadRequestException(`Unsupported POS payment method: ${payment.method}`);
        }
        const amount = new Prisma.Decimal(payment.amount);
        if (!amount.gt(0)) throw new BadRequestException('POS payment amount must be greater than zero');
        return { method, amount, reference: payment.reference, tenantId: effectiveTenantId };
      });
      const totalPayments = parsedPayments.reduce(
        (sum, payment) => sum.add(payment.amount),
        new Prisma.Decimal(0),
      );
      if (!totalPayments.equals(total)) {
        throw new BadRequestException(
          `Payment amount ${totalPayments.toFixed(2)} does not match order total ${total.toFixed(2)}`,
        );
      }

      const order = await tx.posOrder.create({
        data: {
          orderNumber: generateOrderNumber(),
          sessionId,
          customerName: dto.customerName,
          customerPhone: dto.customerPhone,
          subtotal,
          discount: totalDiscount,
          taxRate: 15,
          taxAmount: totalTax,
          total,
          tenantId: effectiveTenantId,
          branchId: session.branchId,
          items: { createMany: { data: orderItems } },
          payments: { createMany: { data: parsedPayments } },
        },
        include: { items: true, payments: true },
      });

      for (const item of dto.items) {
        if (!item.productId) continue;
        const product = productById.get(item.productId)!;
        if (product.isService) continue;

        const updated = await tx.product.updateMany({
          where: {
            id: product.id,
            tenantId: effectiveTenantId,
            isActive: true,
            currentStock: { gte: item.quantity },
          },
          data: { currentStock: { decrement: item.quantity } },
        });
        if (updated.count !== 1) {
          throw new BadRequestException(`Insufficient concurrent stock for ${product.name}`);
        }

        const totalCost = product.costPrice.mul(item.quantity);
        await tx.stockMovement.create({
          data: {
            productId: product.id,
            type: 'SALE',
            quantity: item.quantity,
            unitCost: product.costPrice,
            totalCost,
            reference: order.orderNumber,
            referenceId: order.id,
            tenantId: effectiveTenantId,
          },
        });
      }

      const autoPosting = await this.accountMapping.isAutoPostingEnabledInTransaction(
        tx,
        effectiveTenantId,
      );
      if (autoPosting) {
        const roles = [
          'SALES_REVENUE' as const,
          ...(totalTax.gt(0) ? ['VAT_PAYABLE' as const] : []),
          ...(totalInventoryCost.gt(0) ? ['COGS' as const, 'INVENTORY' as const] : []),
        ];
        const accounts = await this.accountMapping.resolveInTransaction(
          tx,
          effectiveTenantId,
          roles,
        );

        const lines: Array<{
          accountId: string;
          debitAmount?: Prisma.Decimal;
          creditAmount?: Prisma.Decimal;
          description: string;
          branchId?: string;
        }> = [];

        for (const payment of parsedPayments) {
          const settlement = await this.accountMapping.resolvePosPaymentAccountInTransaction(
            tx,
            effectiveTenantId,
            payment.method,
          );
          lines.push({
            accountId: settlement.id,
            debitAmount: payment.amount,
            description: `POS settlement ${payment.method} - ${order.orderNumber}`,
            branchId: session.branchId || undefined,
          });
        }

        const revenue = subtotal.sub(totalDiscount);
        if (revenue.gt(0)) {
          lines.push({
            accountId: accounts.SALES_REVENUE.id,
            creditAmount: revenue,
            description: `POS sales revenue - ${order.orderNumber}`,
            branchId: session.branchId || undefined,
          });
        }
        if (totalTax.gt(0)) {
          lines.push({
            accountId: accounts.VAT_PAYABLE.id,
            creditAmount: totalTax,
            description: `POS VAT payable - ${order.orderNumber}`,
            branchId: session.branchId || undefined,
          });
        }
        if (totalInventoryCost.gt(0)) {
          lines.push(
            {
              accountId: accounts.COGS.id,
              debitAmount: totalInventoryCost,
              description: `POS COGS - ${order.orderNumber}`,
              branchId: session.branchId || undefined,
            },
            {
              accountId: accounts.INVENTORY.id,
              creditAmount: totalInventoryCost,
              description: `POS inventory relief - ${order.orderNumber}`,
              branchId: session.branchId || undefined,
            },
          );
        }

        await this.dualWrite.postInTransaction(tx, {
          tenantId: effectiveTenantId,
          entryNumber: `POS-${order.id}`,
          date: order.createdAt,
          description: `POS order ${order.orderNumber}`,
          reference: order.orderNumber,
          sourceType: 'POS_ORDER',
          sourceId: order.id,
          lines,
        });
      }

      return order;
    });
  }

  async getDailyReport(tenantId: string | undefined, userRole: string, date?: string) {
    const tw = userRole === 'SUPER_ADMIN' ? {} : tenantWhere(tenantId);
    const targetDate = date ? new Date(date) : new Date();
    const start = new Date(targetDate);
    start.setHours(0, 0, 0, 0);
    const end = new Date(targetDate);
    end.setHours(23, 59, 59, 999);

    const [orders, totalSales, paymentMethods] = await Promise.all([
      prisma.posOrder.findMany({
        where: { ...tw, createdAt: { gte: start, lte: end } },
        include: { items: true, payments: true },
      }),
      prisma.posOrder.aggregate({
        _sum: { total: true },
        _count: { id: true },
        where: { ...tw, createdAt: { gte: start, lte: end }, status: 'COMPLETED' },
      }),
      prisma.posPayment.groupBy({
        by: ['method'],
        _sum: { amount: true },
        where: { ...tw, createdAt: { gte: start, lte: end } },
      }),
    ]);

    return {
      date: start.toISOString().split('T')[0],
      totalOrders: totalSales._count.id,
      totalSales: totalSales._sum.total || 0,
      paymentMethods: paymentMethods.map(payment => ({
        method: payment.method,
        amount: payment._sum.amount || 0,
      })),
      orders,
    };
  }
}
