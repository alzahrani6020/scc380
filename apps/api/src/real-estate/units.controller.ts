import { Controller, Get, Post, Patch, Delete, Body, Param, Query, Request, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { UnitsService } from './units.service';
import { CreateUnitDto } from './dto/create-unit.dto';
import { UpdateUnitDto } from './dto/update-unit.dto';

@ApiTags('Real Estate - Units')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
@Controller('real-estate/units')
export class UnitsController {
  constructor(private readonly service: UnitsService) {}

  @Get()
  findAll(@Request() req, @Query('propertyId') propertyId?: string, @Query('status') status?: string, @Query('search') search?: string) {
    return this.service.findAll(req.user.tenantId, { propertyId, status, search });
  }

  @Get(':id')
  findOne(@Request() req, @Param('id') id: string) {
    return this.service.findOne(req.user.tenantId, id);
  }

  @Post()
  create(@Request() req, @Body() body: CreateUnitDto) {
    return this.service.create(req.user.tenantId, body);
  }

  @Patch(':id')
  update(@Request() req, @Param('id') id: string, @Body() body: UpdateUnitDto) {
    return this.service.update(req.user.tenantId, id, body);
  }

  @Delete(':id')
  remove(@Request() req, @Param('id') id: string) {
    return this.service.delete(req.user.tenantId, id);
  }
}
