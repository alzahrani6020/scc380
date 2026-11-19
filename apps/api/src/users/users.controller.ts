import { Controller, Get, Post, Patch, Delete, Body, Param, Query, UseGuards, Req } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionsGuard, RequirePermissions } from '../auth/guards/permissions.guard';
import { UsersService } from './users.service';
import { IsString, IsOptional, IsBoolean, IsIn } from 'class-validator';

class UpdateUserDto {
  @IsString() @IsOptional() firstName?: string;
  @IsString() @IsOptional() lastName?: string;
  @IsString() @IsOptional() phone?: string;
  @IsString() @IsOptional() role?: string;
  @IsString() @IsOptional() status?: string;
  @IsString() @IsOptional() preferences?: string;
}

class UpdatePreferencesDto {
  @IsOptional() @IsIn(['ar', 'en']) language?: 'ar' | 'en';
  @IsOptional() @IsBoolean() notifyInvoices?: boolean;
  @IsOptional() @IsBoolean() notifyEmployees?: boolean;
  @IsOptional() @IsBoolean() notifyFleet?: boolean;
  @IsOptional() @IsBoolean() notifyWeeklyReports?: boolean;
}

@ApiTags('Users')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('users')
export class UsersController {
  constructor(private readonly service: UsersService) {}

  @Get()
  @RequirePermissions('user:read')
  findAll(@Req() req: any, @Query() query: any) { return this.service.findAll(req, query); }

  @Get('me')
  getMe(@Req() req: any) { return this.service.findOne(req, req.user?.userId); }

  @Get('me/preferences')
  getPreferences(@Req() req: any) { return this.service.getPreferences(req); }

  @Patch('me/preferences')
  savePreferences(@Req() req: any, @Body() dto: UpdatePreferencesDto) {
    return this.service.savePreferences(req, dto);
  }

  @Get(':id')
  @RequirePermissions('user:read')
  findOne(@Req() req: any, @Param('id') id: string) { return this.service.findOne(req, id); }

  @Patch(':id')
  update(@Req() req: any, @Param('id') id: string, @Body() dto: UpdateUserDto) { return this.service.update(req, id, dto); }

  @Delete(':id')
  @RequirePermissions('user:write')
  remove(@Req() req: any, @Param('id') id: string) { return this.service.remove(req, id); }
}
