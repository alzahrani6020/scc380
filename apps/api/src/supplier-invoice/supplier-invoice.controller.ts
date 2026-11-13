import { Controller, Get, Post, Delete, Body, Param, Req, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionsGuard, RequirePermissions } from '../auth/guards/permissions.guard';
import { SupplierInvoiceService } from './supplier-invoice.service';

@Controller('supplier-invoices')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class SupplierInvoiceController {
  constructor(private readonly service: SupplierInvoiceService) {}

  @Get()
  @RequirePermissions('erp:read')
  findAll(@Req() req: any) {
    return this.service.findAll(req.user?.tenantId, req.user?.role);
  }

  @Get(':id')
  @RequirePermissions('erp:read')
  findOne(@Param('id') id: string, @Req() req: any) {
    return this.service.findOne(id, req.user?.tenantId, req.user?.role);
  }

  @Post()
  @RequirePermissions('erp:write')
  create(@Req() req: any, @Body() data: any) {
    return this.service.create(req.user?.tenantId, data);
  }

  @Post(':id/payments')
  @RequirePermissions('erp:write')
  addPayment(@Param('id') id: string, @Req() req: any, @Body() data: any) {
    return this.service.addPayment(id, req.user?.tenantId, req.user?.role, data);
  }

  @Delete(':id')
  @RequirePermissions('erp:write')
  remove(@Param('id') id: string, @Req() req: any) {
    return this.service.remove(id, req.user?.tenantId, req.user?.role);
  }
}
