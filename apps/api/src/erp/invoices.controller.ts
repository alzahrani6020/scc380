import { Controller, Get, Post, Patch, Delete, Body, Param, Query, Request, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionsGuard, RequirePermissions } from '../auth/guards/permissions.guard';
import { InvoicesService } from './invoices.service';

@ApiTags('ERP - Invoices')
@UseGuards(JwtAuthGuard, PermissionsGuard)
@ApiBearerAuth()
@Controller('erp/invoices')
export class InvoicesController {
  constructor(private readonly invoicesService: InvoicesService) {}

  @Get()
  @RequirePermissions('erp:read')
  findAll(@Request() req, @Query('status') status?: string, @Query('search') search?: string) {
    return this.invoicesService.findAll(req.user.tenantId, { status, search });
  }

  @Get(':id')
  @RequirePermissions('erp:read')
  findOne(@Request() req, @Param('id') id: string) {
    return this.invoicesService.findOne(req.user.tenantId, id);
  }

  @Post()
  @RequirePermissions('erp:write')
  create(@Request() req, @Body() body: any) {
    return this.invoicesService.create(req.user.tenantId, body);
  }

  @Patch(':id')
  @RequirePermissions('erp:write')
  update(@Request() req, @Param('id') id: string, @Body() body: any) {
    return this.invoicesService.update(req.user.tenantId, id, body);
  }

  @Delete(':id')
  @RequirePermissions('erp:write')
  remove(@Request() req, @Param('id') id: string) {
    return this.invoicesService.delete(req.user.tenantId, id);
  }
}
