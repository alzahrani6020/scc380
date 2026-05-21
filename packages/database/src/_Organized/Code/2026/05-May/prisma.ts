import { PrismaClient } from '@prisma/client';

const globalForPrisma = global as unknown as { prisma: PrismaClient };

export const prisma = globalForPrisma.prisma || new PrismaClient({
  log: process.env.NODE_ENV === 'development' ? ['query', 'info', 'warn', 'error'] : ['error'],
});

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;

// Tenant-aware query helpers
export function withTenant(where: Record<string, any>, tenantId?: string) {
  if (!tenantId) return where;
  return { ...where, tenantId };
}

export function tenantWhere(tenantId?: string) {
  return tenantId ? { tenantId } : {};
}
