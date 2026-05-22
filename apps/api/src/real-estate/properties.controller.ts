import { Controller, Get, Post, Patch, Delete, Body, Param, Query, Request, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PropertiesService } from './properties.service';
import { CreatePropertyDto } from './dto/create-property.dto';
import { UpdatePropertyDto } from './dto/update-property.dto';

@ApiTags('Real Estate - Properties')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
@Controller('real-estate/properties')
export class PropertiesController {
  constructor(private readonly service: PropertiesService) {}

  @Get()
  findAll(@Request() req, @Query('status') status?: string, @Query('city') city?: string, @Query('type') type?: string, @Query('search') search?: string) {
    return this.service.findAll(req.user.tenantId, { status, city, type, search });
  }

  @Get('summary')
  summary(@Request() req) {
    return this.service.summary(req.user.tenantId);
  }

  @Get(':id')
  findOne(@Request() req, @Param('id') id: string) {
    return this.service.findOne(req.user.tenantId, id);
  }

  @Post()
  create(@Request() req, @Body() body: CreatePropertyDto) {
    return this.service.create(req.user.tenantId, body);
  }

  @Patch(':id')
  update(@Request() req, @Param('id') id: string, @Body() body: UpdatePropertyDto) {
    return this.service.update(req.user.tenantId, id, body);
  }

  @Delete(':id')
  remove(@Request() req, @Param('id') id: string) {
    return this.service.delete(req.user.tenantId, id);
  }
}
