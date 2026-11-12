import { Body, Controller, Delete, Get, Param, Patch, Post, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { IsDateString, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionsGuard, RequirePermissions } from '../auth/guards/permissions.guard';
import { FinancialPeriodsService } from './financial-periods.service';

class CreateFinancialPeriodDto {
  @IsString() name: string;
  @IsInt() year: number;
  @IsInt() @Min(1) @Max(12) @IsOptional() month?: number;
  @IsDateString() startDate: string;
  @IsDateString() endDate: string;
}

class UpdateFinancialPeriodDto {
  @IsString() @IsOptional() name?: string;
  @IsInt() @IsOptional() year?: number;
  @IsInt() @Min(1) @Max(12) @IsOptional() month?: number | null;
  @IsDateString() @IsOptional() startDate?: string;
  @IsDateString() @IsOptional() endDate?: string;
}

@ApiTags('Finance - Financial Periods')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('finance/financial-periods')
export class FinancialPeriodsController {
  constructor(private readonly service: FinancialPeriodsService) {}

  @Get()
  @RequirePermissions('erp:read')
  findAll(@Req() req: any) {
    return this.service.findAll(req);
  }

  @Post()
  @RequirePermissions('erp:write')
  create(@Req() req: any, @Body() dto: CreateFinancialPeriodDto) {
    return this.service.create(req, dto);
  }

  @Patch(':id')
  @RequirePermissions('erp:write')
  update(@Req() req: any, @Param('id') id: string, @Body() dto: UpdateFinancialPeriodDto) {
    return this.service.update(req, id, dto);
  }

  @Post(':id/close')
  @RequirePermissions('erp:write')
  close(@Req() req: any, @Param('id') id: string) {
    return this.service.close(req, id);
  }

  @Post(':id/reopen')
  @RequirePermissions('erp:write')
  reopen(@Req() req: any, @Param('id') id: string) {
    return this.service.reopen(req, id);
  }

  @Delete(':id')
  @RequirePermissions('erp:write')
  remove(@Req() req: any, @Param('id') id: string) {
    return this.service.remove(req, id);
  }
}
