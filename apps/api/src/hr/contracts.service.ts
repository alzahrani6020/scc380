import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { prisma, tenantWhere } from '@scc/database';

@Injectable()
export class ContractsService {
  async findAll(req: any, query: any) {
    const where: any = { ...tenantWhere(req.user?.tenantId) };
    if (query.employeeId) where.employeeId = query.employeeId;
    if (query.status) where.status = query.status;
    const [data, count] = await Promise.all([
      prisma.employeeContract.findMany({
        where,
        include: { employee: { select: { firstName: true, lastName: true, employeeCode: true } } },
        orderBy: { createdAt: 'desc' },
      }),
      prisma.employeeContract.count({ where }),
    ]);
    return { data, count };
  }

  async findOne(req: any, id: string) {
    const item = await prisma.employeeContract.findFirst({
      where: { ...tenantWhere(req.user?.tenantId), id },
      include: { employee: { select: { firstName: true, lastName: true, employeeCode: true } } },
    });
    if (!item) throw new NotFoundException('Contract not found');
    return item;
  }

  async create(req: any, dto: any) {
    const tenantId = req.user?.tenantId;
    await this.assertEmployee(tenantId, dto.employeeId);
    const duplicate = await prisma.employeeContract.findFirst({
      where: { ...tenantWhere(tenantId), contractNumber: dto.contractNumber },
    });
    if (duplicate) throw new ConflictException('Contract number already exists');

    const data: any = { ...dto, tenantId, status: 'DRAFT' };
    for (const field of ['startDate', 'endDate', 'probationEndDate', 'signedAt']) {
      if (data[field]) data[field] = new Date(data[field]);
    }
    return prisma.employeeContract.create({ data });
  }

  async updateDraft(req: any, id: string, dto: any) {
    const tenantId = req.user?.tenantId;
    const existing = await prisma.employeeContract.findFirst({
      where: { ...tenantWhere(tenantId), id },
    });
    if (!existing) throw new NotFoundException('Contract not found');
    if (existing.status !== 'DRAFT') throw new BadRequestException('Only draft contracts can be edited');

    if (dto.contractNumber && dto.contractNumber !== existing.contractNumber) {
      const duplicate = await prisma.employeeContract.findFirst({
        where: { ...tenantWhere(tenantId), contractNumber: dto.contractNumber, NOT: { id } },
      });
      if (duplicate) throw new ConflictException('Contract number already exists');
    }

    const data: any = { ...dto };
    for (const field of ['startDate', 'endDate', 'probationEndDate', 'signedAt']) {
      if (data[field]) data[field] = new Date(data[field]);
    }
    return prisma.employeeContract.update({ where: { id }, data });
  }

  async activate(req: any, id: string, signedAt?: string) {
    const tenantId = req.user?.tenantId;
    const contract = await prisma.employeeContract.findFirst({
      where: { ...tenantWhere(tenantId), id },
    });
    if (!contract) throw new NotFoundException('Contract not found');
    if (contract.status !== 'DRAFT') throw new BadRequestException('Only draft contracts can be activated');

    const active = await prisma.employeeContract.findFirst({
      where: { ...tenantWhere(tenantId), employeeId: contract.employeeId, status: 'ACTIVE', NOT: { id } },
    });
    if (active) throw new ConflictException('Employee already has an active contract');

    return prisma.$transaction(async (tx) => {
      const activated = await tx.employeeContract.update({
        where: { id },
        data: { status: 'ACTIVE', signedAt: signedAt ? new Date(signedAt) : contract.signedAt || new Date() },
      });

      const employeeUpdate: any = {};
      for (const field of ['jobTitle', 'basicSalary', 'housingAllowance', 'transportAllowance', 'otherAllowances']) {
        if ((contract as any)[field] !== null && (contract as any)[field] !== undefined) {
          employeeUpdate[field] = (contract as any)[field];
        }
      }
      if (Object.keys(employeeUpdate).length > 0) {
        await tx.employee.update({ where: { id: contract.employeeId }, data: employeeUpdate });
      }
      return activated;
    });
  }

  async terminate(req: any, id: string, reason?: string) {
    const tenantId = req.user?.tenantId;
    const contract = await prisma.employeeContract.findFirst({
      where: { ...tenantWhere(tenantId), id },
    });
    if (!contract) throw new NotFoundException('Contract not found');
    if (contract.status !== 'ACTIVE') throw new BadRequestException('Only active contracts can be terminated');
    return prisma.employeeContract.update({
      where: { id },
      data: { status: 'TERMINATED', terminatedAt: new Date(), terminationReason: reason || null },
    });
  }

  async removeDraft(req: any, id: string) {
    const tenantId = req.user?.tenantId;
    const contract = await prisma.employeeContract.findFirst({
      where: { ...tenantWhere(tenantId), id },
    });
    if (!contract) throw new NotFoundException('Contract not found');
    if (contract.status !== 'DRAFT') throw new BadRequestException('Only draft contracts can be deleted');
    return prisma.employeeContract.delete({ where: { id } });
  }

  private async assertEmployee(tenantId: string, employeeId: string) {
    const employee = await prisma.employee.findFirst({ where: { ...tenantWhere(tenantId), id: employeeId } });
    if (!employee) throw new NotFoundException('Employee not found');
  }
}
