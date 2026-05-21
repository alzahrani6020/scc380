import { Controller, Get, Post, Patch, Delete, Body, Param, Headers, Query } from '@nestjs/common';
import { SupplierService } from './supplier.service';

@Controller('suppliers')
export class SupplierController {
  constructor(private readonly service: SupplierService) {}

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

  @Patch(':id')
  update(@Param('id') id: string, @Headers('x-tenant-id') tenantId: string, @Headers('x-user-role') role: string = 'SUPER_ADMIN', @Body() data: any) {
    return this.service.update(id, tenantId, role, data);
  }

  @Delete(':id')
  remove(@Param('id') id: string, @Headers('x-tenant-id') tenantId: string, @Headers('x-user-role') role: string = 'SUPER_ADMIN') {
    return this.service.remove(id, tenantId, role);
  }

  @Get(':id/statement')
  getStatement(@Param('id') id: string, @Headers('x-tenant-id') tenantId: string, @Headers('x-user-role') role: string = 'SUPER_ADMIN') {
    return this.service.getStatement(id, tenantId, role);
  }
}
