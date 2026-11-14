import { Controller, Get, Post, Patch, Delete, Body, Param, Query, Request, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionsGuard, RequirePermissions } from '../auth/guards/permissions.guard';
import { LeaseContractsService } from './lease-contracts.service';
import { EjarService } from './ejar.service';
import { CreateLeaseContractDto } from './dto/create-lease-contract.dto';
import { UpdateLeaseContractDto } from './dto/update-lease-contract.dto';

@ApiTags('Real Estate - Lease Contracts')
@UseGuards(JwtAuthGuard, PermissionsGuard)
@ApiBearerAuth()
@Controller('real-estate/contracts')
export class LeaseContractsController {
  constructor(
    private readonly service: LeaseContractsService,
    private readonly ejarService: EjarService,
  ) {}

  @Get()
  @RequirePermissions('real-estate:read')
  findAll(@Request() req, @Query('status') status?: string, @Query('propertyId') propertyId?: string, @Query('unitId') unitId?: string, @Query('expiryDays') expiryDays?: string, @Query('search') search?: string) {
    return this.service.findAll(req.user.tenantId, { status, propertyId, unitId, expiryDays: expiryDays ? parseInt(expiryDays) : undefined, search });
  }

  @Get(':id')
  @RequirePermissions('real-estate:read')
  findOne(@Request() req, @Param('id') id: string) {
    return this.service.findOne(req.user.tenantId, id);
  }

  @Post()
  @RequirePermissions('real-estate:write')
  create(@Request() req, @Body() body: CreateLeaseContractDto) {
    return this.service.create(req.user.tenantId, body);
  }

  @Patch(':id')
  @RequirePermissions('real-estate:write')
  update(@Request() req, @Param('id') id: string, @Body() body: UpdateLeaseContractDto) {
    return this.service.update(req.user.tenantId, id, body);
  }

  @Delete(':id')
  @RequirePermissions('real-estate:write')
  remove(@Request() req, @Param('id') id: string) {
    return this.service.delete(req.user.tenantId, id);
  }

  @Post(':id/renew')
  @RequirePermissions('real-estate:write')
  renew(@Request() req, @Param('id') id: string, @Body() body: { startDate: string; endDate: string; rentAmount?: string }) {
    return this.service.renew(req.user.tenantId, id, body);
  }

  @Get(':id/payment-preview')
  @RequirePermissions('real-estate:read')
  paymentPreview(@Request() req, @Param('id') id: string) {
    return this.service.previewPayments(req.user.tenantId, id);
  }

  @Post(':id/activate')
  @RequirePermissions('real-estate:write')
  activate(@Request() req, @Param('id') id: string) {
    return this.service.activate(req.user.tenantId, id);
  }

  @Post(':id/terminate')
  @RequirePermissions('real-estate:write')
  terminate(@Request() req, @Param('id') id: string) {
    return this.service.terminate(req.user.tenantId, id);
  }

  @Post(':id/ejar-sync')
  @RequirePermissions('real-estate:write')
  ejarSync(@Request() req, @Param('id') id: string) {
    return this.ejarService.registerContract(req.user.tenantId, id);
  }
}
