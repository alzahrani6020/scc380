import { Controller, Get, Post, Patch, Delete, Body, Param, Query, Request, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { InvoicesService } from './invoices.service';

@ApiTags('ERP - Invoices')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
@Controller('erp/invoices')
export class InvoicesController {
  constructor(private readonly invoicesService: InvoicesService) {}

  @Get()
  findAll(@Request() req, @Query('status') status?: string, @Query('search') search?: string) {
    return this.invoicesService.findAll(req.user.tenantId, { status, search });
  }

  @Get(':id')
  findOne(@Request() req, @Param('id') id: string) {
    return this.invoicesService.findOne(req.user.tenantId, id);
  }

  @Post()
  create(@Request() req, @Body() body: any) {
    return this.invoicesService.create(req.user.tenantId, body);
  }

  @Patch(':id')
  update(@Request() req, @Param('id') id: string, @Body() body: any) {
    return this.invoicesService.update(req.user.tenantId, id, body);
  }

  @Delete(':id')
  remove(@Request() req, @Param('id') id: string) {
    return this.invoicesService.delete(req.user.tenantId, id);
  }
}
