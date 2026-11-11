import { Controller, Get, Post, Patch, Delete, Body, Param, Query, UseGuards, Req } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionsGuard, RequirePermissions } from '../auth/guards/permissions.guard';
import { ActivitiesService } from './activities.service';
import { IsString, IsOptional, IsEnum } from 'class-validator';
import { ActivityType } from '@prisma/client';

class CreateActivityDto {
  @IsEnum(ActivityType) type: ActivityType;
  @IsString() subject: string;
  @IsString() @IsOptional() description?: string;
  @IsString() @IsOptional() contactId?: string;
  @IsString() @IsOptional() dealId?: string;
  @IsString() @IsOptional() scheduledAt?: string;
  @IsString() @IsOptional() assignedToId?: string;
}

class UpdateActivityDto {
  @IsEnum(ActivityType) @IsOptional() type?: ActivityType;
  @IsString() @IsOptional() subject?: string;
  @IsString() @IsOptional() description?: string;
  @IsString() @IsOptional() contactId?: string;
  @IsString() @IsOptional() dealId?: string;
  @IsString() @IsOptional() scheduledAt?: string;
  @IsString() @IsOptional() completedAt?: string;
  @IsString() @IsOptional() assignedToId?: string;
}

@ApiTags('CRM - Activities')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('crm/activities')
export class ActivitiesController {
  constructor(private readonly service: ActivitiesService) {}

  @Get()
  @RequirePermissions('crm:read')
  @ApiQuery({ name: 'type', required: false })
  @ApiQuery({ name: 'contactId', required: false })
  @ApiQuery({ name: 'assignedToId', required: false })
  @ApiQuery({ name: 'page', required: false })
  @ApiQuery({ name: 'limit', required: false })
  findAll(@Req() req: any, @Query() query: any) {
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
