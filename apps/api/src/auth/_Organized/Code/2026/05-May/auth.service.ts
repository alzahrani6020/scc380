import { Injectable, UnauthorizedException, ConflictException, BadRequestException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { prisma } from '@scc/database';
import { hashPassword, verifyPassword } from '@scc/auth';

@Injectable()
export class AuthService {
  constructor(
    private jwt: JwtService,
    private config: ConfigService,
  ) {}

  async validateUser(email: string, password: string, tenantId?: string) {
    const where: any = { email };
    if (tenantId) where.tenantId = tenantId;

    const user = await prisma.user.findUnique({ where });
    if (!user || !user.passwordHash) return null;
    const valid = await verifyPassword(user.passwordHash, password);
    if (!valid) return null;
    return user;
  }

  async login(userId: string, email: string, role: string, tenantId?: string, tenantSlug?: string) {
    const payload = { sub: userId, email, role, tenantId, tenantSlug };
    const accessToken = this.jwt.sign(payload);
    const refreshToken = this.jwt.sign(payload, {
      secret: this.config.get('JWT_SECRET'),
      expiresIn: this.config.get('REFRESH_TOKEN_EXPIRES_IN') || '7d',
    });

    await prisma.user.update({
      where: { id: userId },
      data: { lastLoginAt: new Date() },
    });

    return {
      accessToken,
      refreshToken,
      user: { id: userId, email, role, tenantId, tenantSlug },
    };
  }

  async register(data: {
    email: string;
    password: string;
    firstName: string;
    lastName: string;
    phone?: string;
    tenantName?: string;
    tenantSlug?: string;
  }) {
    const existing = await prisma.user.findUnique({ where: { email: data.email } });
    if (existing) throw new ConflictException('Email already registered / البريد مسجل مسبقاً');

    let tenantId: string | undefined;

    // If creating a new tenant
    if (data.tenantName && data.tenantSlug) {
      const slugExists = await prisma.tenant.findUnique({ where: { slug: data.tenantSlug } });
      if (slugExists) throw new ConflictException('Tenant slug already exists / اسم المنشأة مستخدم');

      const tenant = await prisma.tenant.create({
        data: {
          name: data.tenantName,
          slug: data.tenantSlug,
          status: 'ACTIVE',
          plan: 'BASIC',
        },
      });
      tenantId = tenant.id;
    }

    const passwordHash = await hashPassword(data.password);
    const user = await prisma.user.create({
      data: {
        email: data.email,
        passwordHash,
        firstName: data.firstName,
        lastName: data.lastName,
        phone: data.phone,
        tenantId,
        role: tenantId ? 'ADMIN' : 'USER',
      },
      select: { id: true, email: true, firstName: true, lastName: true, role: true, status: true, tenantId: true },
    });

    return user;
  }

  async me(userId: string) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true, email: true, firstName: true, lastName: true,
        role: true, status: true, phone: true, tenantId: true,
        tenant: { select: { id: true, name: true, slug: true, plan: true, status: true } },
      },
    });
    if (!user) throw new UnauthorizedException('User not found');
    return user;
  }
}
