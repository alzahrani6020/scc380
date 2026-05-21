import { Controller, Get, Post, Patch, Delete, Body, Param, Query, UseGuards, Req } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { FleetFuelLogsService } from './fleet-fuel-logs.service';
import { IsString, IsOptional, IsNumber } from 'class-validator';

class CreateFuelLogDto {
  @IsString() vehicleId: string;
  @IsString() @IsOptional() driverId?: string;
  @IsString() fuelType: string;
  @IsNumber() liters: number;
  @IsNumber() pricePerLiter: number;
  @IsNumber() totalCost: number;
  @IsNumber() @IsOptional() odometer?: number;
  @IsString() @IsOptional() location?: string;
  @IsString() @IsOptional() fueledAt?: string;
}

class UpdateFuelLogDto {
  @IsNumber() @IsOptional() liters?: number;
  @IsNumber() @IsOptional() totalCost?: number;
  @IsString() @IsOptional() location?: string;
}

@ApiTags('Fleet - Fuel Logs')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('fleet/fuel-logs')
export class FleetFuelLogsController {
  constructor(private readonly service: FleetFuelLogsService) {}

  @Get()
  findAll(@Req() req: any, @Query() query: any) { return this.service.findAll(req, query); }

  @Get(':id')
  findOne(@Req() req: any, @Param('id') id: string) { return this.service.findOne(req, id); }

  @Post()
  create(@Req() req: any, @Body() dto: CreateFuelLogDto) { return this.service.create(req, dto); }

  @Patch(':id')
  update(@Req() req: any, @Param('id') id: string, @Body() dto: UpdateFuelLogDto) { return this.service.update(req, id, dto); }

  @Delete(':id')
  remove(@Req() req: any, @Param('id') id: string) { return this.service.remove(req, id); }
}
