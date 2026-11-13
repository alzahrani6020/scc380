import { Injectable, NotFoundException } from '@nestjs/common';
import { prisma } from '@scc/database';
import { randomBytes } from 'crypto';

@Injectable()
export class ApiKeysService {
  async findAll(req: any) {
    const where: any = { userId: req.user?.userId, revokedAt: null };
    const [data, count] = await Promise.all([
      prisma.apiKey.findMany({ where, select: { id: true, name: true, key: true, createdAt: true, lastUsedAt: true, expiresAt: true }, orderBy: { createdAt: 'desc' } }),
      prisma.apiKey.count({ where }),
    ]);
    return { data: data.map((k: any) => ({ ...k, key: k.key.slice(0, 8) + '...' })), count };
  }

  async create(req: any, dto: any) {
    const key = 'sk_' + randomBytes(32).toString('hex');
    const data: any = {
      name: dto.name,
      key,
      userId: req.user?.userId,
      tenantId: req.tenantId || req.user?.tenantId,
    };
    if (dto.expiresAt) data.expiresAt = new Date(dto.expiresAt);
    const created = await prisma.apiKey.create({ data });
    return { id: created.id, name: created.name, key }; // full key returned only on creation
  }

  async revoke(req: any, id: string) {
    const where: any = { id, userId: req.user?.userId };
    const existing = await prisma.apiKey.findFirst({ where });
    if (!existing) throw new NotFoundException('API key not found');
    await prisma.apiKey.updateMany({ where: { id, userId: req.user?.userId, revokedAt: null }, data: { revokedAt: new Date() } });
    return { revoked: true };
  }
}
