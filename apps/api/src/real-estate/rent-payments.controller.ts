import { Controller, Get, Post, Patch, Delete, Body, Param, Query, Request, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionsGuard, RequirePermissions } from '../auth/guards/permissions.guard';
import { RentPaymentsService } from './rent-payments.service';
import { RentAccountingService } from './rent-accounting.service';
import { CreateRentPaymentDto } from './dto/create-rent-payment.dto';
import { UpdateRentPaymentDto } from './dto/update-rent-payment.dto';
import { RecordPaymentDto } from './dto/record-payment.dto';

@ApiTags('Real Estate - Rent Payments')
@UseGuards(JwtAuthGuard, PermissionsGuard)
@ApiBearerAuth()
@Controller('real-estate/payments')
export class RentPaymentsController {
  constructor(private readonly service: RentPaymentsService, private readonly accounting: RentAccountingService) {}

  @Get()
  @RequirePermissions('real-estate:read')
  findAll(
    @Request() req,
    @Query('contractId') contractId?: string,
    @Query('status') status?: string,
    @Query('overdue') overdue?: string,
    @Query('search') search?: string,
  ) {
    return this.service.findAll(req.user.tenantId, {
      contractId,
      status,
      overdue: overdue === 'true',
      search,
    });
  }

  @Get('collection-summary')
  @RequirePermissions('real-estate:read')
  collectionSummary(@Request() req) {
    return this.service.collectionSummary(req.user.tenantId);
  }

  @Get('overdue')
  @RequirePermissions('real-estate:read')
  overdueReport(@Request() req) {
    return this.service.overdueReport(req.user.tenantId);
  }

  @Post(':id/post-accrual')
  @RequirePermissions('real-estate:write', 'erp:write')
  postAccrual(@Request() req, @Param('id') id: string) {
    return this.accounting.postAccrual(req.user.tenantId, id);
  }

  @Post('collections/:collectionId/post-accounting')
  @RequirePermissions('real-estate:write', 'erp:write')
  postCollection(@Request() req, @Param('collectionId') collectionId: string) {
    return this.accounting.postCollection(req.user.tenantId, collectionId);
  }

  @Get(':id/collections')
  @RequirePermissions('real-estate:read')
  collectionHistory(@Request() req, @Param('id') id: string) {
    return this.service.collectionHistory(req.user.tenantId, id);
  }

  @Get(':id')
  @RequirePermissions('real-estate:read')
  findOne(@Request() req, @Param('id') id: string) {
    return this.service.findOne(req.user.tenantId, id);
  }

  @Post()
  @RequirePermissions('real-estate:write')
  create(@Request() req, @Body() body: CreateRentPaymentDto) {
    return this.service.create(req.user.tenantId, body);
  }

  @Patch(':id')
  @RequirePermissions('real-estate:write')
  update(@Request() req, @Param('id') id: string, @Body() body: UpdateRentPaymentDto) {
    return this.service.update(req.user.tenantId, id, body);
  }

  @Post(':id/record')
  @RequirePermissions('real-estate:write')
  record(@Request() req, @Param('id') id: string, @Body() body: RecordPaymentDto) {
    return this.service.recordPayment(req.user.tenantId, id, body);
  }

  @Delete(':id')
  @RequirePermissions('real-estate:write')
  remove(@Request() req, @Param('id') id: string) {
    return this.service.delete(req.user.tenantId, id);
  }
}
