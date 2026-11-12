import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { prisma, tenantWhere } from '@scc/database';

@Injectable()
export class HrSelfService {
  async getMe(req: any) {
    const employee = await this.resolveEmployee(req);
    const year = new Date().getUTCFullYear();
    const [contract, leaveBalances, loans] = await Promise.all([
      prisma.employeeContract.findFirst({
        where: { ...tenantWhere(req.user.tenantId), employeeId: employee.id, status: 'ACTIVE' },
        orderBy: { startDate: 'desc' },
      }),
      prisma.leaveBalance.findMany({
        where: { ...tenantWhere(req.user.tenantId), employeeId: employee.id, year },
        orderBy: { type: 'asc' },
      }),
      prisma.employeeLoan.findMany({
        where: { ...tenantWhere(req.user.tenantId), employeeId: employee.id, status: { in: ['ACTIVE', 'PAID'] } },
        select: { id: true, type: true, principal: true, installmentAmount: true, balance: true, status: true, startDate: true },
        orderBy: { createdAt: 'desc' },
        take: 20,
      }),
    ]);
    return { employee, contract, leaveBalances, loans };
  }

  async updateProfile(req: any, dto: any) {
    const employee = await this.resolveEmployee(req);
    const data: any = {};
    for (const field of ['phone', 'emergencyContactName', 'emergencyContactPhone']) {
      if (Object.prototype.hasOwnProperty.call(dto, field)) data[field] = dto[field] || null;
    }
    if (Object.keys(data).length === 0) throw new BadRequestException('No self-service profile fields supplied');
    return prisma.employee.update({
      where: { id: employee.id },
      data,
      select: {
        id: true, employeeCode: true, firstName: true, lastName: true, email: true,
        phone: true, jobTitle: true, departmentId: true, emergencyContactName: true, emergencyContactPhone: true,
      },
    });
  }

  async getPayroll(req: any, limitRaw?: string) {
    const employee = await this.resolveEmployee(req);
    const limit = Math.min(Math.max(Number(limitRaw || 12) || 12, 1), 24);
    const rows = await prisma.payroll.findMany({
      where: { ...tenantWhere(req.user.tenantId), employeeId: employee.id },
      orderBy: [{ year: 'desc' }, { month: 'desc' }],
      take: limit,
      select: {
        id: true, year: true, month: true, basicSalary: true, housingAllowance: true,
        transportAllowance: true, otherAllowances: true, gosiDeduction: true,
        taxDeduction: true, otherDeductions: true, loanDeductions: true, netSalary: true,
        status: true, paidAt: true,
      },
    });
    return rows.map((row) => ({
      ...row,
      grossSalary:
        Number(row.basicSalary) +
        Number(row.housingAllowance) +
        Number(row.transportAllowance) +
        Number(row.otherAllowances),
    }));
  }

  async getDocuments(req: any) {
    const employee = await this.resolveEmployee(req);
    return prisma.employeeDocument.findMany({
      where: { ...tenantWhere(req.user.tenantId), employeeId: employee.id },
      select: {
        id: true, type: true, title: true, fileName: true, mimeType: true, sizeBytes: true,
        checksumSha256: true, issuedAt: true, expiresAt: true, notes: true, createdAt: true,
      },
      orderBy: [{ expiresAt: 'asc' }, { createdAt: 'desc' }],
    });
  }

  async getDocumentFile(req: any, id: string) {
    const employee = await this.resolveEmployee(req);
    const doc = await prisma.employeeDocument.findFirst({
      where: { ...tenantWhere(req.user.tenantId), employeeId: employee.id, id },
    });
    if (!doc) throw new NotFoundException('Employee document not found');
    return doc;
  }

  async resolveEmployee(req: any) {
    const tenantId = req.user?.tenantId;
    const userId = req.user?.userId || req.user?.id;
    if (!tenantId || !userId) throw new BadRequestException('Authenticated tenant user is required');
    const employee = await prisma.employee.findFirst({ where: { ...tenantWhere(tenantId), userId } });
    if (!employee) throw new NotFoundException('User is not linked to an employee profile');
    return employee;
  }
}
