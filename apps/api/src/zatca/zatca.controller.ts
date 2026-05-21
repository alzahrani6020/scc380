import { Controller, Get, Param, Request, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { ZatcaService } from './zatca.service';
import { prisma, tenantWhere } from '@scc/database';

@ApiTags('ZATCA')
@Controller('zatca')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class ZatcaController {
  constructor(private service: ZatcaService) {}

  @Get('invoices/:id/xml')
  async generateXml(@Param('id') id: string, @Request() req: any) {
    const tw = req.user.role === 'SUPER_ADMIN' ? {} : tenantWhere(req.user.tenantId);
    const invoice = await prisma.invoice.findFirst({
      where: { id, ...tw },
      include: { items: true, contact: true },
    });

    if (!invoice) {
      return { error: 'الفاتورة غير موجودة' };
    }

    const xml = this.service.generateXml(invoice);
    return { xml, invoiceNumber: invoice.invoiceNumber };
  }

  @Get('invoices/:id/qr')
  async generateQr(@Param('id') id: string, @Request() req: any) {
    const tw = req.user.role === 'SUPER_ADMIN' ? {} : tenantWhere(req.user.tenantId);
    const invoice = await prisma.invoice.findFirst({
      where: { id, ...tw },
      include: { items: true },
    });

    if (!invoice) {
      return { error: 'الفاتورة غير موجودة' };
    }

    const qrData = this.service.generateTlv(invoice);
    return { qrData, invoiceNumber: invoice.invoiceNumber };
  }
}
