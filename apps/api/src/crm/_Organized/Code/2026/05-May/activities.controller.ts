import { Controller, Get, Post, Patch, Delete, Body, Param, Query, UseGuards, Req } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { ActivitiesService } from './activities.service';
import { IsString, IsOptional } from 'class-validator';

class CreateActivityDto {
  @IsString() type: string;
  @IsString() subject: string;
  @IsString() @IsOptional() description?: string;
  @IsString() @IsOptional() contactId?: string;
  @IsString() @IsOptional() dealId?: string;
  @IsString() @IsOptional() scheduledAt?: string;
  @IsString() @IsOptional() assignedToId?: string;
}

class UpdateActivityDto {
  @IsString() @IsOptional() type?: string;
  @IsString() @IsOptional() subject?: string;
  @IsString() @IsOptional() description?: string;
  @IsString() @IsOptional() scheduledAt?: string;
  @IsString() @IsOptional() completedAt?: string;
  @IsString() @IsOptional() assignedToId?: string;
}

@ApiTags('CRM - Activities')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('crm/activities')
export class ActivitiesController {
  constructor(private readonly service: ActivitiesService) {}

  @Get()
  @ApiQuery({ name: 'type', required: false })
  @ApiQuery({ name: 'contactId', required: false })
  @ApiQuery({ name: 'assignedToId', required: false })
  findAll(@Req() req: any, @Query() query: any) {
    return this.service.findAll(req, query);
  }

  @Get(':id')
  findOne(@Req() req: any, @Param('id') id: string) {
    return this.service.findOne(req, id);
  }

  @Post()
  create(@Req() req: any, @Body() dto: CreateActivityDto) {
    return this.service.create(req, dto);
  }

  @Patch(':id')
  update(@Req() req: any, @Param('id') id: string, @Body() dto: UpdateActivityDto) {
    return this.service.update(req, id, dto);
  }

  @Delete(':id')
  remove(@Req() req: any, @Param('id') id: string) {
    return this.service.remove(req, id);
  }
}
