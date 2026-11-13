import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import {
  IsDateString,
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  Min,
} from 'class-validator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionsGuard, RequirePermissions } from '../auth/guards/permissions.guard';
import { FixedAssetsService } from './fixed-assets.service';

class CreateCategoryDto {
  @IsString() name: string;
  @IsString() @IsOptional() code?: string;
  @IsNumber() @Min(0) @Max(100) @IsOptional() depreciationRate?: number;
  @IsInt() @Min(1) @IsOptional() usefulLifeYears?: number;
  @IsIn(['STRAIGHT_LINE', 'DECLINING_BALANCE', 'UNITS_OF_PRODUCTION'])
  @IsOptional()
  depreciationMethod?: string;
}

class UpdateCategoryDto extends CreateCategoryDto {}

class CreateAssetDto {
  @IsString() name: string;
  @IsString() @IsOptional() code?: string;
  @IsString() categoryId: string;
  @IsNumber() acquisitionCost: number;
  @IsNumber() @IsOptional() salvageValue?: number;
  @IsInt() @Min(1) @IsOptional() usefulLifeYears?: number;
  @IsIn(['STRAIGHT_LINE', 'DECLINING_BALANCE', 'UNITS_OF_PRODUCTION'])
  @IsOptional()
  depreciationMethod?: string;
  @IsDateString() purchaseDate: string;
  @IsDateString() @IsOptional() startDate?: string;
  @IsString() @IsOptional() location?: string;
  @IsString() @IsOptional() notes?: string;
}

class PostDepreciationDto {
  @IsString() period: string;
  @IsString() expenseAccountId: string;
  @IsString() accumulatedDepreciationAccountId: string;
  @IsString() @IsOptional() entryNumber?: string;
  @IsString() @IsOptional() costCenterId?: string;
  @IsString() @IsOptional() projectId?: string;
  @IsString() @IsOptional() branchId?: string;
}

@ApiTags('Finance - Fixed Assets')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('finance/fixed-assets')
export class FixedAssetsController {
  constructor(private readonly service: FixedAssetsService) {}

  @Get('categories')
  @RequirePermissions('erp:read')
  listCategories(@Req() req: any) {
    return this.service.listCategories(req);
  }

  @Post('categories')
  @RequirePermissions('erp:write')
  createCategory(@Req() req: any, @Body() dto: CreateCategoryDto) {
    return this.service.createCategory(req, dto);
  }

  @Patch('categories/:id')
  @RequirePermissions('erp:write')
  updateCategory(@Req() req: any, @Param('id') id: string, @Body() dto: UpdateCategoryDto) {
    return this.service.updateCategory(req, id, dto);
  }

  @Delete('categories/:id')
  @RequirePermissions('erp:write')
  removeCategory(@Req() req: any, @Param('id') id: string) {
    return this.service.removeCategory(req, id);
  }

  @Get()
  @RequirePermissions('erp:read')
  listAssets(@Req() req: any) {
    return this.service.listAssets(req);
  }

  @Get(':id')
  @RequirePermissions('erp:read')
  findAsset(@Req() req: any, @Param('id') id: string) {
    return this.service.findAsset(req, id);
  }

  @Post()
  @RequirePermissions('erp:write')
  createAsset(@Req() req: any, @Body() dto: CreateAssetDto) {
    return this.service.createAsset(req, dto);
  }

  @Get(':id/depreciation-preview')
  @RequirePermissions('erp:read')
  preview(
    @Req() req: any,
    @Param('id') id: string,
    @Query('period') period: string,
  ) {
    return this.service.previewDepreciation(req, id, period);
  }

  @Post(':id/depreciation')
  @RequirePermissions('erp:write')
  postDepreciation(@Req() req: any, @Param('id') id: string, @Body() dto: PostDepreciationDto) {
    return this.service.postDepreciation(req, id, dto);
  }
}
