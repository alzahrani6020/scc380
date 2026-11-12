import { Controller, Get, Post, Patch, Delete, Body, Param, Query, UseGuards, Req } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionsGuard, RequirePermissions } from '../auth/guards/permissions.guard';
import { ShiftsService } from './shifts.service';
import { IsString, IsOptional, IsBoolean } from 'class-validator';

class CreateShiftDto {
  @IsString() employeeId: string;
  @IsString() name: string;
  @IsString() startTime: string;
  @IsString() endTime: string;
  @IsBoolean() @IsOptional() isRecurring?: boolean;
  @IsString() @IsOptional() recurrence?: string;
}

class UpdateShiftDto {
  @IsString() @IsOptional() name?: string;
  @IsString() @IsOptional() startTime?: string;
  @IsString() @IsOptional() endTime?: string;
  @IsBoolean() @IsOptional() isRecurring?: boolean;
  @IsString() @IsOptional() recurrence?: string;
}

@ApiTags('HR - Shifts')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('hr/shifts')
export class ShiftsController {
  constructor(private readonly service: ShiftsService) {}

  @Get()
  @RequirePermissions('hr:read')
  findAll(@Req() req: any, @Query() query: any) { return this.service.findAll(req, query); }

  @Get(':id')
  @RequirePermissions('hr:read')
  findOne(@Req() req: any, @Param('id') id: string) { return this.service.findOne(req, id); }

  @Post()
  @RequirePermissions('hr:write')
  create(@Req() req: any, @Body() dto: CreateShiftDto) { return this.service.create(req, dto); }

  @Patch(':id')
  @RequirePermissions('hr:write')
  update(@Req() req: any, @Param('id') id: string, @Body() dto: UpdateShiftDto) { return this.service.update(req, id, dto); }

  @Delete(':id')
  @RequirePermissions('hr:write')
  remove(@Req() req: any, @Param('id') id: string) { return this.service.remove(req, id); }
}
