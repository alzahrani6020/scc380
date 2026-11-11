import { PrismaClient } from '@prisma/client';

const globalForPrisma = global as unknown as { prisma: PrismaClient };

export const prisma = globalForPrisma.prisma || new PrismaClient({
  log: process.env.NODE_ENV === 'development' ? ['query', 'info', 'warn', 'error'] : ['error'],
});

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;

const NO_TENANT_MATCH = '__SCC_TENANT_CONTEXT_REQUIRED__';

// Tenant-aware query helpers.
// Missing tenant context must never broaden a query to all tenants.
export function withTenant(where: Record<string, any>, tenantId?: string | null): Record<string, any> {
  return { ...where, tenantId: tenantId || NO_TENANT_MATCH };
}

export function tenantWhere(tenantId?: string | null): Record<string, any> {
  return { tenantId: tenantId || NO_TENANT_MATCH };
}
