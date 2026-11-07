import { Controller, Get, Post, Patch, Delete, Body, Param, Query, Request, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RentPaymentsService } from './rent-payments.service';
import { CreateRentPaymentDto } from './dto/create-rent-payment.dto';
import { UpdateRentPaymentDto } from './dto/update-rent-payment.dto';
import { RecordPaymentDto } from './dto/record-payment.dto';

@ApiTags('Real Estate - Rent Payments')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
@Controller('real-estate/payments')
export class RentPaymentsController {
  constructor(private readonly service: RentPaymentsService) {}

  @Get()
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
  overdueReport(@Request() req) {
    return this.service.overdueReport(req.user.tenantId);
  }

  @Get(':id')
  findOne(@Request() req, @Param('id') id: string) {
    return this.service.findOne(req.user.tenantId, id);
  }

  @Post()
  create(@Request() req, @Body() body: CreateRentPaymentDto) {
    return this.service.create(req.user.tenantId, body);
  }

  @Patch(':id')
  update(@Request() req, @Param('id') id: string, @Body() body: UpdateRentPaymentDto) {
    return this.service.update(req.user.tenantId, id, body);
  }

  @Post(':id/record')
  record(@Request() req, @Param('id') id: string, @Body() body: RecordPaymentDto) {
    return this.service.recordPayment(req.user.tenantId, id, body);
  }

  @Delete(':id')
  remove(@Request() req, @Param('id') id: string) {
    return this.service.delete(req.user.tenantId, id);
  }
}
