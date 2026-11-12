import { Injectable, NotFoundException } from '@nestjs/common';
import { prisma, tenantWhere } from '@scc/database';
import { pagedResult, parsePagination } from './pagination';

@Injectable()
export class AttendancesService {
  async findAll(req: any, query: any) {
    const where: any = { ...tenantWhere(req.user?.tenantId) };
    if (query.employeeId) where.employeeId = query.employeeId;
    if (query.status) where.status = query.status;
    if (query.search) {
      where.employee = {
        OR: [
          { firstName: { contains: query.search, mode: 'insensitive' } },
          { lastName: { contains: query.search, mode: 'insensitive' } },
          { employeeCode: { contains: query.search, mode: 'insensitive' } },
        ],
      };
    }
    if (query.date) {
      const start = new Date(query.date);
      const end = new Date(start);
      end.setUTCDate(end.getUTCDate() + 1);
      where.date = { gte: start, lt: end };
    }
    if (query.from && query.to) {
      where.date = { gte: new Date(query.from), lte: new Date(query.to) };
    }
    const { page, limit, skip } = parsePagination(query);
    const [data, count] = await Promise.all([
      prisma.attendance.findMany({
        where,
        include: { employee: { select: { firstName: true, lastName: true, employeeCode: true } } },
        orderBy: { date: 'desc' },
        skip,
        take: limit,
      }),
      prisma.attendance.count({ where }),
    ]);
    return pagedResult(data, count, page, limit);
  }

  async findOne(req: any, id: string) {
    const where = { ...tenantWhere(req.user?.tenantId), id };
    const item = await prisma.attendance.findFirst({ where, include: { employee: { select: { firstName: true, lastName: true } } } });
    if (!item) throw new NotFoundException('Attendance record not found');
    return item;
  }

  async create(req: any, dto: any) {
    const tenantId = req.user?.tenantId;
    await this.assertEmployee(tenantId, dto.employeeId);
    const data: any = { ...dto, tenantId };
    data.date = dto.date ? new Date(dto.date) : new Date();
    if (dto.checkIn) data.checkIn = new Date(dto.checkIn);
    if (dto.checkOut) data.checkOut = new Date(dto.checkOut);
    return prisma.attendance.create({ data });
  }

  async update(req: any, id: string, dto: any) {
    const where = { ...tenantWhere(req.user?.tenantId), id };
    const existing = await prisma.attendance.findFirst({ where });
    if (!existing) throw new NotFoundException('Attendance record not found');
    const data: any = { ...dto };
    if (dto.date) data.date = new Date(dto.date);
    if (dto.checkIn) data.checkIn = new Date(dto.checkIn);
    if (dto.checkOut) data.checkOut = new Date(dto.checkOut);
    return prisma.attendance.update({ where: { id }, data });
  }

  async remove(req: any, id: string) {
    const where = { ...tenantWhere(req.user?.tenantId), id };
    const existing = await prisma.attendance.findFirst({ where });
    if (!existing) throw new NotFoundException('Attendance record not found');
    return prisma.attendance.delete({ where: { id } });
  }

  private async assertEmployee(tenantId: string, employeeId: string) {
    const employee = await prisma.employee.findFirst({ where: { ...tenantWhere(tenantId), id: employeeId } });
    if (!employee) throw new NotFoundException('Employee not found');
  }
}
