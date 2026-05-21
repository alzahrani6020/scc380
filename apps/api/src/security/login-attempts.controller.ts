import { Controller, Get, Query, UseGuards, Req } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { LoginAttemptsService } from './login-attempts.service';

@ApiTags('Security - Login Attempts')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('security/login-attempts')
export class LoginAttemptsController {
  constructor(private readonly service: LoginAttemptsService) {}

  @Get()
  findAll(@Req() req: any, @Query() query: any) { return this.service.findAll(req, query); }
}
