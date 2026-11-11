import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { prisma, tenantWhere } from '@scc/database';

@Injectable()
export class CompaniesService {
  private tenantIdFor(req: any) {
    return req.user?.role === 'SUPER_ADMIN' ? req.tenantId : req.user?.tenantId;
  }

  private scope(req: any) {
    return tenantWhere(this.tenantIdFor(req));
  }

  async findAll(req: any, query: any) {
    const page = Math.max(1, Number(query.page || 1));
    const limit = Math.min(100, Math.max(1, Number(query.limit || 25)));
    const where: any = { ...this.scope(req) };
    if (query.active !== undefined) where.isActive = query.active === 'true';
    if (query.search) {
      where.OR = [
        { name: { contains: query.search, mode: 'insensitive' } },
        { legalName: { contains: query.search, mode: 'insensitive' } },
        { crNumber: { contains: query.search, mode: 'insensitive' } },
        { vatNumber: { contains: query.search, mode: 'insensitive' } },
      ];
    }
    const [data, count] = await Promise.all([
      prisma.company.findMany({ where, orderBy: { name: 'asc' }, skip: (page - 1) * limit, take: limit }),
      prisma.company.count({ where }),
    ]);
    return { data, count, page, limit };
  }

  async findOne(req: any, id: string) {
    const company = await prisma.company.findFirst({ where: { id, ...this.scope(req) } });
    if (!company) throw new NotFoundException('Company not found');
    return company;
  }

  async create(req: any, dto: any) {
    const tenantId = this.tenantIdFor(req);
    if (!tenantId) throw new BadRequestException('Tenant context is required');
    const duplicate = await prisma.company.findFirst({ where: { tenantId, name: dto.name } });
    if (duplicate) throw new BadRequestException('Company name already exists in this tenant');
    return prisma.company.create({ data: { ...dto, tenantId } });
  }

  async update(req: any, id: string, dto: any) {
    const existing = await this.findOne(req, id);
    if (dto.name && dto.name !== existing.name) {
      const duplicate = await prisma.company.findFirst({
        where: { ...this.scope(req), name: dto.name, NOT: { id } },
      });
      if (duplicate) throw new BadRequestException('Company name already exists in this tenant');
    }
    return prisma.company.update({ where: { id }, data: dto });
  }

  async remove(req: any, id: string) {
    await this.findOne(req, id);
    return prisma.company.delete({ where: { id } });
  }
}
