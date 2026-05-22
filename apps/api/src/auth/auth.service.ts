import { Injectable, UnauthorizedException, ConflictException, BadRequestException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { prisma } from '@scc/database';
import { hashPassword, verifyPassword } from '@scc/auth';
import * as speakeasy from 'speakeasy';
import * as QRCode from 'qrcode';
import { randomBytes } from 'crypto';
import { OAuth2Client } from 'google-auth-library';

@Injectable()
export class AuthService {
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
    // Check if 2FA is enabled
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { twoFactorEnabled: true },
    });

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

  async verify2FALoginAndIssueToken(tempToken: string, code: string) {
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
    const accessPayload = { sub: userId, email, role, tenantId, tenantSlug };
    const accessToken = this.jwt.sign(accessPayload);
    const refreshToken = this.jwt.sign(accessPayload, {
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

  // ─── Forgot Password ───────────────────────────────────────────────
  async forgotPassword(email: string) {
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      // Don't reveal if user exists
      return { message: 'If this email exists, a reset link has been sent.' };
    }

    const token = randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 1000 * 60 * 60); // 1 hour

    await prisma.passwordResetToken.create({
      data: { email, token, expiresAt },
    });

    // TODO: Send actual email here
    // For now, return the token in the response for demo purposes
    return {
      message: 'Password reset link generated',
      resetToken: token, // In production, send this via email only
      resetUrl: `${this.config.get('WEB_URL', 'http://localhost:3000')}/auth/reset-password?token=${token}`,
    };
  }

  async resetPassword(token: string, newPassword: string) {
    const record = await prisma.passwordResetToken.findUnique({ where: { token } });
    if (!record || record.usedAt || record.expiresAt < new Date()) {
      throw new BadRequestException('Invalid or expired reset token');
    }

    const user = await prisma.user.findUnique({ where: { email: record.email } });
    if (!user) throw new BadRequestException('User not found');

    const passwordHash = await hashPassword(newPassword);
    await prisma.user.update({ where: { id: user.id }, data: { passwordHash } });
    await prisma.passwordResetToken.update({ where: { id: record.id }, data: { usedAt: new Date() } });

    return { message: 'Password reset successfully' };
  }

  // ─── Google OAuth ──────────────────────────────────────────────────
  async googleAuth(credential: string) {
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

    let user = await prisma.user.findUnique({ where: { email } });

    if (!user) {
      // Auto-register Google user
      user = await prisma.user.create({
        data: {
          email,
          firstName: given_name || email.split('@')[0],
          lastName: family_name || '',
          emailVerified: true,
          role: 'USER',
        },
      });
    }

    // Link OAuth account
    await prisma.oauthAccount.upsert({
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

    return this.login(user.id, user.email, user.role, user.tenantId || undefined, undefined);
  }

  // ─── 2FA / TOTP ────────────────────────────────────────────────────
  async setup2FA(userId: string) {
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

    // Generate backup codes
    const backupCodes = Array.from({ length: 8 }, () => randomBytes(4).toString('hex').toUpperCase());

    await prisma.user.update({
      where: { id: userId },
      data: { twoFactorEnabled: true, twoFactorBackupCodes: backupCodes },
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

    // Check backup codes
    if (user.twoFactorBackupCodes.includes(code)) {
      await prisma.user.update({
        where: { id: userId },
        data: { twoFactorBackupCodes: { set: user.twoFactorBackupCodes.filter((c) => c !== code) } },
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
