import { Controller, Get, Post, Patch, Delete, Body, Param, Query, Request, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { LeaseContractsService } from './lease-contracts.service';
import { EjarService } from './ejar.service';
import { CreateLeaseContractDto } from './dto/create-lease-contract.dto';
import { UpdateLeaseContractDto } from './dto/update-lease-contract.dto';

@ApiTags('Real Estate - Lease Contracts')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
@Controller('real-estate/contracts')
export class LeaseContractsController {
  constructor(
    private readonly service: LeaseContractsService,
    private readonly ejarService: EjarService,
  ) {}

  @Get()
  findAll(@Request() req, @Query('status') status?: string, @Query('propertyId') propertyId?: string, @Query('unitId') unitId?: string, @Query('expiryDays') expiryDays?: string, @Query('search') search?: string) {
    return this.service.findAll(req.user.tenantId, { status, propertyId, unitId, expiryDays: expiryDays ? parseInt(expiryDays) : undefined, search });
  }

  @Get(':id')
  findOne(@Request() req, @Param('id') id: string) {
    return this.service.findOne(req.user.tenantId, id);
  }

  @Post()
  create(@Request() req, @Body() body: CreateLeaseContractDto) {
    return this.service.create(req.user.tenantId, body);
  }

  @Patch(':id')
  update(@Request() req, @Param('id') id: string, @Body() body: UpdateLeaseContractDto) {
    return this.service.update(req.user.tenantId, id, body);
  }

  @Delete(':id')
  remove(@Request() req, @Param('id') id: string) {
    return this.service.delete(req.user.tenantId, id);
  }

  @Post(':id/renew')
  renew(@Request() req, @Param('id') id: string, @Body() body: { startDate: string; endDate: string; rentAmount?: string }) {
    return this.service.renew(req.user.tenantId, id, body);
  }

  @Post(':id/terminate')
  terminate(@Request() req, @Param('id') id: string) {
    return this.service.terminate(req.user.tenantId, id);
  }

  @Post(':id/ejar-sync')
  ejarSync(@Request() req, @Param('id') id: string) {
    return this.ejarService.registerContract(req.user.tenantId, id);
  }
}
