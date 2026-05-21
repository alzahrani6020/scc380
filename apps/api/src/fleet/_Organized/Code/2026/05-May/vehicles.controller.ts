import { Controller, Get, Post, Patch, Delete, Body, Param, Query, Request, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { VehiclesService } from './vehicles.service';

@ApiTags('Fleet - Vehicles')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
@Controller('fleet/vehicles')
export class VehiclesController {
  constructor(private readonly vehiclesService: VehiclesService) {}

  @Get()
  findAll(@Request() req, @Query('status') status?: string, @Query('search') search?: string) {
    return this.vehiclesService.findAll(req.user.tenantId, { status, search });
  }

  @Get(':id')
  findOne(@Request() req, @Param('id') id: string) {
    return this.vehiclesService.findOne(req.user.tenantId, id);
  }

  @Post()
  create(@Request() req, @Body() body: any) {
    return this.vehiclesService.create(req.user.tenantId, body);
  }

  @Patch(':id')
  update(@Request() req, @Param('id') id: string, @Body() body: any) {
    return this.vehiclesService.update(req.user.tenantId, id, body);
  }

  @Delete(':id')
  remove(@Request() req, @Param('id') id: string) {
    return this.vehiclesService.delete(req.user.tenantId, id);
  }
}
