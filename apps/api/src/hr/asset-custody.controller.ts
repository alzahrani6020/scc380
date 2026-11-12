import { Body, Controller, Get, Param, Post, Query, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsIn, IsInt, IsNumber, IsOptional, IsString, Min } from 'class-validator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionsGuard, RequirePermissions } from '../auth/guards/permissions.guard';
import { HrAssetCustodyService } from './asset-custody.service';

class CreateAssetCategoryDto {
  @IsString() name: string;
  @IsString() @IsOptional() code?: string;
  @Type(() => Number) @IsNumber() @Min(0) @IsOptional() depreciationRate?: number;
  @Type(() => Number) @IsInt() @Min(1) @IsOptional() usefulLifeYears?: number;
  @IsIn(['STRAIGHT_LINE','DECLINING_BALANCE','UNITS_OF_PRODUCTION']) @IsOptional() depreciationMethod?: string;
}
class CreateFixedAssetDto {
  @IsString() name: string;
  @IsString() @IsOptional() code?: string;
  @IsString() categoryId: string;
  @Type(() => Number) @IsNumber() @Min(0) acquisitionCost: number;
  @Type(() => Number) @IsNumber() @Min(0) @IsOptional() salvageValue?: number;
  @Type(() => Number) @IsInt() @Min(1) @IsOptional() usefulLifeYears?: number;
  @IsIn(['STRAIGHT_LINE','DECLINING_BALANCE','UNITS_OF_PRODUCTION']) @IsOptional() depreciationMethod?: string;
  @IsString() purchaseDate: string;
  @IsString() @IsOptional() startDate?: string;
  @IsString() @IsOptional() location?: string;
  @IsString() @IsOptional() notes?: string;
}
class AssignAssetDto {
  @IsString() assetId: string;
  @IsString() employeeId: string;
  @IsString() @IsOptional() assignedAt?: string;
  @IsString() @IsOptional() expectedReturnAt?: string;
  @IsString() @IsOptional() conditionOut?: string;
  @IsString() @IsOptional() notes?: string;
}
class CloseCustodyDto {
  @IsIn(['RETURNED','LOST','DAMAGED']) status: string;
  @IsString() @IsOptional() conditionIn?: string;
  @IsString() @IsOptional() notes?: string;
}

@ApiTags('HR - Asset Custody')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('hr/assets')
export class HrAssetCustodyController {
  constructor(private readonly service: HrAssetCustodyService) {}

  @Get('categories')
  @RequirePermissions('hr:assets:read')
  categories(@Req() req: any) { return this.service.listCategories(req); }

  @Post('categories')
  @RequirePermissions('erp:write')
  createCategory(@Req() req: any, @Body() dto: CreateAssetCategoryDto) {
    return this.service.createCategory(req, dto);
  }

  @Get()
  @RequirePermissions('hr:assets:read')
  assets(@Req() req: any, @Query() query: any) { return this.service.listAssets(req, query); }

  @Post()
  @RequirePermissions('erp:write')
  createAsset(@Req() req: any, @Body() dto: CreateFixedAssetDto) {
    return this.service.createAsset(req, dto);
  }

  @Get('custody/assignments')
  @RequirePermissions('hr:assets:read')
  assignments(@Req() req: any, @Query() query: any) {
    return this.service.listAssignments(req, query);
  }

  @Post('custody/assign')
  @RequirePermissions('hr:assets:write')
  assign(@Req() req: any, @Body() dto: AssignAssetDto) {
    return this.service.assign(req, dto);
  }

  @Post('custody/:id/close')
  @RequirePermissions('hr:assets:write')
  close(@Req() req: any, @Param('id') id: string, @Body() dto: CloseCustodyDto) {
    return this.service.closeAssignment(req, id, dto);
  }
}

@ApiTags('HR - Self Asset Custody')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('hr/self/assets')
export class HrSelfAssetCustodyController {
  constructor(private readonly service: HrAssetCustodyService) {}

  @Get()
  list(@Req() req: any) { return this.service.selfAssignments(req); }
}
