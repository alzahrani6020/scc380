import { Controller, Get, Post, Patch, Delete, Body, Param, UseGuards, Req } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { ApiKeysService } from './api-keys.service';
import { IsString, IsOptional } from 'class-validator';

class CreateApiKeyDto {
  @IsString() name: string;
  @IsString() @IsOptional() expiresAt?: string;
}

@ApiTags('Security - API Keys')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('security/api-keys')
export class ApiKeysController {
  constructor(private readonly service: ApiKeysService) {}

  @Get()
  findAll(@Req() req: any) { return this.service.findAll(req); }

  @Post()
  create(@Req() req: any, @Body() dto: CreateApiKeyDto) { return this.service.create(req, dto); }

  @Delete(':id')
  revoke(@Req() req: any, @Param('id') id: string) { return this.service.revoke(req, id); }
}
