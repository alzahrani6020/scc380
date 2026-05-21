import { Injectable, NotFoundException } from '@nestjs/common';
import { prisma, withTenant } from '@scc/database';

@Injectable()
export class EmployeesService {
  async findAll(tenantId: string, filters?: { status?: string; departmentId?: string; search?: string }) {
    const where = withTenant({}, tenantId);
    if (filters?.status) where.status = filters.status;
    if (filters?.departmentId) where.departmentId = filters.departmentId;
    if (filters?.search) {
      where.OR = [
        { firstName: { contains: filters.search, mode: 'insensitive' } },
        { lastName: { contains: filters.search, mode: 'insensitive' } },
        { email: { contains: filters.search, mode: 'insensitive' } },
        { employeeCode: { contains: filters.search, mode: 'insensitive' } },
      ];
    }
    return prisma.employee.findMany({ where, orderBy: { createdAt: 'desc' } });
  }

  async findOne(tenantId: string, id: string) {
    const employee = await prisma.employee.findFirst({ where: withTenant({ id }, tenantId) });
    if (!employee) throw new NotFoundException('Employee not found');
    return employee;
  }

  async create(tenantId: string, data: any) {
    return prisma.employee.create({ data: { ...data, tenantId } });
  }

  async update(tenantId: string, id: string, data: any) {
    const employee = await prisma.employee.findFirst({ where: withTenant({ id }, tenantId) });
    if (!employee) throw new NotFoundException('Employee not found');
    return prisma.employee.update({ where: { id }, data });
  }

  async delete(tenantId: string, id: string) {
    const employee = await prisma.employee.findFirst({ where: withTenant({ id }, tenantId) });
    if (!employee) throw new NotFoundException('Employee not found');
    return prisma.employee.delete({ where: { id } });
  }
}
