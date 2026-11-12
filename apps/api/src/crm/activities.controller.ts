import { Controller, Get, Post, Patch, Delete, Body, Param, Query, UseGuards, Req } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionsGuard, RequirePermissions } from '../auth/guards/permissions.guard';
import { ActivitiesService } from './activities.service';
import { IsString, IsOptional, IsEnum, IsISO8601, MaxLength, MinLength } from 'class-validator';
import { ActivityType } from '@prisma/client';
import { ListActivitiesQueryDto } from './dto/list-activities-query.dto';

class CreateActivityDto {
  @IsEnum(ActivityType) type: ActivityType;
  @IsString() @MinLength(1) @MaxLength(150) subject: string;
  @IsString() @MaxLength(2000) @IsOptional() description?: string;
  @IsString() @MaxLength(50) @IsOptional() contactId?: string;
  @IsString() @MaxLength(50) @IsOptional() dealId?: string;
  @IsISO8601() @IsOptional() scheduledAt?: string;
  @IsISO8601() @IsOptional() remindAt?: string;
  @IsString() @MaxLength(50) @IsOptional() assignedToId?: string;
}

class UpdateActivityDto {
  @IsEnum(ActivityType) @IsOptional() type?: ActivityType;
  @IsString() @MinLength(1) @MaxLength(150) @IsOptional() subject?: string;
  @IsString() @MaxLength(2000) @IsOptional() description?: string;
  @IsString() @MaxLength(50) @IsOptional() contactId?: string;
  @IsString() @MaxLength(50) @IsOptional() dealId?: string;
  @IsISO8601() @IsOptional() scheduledAt?: string;
  @IsISO8601() @IsOptional() completedAt?: string;
  @IsISO8601() @IsOptional() remindAt?: string;
  @IsString() @MaxLength(50) @IsOptional() assignedToId?: string;
}

@ApiTags('CRM - Activities')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('crm/activities')
export class ActivitiesController {
  constructor(private readonly service: ActivitiesService) {}

  @Get()
  @RequirePermissions('crm:read')
  findAll(@Req() req: any, @Query() query: ListActivitiesQueryDto) {
    return this.service.findAll(req, query);
  }

  @Get(':id')
  @RequirePermissions('crm:read')
  findOne(@Req() req: any, @Param('id') id: string) {
    return this.service.findOne(req, id);
  }

  @Post()
  @RequirePermissions('crm:write')
  create(@Req() req: any, @Body() dto: CreateActivityDto) {
    return this.service.create(req, dto);
  }

  @Patch(':id')
  @RequirePermissions('crm:write')
  update(@Req() req: any, @Param('id') id: string, @Body() dto: UpdateActivityDto) {
    return this.service.update(req, id, dto);
  }

  @Delete(':id')
  @RequirePermissions('crm:write')
  remove(@Req() req: any, @Param('id') id: string) {
    return this.service.remove(req, id);
  }
}
