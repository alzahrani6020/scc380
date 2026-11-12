import { Controller, Get, Post, Patch, Delete, Body, Param, Query, UseGuards, Req } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsDateString, IsIn, IsInt, IsOptional, IsString, Min } from 'class-validator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionsGuard, RequirePermissions } from '../auth/guards/permissions.guard';
import { LeavesService } from './leaves.service';

class CreateLeaveDto {
  @IsString() employeeId: string;
  @IsIn(['ANNUAL','SICK','EMERGENCY','UNPAID','MATERNITY','PATERNITY','HAJJ','STUDY','COMPASSIONATE']) type: string;
  @IsDateString() startDate: string;
  @IsDateString() endDate: string;
  @Type(() => Number) @IsInt() @Min(1) days: number;
  @IsString() @IsOptional() reason?: string;
}

class UpdateLeaveDto {
  @IsIn(['PENDING','APPROVED','REJECTED','CANCELLED']) @IsOptional() status?: string;
  @IsDateString() @IsOptional() startDate?: string;
  @IsDateString() @IsOptional() endDate?: string;
  @Type(() => Number) @IsInt() @Min(1) @IsOptional() days?: number;
  @IsString() @IsOptional() reason?: string;
}

@ApiTags('HR - Leaves')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('hr/leaves')
export class LeavesController {
  constructor(private readonly service: LeavesService) {}

  @Get()
  @RequirePermissions('hr:leave-requests:read')
  findAll(@Req() req: any, @Query() query: any) { return this.service.findAll(req, query); }

  @Get(':id')
  @RequirePermissions('hr:leave-requests:read')
  findOne(@Req() req: any, @Param('id') id: string) { return this.service.findOne(req, id); }

  @Post()
  @RequirePermissions('hr:leave-requests:write')
  create(@Req() req: any, @Body() dto: CreateLeaveDto) { return this.service.create(req, dto); }

  @Patch(':id')
  @RequirePermissions('hr:leave-requests:write')
  update(@Req() req: any, @Param('id') id: string, @Body() dto: UpdateLeaveDto) { return this.service.update(req, id, dto); }

  @Delete(':id')
  @RequirePermissions('hr:leave-requests:write')
  remove(@Req() req: any, @Param('id') id: string) { return this.service.remove(req, id); }
}
