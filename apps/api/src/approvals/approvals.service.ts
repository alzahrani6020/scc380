import { Injectable, BadRequestException } from '@nestjs/common';
import { prisma, tenantWhere } from '@scc/database';

export type EntityType = 'leave' | 'expense' | 'invoice' | 'purchaseOrder' | 'fleetMaintenance';

export interface ApprovalResult {
  success: boolean;
  message: string;
  data?: any;
}

@Injectable()
export class ApprovalsService {
  private entityConfig: Record<EntityType, { table: string; statusField: string; approvedByField?: string; approvedAtField?: string }> = {
    leave: { table: 'leave', statusField: 'status', approvedByField: 'approvedById', approvedAtField: 'approvedAt' },
    expense: { table: 'expense', statusField: 'status', approvedByField: 'approvedById' },
    invoice: { table: 'invoice', statusField: 'status' },
    purchaseOrder: { table: 'purchaseOrder', statusField: 'status' },
    fleetMaintenance: { table: 'fleetMaintenance', statusField: 'status' },
  };

  async approve(entityType: EntityType, entityId: string, approverId: string, tenantId?: string, userRole?: string): Promise<ApprovalResult> {
    const config = this.entityConfig[entityType];
    if (!config) throw new BadRequestException('Invalid entity type');

    const tw = userRole === 'SUPER_ADMIN' ? {} : tenantWhere(tenantId);

    // @ts-ignore
    const entity = await prisma[config.table].findFirst({
      where: { id: entityId, ...tw },
    });

    if (!entity) {
      return { success: false, message: 'العنصر غير موجود' };
    }

    const updateData: any = { [config.statusField]: 'APPROVED' };
    if (config.approvedByField) updateData[config.approvedByField] = approverId;
    if (config.approvedAtField) updateData[config.approvedAtField] = new Date();

    // @ts-ignore
    await prisma[config.table].update({
      where: { id: entityId },
      data: updateData,
    });

    return { success: true, message: 'تمت الموافقة بنجاح', data: entity };
  }

  async reject(entityType: EntityType, entityId: string, approverId: string, reason: string, tenantId?: string, userRole?: string): Promise<ApprovalResult> {
    const config = this.entityConfig[entityType];
    if (!config) throw new BadRequestException('Invalid entity type');

    const tw = userRole === 'SUPER_ADMIN' ? {} : tenantWhere(tenantId);

    // @ts-ignore
    const entity = await prisma[config.table].findFirst({
      where: { id: entityId, ...tw },
    });

    if (!entity) {
      return { success: false, message: 'العنصر غير موجود' };
    }

    const updateData: any = { [config.statusField]: 'REJECTED' };
    if (config.approvedByField) updateData[config.approvedByField] = approverId;
    if (config.approvedAtField) updateData[config.approvedAtField] = new Date();

    // @ts-ignore
    await prisma[config.table].update({
      where: { id: entityId },
      data: updateData,
    });

    return { success: true, message: 'تم الرفض بنجاح', data: entity };
  }

  async getPendingApprovals(tenantId?: string, userRole?: string): Promise<any[]> {
    const tw = userRole === 'SUPER_ADMIN' ? {} : tenantWhere(tenantId);
    const results: any[] = [];

    // Leaves
    const leaves = await prisma.leave.findMany({
      where: { ...tw, status: 'PENDING' },
      include: { employee: { select: { firstName: true, lastName: true } } },
      orderBy: { createdAt: 'desc' },
    });
    for (const l of leaves) {
      results.push({ id: l.id, type: 'leave', title: `إجازة ${l.type}`, requester: `${l.employee.firstName} ${l.employee.lastName}`, date: l.createdAt, status: l.status });
    }

    // Expenses
    const expenses = await prisma.expense.findMany({
      where: { ...tw, status: 'PENDING' },
      orderBy: { createdAt: 'desc' },
    });
    for (const e of expenses) {
      results.push({ id: e.id, type: 'expense', title: `مصروف: ${e.description}`, requester: '-', date: e.createdAt, status: e.status, amount: e.amount });
    }

    // Invoices
    const invoices = await prisma.invoice.findMany({
      where: { ...tw, status: 'DRAFT' },
      orderBy: { createdAt: 'desc' },
    });
    const invoiceContactIds = invoices.map(i => i.contactId).filter(Boolean);
    const invoiceContacts = invoiceContactIds.length > 0
      ? await prisma.contact.findMany({ where: { id: { in: invoiceContactIds } }, select: { id: true, firstName: true, lastName: true } })
      : [];
    for (const i of invoices) {
      const contact = invoiceContacts.find(c => c.id === i.contactId);
      results.push({ id: i.id, type: 'invoice', title: `فاتورة ${i.invoiceNumber}`, requester: contact ? `${contact.firstName} ${contact.lastName}` : '-', date: i.createdAt, status: i.status, amount: i.total });
    }

    // Purchase Orders
    const pos = await prisma.purchaseOrder.findMany({
      where: { ...tw, status: 'DRAFT' },
      orderBy: { createdAt: 'desc' },
    });
    for (const p of pos) {
      results.push({ id: p.id, type: 'purchaseOrder', title: `أمر شراء ${p.poNumber}`, requester: '-', date: p.createdAt, status: p.status, amount: p.total });
    }

    // Fleet Maintenance
    const maintenances = await prisma.fleetMaintenance.findMany({
      where: { ...tw, status: 'SCHEDULED' },
      include: { vehicle: { select: { plateNumber: true } } },
      orderBy: { createdAt: 'desc' },
    });
    for (const m of maintenances) {
      results.push({ id: m.id, type: 'fleetMaintenance', title: `صيانة ${m.vehicle.plateNumber}`, requester: '-', date: m.createdAt, status: m.status, amount: m.cost });
    }

    return results.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }

  async getMyRequests(userId: string, tenantId?: string, userRole?: string): Promise<any[]> {
    const tw = userRole === 'SUPER_ADMIN' ? {} : tenantWhere(tenantId);
    const results: any[] = [];

    // Find employee by userId
    const employee = await prisma.employee.findFirst({ where: { ...tw, email: { contains: userId } } });
    if (employee) {
      const leaves = await prisma.leave.findMany({
        where: { employeeId: employee.id },
        orderBy: { createdAt: 'desc' },
      });
      for (const l of leaves) {
        results.push({ id: l.id, type: 'leave', title: `إجازة ${l.type}`, date: l.createdAt, status: l.status });
      }
    }

    return results.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }
}
