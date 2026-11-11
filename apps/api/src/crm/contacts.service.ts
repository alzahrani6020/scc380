import { BadRequestException, Inject, Injectable, NotFoundException, Optional } from '@nestjs/common';
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
  private readonly db: PrismaClient;

  constructor(@Optional() @Inject('CONTACTS_DB') db?: PrismaClient) {
    this.db = db ?? prisma;
  }

  private requireTenantId(tenantId: string | undefined): string {
    if (!tenantId) throw new BadRequestException('Tenant context is required');
    return tenantId;
  }

  async findAll(tenantId: string | undefined, _userRole: string, filters: ContactListQuery = {}) {
    const scopedTenantId = this.requireTenantId(tenantId);
    const page = Math.max(1, Math.floor(filters.page ?? 1) || 1);
    const limit = Math.min(100, Math.max(1, Math.floor(filters.limit ?? 25) || 25));
    const where = withTenant({}, scopedTenantId);
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

  async findOne(tenantId: string | undefined, _userRole: string, id: string) {
    const scopedTenantId = this.requireTenantId(tenantId);
    const contact = await this.db.contact.findFirst({ where: withTenant({ id }, scopedTenantId) });
    if (!contact) throw new NotFoundException('Contact not found');
    return contact;
  }

  async create(tenantId: string | undefined, _userRole: string, dto: CreateContactDto) {
    const scopedTenantId = this.requireTenantId(tenantId);
    const data = pickContactPayload(dto);
    data.tenantId = scopedTenantId;
    return this.db.contact.create({ data: data as Prisma.ContactUncheckedCreateInput });
  }

  async update(tenantId: string | undefined, _userRole: string, id: string, dto: UpdateContactDto) {
    const scopedTenantId = this.requireTenantId(tenantId);
    const where = withTenant({ id }, scopedTenantId);
    const contact = await this.db.contact.findFirst({ where });
    if (!contact) throw new NotFoundException('Contact not found');
    const data = pickContactPayload(dto as Record<string, unknown>);
    return this.db.contact.update({ where: { id }, data: data as Prisma.ContactUpdateInput });
  }

  async delete(tenantId: string | undefined, _userRole: string, id: string) {
    const scopedTenantId = this.requireTenantId(tenantId);
    const contact = await this.db.contact.findFirst({ where: withTenant({ id }, scopedTenantId) });
    if (!contact) throw new NotFoundException('Contact not found');
    return this.db.contact.delete({ where: { id } });
  }
}
