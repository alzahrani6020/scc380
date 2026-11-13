import { Body, Controller, Get, Param, Post, Query, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsBoolean, IsIn, IsNumber, IsOptional, IsString, Min } from 'class-validator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionsGuard, RequirePermissions } from '../auth/guards/permissions.guard';
import { END_SERVICE_REASONS, SETTLEMENT_INITIATORS } from './end-service-calculator';
import { EndServiceSettlementsService } from './end-service-settlements.service';

class SettlementDto {
  @IsString() employeeId: string;
  @IsIn([...END_SERVICE_REASONS]) reason: string;
  @IsIn([...SETTLEMENT_INITIATORS]) initiatedBy: string;
  @IsString() lastWorkingDate: string;
  @Type(() => Number) @IsNumber() @Min(0) @IsOptional() lastWage?: number;
  @Type(() => Number) @IsNumber() @Min(0) @IsOptional() leaveEncashment?: number;
  @Type(() => Number) @IsNumber() @Min(0) @IsOptional() unpaidSalary?: number;
  @Type(() => Number) @IsNumber() @Min(0) @IsOptional() otherEntitlements?: number;
  @Type(() => Number) @IsNumber() @Min(0) @IsOptional() compensation?: number;
  @Type(() => Number) @IsNumber() @Min(0) @IsOptional() otherDeductions?: number;
  @IsBoolean() @IsOptional() deductOutstandingLoans?: boolean;
  @IsString() @IsOptional() notes?: string;
}


class PostSettlementAccountingDto {
  @IsString() settlementPayableAccountId: string;
  @IsString() @IsOptional() eosExpenseAccountId?: string;
  @IsString() @IsOptional() leaveEncashmentAccountId?: string;
  @IsString() @IsOptional() unpaidSalaryAccountId?: string;
  @IsString() @IsOptional() otherEntitlementsAccountId?: string;
  @IsString() @IsOptional() compensationAccountId?: string;
  @IsString() @IsOptional() loanReceivableAccountId?: string;
  @IsString() @IsOptional() otherDeductionAccountId?: string;
}

class PostSettlementPaymentAccountingDto {
  @IsString() cashAccountId: string;
}

@ApiTags('HR - End Service Settlements')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('hr/end-service-settlements')
export class EndServiceSettlementsController {
  constructor(private readonly service: EndServiceSettlementsService) {}

  @Get()
  @RequirePermissions('hr:settlements:read')
  findAll(@Req() req: any, @Query() query: any) { return this.service.findAll(req, query); }

  @Get(':id')
  @RequirePermissions('hr:settlements:read')
  findOne(@Req() req: any, @Param('id') id: string) { return this.service.findOne(req, id); }

  @Post('preview')
  @RequirePermissions('hr:settlements:read')
  preview(@Req() req: any, @Body() dto: SettlementDto) { return this.service.preview(req, dto); }

  @Post()
  @RequirePermissions('hr:settlements:write')
  create(@Req() req: any, @Body() dto: SettlementDto) { return this.service.create(req, dto); }

  @Post(':id/approve')
  @RequirePermissions('hr:settlements:write')
  approve(@Req() req: any, @Param('id') id: string) { return this.service.approve(req, id); }

  @Post(':id/post-accounting')
  @RequirePermissions('hr:settlements:write', 'erp:write')
  postAccounting(@Req() req: any, @Param('id') id: string, @Body() dto: PostSettlementAccountingDto) {
    return this.service.postAccounting(req, id, dto);
  }

  @Post(':id/post-payment-accounting')
  @RequirePermissions('hr:settlements:write', 'erp:write')
  postPaymentAccounting(@Req() req: any, @Param('id') id: string, @Body() dto: PostSettlementPaymentAccountingDto) {
    return this.service.postPaymentAccounting(req, id, dto);
  }

  @Post(':id/pay')
  @RequirePermissions('hr:settlements:write')
  pay(@Req() req: any, @Param('id') id: string) { return this.service.pay(req, id); }

  @Post(':id/cancel')
  @RequirePermissions('hr:settlements:write')
  cancel(@Req() req: any, @Param('id') id: string) { return this.service.cancelDraft(req, id); }
}
