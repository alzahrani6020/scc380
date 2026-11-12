import { Injectable, NotFoundException } from '@nestjs/common';
import { prisma, withTenant } from '@scc/database';
import { pagedResult, parsePagination } from './pagination';

@Injectable()
export class EmployeesService {
  async findAll(tenantId: string, filters?: { status?: string; departmentId?: string; search?: string; page?: string; limit?: string }) {
    const where = withTenant({}, tenantId);
    if (filters?.status) where.status = filters.status;
    if (filters?.departmentId) where.departmentId = filters.departmentId;
    if (filters?.search) {
      where.OR = [
        { firstName: { contains: filters.search, mode: 'insensitive' } },
        { lastName: { contains: filters.search, mode: 'insensitive' } },
        { email: { contains: filters.search, mode: 'insensitive' } },
        { employeeCode: { contains: filters.search, mode: 'insensitive' } },
        { jobTitle: { contains: filters.search, mode: 'insensitive' } },
      ];
    }

    const { page, limit, skip } = parsePagination(filters);
    const [data, count] = await Promise.all([
      prisma.employee.findMany({ where, orderBy: { createdAt: 'desc' }, skip, take: limit }),
      prisma.employee.count({ where }),
    ]);
    return pagedResult(data, count, page, limit);
  }

  async findOne(tenantId: string, id: string) {
    const employee = await prisma.employee.findFirst({ where: withTenant({ id }, tenantId) });
    if (!employee) throw new NotFoundException('Employee not found');
    return employee;
  }

  async create(tenantId: string, data: any) {
    const payload: any = { ...data, tenantId };
    if (payload.hireDate) payload.hireDate = new Date(payload.hireDate);
    if (payload.terminationDate) payload.terminationDate = new Date(payload.terminationDate);
    if (payload.departmentId) await this.assertDepartment(tenantId, payload.departmentId);
    return prisma.employee.create({ data: payload });
  }

  async update(tenantId: string, id: string, data: any) {
    const employee = await prisma.employee.findFirst({ where: withTenant({ id }, tenantId) });
    if (!employee) throw new NotFoundException('Employee not found');

    const payload: any = { ...data };
    if (payload.hireDate) payload.hireDate = new Date(payload.hireDate);
    if (payload.terminationDate) payload.terminationDate = new Date(payload.terminationDate);
    if (payload.departmentId) await this.assertDepartment(tenantId, payload.departmentId);

    return prisma.employee.update({ where: { id }, data: payload });
  }

  async terminate(tenantId: string, id: string) {
    const employee = await prisma.employee.findFirst({ where: withTenant({ id }, tenantId) });
    if (!employee) throw new NotFoundException('Employee not found');
    return prisma.employee.update({
      where: { id },
      data: {
        status: 'TERMINATED',
        terminationDate: employee.terminationDate || new Date(),
      },
    });
  }

  private async assertDepartment(tenantId: string, departmentId: string) {
    const department = await prisma.department.findFirst({ where: withTenant({ id: departmentId }, tenantId) });
    if (!department) throw new NotFoundException('Department not found');
  }
}
