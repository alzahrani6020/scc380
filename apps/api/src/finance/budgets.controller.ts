import { Body, Controller, Delete, Get, Param, Patch, Post, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { IsInt, IsNumber, IsOptional, IsString, Max, Min } from 'class-validator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionsGuard, RequirePermissions } from '../auth/guards/permissions.guard';
import { BudgetsService } from './budgets.service';

class CreateBudgetPlanDto {
  @IsInt() year: number;
  @IsString() @IsOptional() name?: string;
  @IsString() @IsOptional() notes?: string;
}

class BudgetLineDto {
  @IsInt() @Min(1) @Max(12) month: number;
  @IsString() accountId: string;
  @IsString() @IsOptional() costCenterId?: string;
  @IsNumber() amount: number;
  @IsString() @IsOptional() notes?: string;
}

class UpdateBudgetLineDto {
  @IsInt() @Min(1) @Max(12) @IsOptional() month?: number;
  @IsString() @IsOptional() accountId?: string;
  @IsString() @IsOptional() costCenterId?: string;
  @IsNumber() @IsOptional() amount?: number;
  @IsString() @IsOptional() notes?: string;
}

@ApiTags('Finance - Budgets')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('finance/budgets')
export class BudgetsController {
  constructor(private readonly service: BudgetsService) {}

  @Get()
  @RequirePermissions('erp:read')
  findAll(@Req() req: any) {
    return this.service.findAll(req);
  }

  @Get(':id')
  @RequirePermissions('erp:read')
  findOne(@Req() req: any, @Param('id') id: string) {
    return this.service.findOne(req, id);
  }

  @Post()
  @RequirePermissions('erp:write')
  create(@Req() req: any, @Body() dto: CreateBudgetPlanDto) {
    return this.service.create(req, dto);
  }

  @Post(':id/lines')
  @RequirePermissions('erp:write')
  addLine(@Req() req: any, @Param('id') id: string, @Body() dto: BudgetLineDto) {
    return this.service.addLine(req, id, dto);
  }

  @Patch(':id/lines/:lineId')
  @RequirePermissions('erp:write')
  updateLine(
    @Req() req: any,
    @Param('id') id: string,
    @Param('lineId') lineId: string,
    @Body() dto: UpdateBudgetLineDto,
  ) {
    return this.service.updateLine(req, id, lineId, dto);
  }

  @Delete(':id/lines/:lineId')
  @RequirePermissions('erp:write')
  removeLine(@Req() req: any, @Param('id') id: string, @Param('lineId') lineId: string) {
    return this.service.removeLine(req, id, lineId);
  }

  @Post(':id/approve')
  @RequirePermissions('erp:write')
  approve(@Req() req: any, @Param('id') id: string) {
    return this.service.approve(req, id);
  }

  @Post(':id/reopen')
  @RequirePermissions('erp:write')
  reopen(@Req() req: any, @Param('id') id: string) {
    return this.service.reopen(req, id);
  }

  @Get(':id/report')
  @RequirePermissions('erp:read')
  report(@Req() req: any, @Param('id') id: string) {
    return this.service.report(req, id);
  }
}
