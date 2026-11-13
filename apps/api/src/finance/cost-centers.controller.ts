import { Body, Controller, Delete, Get, Param, Patch, Post, Query, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { IsBoolean, IsNumber, IsOptional, IsString } from 'class-validator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionsGuard, RequirePermissions } from '../auth/guards/permissions.guard';
import { CostCentersService } from './cost-centers.service';

class CreateCostCenterDto {
  @IsString() name: string;
  @IsString() @IsOptional() code?: string;
  @IsString() @IsOptional() type?: string;
  @IsNumber() @IsOptional() budget?: number;
  @IsBoolean() @IsOptional() isActive?: boolean;
}

class UpdateCostCenterDto {
  @IsString() @IsOptional() name?: string;
  @IsString() @IsOptional() code?: string;
  @IsString() @IsOptional() type?: string;
  @IsNumber() @IsOptional() budget?: number | null;
  @IsBoolean() @IsOptional() isActive?: boolean;
}

@ApiTags('Finance - Cost Centers')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('finance/cost-centers')
export class CostCentersController {
  constructor(private readonly service: CostCentersService) {}

  @Get()
  @RequirePermissions('erp:read')
  findAll(@Req() req: any) {
    return this.service.findAll(req);
  }

  @Get(':id/report')
  @RequirePermissions('erp:read')
  report(
    @Req() req: any,
    @Param('id') id: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    return this.service.report(req, id, from, to);
  }

  @Get(':id')
  @RequirePermissions('erp:read')
  findOne(@Req() req: any, @Param('id') id: string) {
    return this.service.findOne(req, id);
  }

  @Post()
  @RequirePermissions('erp:write')
  create(@Req() req: any, @Body() dto: CreateCostCenterDto) {
    return this.service.create(req, dto);
  }

  @Patch(':id')
  @RequirePermissions('erp:write')
  update(@Req() req: any, @Param('id') id: string, @Body() dto: UpdateCostCenterDto) {
    return this.service.update(req, id, dto);
  }

  @Delete(':id')
  @RequirePermissions('erp:write')
  remove(@Req() req: any, @Param('id') id: string) {
    return this.service.remove(req, id);
  }
}
