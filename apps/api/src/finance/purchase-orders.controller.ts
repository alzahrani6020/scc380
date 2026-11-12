import { Controller, Get, Post, Patch, Delete, Body, Param, Query, UseGuards, Req } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionsGuard, RequirePermissions } from '../auth/guards/permissions.guard';
import { PurchaseOrdersService } from './purchase-orders.service';
import { IsString, IsOptional, IsNumber } from 'class-validator';

class CreatePODto {
  @IsString() poNumber: string;
  @IsString() @IsOptional() vendorId?: string;
  @IsNumber() subtotal: number;
  @IsNumber() @IsOptional() taxAmount?: number;
  @IsNumber() total: number;
  @IsString() @IsOptional() expectedDelivery?: string;
  @IsString() @IsOptional() notes?: string;
}

class UpdatePODto {
  @IsString() @IsOptional() status?: string;
  @IsNumber() @IsOptional() subtotal?: number;
  @IsNumber() @IsOptional() taxAmount?: number;
  @IsNumber() @IsOptional() total?: number;
  @IsString() @IsOptional() expectedDelivery?: string;
}

@ApiTags('Finance - Purchase Orders')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('finance/purchase-orders')
export class PurchaseOrdersController {
  constructor(private readonly service: PurchaseOrdersService) {}

  @Get()
  @RequirePermissions('erp:read')
  findAll(@Req() req: any, @Query() query: any) { return this.service.findAll(req, query); }

  @Get(':id')
  @RequirePermissions('erp:read')
  findOne(@Req() req: any, @Param('id') id: string) { return this.service.findOne(req, id); }

  @Post()
  @RequirePermissions('erp:write')
  create(@Req() req: any, @Body() dto: CreatePODto) { return this.service.create(req, dto); }

  @Patch(':id')
  @RequirePermissions('erp:write')
  update(@Req() req: any, @Param('id') id: string, @Body() dto: UpdatePODto) { return this.service.update(req, id, dto); }

  @Delete(':id')
  @RequirePermissions('erp:write')
  remove(@Req() req: any, @Param('id') id: string) { return this.service.remove(req, id); }
}
