import { CanActivate, ExecutionContext, ForbiddenException, Injectable, SetMetadata } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { hasPermission } from '@scc/auth';

export const REQUIRE_PERMISSIONS_KEY = 'requiredPermissions';

/** Requires the session role to hold every listed permission (e.g. 'crm:read'). */
export const RequirePermissions = (...permissions: string[]) =>
  SetMetadata(REQUIRE_PERMISSIONS_KEY, permissions);

@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const required = this.reflector.getAllAndOverride<string[]>(REQUIRE_PERMISSIONS_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!required?.length) return true;

    const { user } = context.switchToHttp().getRequest();
    const role = user?.role as Parameters<typeof hasPermission>[0] | undefined;
    if (!role || !required.every((p) => hasPermission(role, p))) {
      throw new ForbiddenException('Insufficient permissions / صلاحيات غير كافية');
    }
    return true;
  }
}
