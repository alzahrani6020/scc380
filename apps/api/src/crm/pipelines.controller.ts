import { Body, Controller, Delete, Get, Param, Patch, Post, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { IsBoolean, IsInt, IsOptional, IsString, Max, MaxLength, Min, MinLength } from 'class-validator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionsGuard, RequirePermissions } from '../auth/guards/permissions.guard';
import { PipelinesService } from './pipelines.service';

export class CreatePipelineDto {
  @IsString() @MinLength(1) @MaxLength(150) name: string;
  @IsOptional() @IsString() @MaxLength(500) description?: string;
  @IsOptional() @IsBoolean() isDefault?: boolean;
  @IsOptional() @IsBoolean() isActive?: boolean;
}
export class UpdatePipelineDto {
  @IsOptional() @IsString() @MinLength(1) @MaxLength(150) name?: string;
  @IsOptional() @IsString() @MaxLength(500) description?: string;
  @IsOptional() @IsBoolean() isDefault?: boolean;
  @IsOptional() @IsBoolean() isActive?: boolean;
}
export class CreateStageDto {
  @IsString() @MinLength(1) @MaxLength(100) name: string;
  @IsString() @MinLength(1) @MaxLength(50) code: string;
  @IsInt() @Min(0) order: number;
  @IsInt() @Min(0) @Max(100) probability: number;
  @IsOptional() @IsString() @MaxLength(30) color?: string;
  @IsOptional() @IsBoolean() isWon?: boolean;
  @IsOptional() @IsBoolean() isLost?: boolean;
  @IsOptional() @IsBoolean() isActive?: boolean;
}
export class UpdateStageDto {
  @IsOptional() @IsString() @MinLength(1) @MaxLength(100) name?: string;
  @IsOptional() @IsString() @MinLength(1) @MaxLength(50) code?: string;
  @IsOptional() @IsInt() @Min(0) order?: number;
  @IsOptional() @IsInt() @Min(0) @Max(100) probability?: number;
  @IsOptional() @IsString() @MaxLength(30) color?: string;
  @IsOptional() @IsBoolean() isWon?: boolean;
  @IsOptional() @IsBoolean() isLost?: boolean;
  @IsOptional() @IsBoolean() isActive?: boolean;
}

@ApiTags('CRM - Pipelines')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('crm/pipelines')
export class PipelinesController {
  constructor(private readonly service: PipelinesService) {}

  @Get()
  @RequirePermissions('crm:read')
  findAll(@Req() req: any) { return this.service.findAll(req); }

  @Get(':id')
  @RequirePermissions('crm:read')
  findOne(@Req() req: any, @Param('id') id: string) { return this.service.findOne(req, id); }

  @Post()
  @RequirePermissions('crm:write')
  create(@Req() req: any, @Body() dto: CreatePipelineDto) { return this.service.create(req, dto); }

  @Patch(':id')
  @RequirePermissions('crm:write')
  update(@Req() req: any, @Param('id') id: string, @Body() dto: UpdatePipelineDto) {
    return this.service.update(req, id, dto);
  }

  @Delete(':id')
  @RequirePermissions('crm:write')
  remove(@Req() req: any, @Param('id') id: string) { return this.service.remove(req, id); }

  @Post(':id/stages')
  @RequirePermissions('crm:write')
  createStage(@Req() req: any, @Param('id') id: string, @Body() dto: CreateStageDto) {
    return this.service.createStage(req, id, dto);
  }

  @Patch(':id/stages/:stageId')
  @RequirePermissions('crm:write')
  updateStage(@Req() req: any, @Param('id') id: string, @Param('stageId') stageId: string, @Body() dto: UpdateStageDto) {
    return this.service.updateStage(req, id, stageId, dto);
  }

  @Delete(':id/stages/:stageId')
  @RequirePermissions('crm:write')
  removeStage(@Req() req: any, @Param('id') id: string, @Param('stageId') stageId: string) {
    return this.service.removeStage(req, id, stageId);
  }
}
