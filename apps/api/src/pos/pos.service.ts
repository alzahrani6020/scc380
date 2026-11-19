import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { prisma, tenantWhere } from '@scc/database';
import { PosPaymentMethod } from '@prisma/client';
import { PaymentMethod } from '@scc/database';
import { AccountMappingService, AccountingRole } from '../accounting-core/account-mapping.service';
import { AccountingPostingService, PostingLine } from '../accounting-core/accounting-posting.service';
import { CreatePosOrderDto, CreatePosSessionDto, ClosePosSessionDto } from './dto/pos.dto';

function generateOrderNumber(): string {
  return 'POS-' + Date.now().toString(36).toUpperCase();
}

@Injectable()
export class PosService {
  constructor(
    private readonly mapping: AccountMappingService = new AccountMappingService(),
    private readonly posting: AccountingPostingService = new AccountingPostingService(),
  ) {}
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

  async createOrder(dto: CreatePosOrderDto, userId: string, tenantId: string | undefined, userRole: string) {
    // Tenant identity is derived exclusively from the authenticated JWT.
    // SUPER_ADMIN without an explicit tenant cannot create a financial transaction.
    if (!userId || !tenantId) throw new BadRequestException('Tenant-scoped session is required');
    const orderNumber = 'POS-' + dto.clientOrderId;
    const existing = await prisma.posOrder.findFirst({
      where: { orderNumber, tenantId },
      include: { items: true, payments: true },
    });
    if (existing) return existing;

    if (!dto.items?.length || !dto.payments?.length) {
      throw new BadRequestException('Items and payments are required');
    }
    if (dto.items.some(i => !i.productId) ||
        new Set(dto.items.map(i => i.productId)).size !== dto.items.length) {
      throw new BadRequestException('Unique inventory product IDs are required');
    }

    // Serializable transactions prevent overselling across concurrent POS terminals.
    // Every stock decrement, ledger movement, payment and order must commit together.
    return prisma.$transaction(async (tx) => {
      const repeat = await tx.posOrder.findFirst({
        where: { orderNumber, tenantId },
        include: { items: true, payments: true },
      });
      if (repeat) return repeat;
      const session = await tx.posSession.findFirst({
        where: { userId, tenantId, status: 'OPEN' },
        select: { id: true },
      });
      if (!session) throw new BadRequestException('Open POS session is required');

      let subtotal = 0;
      let totalTax = 0;
      const lines = [];
      for (const item of dto.items) {
        const product = await tx.product.findFirst({
          where: { id: item.productId, tenantId, isActive: true, isService: false },
          select: { id: true, name: true, salePrice: true, taxRate: true, currentStock: true, costPrice: true },
        });
        if (!product) throw new BadRequestException('Product not available in your tenant');
        if (!Number.isInteger(item.quantity) || item.quantity <= 0) {
          throw new BadRequestException('Invalid item quantity');
        }
        // Price/tax are server-authoritative; client values cannot alter charged totals.
        const price = Number(product.salePrice);
        const taxRate = Number(product.taxRate);
        if (!Number.isFinite(price) || price < 0 || !Number.isFinite(taxRate) ||
            taxRate < 0 || taxRate > 100) {
          throw new BadRequestException('Invalid product price or tax');
        }
        const lineNet = Math.round(price * item.quantity * 100) / 100;
        const lineTax = Math.round(lineNet * taxRate) / 10000 * 100;
        subtotal += lineNet;
        totalTax += lineTax;
        lines.push({
          product, item, price, taxRate,
          total: Math.round((lineNet + lineTax) * 100) / 100,
        });
      }
      subtotal = Math.round(subtotal * 100) / 100;
      totalTax = Math.round(totalTax * 100) / 100;
      const total = Math.round((subtotal + totalTax) * 100) / 100;
      const payments = dto.payments.map(payment => {
        const amount = Number(payment.amount);
        if (!Number.isFinite(amount) || amount <= 0 ||
            !Object.values(PosPaymentMethod).includes(payment.method as PosPaymentMethod)) {
          throw new BadRequestException('Invalid payment');
        }
        return { method: payment.method as PosPaymentMethod, amount, reference: payment.reference, tenantId };
      });
      const paid = Math.round(payments.reduce((sum, payment) => sum + payment.amount, 0) * 100) / 100;
      if (Math.abs(total - paid) > 0.009) throw new BadRequestException('Payment amount does not match server total');

      // Resolve every accounting account BEFORE any stock write. Missing accounts
      // must reject the entire sale rather than silently create unposted revenue.
      const costTotal = Math.round(lines.reduce((sum, line) =>
        sum + Number(line.product.costPrice || 0) * line.item.quantity, 0) * 100) / 100;
      const roles: AccountingRole[] = [
        ...(subtotal > 0 ? ['SALES_REVENUE' as const] : []),
        ...(totalTax > 0 ? ['VAT_PAYABLE' as const] : []),
        ...(costTotal > 0 ? ['INVENTORY' as const, 'COGS' as const] : []),
      ];
      const accounts = roles.length
        ? await this.mapping.resolveInTransaction(tx, tenantId, roles)
        : {} as Record<string, { id: string }>;
      const paymentLines: PostingLine[] = [];
      for (const payment of payments) {
        // The POS payment enum includes options not represented by the
        // accounting payment enum. Reject those until explicitly mapped.
        if (!Object.values(PaymentMethod).includes(payment.method as unknown as PaymentMethod)) {
          throw new BadRequestException(`Accounting mapping unavailable for POS payment ${payment.method}`);
        }
        const account = await this.mapping.resolvePaymentAccountInTransaction(
          tx, tenantId, payment.method as unknown as PaymentMethod,
        );
        paymentLines.push({ accountId: account.id, debitAmount: payment.amount });
      }

      // Conditional update prevents negative inventory even under racing requests.
      for (const line of lines) {
        const updated = await tx.product.updateMany({
          where: { id: line.product.id, tenantId, isActive: true, isService: false,
            currentStock: { gte: line.item.quantity } },
          data: { currentStock: { decrement: line.item.quantity } },
        });
        if (updated.count !== 1) throw new BadRequestException('Insufficient stock');
      }

      const order = await tx.posOrder.create({
        data: {
          orderNumber, sessionId: session.id, tenantId,
          customerName: dto.customerName, customerPhone: dto.customerPhone,
          subtotal, discount: 0, taxRate: 15, taxAmount: totalTax, total,
          items: { createMany: { data: lines.map(line => ({
            productId: line.product.id, productName: line.product.name,
            quantity: line.item.quantity, unitPrice: line.price,
            discount: 0, taxRate: line.taxRate, total: line.total, tenantId,
          })) } },
          payments: { createMany: { data: payments } },
        },
        include: { items: true, payments: true },
      });
      for (const line of lines) {
        await tx.stockMovement.create({
          data: {
            productId: line.product.id, tenantId, type: 'SALE',
            quantity: line.item.quantity,
            unitCost: line.product.costPrice,
            totalCost: Number(line.product.costPrice) * line.item.quantity,
            reference: order.orderNumber, referenceId: order.id,
          },
        });
      }
      // A single balanced posting links cash, revenue, VAT and inventory cost
      // to the same order. All inserts participate in the same serializable
      // transaction: accounting rejection rolls back sale and stock changes.
      const journalLines: PostingLine[] = [...paymentLines];
      if (subtotal > 0) journalLines.push({ accountId: accounts.SALES_REVENUE.id, creditAmount: subtotal });
      if (totalTax > 0) journalLines.push({ accountId: accounts.VAT_PAYABLE.id, creditAmount: totalTax });
      if (costTotal > 0) journalLines.push(
        { accountId: accounts.COGS.id, debitAmount: costTotal },
        { accountId: accounts.INVENTORY.id, creditAmount: costTotal },
      );
      await this.posting.postInTransaction(tx, {
        tenantId,
        entryNumber: `POS-${order.id}`,
        description: `POS sale ${order.orderNumber}`,
        reference: order.orderNumber,
        sourceType: 'POS_ORDER', sourceId: order.id,
        lines: journalLines,
      });
      return order;
    }, { isolationLevel: 'Serializable', timeout: 15000 });
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
