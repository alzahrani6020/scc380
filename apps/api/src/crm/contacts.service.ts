import { Injectable, NotFoundException } from '@nestjs/common';
import { prisma, withTenant } from '@scc/database';

@Injectable()
export class ContactsService {
  async findAll(tenantId: string | undefined, userRole: string, filters?: { type?: string; search?: string; status?: string }) {
    const where = userRole === 'SUPER_ADMIN' ? {} : withTenant({}, tenantId);
    if (filters?.type) where.type = filters.type;
    if (filters?.status) where.status = filters.status;
    if (filters?.search) {
      where.OR = [
        { firstName: { contains: filters.search, mode: 'insensitive' } },
        { lastName: { contains: filters.search, mode: 'insensitive' } },
        { email: { contains: filters.search, mode: 'insensitive' } },
        { phone: { contains: filters.search, mode: 'insensitive' } },
      ];
    }
    return prisma.contact.findMany({ where, orderBy: { createdAt: 'desc' } });
  }

  async findOne(tenantId: string | undefined, userRole: string, id: string) {
    const where = userRole === 'SUPER_ADMIN' ? { id } : withTenant({ id }, tenantId);
    const contact = await prisma.contact.findFirst({ where });
    if (!contact) throw new NotFoundException('Contact not found');
    return contact;
  }

  async create(tenantId: string | undefined, userRole: string, data: any) {
    if (userRole === 'SUPER_ADMIN' && !data.tenantId) {
      throw new NotFoundException('Super Admin must specify tenantId when creating');
    }
    return prisma.contact.create({ data: { ...data, tenantId: userRole === 'SUPER_ADMIN' ? data.tenantId : tenantId } });
  }

  async update(tenantId: string | undefined, userRole: string, id: string, data: any) {
    const where = userRole === 'SUPER_ADMIN' ? { id } : withTenant({ id }, tenantId);
    const contact = await prisma.contact.findFirst({ where });
    if (!contact) throw new NotFoundException('Contact not found');
    return prisma.contact.update({ where: { id }, data });
  }

  async delete(tenantId: string | undefined, userRole: string, id: string) {
    const where = userRole === 'SUPER_ADMIN' ? { id } : withTenant({ id }, tenantId);
    const contact = await prisma.contact.findFirst({ where });
    if (!contact) throw new NotFoundException('Contact not found');
    return prisma.contact.delete({ where: { id } });
  }
}
