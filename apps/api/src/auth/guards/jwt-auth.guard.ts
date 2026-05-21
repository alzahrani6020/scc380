import { Injectable, CanActivate, ExecutionContext } from '@nestjs/common';

@Injectable()
export class JwtAuthGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    // Dev mode: always authenticated as super admin
    request.user = {
      id: 'dev-user',
      email: 'dev@local.com',
      firstName: 'مطور',
      lastName: 'النظام',
      role: 'SUPER_ADMIN',
      tenantId: null,
    };
    return true;
  }
}
