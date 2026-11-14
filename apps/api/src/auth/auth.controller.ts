import { Controller, Post, Body, UseGuards, Request, Get, Headers, BadRequestException } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { AuthService } from './auth.service';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { AuthRateLimitGuard } from './guards/auth-rate-limit.guard';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';

@ApiTags('Auth')
@Controller('auth')
export class AuthController {
  constructor(private authService: AuthService) {}

  @UseGuards(AuthRateLimitGuard)
  @Post('login')
  async login(@Body() body: LoginDto, @Request() req: any, @Headers('x-tenant-slug') tenantSlug?: string) {
    const user = await this.authService.authenticate(body.email, body.password, tenantSlug);
    return this.authService.login(
      user.id,
      user.email,
      user.role,
      user.tenantId || undefined,
      tenantSlug,
      req,
    );
  }

  @UseGuards(AuthRateLimitGuard)
  @Post('register')
  async register(@Body() body: RegisterDto) {
    return this.authService.register(body);
  }

  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @Get('me')
  async me(@Request() req) {
    return this.authService.me(req.user.userId);
  }

  @UseGuards(AuthRateLimitGuard)
  @Post('refresh')
  async refresh(@Body('refreshToken') refreshToken: string) {
    if (!refreshToken) throw new BadRequestException('refreshToken is required');
    return this.authService.refresh(refreshToken);
  }

  @Post('logout')
  async logout(@Body('refreshToken') refreshToken: string) {
    if (!refreshToken) throw new BadRequestException('refreshToken is required');
    return this.authService.logout(refreshToken);
  }

  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @Post('logout-all')
  async logoutAll(@Request() req) {
    return this.authService.logoutAll(req.user.userId, req.user.tenantId ?? null);
  }

  // ─── Forgot / Reset Password ───────────────────────────────────────
  @UseGuards(AuthRateLimitGuard)
  @Post('forgot-password')
  async forgotPassword(@Body('email') email: string) {
    if (!email) throw new BadRequestException('Email is required');
    return this.authService.forgotPassword(email);
  }

  @UseGuards(AuthRateLimitGuard)
  @Post('reset-password')
  async resetPassword(
    @Body('token') token: string,
    @Body('newPassword') newPassword: string,
  ) {
    if (!token || typeof newPassword !== 'string') {
      throw new BadRequestException('Token and newPassword are required');
    }
    if (newPassword.length < 12 || newPassword.length > 128) {
      throw new BadRequestException('Password must be between 12 and 128 characters');
    }
    return this.authService.resetPassword(token, newPassword);
  }

  // ─── Google OAuth ──────────────────────────────────────────────────
  @UseGuards(AuthRateLimitGuard)
  @Post('google')
  async googleAuth(@Body('credential') credential: string, @Request() req: any) {
    if (!credential) throw new BadRequestException('Google credential is required');
    return this.authService.googleAuth(credential, req);
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

  @UseGuards(AuthRateLimitGuard)
  @Post('verify-2fa-login')
  async verify2FALoginAndIssueToken(
    @Body('tempToken') tempToken: string,
    @Body('code') code: string,
    @Request() req: any,
  ) {
    if (!tempToken || !code) throw new BadRequestException('tempToken and code are required');
    return this.authService.verify2FALoginAndIssueToken(tempToken, code, req);
  }

  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @Post('2fa/disable')
  async disable2FA(@Request() req, @Body('code') code: string) {
    if (!code) throw new BadRequestException('Code is required');
    return this.authService.disable2FA(req.user.userId, code);
  }
}
