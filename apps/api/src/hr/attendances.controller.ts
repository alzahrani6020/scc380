import { Controller, Get, Post, Patch, Delete, Body, Param, Query, UseGuards, Req } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsString, IsOptional, IsNumber } from 'class-validator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionsGuard, RequirePermissions } from '../auth/guards/permissions.guard';
import { AttendancesService } from './attendances.service';

class CreateAttendanceDto {
  @IsString() employeeId: string;
  @IsString() @IsOptional() date?: string;
  @IsString() @IsOptional() checkIn?: string;
  @IsString() @IsOptional() checkOut?: string;
  @IsString() status: string;
  @IsString() @IsOptional() notes?: string;
  @Type(() => Number) @IsNumber() @IsOptional() workHours?: number;
  @Type(() => Number) @IsNumber() @IsOptional() overtimeHours?: number;
}

class UpdateAttendanceDto {
  @IsString() @IsOptional() date?: string;
  @IsString() @IsOptional() checkIn?: string;
  @IsString() @IsOptional() checkOut?: string;
  @IsString() @IsOptional() status?: string;
  @IsString() @IsOptional() notes?: string;
  @Type(() => Number) @IsNumber() @IsOptional() workHours?: number;
  @Type(() => Number) @IsNumber() @IsOptional() overtimeHours?: number;
}

@ApiTags('HR - Attendance')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('hr/attendances')
export class AttendancesController {
  constructor(private readonly service: AttendancesService) {}

  @Get()
  @RequirePermissions('hr:read')
  findAll(@Req() req: any, @Query() query: any) { return this.service.findAll(req, query); }

  @Get(':id')
  @RequirePermissions('hr:read')
  findOne(@Req() req: any, @Param('id') id: string) { return this.service.findOne(req, id); }

  @Post()
  @RequirePermissions('hr:write')
  create(@Req() req: any, @Body() dto: CreateAttendanceDto) { return this.service.create(req, dto); }

  @Patch(':id')
  @RequirePermissions('hr:write')
  update(@Req() req: any, @Param('id') id: string, @Body() dto: UpdateAttendanceDto) { return this.service.update(req, id, dto); }

  @Delete(':id')
  @RequirePermissions('hr:write')
  remove(@Req() req: any, @Param('id') id: string) { return this.service.remove(req, id); }
}
