import { Injectable, NotFoundException } from '@nestjs/common';
import type { Prisma, PrismaClient } from '@prisma/client';
import { prisma, withTenant } from '@scc/database';
import { CreateContactDto } from './dto/create-contact.dto';
import { UpdateContactDto } from './dto/update-contact.dto';

export interface ContactListQuery {
  page?: number;
  limit?: number;
  search?: string;
  type?: string;
  status?: string;
}

// Only fields the CRM form submits / the schema exposes to clients. Ownership
// and system fields (id, createdAt, updatedAt) are never taken from the client;
// tenantId is accepted but gated by role in create/update below.
const CONTACT_PAYLOAD_FIELDS = [
  'firstName',
  'lastName',
  'email',
  'phone',
  'phone2',
  'companyName',
  'jobTitle',
  'idNumber',
  'vatNumber',
  'crNumber',
  'address',
  'city',
  'region',
  'country',
  'type',
  'status',
  'tenantId',
] as const;

function pickContactPayload(source: unknown): Record<string, unknown> {
  const src = source as Record<string, unknown>;
  const payload: Record<string, unknown> = {};
  for (const field of CONTACT_PAYLOAD_FIELDS) {
    if (src[field] !== undefined) payload[field] = src[field];
  }
  return payload;
}

@Injectable()
export class ContactsService {
  // Injectable for tests (in-memory fake); Nest resolves the default in prod.
  constructor(private readonly db: PrismaClient = prisma) {}

  async findAll(tenantId: string | undefined, userRole: string, filters: ContactListQuery = {}) {
    const page = Math.max(1, Math.floor(filters.page ?? 1) || 1);
    const limit = Math.min(100, Math.max(1, Math.floor(filters.limit ?? 25) || 25));
    const where = userRole === 'SUPER_ADMIN' ? {} : withTenant({}, tenantId);
    if (filters.type) where.type = filters.type;
    if (filters.status) where.status = filters.status;
    if (filters.search) {
      where.OR = [
        { firstName: { contains: filters.search, mode: 'insensitive' } },
        { lastName: { contains: filters.search, mode: 'insensitive' } },
        { email: { contains: filters.search, mode: 'insensitive' } },
        { phone: { contains: filters.search, mode: 'insensitive' } },
      ];
    }
    const [data, count] = await Promise.all([
      this.db.contact.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.db.contact.count({ where }),
    ]);
    return { data, count, page, limit };
  }

  async findOne(tenantId: string | undefined, userRole: string, id: string) {
    const where = userRole === 'SUPER_ADMIN' ? { id } : withTenant({ id }, tenantId);
    const contact = await this.db.contact.findFirst({ where });
    if (!contact) throw new NotFoundException('Contact not found');
    return contact;
  }

  async create(tenantId: string | undefined, userRole: string, dto: CreateContactDto) {
    if (userRole === 'SUPER_ADMIN' && !dto.tenantId) {
      throw new NotFoundException('Super Admin must specify tenantId when creating');
    }
    const data = pickContactPayload(dto);
    data.tenantId = userRole === 'SUPER_ADMIN' ? dto.tenantId : tenantId;
    return this.db.contact.create({ data: data as Prisma.ContactUncheckedCreateInput });
  }

  async update(tenantId: string | undefined, userRole: string, id: string, dto: UpdateContactDto) {
    const where = userRole === 'SUPER_ADMIN' ? { id } : withTenant({ id }, tenantId);
    const contact = await this.db.contact.findFirst({ where });
    if (!contact) throw new NotFoundException('Contact not found');
    const data = pickContactPayload(dto as Record<string, unknown>);
    // Non-SUPER_ADMIN can never move a contact across tenants.
    if (userRole !== 'SUPER_ADMIN') delete data.tenantId;
    return this.db.contact.update({ where: { id }, data: data as Prisma.ContactUpdateInput });
  }

  async delete(tenantId: string | undefined, userRole: string, id: string) {
    const where = userRole === 'SUPER_ADMIN' ? { id } : withTenant({ id }, tenantId);
    const contact = await this.db.contact.findFirst({ where });
    if (!contact) throw new NotFoundException('Contact not found');
    return this.db.contact.delete({ where: { id } });
  }
}
