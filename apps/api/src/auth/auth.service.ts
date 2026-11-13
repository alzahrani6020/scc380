import { Injectable, UnauthorizedException, ConflictException, BadRequestException, Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { prisma } from '@scc/database';
import { hashPassword, verifyPassword } from '@scc/auth';
import * as speakeasy from 'speakeasy';
import * as QRCode from 'qrcode';
import { createHash, randomBytes } from 'crypto';
import { OAuth2Client } from 'google-auth-library';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);
  private googleClient: OAuth2Client;

  constructor(
    private jwt: JwtService,
    private config: ConfigService,
  ) {
    const googleClientId = this.config.get('GOOGLE_CLIENT_ID');
    if (googleClientId) {
      this.googleClient = new OAuth2Client(googleClientId);
    }
  }

  private normalizeEmail(email: string) {
    return email.trim().toLowerCase();
  }

  private sessionMetadata(req?: any) {
    const userAgent = req?.headers?.['user-agent'];
    const agent = typeof userAgent === 'string' ? userAgent.slice(0, 512) : null;
    const ip = typeof req?.ip === 'string' ? req.ip.slice(0, 128) : null;
    return { userAgent: agent, ipAddress: ip, deviceInfo: agent ? agent.slice(0, 160) : null };
  }

  private hashToken(token: string) {
    return createHash('sha256').update(token).digest('hex');
  }

  private buildTokenPair(
    userId: string,
    email: string,
    role: string,
    tenantId?: string,
    tenantSlug?: string,
  ) {
    const sessionKey = randomBytes(24).toString('hex');
    const accessPayload = {
      sub: userId,
      email,
      role,
      tenantId,
      tenantSlug,
      type: 'access',
      sid: sessionKey,
    };
    const refreshPayload = {
      sub: userId,
      email,
      role,
      tenantId,
      tenantSlug,
      type: 'refresh',
      jti: sessionKey,
    };

    const accessToken = this.jwt.sign(accessPayload);
    const refreshToken = this.jwt.sign(refreshPayload, {
      secret: this.config.get('JWT_SECRET'),
      expiresIn: this.config.get('REFRESH_TOKEN_EXPIRES_IN') || '7d',
    });
    const decoded = this.jwt.decode(refreshToken) as { exp?: number } | null;
    const expiresAt =
      decoded?.exp && Number.isFinite(decoded.exp)
        ? new Date(decoded.exp * 1000)
        : new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

    return {
      accessToken,
      refreshToken,
      sessionKey,
      refreshTokenHash: this.hashToken(refreshToken),
      expiresAt,
    };
  }

  async validateUser(email: string, password: string, tenantId?: string) {
    const normalizedEmail = this.normalizeEmail(email);
    const user = await prisma.user.findUnique({
      where: { email: normalizedEmail },
      include: { tenant: { select: { id: true, status: true } } },
    });

    if (!user || !user.passwordHash || user.status !== 'ACTIVE') return null;
    if (tenantId && user.tenantId !== tenantId) return null;
    if (user.tenant && user.tenant.status !== 'ACTIVE') return null;

    const valid = await verifyPassword(user.passwordHash, password);
    if (!valid) return null;
    return user;
  }

  async authenticate(email: string, password: string, tenantSlug?: string) {
    let tenantId: string | undefined;

    if (tenantSlug && tenantSlug !== 'all') {
      const tenant = await prisma.tenant.findUnique({
        where: { slug: tenantSlug.trim().toLowerCase() },
        select: { id: true, status: true },
      });
      if (!tenant || tenant.status !== 'ACTIVE') {
        throw new UnauthorizedException('Invalid credentials / بيانات الدخول غير صحيحة');
      }
      tenantId = tenant.id;
    }

    const user = await this.validateUser(email, password, tenantId);
    if (!user) {
      throw new UnauthorizedException('Invalid credentials / بيانات الدخول غير صحيحة');
    }
    return user;
  }

  async login(userId: string, email: string, role: string, tenantId?: string, tenantSlug?: string, req?: any) {
    // Re-check account and tenant state at token issuance time.
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        twoFactorEnabled: true,
        status: true,
        tenantId: true,
        tenant: { select: { status: true } },
      },
    });
    if (!user || user.status !== 'ACTIVE' || (user.tenant && user.tenant.status !== 'ACTIVE')) {
      throw new UnauthorizedException('Account is not active');
    }
    if (tenantId && user.tenantId !== tenantId) {
      throw new UnauthorizedException('Invalid tenant');
    }

    if (user?.twoFactorEnabled) {
      // Issue a temporary token for 2FA verification
      const tempToken = this.jwt.sign(
        { sub: userId, email, role, tenantId, tenantSlug, type: '2fa_pending' },
        { expiresIn: '5m' },
      );
      return {
        requires2FA: true,
        tempToken,
        user: { id: userId, email, role, tenantId, tenantSlug },
      };
    }

    const tokens = this.buildTokenPair(userId, email, role, tenantId, tenantSlug);

    await prisma.$transaction([
      prisma.session.create({
        data: {
          id: tokens.sessionKey,
          userId,
          tenantId: tenantId || null,
          token: tokens.refreshTokenHash,
          expiresAt: tokens.expiresAt,
          ...this.sessionMetadata(req),
        },
      }),
      prisma.user.update({
        where: { id: userId },
        data: { lastLoginAt: new Date() },
      }),
    ]);

    return {
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      user: { id: userId, email, role, tenantId, tenantSlug },
    };
  }

  async verify2FALoginAndIssueToken(tempToken: string, code: string, req?: any) {
    let payload: any;
    try {
      payload = this.jwt.verify(tempToken);
    } catch {
      throw new UnauthorizedException('Invalid or expired temporary token');
    }

    if (payload.type !== '2fa_pending') {
      throw new UnauthorizedException('Invalid token type');
    }

    const verifyResult = await this.verify2FALogin(payload.sub, code);
    if (!verifyResult.verified) {
      throw new UnauthorizedException('Invalid 2FA code');
    }

    const { sub: userId, email, role, tenantId, tenantSlug } = payload;
    const tokens = this.buildTokenPair(userId, email, role, tenantId, tenantSlug);

    await prisma.$transaction([
      prisma.session.create({
        data: {
          id: tokens.sessionKey,
          userId,
          tenantId: tenantId || null,
          token: tokens.refreshTokenHash,
          expiresAt: tokens.expiresAt,
          ...this.sessionMetadata(req),
        },
      }),
      prisma.user.update({
        where: { id: userId },
        data: { lastLoginAt: new Date() },
      }),
    ]);

    return {
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      user: { id: userId, email, role, tenantId, tenantSlug },
    };
  }

  async refresh(refreshToken: string) {
    let payload: any;
    try {
      payload = this.jwt.verify(refreshToken, {
        secret: this.config.get('JWT_SECRET'),
      });
    } catch {
      throw new UnauthorizedException('Invalid or expired refresh token');
    }

    if (payload?.type !== 'refresh' || !payload?.sub || !payload?.jti) {
      throw new UnauthorizedException('Invalid refresh token type');
    }

    const tokenHash = this.hashToken(refreshToken);
    const session = await prisma.session.findUnique({
      where: { token: tokenHash },
      include: {
        user: {
          include: {
            tenant: { select: { id: true, slug: true, status: true } },
          },
        },
      },
    });

    if (!session) {
      throw new UnauthorizedException('Refresh session not found');
    }

    if (session.revokedAt) {
      await prisma.session.updateMany({
        where: { userId: session.userId, revokedAt: null },
        data: { revokedAt: new Date() },
      });
      throw new UnauthorizedException('Refresh token reuse detected');
    }

    if (session.expiresAt <= new Date()) {
      await prisma.session.update({
        where: { id: session.id },
        data: { revokedAt: new Date() },
      });
      throw new UnauthorizedException('Refresh session expired');
    }

    const user = session.user;
    if (
      !user ||
      user.status !== 'ACTIVE' ||
      (user.tenant && user.tenant.status !== 'ACTIVE') ||
      (payload.tenantId || null) !== (session.tenantId || null)
    ) {
      await prisma.session.updateMany({
        where: { userId: session.userId, revokedAt: null },
        data: { revokedAt: new Date() },
      });
      throw new UnauthorizedException('Account is not active');
    }

    const tenantSlug = user.tenant?.slug || payload.tenantSlug || undefined;
    const tokens = this.buildTokenPair(
      user.id,
      user.email,
      user.role,
      user.tenantId || undefined,
      tenantSlug,
    );
    const revokedAt = new Date();

    await prisma.$transaction(async (tx) => {
      const revoked = await tx.session.updateMany({
        where: {
          id: session.id,
          revokedAt: null,
          expiresAt: { gt: revokedAt },
        },
        data: { revokedAt },
      });

      if (revoked.count !== 1) {
        throw new UnauthorizedException('Refresh token already used');
      }

      await tx.session.create({
        data: {
          id: tokens.sessionKey,
          userId: user.id,
          tenantId: user.tenantId || null,
          token: tokens.refreshTokenHash,
          expiresAt: tokens.expiresAt,
          userAgent: session.userAgent,
          ipAddress: session.ipAddress,
          deviceInfo: session.deviceInfo,
        },
      });
    });

    return {
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
        tenantId: user.tenantId,
        tenantSlug,
      },
    };
  }

  async logout(refreshToken: string) {
    const tokenHash = this.hashToken(refreshToken);
    await prisma.session.updateMany({
      where: { token: tokenHash, revokedAt: null },
      data: { revokedAt: new Date() },
    });
    return { message: 'Logged out successfully' };
  }

  async logoutAll(userId: string) {
    await prisma.session.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
    return { message: 'All sessions revoked successfully' };
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
    const email = this.normalizeEmail(data.email);
    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) throw new ConflictException('Email already registered / البريد مسجل مسبقاً');

    const passwordHash = await hashPassword(data.password);

    // معاملة ذرّية: إنشاء المنشأة والمستخدم معاً أو لا شيء (يمنع tenant يتيم بدون مالك)
    return prisma.$transaction(async (tx) => {
      let tenantId: string | undefined;

      if (data.tenantName && data.tenantSlug) {
        const slugExists = await tx.tenant.findUnique({ where: { slug: data.tenantSlug } });
        if (slugExists) throw new ConflictException('Tenant slug already exists / اسم المنشأة مستخدم');

        const tenant = await tx.tenant.create({
          data: {
            name: data.tenantName,
            slug: data.tenantSlug,
            status: 'ACTIVE',
            plan: 'BASIC',
          },
        });
        tenantId = tenant.id;
      }

      return tx.user.create({
        data: {
          email,
          passwordHash,
          firstName: data.firstName,
          lastName: data.lastName,
          phone: data.phone,
          tenantId,
          role: tenantId ? 'ADMIN' : 'USER',
        },
        select: { id: true, email: true, firstName: true, lastName: true, role: true, status: true, tenantId: true },
      });
    });
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

  // ─── Forgot Password / Account Setup ───────────────────────────────
  private async sendPasswordLink(
    user: { id: string; email: string },
    purpose: 'RESET' | 'INVITE',
  ) {
    const brevoApiKey = this.config.get<string>('BREVO_API_KEY');
    const senderEmail = this.config.get<string>('EMAIL_FROM');
    const senderName = this.config.get<string>('EMAIL_FROM_NAME') || 'SCC380';

    if (!brevoApiKey || !senderEmail) {
      this.logger.error(`${purpose} email delivery is not configured`);
      return false;
    }

    const token = randomBytes(32).toString('hex');
    const tokenHash = createHash('sha256').update(token).digest('hex');
    const ttlMs = purpose === 'INVITE' ? 24 * 60 * 60 * 1000 : 60 * 60 * 1000;
    const expiresAt = new Date(Date.now() + ttlMs);
    const resetUrl = `${this.config.get('WEB_URL', 'http://localhost:3000')}/auth/reset-password?token=${token}`;

    await prisma.passwordResetToken.deleteMany({
      where: { email: user.email, usedAt: null },
    });
    await prisma.passwordResetToken.create({
      data: { email: user.email, token: tokenHash, expiresAt, userId: user.id },
    });

    const isInvite = purpose === 'INVITE';
    try {
      const response = await fetch('https://api.brevo.com/v3/smtp/email', {
        method: 'POST',
        headers: {
          accept: 'application/json',
          'api-key': brevoApiKey,
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          sender: { name: senderName, email: senderEmail },
          to: [{ email: user.email }],
          subject: isInvite ? 'تفعيل حساب الخدمة الذاتية - SCC380' : 'إعادة تعيين كلمة المرور - SCC380',
          htmlContent:
            (isInvite
              ? '<p>تم إنشاء حساب الخدمة الذاتية الخاص بك في SCC380.</p>'
              : '<p>تم طلب إعادة تعيين كلمة المرور لحسابك.</p>') +
            '<p><a href="' + resetUrl + '">' +
            (isInvite ? 'تعيين كلمة المرور وتفعيل الحساب' : 'إعادة تعيين كلمة المرور') +
            '</a></p>' +
            `<p>تنتهي صلاحية الرابط خلال ${isInvite ? '24 ساعة' : 'ساعة واحدة'}.</p>`,
        }),
      });
      if (!response.ok) throw new Error(`Brevo returned HTTP ${response.status}`);
      return true;
    } catch (error) {
      await prisma.passwordResetToken.deleteMany({ where: { token: tokenHash } });
      this.logger.error(
        `${purpose} email delivery failed`,
        error instanceof Error ? error.message : undefined,
      );
      return false;
    }
  }

  async forgotPassword(email: string) {
    const genericResponse = { message: 'If this email exists, a reset link has been sent.' };
    const normalizedEmail = this.normalizeEmail(email);
    const user = await prisma.user.findUnique({ where: { email: normalizedEmail } });
    if (!user) return genericResponse;

    await this.sendPasswordLink({ id: user.id, email: user.email }, 'RESET');
    return genericResponse;
  }

  async sendAccountSetupEmail(userId: string) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, email: true, status: true },
    });
    if (!user) throw new BadRequestException('User not found');
    if (user.status !== 'PENDING_VERIFICATION') {
      throw new BadRequestException('Only pending users can receive an account setup invitation');
    }
    const sent = await this.sendPasswordLink({ id: user.id, email: user.email }, 'INVITE');
    return { sent };
  }

  async resetPassword(token: string, newPassword: string) {
    const tokenHash = createHash('sha256').update(token).digest('hex');
    const record = await prisma.passwordResetToken.findFirst({
      where: { OR: [{ token: tokenHash }, { token }] },
    });
    if (!record || record.usedAt || record.expiresAt < new Date()) {
      throw new BadRequestException('Invalid or expired reset token');
    }

    const user = record.userId
      ? await prisma.user.findUnique({ where: { id: record.userId } })
      : await prisma.user.findUnique({ where: { email: record.email } });
    if (!user) throw new BadRequestException('User not found');

    const passwordHash = await hashPassword(newPassword);
    const usedAt = new Date();
    await prisma.$transaction([
      prisma.user.update({
        where: { id: user.id },
        data: {
          passwordHash,
          ...(user.status === 'PENDING_VERIFICATION'
            ? { status: 'ACTIVE', emailVerified: true }
            : {}),
        },
      }),
      prisma.passwordResetToken.updateMany({
        where: { email: record.email, usedAt: null },
        data: { usedAt },
      }),
      prisma.session.updateMany({
        where: { userId: user.id, revokedAt: null },
        data: { revokedAt: usedAt },
      }),
    ]);

    return { message: 'Password reset successfully' };
  }

  // ─── Google OAuth ──────────────────────────────────────────────────
  async googleAuth(credential: string, req?: any) {
    if (!this.googleClient) {
      throw new BadRequestException('Google OAuth not configured');
    }

    const ticket = await this.googleClient.verifyIdToken({
      idToken: credential,
      audience: this.config.get('GOOGLE_CLIENT_ID'),
    });

    const payload = ticket.getPayload();
    if (!payload || !payload.email) {
      throw new UnauthorizedException('Invalid Google token');
    }

    const { email, given_name, family_name, sub: googleId } = payload;

    const user = await prisma.user.findUnique({ where: { email } });

    if (!user) {
      throw new UnauthorizedException('Google account is not registered');
    }
    if (user.status !== 'ACTIVE' || !user.tenantId) {
      throw new UnauthorizedException('Account is not active');
    }

    // Link OAuth account
    await prisma.oAuthAccount.upsert({
      where: {
        provider_providerAccountId: { provider: 'google', providerAccountId: googleId },
      },
      update: {},
      create: {
        userId: user.id,
        provider: 'google',
        providerAccountId: googleId,
      },
    });

    return this.login(user.id, user.email, user.role, user.tenantId || undefined, undefined, req);
  }

  // ─── 2FA / TOTP ────────────────────────────────────────────────────
  async setup2FA(userId: string) {
    const existing = await prisma.user.findUnique({
      where: { id: userId },
      select: { twoFactorEnabled: true },
    });
    if (!existing) throw new BadRequestException('User not found');
    if (existing.twoFactorEnabled) {
      throw new BadRequestException('2FA is already enabled; disable it before setting up a new secret');
    }

    const secret = speakeasy.generateSecret({
      name: `SCC380 (${userId})`,
      length: 32,
    });

    await prisma.user.update({
      where: { id: userId },
      data: { twoFactorSecret: secret.base32 },
    });

    const qrCodeUrl = await QRCode.toDataURL(secret.otpauth_url || '');

    return {
      secret: secret.base32,
      qrCode: qrCodeUrl,
    };
  }

  async verify2FASetup(userId: string, code: string) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { twoFactorSecret: true },
    });
    if (!user?.twoFactorSecret) throw new BadRequestException('2FA not set up');

    const verified = speakeasy.totp.verify({
      secret: user.twoFactorSecret,
      encoding: 'base32',
      token: code,
      window: 2,
    });

    if (!verified) throw new UnauthorizedException('Invalid 2FA code');

    // Generate backup codes, return them once, and store only hashes.
    const backupCodes = Array.from({ length: 8 }, () => randomBytes(8).toString('hex').toUpperCase());
    const backupCodeHashes = backupCodes.map((backupCode) =>
      createHash('sha256').update(backupCode).digest('hex'),
    );

    await prisma.user.update({
      where: { id: userId },
      data: { twoFactorEnabled: true, twoFactorBackupCodes: backupCodeHashes },
    });

    return { message: '2FA enabled successfully', backupCodes };
  }

  async verify2FALogin(userId: string, code: string) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { twoFactorSecret: true, twoFactorEnabled: true, twoFactorBackupCodes: true },
    });
    if (!user?.twoFactorEnabled || !user.twoFactorSecret) {
      throw new BadRequestException('2FA not enabled');
    }

    // Check hashed backup codes, with legacy plaintext compatibility until old codes are consumed.
    const backupCodeHash = createHash('sha256').update(code).digest('hex');
    const matchedBackupCode = user.twoFactorBackupCodes.find(
      (storedCode) => storedCode === backupCodeHash || storedCode === code,
    );
    if (matchedBackupCode) {
      await prisma.user.update({
        where: { id: userId },
        data: {
          twoFactorBackupCodes: {
            set: user.twoFactorBackupCodes.filter((storedCode) => storedCode !== matchedBackupCode),
          },
        },
      });
      return { verified: true, usedBackupCode: true };
    }

    const verified = speakeasy.totp.verify({
      secret: user.twoFactorSecret,
      encoding: 'base32',
      token: code,
      window: 2,
    });

    if (!verified) throw new UnauthorizedException('Invalid 2FA code');
    return { verified: true };
  }

  async disable2FA(userId: string, code: string) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { twoFactorSecret: true, twoFactorEnabled: true },
    });
    if (!user?.twoFactorEnabled || !user.twoFactorSecret) {
      throw new BadRequestException('2FA not enabled');
    }

    const verified = speakeasy.totp.verify({
      secret: user.twoFactorSecret,
      encoding: 'base32',
      token: code,
      window: 2,
    });

    if (!verified) throw new UnauthorizedException('Invalid 2FA code');

    await prisma.user.update({
      where: { id: userId },
      data: { twoFactorEnabled: false, twoFactorSecret: null, twoFactorBackupCodes: [] },
    });

    return { message: '2FA disabled successfully' };
  }
}
