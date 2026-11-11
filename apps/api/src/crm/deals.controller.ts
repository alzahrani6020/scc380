import { Controller, Get, Post, Patch, Delete, Body, Param, Query, UseGuards, Req } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionsGuard, RequirePermissions } from '../auth/guards/permissions.guard';
import { DealsService } from './deals.service';
import { IsString, IsOptional, IsNumber, IsEnum, IsInt, Min, Max, IsISO8601, MaxLength } from 'class-validator';
import { DealStage } from '@prisma/client';
import { ListDealsQueryDto } from './dto/list-deals-query.dto';

class CreateDealDto {
  @IsString() @MaxLength(150) title: string;
  @IsString() @MaxLength(2000) @IsOptional() description?: string;
  @IsString() @MaxLength(50) contactId: string;
  @IsNumber() @IsOptional() value?: number;
  @IsString() @MaxLength(10) @IsOptional() currency?: string;
  @IsEnum(DealStage) @IsOptional() stage?: DealStage;
  @IsInt() @Min(0) @Max(100) @IsOptional() probability?: number;
  @IsISO8601() @IsOptional() expectedClose?: string;
  @IsString() @MaxLength(50) @IsOptional() assignedToId?: string;
}

class UpdateDealDto {
  @IsString() @MaxLength(150) @IsOptional() title?: string;
  @IsString() @MaxLength(2000) @IsOptional() description?: string;
  @IsString() @MaxLength(50) @IsOptional() contactId?: string;
  @IsNumber() @IsOptional() value?: number;
  @IsString() @MaxLength(10) @IsOptional() currency?: string;
  @IsEnum(DealStage) @IsOptional() stage?: DealStage;
  @IsInt() @Min(0) @Max(100) @IsOptional() probability?: number;
  @IsISO8601() @IsOptional() expectedClose?: string;
  @IsString() @MaxLength(50) @IsOptional() assignedToId?: string;
}

@ApiTags('CRM - Deals')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('crm/deals')
export class DealsController {
  constructor(private readonly service: DealsService) {}

  @Get()
  @RequirePermissions('crm:read')
  findAll(@Req() req: any, @Query() query: ListDealsQueryDto) {
    return this.service.findAll(req, query);
  }

  @Get(':id')
  @RequirePermissions('crm:read')
  findOne(@Req() req: any, @Param('id') id: string) {
    return this.service.findOne(req, id);
  }

  @Post()
  @RequirePermissions('crm:write')
  create(@Req() req: any, @Body() dto: CreateDealDto) {
    return this.service.create(req, dto);
  }

  @Patch(':id')
  @RequirePermissions('crm:write')
  update(@Req() req: any, @Param('id') id: string, @Body() dto: UpdateDealDto) {
    return this.service.update(req, id, dto);
  }

  @Delete(':id')
  @RequirePermissions('crm:write')
  remove(@Req() req: any, @Param('id') id: string) {
    return this.service.remove(req, id);
  }
}
