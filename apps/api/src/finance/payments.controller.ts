import { Controller, Get, Post, Patch, Delete, Body, Param, Query, UseGuards, Req } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionsGuard, RequirePermissions } from '../auth/guards/permissions.guard';
import { PaymentsService } from './payments.service';
import { IsString, IsOptional, IsNumber } from 'class-validator';

class CreatePaymentDto {
  @IsString() @IsOptional() invoiceId?: string;
  @IsNumber() amount: number;
  @IsString() @IsOptional() currency?: string;
  @IsNumber() @IsOptional() exchangeRate?: number;
  @IsString() method: string;
  @IsString() @IsOptional() reference?: string;
  @IsString() @IsOptional() notes?: string;
  @IsString() @IsOptional() paidAt?: string;
}

class UpdatePaymentDto {
  @IsNumber() @IsOptional() amount?: number;
  @IsNumber() @IsOptional() exchangeRate?: number;
  @IsString() @IsOptional() method?: string;
  @IsString() @IsOptional() status?: string;
  @IsString() @IsOptional() reference?: string;
}

@ApiTags('Finance - Payments')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('finance/payments')
export class PaymentsController {
  constructor(private readonly service: PaymentsService) {}

  @Get()
  @ApiQuery({ name: 'invoiceId', required: false })
  @ApiQuery({ name: 'status', required: false })
  @RequirePermissions('erp:read')
  findAll(@Req() req: any, @Query() query: any) { return this.service.findAll(req, query); }

  @Get(':id')
  @RequirePermissions('erp:read')
  findOne(@Req() req: any, @Param('id') id: string) { return this.service.findOne(req, id); }

  @Post()
  @RequirePermissions('erp:write')
  create(@Req() req: any, @Body() dto: CreatePaymentDto) { return this.service.create(req, dto); }

  @Patch(':id')
  @RequirePermissions('erp:write')
  update(@Req() req: any, @Param('id') id: string, @Body() dto: UpdatePaymentDto) { return this.service.update(req, id, dto); }

  @Delete(':id')
  @RequirePermissions('erp:write')
  remove(@Req() req: any, @Param('id') id: string) { return this.service.remove(req, id); }
}
