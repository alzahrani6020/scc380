import { Injectable, NotFoundException, BadRequestException, ForbiddenException } from '@nestjs/common';
import { prisma, withTenant } from '@scc/database';

@Injectable()
export class InvoicesService {
  private readonly RETENTION_YEARS = 6;

  // ─── Guards ──────────────────────────────────────────────────────────
  private async guardZatcaLocked(tenantId: string, id: string) {
    const invoice = await prisma.invoice.findFirst({
      where: withTenant({ id }, tenantId),
      select: { zatcaStatus: true, invoiceNumber: true },
    });
    if (!invoice) throw new NotFoundException('الفاتورة غير موجودة');
    if (invoice.zatcaStatus === 'CLEARED' || invoice.zatcaStatus === 'REPORTED') {
      throw new ForbiddenException('الفاتورة مُبلَّغة لـ ZATCA — لا يمكن التعديل أو الحذف');
    }
    return invoice;
  }

  private async validateInvoiceSeries(tenantId: string, invoiceNumber: string, excludeId?: string) {
    const tenant = await prisma.tenant.findUnique({ where: { id: tenantId }, select: { settings: true } });
    const settings = (tenant?.settings || {}) as Record<string, any>;
    const series = settings.invoiceSeries as string | undefined;

    if (series && !invoiceNumber.startsWith(series)) {
      throw new BadRequestException(`رقم الفاتورة يجب أن يبدأ بالسلسلة "${series}"`);
    }

    // Prevent duplicate invoice numbers
    const existing = await prisma.invoice.findFirst({
      where: withTenant({ invoiceNumber, NOT: excludeId ? { id: excludeId } : undefined }, tenantId),
    });
    if (existing) {
      throw new BadRequestException('رقم الفاتورة مستخدم مسبقاً');
    }
  }

  private enforceServerTimestamp(data: any) {
    const now = new Date();
    return {
      ...data,
      issueDate: now,
      createdAt: now,
    };
  }

  // ─── CRUD ────────────────────────────────────────────────────────────
  async findAll(tenantId: string, filters?: { status?: string; search?: string }) {
    const where = withTenant({}, tenantId);
    if (filters?.status) where.status = filters.status;
    if (filters?.search) {
      where.OR = [
        { invoiceNumber: { contains: filters.search, mode: 'insensitive' } },
        { notes: { contains: filters.search, mode: 'insensitive' } },
      ];
    }
    return prisma.invoice.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: { items: true },
    });
  }

  async findOne(tenantId: string, id: string) {
    const invoice = await prisma.invoice.findFirst({
      where: withTenant({ id }, tenantId),
      include: { items: true },
    });
    if (!invoice) throw new NotFoundException('الفاتورة غير موجودة');
    return invoice;
  }

  async create(tenantId: string, data: any) {
    const { items, ...invoiceData } = data;

    // Validate series & uniqueness
    await this.validateInvoiceSeries(tenantId, invoiceData.invoiceNumber);

    // Enforce server timestamp (ZATCA anti-tampering)
    const lockedData = this.enforceServerTimestamp(invoiceData);

    // Set retention date (6 years)
    const retentionUntil = new Date();
    retentionUntil.setFullYear(retentionUntil.getFullYear() + this.RETENTION_YEARS);

    return prisma.invoice.create({
      data: {
        ...lockedData,
        tenantId,
        retentionUntil,
        items: items?.length ? { create: items.map((item: any) => ({ ...item, tenantId })) } : undefined,
      },
      include: { items: true },
    });
  }

  async update(tenantId: string, id: string, data: any) {
    const invoice = await this.guardZatcaLocked(tenantId, id);

    // If trying to change invoiceNumber, validate series
    if (data.invoiceNumber && data.invoiceNumber !== invoice.invoiceNumber) {
      await this.validateInvoiceSeries(tenantId, data.invoiceNumber, id);
    }

    // Block date tampering
    if (data.issueDate || data.createdAt) {
      throw new ForbiddenException('تغيير تاريخ الفاتورة محظور — يتم تحديده تلقائياً من الخادم');
    }

    return prisma.invoice.update({ where: { id }, data, include: { items: true } });
  }

  async delete(tenantId: string, id: string) {
    await this.guardZatcaLocked(tenantId, id);
    return prisma.invoice.delete({ where: { id } });
  }
}
