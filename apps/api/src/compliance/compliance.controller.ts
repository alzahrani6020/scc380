import {
  Controller, Get, Post, Body, Request, UseGuards, Param, Query, Res,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { ComplianceService } from './compliance.service';
import { Response } from 'express';

@ApiTags('Compliance')
@Controller('compliance')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class ComplianceController {
  constructor(private service: ComplianceService) {}

  // ─── PDPL Consent ────────────────────────────────────────────────────
  @Post('consents')
  async createConsent(@Request() req: any, @Body() body: any) {
    return this.service.createConsent(req.user.tenantId, body);
  }

  @Get('consents')
  async getConsents(
    @Request() req: any,
    @Query('subjectType') subjectType?: string,
    @Query('subjectId') subjectId?: string,
    @Query('granted') granted?: string,
  ) {
    return this.service.getConsents(req.user.tenantId, {
      subjectType,
      subjectId,
      granted: granted !== undefined ? granted === 'true' : undefined,
    });
  }

  @Post('consents/:id/withdraw')
  async withdrawConsent(@Request() req: any, @Param('id') id: string) {
    return this.service.withdrawConsent(req.user.tenantId, id, req.user.userId);
  }

  @Get('consents/status')
  async getConsentStatus(
    @Request() req: any,
    @Query('subjectType') subjectType: string,
    @Query('subjectId') subjectId: string,
  ) {
    return this.service.getConsentStatus(req.user.tenantId, subjectType, subjectId);
  }

  // ─── WPS Export ──────────────────────────────────────────────────────
  @Get('wps/export')
  async exportWps(
    @Request() req: any,
    @Query('month') month: string,
    @Query('year') year: string,
    @Res() res: Response,
  ) {
    const content = await this.service.exportWpsFile(
      req.user.tenantId,
      parseInt(month),
      parseInt(year),
    );
    res.setHeader('Content-Type', 'text/plain');
    res.setHeader('Content-Disposition', `attachment; filename="WPS_${year}_${month}.sif"`);
    res.send(content);
  }

  // ─── Qiwa ────────────────────────────────────────────────────────────
  @Post('qiwa/sync')
  async syncQiwa(@Request() req: any) {
    return this.service.syncQiwaContracts(req.user.tenantId);
  }

  // ─── Compliance Report ───────────────────────────────────────────────
  @Get('report')
  async getReport(@Request() req: any) {
    return this.service.getComplianceReport(req.user.tenantId);
  }
}
