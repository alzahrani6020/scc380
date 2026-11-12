import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { prisma, tenantWhere } from '@scc/database';

@Injectable()
export class PayrollsService {
  async findAll(req: any, query: any) {
    const where: any = { ...tenantWhere(req.user?.tenantId) };
    if (query.employeeId) where.employeeId = query.employeeId;
    if (query.status) where.status = query.status;
    if (query.month) where.month = parseInt(query.month);
    if (query.year) where.year = parseInt(query.year);
    const [data, count] = await Promise.all([
      prisma.payroll.findMany({
        where,
        include: { employee: { select: { firstName: true, lastName: true, employeeCode: true } } },
        orderBy: [{ year: 'desc' }, { month: 'desc' }],
        take: 200,
      }),
      prisma.payroll.count({ where }),
    ]);
    return { data, count };
  }

  async findOne(req: any, id: string) {
    const where = { ...tenantWhere(req.user?.tenantId), id };
    const item = await prisma.payroll.findFirst({ where, include: { employee: { select: { firstName: true, lastName: true } } } });
    if (!item) throw new NotFoundException('Payroll record not found');
    return item;
  }

  async create(req: any, dto: any) {
    const tenantId = req.user?.tenantId;
    await this.assertEmployee(tenantId, dto.employeeId);
    return prisma.payroll.create({
      data: { ...dto, status: 'DRAFT', tenantId },
    });
  }

  async update(req: any, id: string, dto: any) {
    const where = { ...tenantWhere(req.user?.tenantId), id };
    const existing = await prisma.payroll.findFirst({ where });
    if (!existing) throw new NotFoundException('Payroll record not found');

    if (existing.status === 'PAID') {
      throw new BadRequestException('Paid payroll is locked');
    }
    if (dto.status === 'PAID' && existing.status !== 'APPROVED') {
      throw new BadRequestException('Payroll must be approved before payment');
    }
    if (existing.status === 'APPROVED') {
      const keys = Object.keys(dto);
      const allowed = new Set(['status', 'paidAt']);
      if (keys.some((key) => !allowed.has(key)) || (dto.status && dto.status !== 'PAID')) {
        throw new BadRequestException('Approved payroll is locked except for payment');
      }
    }

    const data: any = { ...dto };
    if (dto.paidAt) data.paidAt = new Date(dto.paidAt);
    if (dto.status === 'PAID' && !dto.paidAt) data.paidAt = new Date();
    return prisma.payroll.update({ where: { id }, data });
  }

  async remove(req: any, id: string) {
    const where = { ...tenantWhere(req.user?.tenantId), id };
    const existing = await prisma.payroll.findFirst({ where });
    if (!existing) throw new NotFoundException('Payroll record not found');
    if (existing.status === 'PAID') throw new BadRequestException('Paid payroll cannot be deleted');
    return prisma.payroll.delete({ where: { id } });
  }

  private async assertEmployee(tenantId: string, employeeId: string) {
    const employee = await prisma.employee.findFirst({ where: { ...tenantWhere(tenantId), id: employeeId } });
    if (!employee) throw new NotFoundException('Employee not found');
  }
}
