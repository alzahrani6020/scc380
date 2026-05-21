import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy } from 'passport-local';
import { AuthService } from '../auth.service';

@Injectable()
export class LocalStrategy extends PassportStrategy(Strategy) {
  constructor(private authService: AuthService) {
    super({ usernameField: 'email', passReqToCallback: true });
  }

  async validate(req: any, email: string, password: string) {
    const tenantSlug = req.headers['x-tenant-slug'] as string | undefined;
    let tenantId: string | undefined;

    if (tenantSlug && tenantSlug !== 'all') {
      const { prisma } = require('@scc/database');
      const tenant = await prisma.tenant.findUnique({
        where: { slug: tenantSlug },
        select: { id: true },
      });
      if (tenant) tenantId = tenant.id;
    }

    const user = await this.authService.validateUser(email, password, tenantId);
    if (!user) {
      throw new UnauthorizedException('Invalid credentials / بيانات الدخول غير صحيحة');
    }
    return user;
  }
}
