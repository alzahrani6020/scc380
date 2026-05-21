import { Controller, Get, Post, Delete, Body, Param, Headers } from '@nestjs/common';
import { SupplierInvoiceService } from './supplier-invoice.service';

@Controller('supplier-invoices')
export class SupplierInvoiceController {
  constructor(private readonly service: SupplierInvoiceService) {}

  @Get()
  findAll(@Headers('x-tenant-id') tenantId: string, @Headers('x-user-role') role: string = 'SUPER_ADMIN') {
    return this.service.findAll(tenantId, role);
  }

  @Get(':id')
  findOne(@Param('id') id: string, @Headers('x-tenant-id') tenantId: string, @Headers('x-user-role') role: string = 'SUPER_ADMIN') {
    return this.service.findOne(id, tenantId, role);
  }

  @Post()
  create(@Headers('x-tenant-id') tenantId: string, @Body() data: any) {
    return this.service.create(tenantId, data);
  }

  @Post(':id/payments')
  addPayment(@Param('id') id: string, @Headers('x-tenant-id') tenantId: string, @Headers('x-user-role') role: string = 'SUPER_ADMIN', @Body() data: any) {
    return this.service.addPayment(id, tenantId, role, data);
  }

  @Delete(':id')
  remove(@Param('id') id: string, @Headers('x-tenant-id') tenantId: string, @Headers('x-user-role') role: string = 'SUPER_ADMIN') {
    return this.service.remove(id, tenantId, role);
  }
}
