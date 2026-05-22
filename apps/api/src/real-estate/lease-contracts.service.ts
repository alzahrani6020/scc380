import { Injectable, NotFoundException } from '@nestjs/common';
import { prisma, withTenant } from '@scc/database';

@Injectable()
export class LeaseContractsService {
  async findAll(tenantId: string, filters?: { status?: string; propertyId?: string; unitId?: string; expiryDays?: number; search?: string }) {
    const where = withTenant({}, tenantId);
    if (filters?.status) where.status = filters.status;
    if (filters?.propertyId) where.propertyId = filters.propertyId;
    if (filters?.unitId) where.unitId = filters.unitId;
    if (filters?.expiryDays) {
      const date = new Date();
      date.setDate(date.getDate() + filters.expiryDays);
      where.endDate = { lte: date, gte: new Date() };
    }
    if (filters?.search) {
      where.OR = [
        { lessorName: { contains: filters.search, mode: 'insensitive' } },
        { lesseeName: { contains: filters.search, mode: 'insensitive' } },
        { ejarContractNumber: { contains: filters.search, mode: 'insensitive' } },
      ];
    }
    const [data, count] = await Promise.all([
      prisma.leaseContract.findMany({
        where,
        orderBy: { startDate: 'desc' },
        include: {
          property: { select: { id: true, name: true } },
          unit: { select: { id: true, unitNumber: true } },
          _count: { select: { payments: true } },
        },
      }),
      prisma.leaseContract.count({ where }),
    ]);
    return { data, count };
  }

  async findOne(tenantId: string, id: string) {
    const contract = await prisma.leaseContract.findFirst({
      where: withTenant({ id }, tenantId),
      include: {
        property: true,
        unit: true,
        payments: { orderBy: { dueDate: 'asc' } },
        documents: true,
      },
    });
    if (!contract) throw new NotFoundException('Contract not found');
    return contract;
  }

  async create(tenantId: string, dto: any) {
    const data = {
      ...dto,
      tenantId,
      startDate: new Date(dto.startDate),
      endDate: new Date(dto.endDate),
      status: dto.status || 'DRAFT',
    };

    const contract = await prisma.leaseContract.create({ data });

    // Auto-generate payment schedule
    await this.generatePaymentSchedule(contract);

    // Update unit status if contract is ACTIVE
    if (contract.status === 'ACTIVE') {
      await prisma.unit.update({
        where: { id: contract.unitId },
        data: { status: 'OCCUPIED', currentLeaseId: contract.id },
      });
    }

    return contract;
  }

  async update(tenantId: string, id: string, dto: any) {
    const existing = await prisma.leaseContract.findFirst({ where: withTenant({ id }, tenantId) });
    if (!existing) throw new NotFoundException('Contract not found');
    const data = { ...dto };
    if (dto.startDate) data.startDate = new Date(dto.startDate);
    if (dto.endDate) data.endDate = new Date(dto.endDate);
    return prisma.leaseContract.update({ where: { id }, data });
  }

  async delete(tenantId: string, id: string) {
    const existing = await prisma.leaseContract.findFirst({ where: withTenant({ id }, tenantId) });
    if (!existing) throw new NotFoundException('Contract not found');
    // Reset unit status
    await prisma.unit.update({
      where: { id: existing.unitId },
      data: { status: 'VACANT', currentLeaseId: null },
    });
    return prisma.leaseContract.delete({ where: { id } });
  }

  async renew(tenantId: string, id: string, dto: { startDate: string; endDate: string; rentAmount?: string }) {
    const existing = await prisma.leaseContract.findFirst({
      where: withTenant({ id }, tenantId),
      include: { payments: true },
    });
    if (!existing) throw new NotFoundException('Contract not found');

    // Mark old as RENEWED
    await prisma.leaseContract.update({
      where: { id },
      data: { status: 'RENEWED' },
    });

    // Create new contract
    const newContract = await prisma.leaseContract.create({
      data: {
        tenantId,
        propertyId: existing.propertyId,
        unitId: existing.unitId,
        contractType: existing.contractType,
        lessorName: existing.lessorName,
        lessorIdNumber: existing.lessorIdNumber,
        lessorPhone: existing.lessorPhone,
        lesseeName: existing.lesseeName,
        lesseeIdNumber: existing.lesseeIdNumber,
        lesseePhone: existing.lesseePhone,
        startDate: new Date(dto.startDate),
        endDate: new Date(dto.endDate),
        rentAmount: dto.rentAmount ? parseFloat(dto.rentAmount) : existing.rentAmount,
        paymentFrequency: existing.paymentFrequency,
        securityDeposit: existing.securityDeposit,
        paymentMethod: existing.paymentMethod,
        bankAccount: existing.bankAccount,
        status: 'ACTIVE',
        autoRenew: existing.autoRenew,
        renewalNoticeDays: existing.renewalNoticeDays,
      },
    });

    await this.generatePaymentSchedule(newContract);
    return newContract;
  }

  async terminate(tenantId: string, id: string) {
    const existing = await prisma.leaseContract.findFirst({ where: withTenant({ id }, tenantId) });
    if (!existing) throw new NotFoundException('Contract not found');
    const contract = await prisma.leaseContract.update({
      where: { id },
      data: { status: 'TERMINATED', endDate: new Date() },
    });
    await prisma.unit.update({
      where: { id: existing.unitId },
      data: { status: 'VACANT', currentLeaseId: null },
    });
    return contract;
  }

  private async generatePaymentSchedule(contract: any) {
    const start = new Date(contract.startDate);
    const end = new Date(contract.endDate);
    const payments = [];
    let current = new Date(start);

    const intervalMonths =
      contract.paymentFrequency === 'MONTHLY' ? 1 :
      contract.paymentFrequency === 'QUARTERLY' ? 3 :
      contract.paymentFrequency === 'SEMI_ANNUAL' ? 6 :
      contract.paymentFrequency === 'ANNUAL' ? 12 : 1;

    while (current <= end) {
      payments.push({
        tenantId: contract.tenantId,
        contractId: contract.id,
        propertyId: contract.propertyId,
        unitId: contract.unitId,
        dueDate: new Date(current),
        amount: contract.rentAmount,
        status: 'PENDING',
      });
      current.setMonth(current.getMonth() + intervalMonths);
    }

    if (payments.length > 0) {
      await prisma.rentPayment.createMany({ data: payments });
    }
  }
}
