import { Injectable, CanActivate, ExecutionContext } from '@nestjs/common';

@Injectable()
export class LocalAuthGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
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
