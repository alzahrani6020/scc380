import { Controller, Get, Post, Patch, Delete, Body, Param, Headers } from '@nestjs/common';
import { StockTransferService } from './stock-transfer.service';

@Controller('stock-transfers')
export class StockTransferController {
  constructor(private readonly service: StockTransferService) {}

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

  @Patch(':id/status')
  updateStatus(@Param('id') id: string, @Headers('x-tenant-id') tenantId: string, @Headers('x-user-role') role: string = 'SUPER_ADMIN', @Body('status') status: string) {
    return this.service.updateStatus(id, tenantId, role, status);
  }

  @Delete(':id')
  remove(@Param('id') id: string, @Headers('x-tenant-id') tenantId: string, @Headers('x-user-role') role: string = 'SUPER_ADMIN') {
    return this.service.remove(id, tenantId, role);
  }
}
