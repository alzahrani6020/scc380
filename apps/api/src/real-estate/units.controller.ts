import { Controller, Get, Post, Patch, Delete, Body, Param, Query, Request, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionsGuard, RequirePermissions } from '../auth/guards/permissions.guard';
import { UnitsService } from './units.service';
import { CreateUnitDto } from './dto/create-unit.dto';
import { UpdateUnitDto } from './dto/update-unit.dto';

@ApiTags('Real Estate - Units')
@UseGuards(JwtAuthGuard, PermissionsGuard)
@ApiBearerAuth()
@Controller('real-estate/units')
export class UnitsController {
  constructor(private readonly service: UnitsService) {}

  @Get()
  @RequirePermissions('real-estate:read')
  findAll(@Request() req, @Query('propertyId') propertyId?: string, @Query('status') status?: string, @Query('search') search?: string) {
    return this.service.findAll(req.user.tenantId, { propertyId, status, search });
  }

  @Get(':id')
  @RequirePermissions('real-estate:read')
  findOne(@Request() req, @Param('id') id: string) {
    return this.service.findOne(req.user.tenantId, id);
  }

  @Post()
  @RequirePermissions('real-estate:write')
  create(@Request() req, @Body() body: CreateUnitDto) {
    return this.service.create(req.user.tenantId, body);
  }

  @Patch(':id')
  @RequirePermissions('real-estate:write')
  update(@Request() req, @Param('id') id: string, @Body() body: UpdateUnitDto) {
    return this.service.update(req.user.tenantId, id, body);
  }

  @Delete(':id')
  @RequirePermissions('real-estate:write')
  remove(@Request() req, @Param('id') id: string) {
    return this.service.delete(req.user.tenantId, id);
  }
}
