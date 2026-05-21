import { Controller, Post, Body, UseGuards, Request, Get, Headers } from '@nestjs/common';
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
}
