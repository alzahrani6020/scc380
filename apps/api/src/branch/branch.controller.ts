import { Controller, Get, Post, Patch, Delete, Body, Param, Headers } from '@nestjs/common';
import { BranchService } from './branch.service';

@Controller('branches')
export class BranchController {
  constructor(private readonly service: BranchService) {}

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

  @Get(':id/stats')
  getStats(@Param('id') id: string, @Headers('x-tenant-id') tenantId: string, @Headers('x-user-role') role: string = 'SUPER_ADMIN') {
    return this.service.getStats(id, tenantId, role);
  }
}
