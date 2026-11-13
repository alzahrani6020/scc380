import { Body, Controller, Get, Param, Patch, Post, Query, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsIn, IsNumber, IsOptional, IsString, Min } from 'class-validator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionsGuard, RequirePermissions } from '../auth/guards/permissions.guard';
import { EmployeeLoansService } from './employee-loans.service';

class CreateEmployeeLoanDto {
  @IsString() employeeId: string;
  @IsIn(['LOAN', 'ADVANCE']) @IsOptional() type?: string;
  @Type(() => Number) @IsNumber() @Min(0.01) principal: number;
  @Type(() => Number) @IsNumber() @Min(0.01) installmentAmount: number;
  @IsString() startDate: string;
  @IsString() @IsOptional() notes?: string;
}
class UpdateEmployeeLoanDto {
  @IsIn(['LOAN', 'ADVANCE']) @IsOptional() type?: string;
  @Type(() => Number) @IsNumber() @Min(0.01) @IsOptional() principal?: number;
  @Type(() => Number) @IsNumber() @Min(0.01) @IsOptional() installmentAmount?: number;
  @IsString() @IsOptional() startDate?: string;
  @IsString() @IsOptional() notes?: string;
}
class RepayEmployeeLoanDto {
  @Type(() => Number) @IsNumber() @Min(0.01) amount: number;
  @IsString() cashAccountId: string;
  @IsString() loanReceivableAccountId: string;
  @IsString() @IsOptional() notes?: string;
}

class PostLoanDisbursementAccountingDto {
  @IsString() cashAccountId: string;
  @IsString() loanReceivableAccountId: string;
}

@ApiTags('HR - Employee Loans')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('hr/employee-loans')
export class EmployeeLoansController {
  constructor(private readonly service: EmployeeLoansService) {}

  @Get()
  @RequirePermissions('hr:loans:read')
  findAll(@Req() req: any, @Query() query: any) { return this.service.findAll(req, query); }

  @Get(':id')
  @RequirePermissions('hr:loans:read')
  findOne(@Req() req: any, @Param('id') id: string) { return this.service.findOne(req, id); }

  @Post()
  @RequirePermissions('hr:loans:write')
  create(@Req() req: any, @Body() dto: CreateEmployeeLoanDto) { return this.service.create(req, dto); }

  @Patch(':id')
  @RequirePermissions('hr:loans:write')
  update(@Req() req: any, @Param('id') id: string, @Body() dto: UpdateEmployeeLoanDto) { return this.service.updateDraft(req, id, dto); }

  @Post(':id/approve')
  @RequirePermissions('hr:loans:write')
  approve(@Req() req: any, @Param('id') id: string) { return this.service.approve(req, id); }

  @Post(':id/post-disbursement-accounting')
  @RequirePermissions('hr:loans:write', 'erp:write')
  postDisbursementAccounting(@Req() req: any, @Param('id') id: string, @Body() dto: PostLoanDisbursementAccountingDto) {
    return this.service.postDisbursementAccounting(req, id, dto);
  }

  @Post(':id/repay')
  @RequirePermissions('hr:loans:write', 'erp:write')
  repay(@Req() req: any, @Param('id') id: string, @Body() dto: RepayEmployeeLoanDto) { return this.service.repay(req, id, dto); }

  @Post(':id/cancel')
  @RequirePermissions('hr:loans:write')
  cancel(@Req() req: any, @Param('id') id: string) { return this.service.cancelDraft(req, id); }
}
