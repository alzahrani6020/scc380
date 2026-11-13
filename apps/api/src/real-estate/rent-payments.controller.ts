import { Controller, Get, Post, Patch, Delete, Body, Param, Query, Request, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionsGuard, RequirePermissions } from '../auth/guards/permissions.guard';
import { RentPaymentsService } from './rent-payments.service';
import { CreateRentPaymentDto } from './dto/create-rent-payment.dto';
import { UpdateRentPaymentDto } from './dto/update-rent-payment.dto';
import { RecordPaymentDto } from './dto/record-payment.dto';

@ApiTags('Real Estate - Rent Payments')
@UseGuards(JwtAuthGuard, PermissionsGuard)
@ApiBearerAuth()
@Controller('real-estate/payments')
export class RentPaymentsController {
  constructor(private readonly service: RentPaymentsService) {}

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

  @Get('overdue')
  @RequirePermissions('real-estate:read')
  overdueReport(@Request() req) {
    return this.service.overdueReport(req.user.tenantId);
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
