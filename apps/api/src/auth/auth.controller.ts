import { Controller, Post, Body, UseGuards, Request, Get, Headers, BadRequestException } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { AuthService } from './auth.service';
import { LocalAuthGuard } from './guards/local-auth.guard';
import { JwtAuthGuard } from './guards/jwt-auth.guard';

@ApiTags('Auth')
@Controller('auth')
export class AuthController {
  constructor(private authService: AuthService) {}

  @UseGuards(LocalAuthGuard)
  @Post('login')
  async login(@Request() req, @Headers('x-tenant-slug') tenantSlug?: string) {
    return this.authService.login(
      req.user.id,
      req.user.email,
      req.user.role,
      req.user.tenantId,
      tenantSlug,
    );
  }

  @Post('register')
  async register(
    @Body() body: {
      email: string;
      password: string;
      firstName: string;
      lastName: string;
      phone?: string;
      tenantName?: string;
      tenantSlug?: string;
    },
  ) {
    return this.authService.register(body);
  }

  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @Get('me')
  async me(@Request() req) {
    return this.authService.me(req.user.userId);
  }

  // ─── Forgot / Reset Password ───────────────────────────────────────
  @Post('forgot-password')
  async forgotPassword(@Body('email') email: string) {
    if (!email) throw new BadRequestException('Email is required');
    return this.authService.forgotPassword(email);
  }

  @Post('reset-password')
  async resetPassword(
    @Body('token') token: string,
    @Body('newPassword') newPassword: string,
  ) {
    if (!token || !newPassword) throw new BadRequestException('Token and newPassword are required');
    return this.authService.resetPassword(token, newPassword);
  }

  // ─── Google OAuth ──────────────────────────────────────────────────
  @Post('google')
  async googleAuth(@Body('credential') credential: string) {
    if (!credential) throw new BadRequestException('Google credential is required');
    return this.authService.googleAuth(credential);
  }

  // ─── 2FA ───────────────────────────────────────────────────────────
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @Post('2fa/setup')
  async setup2FA(@Request() req) {
    return this.authService.setup2FA(req.user.userId);
  }

  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @Post('2fa/verify-setup')
  async verify2FASetup(@Request() req, @Body('code') code: string) {
    if (!code) throw new BadRequestException('Code is required');
    return this.authService.verify2FASetup(req.user.userId, code);
  }

  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @Post('2fa/verify')
  async verify2FALogin(@Request() req, @Body('code') code: string) {
    if (!code) throw new BadRequestException('Code is required');
    return this.authService.verify2FALogin(req.user.userId, code);
  }

  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @Post('2fa/disable')
  async disable2FA(@Request() req, @Body('code') code: string) {
    if (!code) throw new BadRequestException('Code is required');
    return this.authService.disable2FA(req.user.userId, code);
  }
}
