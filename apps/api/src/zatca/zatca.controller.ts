import { Controller, Get, Post, Param, Request, UseGuards, Body, Res, Query, BadRequestException } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { ZatcaService } from './zatca.service';
import { ZatcaCredentialService } from './zatca-credential.service';
import { Response } from 'express';

@ApiTags('ZATCA')
@Controller('zatca')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class ZatcaController {
  constructor(
    private service: ZatcaService,
    private credentialService: ZatcaCredentialService,
  ) {}

  // ─── Credential Management ───────────────────────────────────────────
  @Post('credentials/csr')
  async generateCSR(
    @Request() req: any,
    @Body('otp') otp: string,
  ) {
    if (!otp) throw new BadRequestException('OTP مطلوب');
    return this.credentialService.generateCSR(req.user.tenantId, otp);
  }

  @Post('credentials/csid')
  async requestCSID(
    @Request() req: any,
    @Query('environment') environment?: 'SANDBOX' | 'PRODUCTION',
  ) {
    return this.credentialService.requestCSID(req.user.tenantId, environment || 'SANDBOX');
  }

  @Post('credentials/renew')
  async renewCSID(@Request() req: any) {
    return this.credentialService.renewCSID(req.user.tenantId);
  }

  @Get('credentials/status')
  async getCredentialStatus(@Request() req: any) {
    return this.credentialService.getStatus(req.user.tenantId);
  }

  // ─── Invoice Operations ──────────────────────────────────────────────
  @Post('invoices/:id/sign')
  async signInvoice(@Param('id') id: string, @Request() req: any) {
    return this.service.signInvoice(id, req.user.tenantId);
  }

  @Post('invoices/:id/clearance')
  async clearanceInvoice(@Param('id') id: string, @Request() req: any) {
    return this.service.clearanceInvoice(id, req.user.tenantId);
  }

  @Post('invoices/:id/report')
  async reportInvoice(@Param('id') id: string, @Request() req: any) {
    return this.service.reportInvoice(id, req.user.tenantId);
  }

  @Get('invoices/:id/xml')
  async getXml(@Param('id') id: string, @Request() req: any) {
    const invoice = await this.service.signInvoice(id, req.user.tenantId);
    return { xml: invoice.xml, uuid: invoice.uuid };
  }

  @Get('invoices/:id/pdf')
  async getPdf(@Param('id') id: string, @Request() req: any, @Res() res: Response) {
    const pdfBuffer = await this.service.generatePdfA3(id, req.user.tenantId);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="invoice-${id}.pdf"`);
    res.send(pdfBuffer);
  }

  // ─── Credit/Debit Notes ──────────────────────────────────────────────
  @Post('credit-note')
  async createCreditNote(
    @Request() req: any,
    @Body() body: { originalInvoiceId: string; reason: string },
  ) {
    return this.service.createCreditNote(body.originalInvoiceId, req.user.tenantId, body.reason);
  }

  @Post('debit-note')
  async createDebitNote(
    @Request() req: any,
    @Body() body: { originalInvoiceId: string; reason: string; additionalAmount: number },
  ) {
    return this.service.createDebitNote(body.originalInvoiceId, req.user.tenantId, body.reason, body.additionalAmount);
  }
}
