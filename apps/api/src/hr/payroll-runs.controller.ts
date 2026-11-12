import { Body, Controller, Delete, Get, Param, Patch, Post, Query, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, IsNumber, IsOptional, IsString, Max, Min } from 'class-validator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionsGuard, RequirePermissions } from '../auth/guards/permissions.guard';
import { PayrollRunsService } from './payroll-runs.service';

class CreatePayrollRunDto {
  @Type(() => Number) @IsInt() @Min(2000) @Max(2100) year: number;
  @Type(() => Number) @IsInt() @Min(1) @Max(12) month: number;
  @IsString() @IsOptional() notes?: string;
}

class UpdatePayrollRunItemDto {
  @Type(() => Number) @IsNumber() @Min(0) @IsOptional() basicSalary?: number;
  @Type(() => Number) @IsNumber() @Min(0) @IsOptional() housingAllowance?: number;
  @Type(() => Number) @IsNumber() @Min(0) @IsOptional() transportAllowance?: number;
  @Type(() => Number) @IsNumber() @Min(0) @IsOptional() otherAllowances?: number;
  @Type(() => Number) @IsNumber() @Min(0) @IsOptional() gosiDeduction?: number;
  @Type(() => Number) @IsNumber() @Min(0) @IsOptional() taxDeduction?: number;
  @Type(() => Number) @IsNumber() @Min(0) @IsOptional() otherDeductions?: number;
  @IsString() @IsOptional() notes?: string;
}


class PostPayrollAccountingDto {
  @IsString() expenseAccountId: string;
  @IsString() netPayableAccountId: string;
  @IsString() @IsOptional() gosiPayableAccountId?: string;
  @IsString() @IsOptional() taxPayableAccountId?: string;
  @IsString() @IsOptional() otherDeductionAccountId?: string;
  @IsString() @IsOptional() loanReceivableAccountId?: string;
}

@ApiTags('HR - Payroll Runs')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('hr/payroll-runs')
export class PayrollRunsController {
  constructor(private readonly service: PayrollRunsService) {}

  @Get()
  @RequirePermissions('hr:read')
  findAll(@Req() req: any, @Query() query: any) { return this.service.findAll(req, query); }

  @Get(':id')
  @RequirePermissions('hr:read')
  findOne(@Req() req: any, @Param('id') id: string) { return this.service.findOne(req, id); }

  @Post()
  @RequirePermissions('hr:write')
  create(@Req() req: any, @Body() dto: CreatePayrollRunDto) { return this.service.create(req, dto); }

  @Patch(':id/items/:itemId')
  @RequirePermissions('hr:write')
  updateItem(@Req() req: any, @Param('id') id: string, @Param('itemId') itemId: string, @Body() dto: UpdatePayrollRunItemDto) {
    return this.service.updateItem(req, id, itemId, dto);
  }

  @Post(':id/approve')
  @RequirePermissions('hr:write')
  approve(@Req() req: any, @Param('id') id: string) { return this.service.approve(req, id); }

  @Post(':id/pay')
  @RequirePermissions('hr:write')
  pay(@Req() req: any, @Param('id') id: string) { return this.service.pay(req, id); }

  @Post(':id/post-accounting')
  @RequirePermissions('hr:write', 'erp:write')
  postAccounting(@Req() req: any, @Param('id') id: string, @Body() dto: PostPayrollAccountingDto) {
    return this.service.postAccounting(req, id, dto);
  }

  @Delete(':id')
  @RequirePermissions('hr:write')
  remove(@Req() req: any, @Param('id') id: string) { return this.service.removeDraft(req, id); }
}
