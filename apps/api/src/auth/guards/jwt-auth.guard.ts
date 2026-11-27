import { ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

/**
 * P0 company isolation: the untrusted X-Tenant-Slug/subdomain selected by
 * middleware cannot switch a signed user's company. Super administrators may
 * explicitly select a tenant for platform-wide support; their JWT role and
 * current session are independently validated by JwtStrategy.
 */
export function assertAuthenticatedTenantScope(
  user: { tenantId?: string | null; role?: string } | undefined,
  requestedTenantId: string | undefined | null,
) {
  if (!requestedTenantId || !user) return;
  if (user.role === 'SUPER_ADMIN') return;
  if (!user.tenantId || user.tenantId !== requestedTenantId) {
    throw new ForbiddenException('Authenticated company does not match requested tenant');
  }
}

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  handleRequest(err: any, user: any, info: any, context: ExecutionContext, status?: any) {
    const authenticated = super.handleRequest(err, user, info, context, status) as any;
    const req = context.switchToHttp().getRequest();
    assertAuthenticatedTenantScope(authenticated, req?.tenantId);
    return authenticated;
  }
}
