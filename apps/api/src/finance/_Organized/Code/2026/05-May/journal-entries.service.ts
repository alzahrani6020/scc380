import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { prisma, tenantWhere } from '@scc/database';

@Injectable()
export class JournalEntriesService {
  async findAll(req: any, query: any) {
    const where: any = { ...tenantWhere(req) };
    if (query.type) where.type = query.type;
    if (query.status) where.status = query.status;
    if (query.from && query.to) {
      where.date = { gte: new Date(query.from), lte: new Date(query.to) };
    }
    const [data, count] = await Promise.all([
      prisma.journalEntry.findMany({ where, orderBy: { date: 'desc' }, take: 200 }),
      prisma.journalEntry.count({ where }),
    ]);
    return { data, count };
  }

  async findOne(req: any, id: string) {
    const where = { ...tenantWhere(req), id };
    const item = await prisma.journalEntry.findFirst({ where });
    if (!item) throw new NotFoundException('Journal entry not found');
    return item;
  }

  async create(req: any, dto: any) {
    const tenantId = req.tenantId || req.user?.tenantId;
    const existing = await prisma.journalEntry.findFirst({
      where: { tenantId, entryNumber: dto.entryNumber },
    });
    if (existing) throw new ConflictException('Entry number already exists');
    const data: any = { ...dto, tenantId };
    if (dto.date) data.date = new Date(dto.date);
    return prisma.journalEntry.create({ data });
  }

  async update(req: any, id: string, dto: any) {
    const where = { ...tenantWhere(req), id };
    const existing = await prisma.journalEntry.findFirst({ where });
    if (!existing) throw new NotFoundException('Journal entry not found');
    return prisma.journalEntry.update({ where: { id }, data: dto });
  }

  async remove(req: any, id: string) {
    const where = { ...tenantWhere(req), id };
    const existing = await prisma.journalEntry.findFirst({ where });
    if (!existing) throw new NotFoundException('Journal entry not found');
    return prisma.journalEntry.delete({ where: { id } });
  }
}
