import { Injectable, NotFoundException } from '@nestjs/common';
import { prisma } from '@scc/database';
import { createHash, randomBytes } from 'crypto';

@Injectable()
export class ApiKeysService {
  async findAll(req: any) {
    const where: any = { userId: req.user?.userId, tenantId: req.user?.tenantId ?? null, revokedAt: null };
    const [data, count] = await Promise.all([
      prisma.apiKey.findMany({ where, select: { id: true, name: true, key: true, createdAt: true, lastUsedAt: true, expiresAt: true }, orderBy: { createdAt: 'desc' } }),
      prisma.apiKey.count({ where }),
    ]);
    return { data: data.map((k: any) => ({ ...k, key: k.key.startsWith('sha256:') ? 'sk_••••••••' : k.key.slice(0, 8) + '...' })), count };
  }

  async create(req: any, dto: any) {
    const key = 'sk_' + randomBytes(32).toString('hex');
    const data: any = {
      name: dto.name,
      key: 'sha256:' + createHash('sha256').update(key).digest('hex'),
      userId: req.user?.userId,
      tenantId: req.user?.tenantId ?? null,
    };
    if (dto.expiresAt) data.expiresAt = new Date(dto.expiresAt);
    const created = await prisma.$transaction(async (tx) => {
      const entry = await tx.apiKey.create({ data });
      await tx.auditLog.create({
        data: {
          tenantId: req.user?.tenantId ?? null,
          userId: req.user?.userId,
          action: 'API_KEY_CREATED',
          entityType: 'ApiKey',
          entityId: entry.id,
          newValues: { keyId: entry.id, name: entry.name },
        },
      });
      return entry;
    });
    return { id: created.id, name: created.name, key }; // full key returned only on creation
  }

  async revoke(req: any, id: string) {
    const where: any = { id, userId: req.user?.userId, tenantId: req.user?.tenantId ?? null };
    const existing = await prisma.apiKey.findFirst({ where });
    if (!existing) throw new NotFoundException('API key not found');
    const revoked = await prisma.$transaction(async (tx) => {
      const result = await tx.apiKey.updateMany({
        where: { ...where, revokedAt: null },
        data: { revokedAt: new Date() },
      });
      if (result.count === 1) {
        await tx.auditLog.create({
          data: {
            tenantId: req.user?.tenantId ?? null,
            userId: req.user?.userId,
            action: 'API_KEY_REVOKED',
            entityType: 'ApiKey',
            entityId: id,
            newValues: { keyId: id },
          },
        });
      }
      return result.count === 1;
    });
    return { revoked };
  }
}
