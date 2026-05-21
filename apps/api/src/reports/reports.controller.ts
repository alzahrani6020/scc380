import { Controller, Get, Param, Query, Request, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { ReportsService } from './reports.service';

@ApiTags('Financial Reports')
@Controller('reports')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class ReportsController {
  constructor(private service: ReportsService) {}

  @Get('trial-balance')
  getTrialBalance(@Request() req: any) {
    return this.service.getTrialBalance(req.user.tenantId, req.user.role);
  }

  @Get('income-statement')
  getIncomeStatement(@Request() req: any) {
    return this.service.getIncomeStatement(req.user.tenantId, req.user.role);
  }

  @Get('balance-sheet')
  getBalanceSheet(@Request() req: any) {
    return this.service.getBalanceSheet(req.user.tenantId, req.user.role);
  }

  @Get('general-ledger/:accountId')
  getGeneralLedger(@Param('accountId') accountId: string, @Request() req: any) {
    return this.service.getGeneralLedger(accountId, req.user.tenantId, req.user.role);
  }

  @Get('vat')
  getVatReport(@Request() req: any, @Query('from') from?: string, @Query('to') to?: string) {
    return this.service.getVatReport(req.user.tenantId, req.user.role, from, to);
  }

  @Get('cash-flow')
  getCashFlow(@Request() req: any) {
    return this.service.getCashFlow(req.user.tenantId, req.user.role);
  }
}
