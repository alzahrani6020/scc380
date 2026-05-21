import { Controller, Get, Post, Patch, Delete, Body, Param, Query, UseGuards, Req } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { FleetMaintenanceService } from './fleet-maintenance.service';
import { IsString, IsOptional, IsNumber } from 'class-validator';

class CreateMaintenanceDto {
  @IsString() vehicleId: string;
  @IsString() type: string;
  @IsString() description: string;
  @IsNumber() @IsOptional() cost?: number;
  @IsString() @IsOptional() serviceDate?: string;
  @IsString() @IsOptional() nextServiceDate?: string;
  @IsNumber() @IsOptional() mileage?: number;
  @IsString() @IsOptional() serviceCenter?: string;
}

class UpdateMaintenanceDto {
  @IsString() @IsOptional() status?: string;
  @IsNumber() @IsOptional() cost?: number;
  @IsString() @IsOptional() nextServiceDate?: string;
  @IsString() @IsOptional() serviceCenter?: string;
}

@ApiTags('Fleet - Maintenance')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('fleet/maintenance')
export class FleetMaintenanceController {
  constructor(private readonly service: FleetMaintenanceService) {}

  @Get()
  findAll(@Req() req: any, @Query() query: any) { return this.service.findAll(req, query); }

  @Get(':id')
  findOne(@Req() req: any, @Param('id') id: string) { return this.service.findOne(req, id); }

  @Post()
  create(@Req() req: any, @Body() dto: CreateMaintenanceDto) { return this.service.create(req, dto); }

  @Patch(':id')
  update(@Req() req: any, @Param('id') id: string, @Body() dto: UpdateMaintenanceDto) { return this.service.update(req, id, dto); }

  @Delete(':id')
  remove(@Req() req: any, @Param('id') id: string) { return this.service.remove(req, id); }
}
