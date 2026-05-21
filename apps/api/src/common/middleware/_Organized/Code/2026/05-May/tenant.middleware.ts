import { Injectable, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { prisma } from '@scc/database';

export interface TenantRequest extends Request {
  tenantSlug?: string;
  tenantId?: string;
  user?: any;
}

@Injectable()
export class TenantMiddleware implements NestMiddleware {
  async use(req: TenantRequest, res: Response, next: NextFunction) {
    // Super Admin bypass - no tenant restrictions
    if (req.user?.role === 'SUPER_ADMIN') {
      req.tenantSlug = 'all';
      req.tenantId = undefined;
      return next();
    }

    const tenantSlug = (req.headers['x-tenant-slug'] as string) || req.subdomains[0] || null;

    if (tenantSlug) {
      const tenant = await prisma.tenant.findUnique({
        where: { slug: tenantSlug },
        select: { id: true, status: true, type: true },
      });

      if (!tenant) {
        return res.status(404).json({ error: 'Tenant not found', message: 'المنشأة غير موجودة' });
      }

      if (tenant.status !== 'ACTIVE') {
        return res.status(403).json({ error: 'Tenant is not active', message: 'المنشأة غير نشطة' });
      }

      req.tenantSlug = tenantSlug;
      req.tenantId = tenant.id;
    }

    next();
  }
}
