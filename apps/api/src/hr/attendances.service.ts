import { Injectable, NotFoundException } from '@nestjs/common';
import { prisma, tenantWhere } from '@scc/database';

@Injectable()
export class AttendancesService {
  async findAll(req: any, query: any) {
    const where: any = { ...tenantWhere(req) };
    if (query.employeeId) where.employeeId = query.employeeId;
    if (query.status) where.status = query.status;
    if (query.date) where.date = { gte: new Date(query.date), lte: new Date(query.date) };
    if (query.from && query.to) {
      where.date = { gte: new Date(query.from), lte: new Date(query.to) };
    }
    const [data, count] = await Promise.all([
      prisma.attendance.findMany({
        where,
        include: { employee: { select: { firstName: true, lastName: true, employeeCode: true } } },
        orderBy: { date: 'desc' },
        take: 200,
      }),
      prisma.attendance.count({ where }),
    ]);
    return { data, count };
  }

  async findOne(req: any, id: string) {
    const where = { ...tenantWhere(req), id };
    const item = await prisma.attendance.findFirst({ where, include: { employee: { select: { firstName: true, lastName: true } } } });
    if (!item) throw new NotFoundException('Attendance record not found');
    return item;
  }

  async create(req: any, dto: any) {
    const data: any = { ...dto, tenantId: req.tenantId || req.user?.tenantId };
    data.date = dto.date ? new Date(dto.date) : new Date();
    if (dto.checkIn) data.checkIn = new Date(dto.checkIn);
    if (dto.checkOut) data.checkOut = new Date(dto.checkOut);
    return prisma.attendance.create({ data });
  }

  async update(req: any, id: string, dto: any) {
    const where = { ...tenantWhere(req), id };
    const existing = await prisma.attendance.findFirst({ where });
    if (!existing) throw new NotFoundException('Attendance record not found');
    const data: any = { ...dto };
    if (dto.checkIn) data.checkIn = new Date(dto.checkIn);
    if (dto.checkOut) data.checkOut = new Date(dto.checkOut);
    return prisma.attendance.update({ where: { id }, data });
  }

  async remove(req: any, id: string) {
    const where = { ...tenantWhere(req), id };
    const existing = await prisma.attendance.findFirst({ where });
    if (!existing) throw new NotFoundException('Attendance record not found');
    return prisma.attendance.delete({ where: { id } });
  }
}
