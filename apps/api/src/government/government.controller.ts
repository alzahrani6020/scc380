import { Controller, Post, Get, Body, Param, UseGuards, Request } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { GovernmentService } from './government.service';

@ApiTags('Government')
@Controller('government')
export class GovernmentController {
  constructor(private govService: GovernmentService) {}

  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @Post('zatca/invoice')
  async generateZatcaInvoice(@Request() req, @Body() body: { invoiceId: string }) {
    return this.govService.generateZatcaInvoice(req.user.tenantId, body.invoiceId);
  }

  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @Get('absher/verify/:idNumber')
  async verifyAbsher(@Param('idNumber') idNumber: string) {
    return this.govService.verifyAbsherIdentity(idNumber);
  }

  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @Post('moi/validate-cr')
  async validateCR(@Body() body: { crNumber: string }) {
    return this.govService.validateCommercialRegistration(body.crNumber);
  }
}
