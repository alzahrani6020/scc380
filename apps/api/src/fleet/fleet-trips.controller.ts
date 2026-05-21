import { Controller, Get, Post, Patch, Delete, Body, Param, Query, UseGuards, Req } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { FleetTripsService } from './fleet-trips.service';
import { IsString, IsOptional, IsNumber } from 'class-validator';

class CreateFleetTripDto {
  @IsString() vehicleId: string;
  @IsString() @IsOptional() driverId?: string;
  @IsString() @IsOptional() purpose?: string;
  @IsNumber() @IsOptional() startOdometer?: number;
  @IsString() startedAt: string;
}

class UpdateFleetTripDto {
  @IsString() @IsOptional() driverId?: string;
  @IsString() @IsOptional() purpose?: string;
  @IsNumber() @IsOptional() endOdometer?: number;
  @IsString() @IsOptional() endedAt?: string;
  @IsString() @IsOptional() status?: string;
}

@ApiTags('Fleet - Trips')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('fleet/trips')
export class FleetTripsController {
  constructor(private readonly service: FleetTripsService) {}

  @Get()
  @ApiQuery({ name: 'vehicleId', required: false })
  @ApiQuery({ name: 'status', required: false })
  findAll(@Req() req: any, @Query() query: any) {
    return this.service.findAll(req, query);
  }

  @Get(':id')
  findOne(@Req() req: any, @Param('id') id: string) {
    return this.service.findOne(req, id);
  }

  @Post()
  create(@Req() req: any, @Body() dto: CreateFleetTripDto) {
    return this.service.create(req, dto);
  }

  @Patch(':id')
  update(@Req() req: any, @Param('id') id: string, @Body() dto: UpdateFleetTripDto) {
    return this.service.update(req, id, dto);
  }

  @Delete(':id')
  remove(@Req() req: any, @Param('id') id: string) {
    return this.service.remove(req, id);
  }
}
