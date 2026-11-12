import { Controller, Get, Post, Delete, Body, Param, Req, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { SupplierInvoiceService } from './supplier-invoice.service';

@Controller('supplier-invoices')
@UseGuards(JwtAuthGuard)
export class SupplierInvoiceController {
  constructor(private readonly service: SupplierInvoiceService) {}

  @Get()
  findAll(@Req() req: any) {
    return this.service.findAll(req.user?.tenantId, req.user?.role);
  }

  @Get(':id')
  findOne(@Param('id') id: string, @Req() req: any) {
    return this.service.findOne(id, req.user?.tenantId, req.user?.role);
  }

  @Post()
  create(@Req() req: any, @Body() data: any) {
    return this.service.create(req.user?.tenantId, data);
  }

  @Post(':id/payments')
  addPayment(@Param('id') id: string, @Req() req: any, @Body() data: any) {
    return this.service.addPayment(id, req.user?.tenantId, req.user?.role, data);
  }

  @Delete(':id')
  remove(@Param('id') id: string, @Req() req: any) {
    return this.service.remove(id, req.user?.tenantId, req.user?.role);
  }
}
