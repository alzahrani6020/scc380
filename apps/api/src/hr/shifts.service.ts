import { Injectable, NotFoundException } from '@nestjs/common';
import { prisma, tenantWhere } from '@scc/database';

@Injectable()
export class ShiftsService {
  async findAll(req: any, query: any) {
    const where: any = { ...tenantWhere(req.user?.tenantId) };
    if (query.employeeId) where.employeeId = query.employeeId;
    const [data, count] = await Promise.all([
      prisma.shift.findMany({
        where,
        include: { employee: { select: { firstName: true, lastName: true, employeeCode: true } } },
        orderBy: { startTime: 'asc' },
        take: 200,
      }),
      prisma.shift.count({ where }),
    ]);
    return { data, count };
  }

  async findOne(req: any, id: string) {
    const where = { ...tenantWhere(req.user?.tenantId), id };
    const item = await prisma.shift.findFirst({ where });
    if (!item) throw new NotFoundException('Shift not found');
    return item;
  }

  async create(req: any, dto: any) {
    const tenantId = req.user?.tenantId;
    await this.assertEmployee(tenantId, dto.employeeId);
    const data: any = { ...dto, tenantId };
    data.startTime = new Date(dto.startTime);
    data.endTime = new Date(dto.endTime);
    return prisma.shift.create({ data });
  }

  async update(req: any, id: string, dto: any) {
    const where = { ...tenantWhere(req.user?.tenantId), id };
    const existing = await prisma.shift.findFirst({ where });
    if (!existing) throw new NotFoundException('Shift not found');
    const data: any = { ...dto };
    if (dto.startTime) data.startTime = new Date(dto.startTime);
    if (dto.endTime) data.endTime = new Date(dto.endTime);
    return prisma.shift.update({ where: { id }, data });
  }

  async remove(req: any, id: string) {
    const where = { ...tenantWhere(req.user?.tenantId), id };
    const existing = await prisma.shift.findFirst({ where });
    if (!existing) throw new NotFoundException('Shift not found');
    return prisma.shift.delete({ where: { id } });
  }

  private async assertEmployee(tenantId: string, employeeId: string) {
    const employee = await prisma.employee.findFirst({ where: { ...tenantWhere(tenantId), id: employeeId } });
    if (!employee) throw new NotFoundException('Employee not found');
  }
}
