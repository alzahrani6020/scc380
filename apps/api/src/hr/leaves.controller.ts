import { Controller, Get, Post, Patch, Delete, Body, Param, Query, UseGuards, Req } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsString, IsOptional, IsNumber } from 'class-validator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionsGuard, RequirePermissions } from '../auth/guards/permissions.guard';
import { LeavesService } from './leaves.service';

class CreateLeaveDto {
  @IsString() employeeId: string;
  @IsString() type: string;
  @IsString() startDate: string;
  @IsString() endDate: string;
  @Type(() => Number) @IsNumber() days: number;
  @IsString() @IsOptional() reason?: string;
}

class UpdateLeaveDto {
  @IsString() @IsOptional() type?: string;
  @IsString() @IsOptional() status?: string;
  @IsString() @IsOptional() startDate?: string;
  @IsString() @IsOptional() endDate?: string;
  @Type(() => Number) @IsNumber() @IsOptional() days?: number;
  @IsString() @IsOptional() reason?: string;
}

@ApiTags('HR - Leaves')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('hr/leaves')
export class LeavesController {
  constructor(private readonly service: LeavesService) {}

  @Get()
  @RequirePermissions('hr:read')
  findAll(@Req() req: any, @Query() query: any) { return this.service.findAll(req, query); }

  @Get(':id')
  @RequirePermissions('hr:read')
  findOne(@Req() req: any, @Param('id') id: string) { return this.service.findOne(req, id); }

  @Post()
  @RequirePermissions('hr:write')
  create(@Req() req: any, @Body() dto: CreateLeaveDto) { return this.service.create(req, dto); }

  @Patch(':id')
  @RequirePermissions('hr:write')
  update(@Req() req: any, @Param('id') id: string, @Body() dto: UpdateLeaveDto) { return this.service.update(req, id, dto); }

  @Delete(':id')
  @RequirePermissions('hr:write')
  remove(@Req() req: any, @Param('id') id: string) { return this.service.remove(req, id); }
}
