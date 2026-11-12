import { Body, Controller, Get, Param, Patch, Post, Query, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { IsIn, IsInt, IsOptional, IsString, MaxLength, Min } from 'class-validator';
import { Type } from 'class-transformer';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionsGuard, RequirePermissions } from '../auth/guards/permissions.guard';
import { HrLifecycleService } from './hr-lifecycle.service';

class CreateLifecycleDto {
  @IsString() employeeId: string;
  @IsIn(['ONBOARDING','OFFBOARDING']) type: string;
  @IsString() @IsOptional() startDate?: string;
  @IsString() @IsOptional() targetDate?: string;
  @IsString() @MaxLength(1000) @IsOptional() notes?: string;
}
class CreateLifecycleTaskDto {
  @IsString() @MaxLength(200) title: string;
  @IsString() @MaxLength(1000) @IsOptional() description?: string;
  @IsString() @IsOptional() assignedToId?: string;
  @IsString() @IsOptional() dueDate?: string;
  @Type(() => Number) @IsInt() @Min(0) @IsOptional() order?: number;
}
class UpdateLifecycleTaskDto {
  @IsString() @MaxLength(200) @IsOptional() title?: string;
  @IsString() @MaxLength(1000) @IsOptional() description?: string;
  @IsString() @IsOptional() assignedToId?: string;
  @IsString() @IsOptional() dueDate?: string;
  @Type(() => Number) @IsInt() @Min(0) @IsOptional() order?: number;
  @IsIn(['TODO','IN_PROGRESS','DONE','SKIPPED']) @IsOptional() status?: string;
  @IsString() @MaxLength(1000) @IsOptional() notes?: string;
}

@ApiTags('HR - Employee Lifecycle')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('hr/lifecycle')
export class HrLifecycleController {
  constructor(private readonly service: HrLifecycleService) {}

  @Get()
  @RequirePermissions('hr:read')
  list(@Req() req: any, @Query() query: any) { return this.service.list(req, query); }

  @Get(':id')
  @RequirePermissions('hr:read')
  findOne(@Req() req: any, @Param('id') id: string) { return this.service.findOne(req, id); }

  @Post()
  @RequirePermissions('hr:write')
  create(@Req() req: any, @Body() dto: CreateLifecycleDto) { return this.service.create(req, dto); }

  @Post(':id/tasks')
  @RequirePermissions('hr:write')
  addTask(@Req() req: any, @Param('id') id: string, @Body() dto: CreateLifecycleTaskDto) {
    return this.service.addTask(req, id, dto);
  }

  @Patch(':id/tasks/:taskId')
  @RequirePermissions('hr:write')
  updateTask(@Req() req: any, @Param('id') id: string, @Param('taskId') taskId: string, @Body() dto: UpdateLifecycleTaskDto) {
    return this.service.updateTask(req, id, taskId, dto);
  }

  @Post(':id/complete')
  @RequirePermissions('hr:write')
  complete(@Req() req: any, @Param('id') id: string) { return this.service.complete(req, id); }

  @Post(':id/cancel')
  @RequirePermissions('hr:write')
  cancel(@Req() req: any, @Param('id') id: string) { return this.service.cancel(req, id); }
}
