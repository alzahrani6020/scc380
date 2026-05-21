import { Controller, Get, Post, Patch, Delete, Body, Param, Query, UseGuards, Req } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { SessionsService } from './sessions.service';

@ApiTags('Security - Sessions')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('security/sessions')
export class SessionsController {
  constructor(private readonly service: SessionsService) {}

  @Get()
  findAll(@Req() req: any, @Query('userId') userId?: string) { return this.service.findAll(req, userId); }

  @Get('me')
  findMySessions(@Req() req: any) { return this.service.findAll(req, req.user?.userId); }

  @Delete(':id')
  revoke(@Req() req: any, @Param('id') id: string) { return this.service.revoke(req, id); }

  @Post('revoke-all')
  revokeAll(@Req() req: any) { return this.service.revokeAll(req); }
}
