import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { prisma, tenantWhere } from '@scc/database';
import { CreatePosOrderDto, CreatePosSessionDto, ClosePosSessionDto } from './dto/pos.dto';

function generateOrderNumber(): string {
  return 'POS-' + Date.now().toString(36).toUpperCase();
}

@Injectable()
export class PosService {
  // ─── Sessions ───
  async findActiveSession(userId: string, tenantId: string | undefined, userRole: string) {
    const tw = userRole === 'SUPER_ADMIN' ? {} : tenantWhere(tenantId);
    return prisma.posSession.findFirst({
      where: { ...tw, userId, status: 'OPEN' },
      include: { orders: { include: { items: true, payments: true } } },
    });
  }

  async openSession(dto: CreatePosSessionDto, userId: string, tenantId: string | undefined, userRole: string) {
    const existing = await this.findActiveSession(userId, tenantId, userRole);
    if (existing) throw new BadRequestException('You already have an open session');

    const data: any = {
      ...dto,
      openingCash: parseFloat(dto.openingCash),
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

    // Calculate expected cash
    const cashPayments = session.orders
      .flatMap(o => o.payments)
      .filter(p => p.method === 'CASH')
      .reduce((sum, p) => sum + Number(p.amount), 0);
    const expectedCash = Number(session.openingCash) + cashPayments;

    return prisma.posSession.update({
      where: { id: sessionId },
      data: {
        status: 'CLOSED',
        closedAt: new Date(),
        closingCash: parseFloat(dto.closingCash),
        expectedCash,
        notes: dto.notes,
      },
    });
  }

  // ─── Orders ───
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
    // Verify session exists and is open
    const tw = userRole === 'SUPER_ADMIN' ? {} : tenantWhere(tenantId);
    const session = await prisma.posSession.findFirst({
      where: { id: sessionId, ...tw, status: 'OPEN' },
    });
    if (!session) throw new BadRequestException('No open session found');

    // Calculate totals
    let subtotal = 0;
    let totalDiscount = 0;
    let totalTax = 0;

    const orderItems = dto.items.map(item => {
      const qty = item.quantity;
      const price = parseFloat(item.unitPrice);
      const discount = parseFloat(item.discount || '0');
      const taxRate = parseFloat(item.taxRate || '15');
      const itemSubtotal = qty * price;
      const itemDiscount = qty * discount;
      const taxableAmount = itemSubtotal - itemDiscount;
      const itemTax = taxableAmount * (taxRate / 100);
      const itemTotal = taxableAmount + itemTax;

      subtotal += itemSubtotal;
      totalDiscount += itemDiscount;
      totalTax += itemTax;

      return {
        productId: item.productId,
        productName: item.productName,
        quantity: qty,
        unitPrice: price,
        discount: itemDiscount,
        taxRate,
        total: itemTotal,
        tenantId: userRole === 'SUPER_ADMIN' ? undefined : tenantId,
      };
    });

    const total = subtotal - totalDiscount + totalTax;

    // Validate payments
    const totalPayments = dto.payments.reduce((sum, p) => sum + parseFloat(p.amount), 0);
    if (Math.abs(totalPayments - total) > 0.01) {
      throw new BadRequestException(`Payment amount ${totalPayments} does not match order total ${total}`);
    }

    // Create order
    const order = await prisma.posOrder.create({
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
        tenantId: userRole === 'SUPER_ADMIN' ? undefined : tenantId,
        items: { createMany: { data: orderItems } },
        payments: {
          createMany: {
            data: dto.payments.map(p => ({
              method: p.method,
              amount: parseFloat(p.amount),
              reference: p.reference,
              tenantId: userRole === 'SUPER_ADMIN' ? undefined : tenantId,
            })),
          },
        },
      },
      include: { items: true, payments: true },
    });

    // Update stock for products
    for (const item of dto.items) {
      if (item.productId) {
        await prisma.product.update({
          where: { id: item.productId },
          data: { currentStock: { decrement: item.quantity } },
        });
        // Record stock movement
        await prisma.stockMovement.create({
          data: {
            productId: item.productId,
            type: 'SALE',
            quantity: item.quantity,
            unitCost: 0,
            totalCost: 0,
            reference: order.orderNumber,
            referenceId: order.id,
            tenantId: userRole === 'SUPER_ADMIN' ? undefined : tenantId,
          },
        });
      }
    }

    return order;
  }

  // ─── Daily Report ───
  async getDailyReport(tenantId: string | undefined, userRole: string, date?: string) {
    const tw = userRole === 'SUPER_ADMIN' ? {} : tenantWhere(tenantId);
    const targetDate = date ? new Date(date) : new Date();
    const start = new Date(targetDate.setHours(0, 0, 0, 0));
    const end = new Date(targetDate.setHours(23, 59, 59, 999));

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
      paymentMethods: paymentMethods.map(p => ({
        method: p.method,
        amount: p._sum.amount || 0,
      })),
      orders,
    };
  }
}
