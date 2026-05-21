import { Controller, Get, Post, Patch, Delete, Body, Param, Query, UseGuards, Req } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { DriversService } from './drivers.service';
import { IsString, IsOptional } from 'class-validator';

class CreateDriverDto {
  @IsString() firstName: string;
  @IsString() lastName: string;
  @IsString() @IsOptional() email?: string;
  @IsString() @IsOptional() phone?: string;
  @IsString() @IsOptional() idNumber?: string;
  @IsString() @IsOptional() licenseNumber?: string;
  @IsString() @IsOptional() licenseExpiry?: string;
}

class UpdateDriverDto {
  @IsString() @IsOptional() firstName?: string;
  @IsString() @IsOptional() lastName?: string;
  @IsString() @IsOptional() phone?: string;
  @IsString() @IsOptional() status?: string;
  @IsString() @IsOptional() licenseExpiry?: string;
}

@ApiTags('Fleet - Drivers')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('fleet/drivers')
export class DriversController {
  constructor(private readonly service: DriversService) {}

  @Get()
  findAll(@Req() req: any, @Query('search') search?: string, @Query('status') status?: string) {
    return this.service.findAll(req, search, status);
  }

  @Get(':id')
  findOne(@Req() req: any, @Param('id') id: string) { return this.service.findOne(req, id); }

  @Post()
  create(@Req() req: any, @Body() dto: CreateDriverDto) { return this.service.create(req, dto); }

  @Patch(':id')
  update(@Req() req: any, @Param('id') id: string, @Body() dto: UpdateDriverDto) { return this.service.update(req, id, dto); }

  @Delete(':id')
  remove(@Req() req: any, @Param('id') id: string) { return this.service.remove(req, id); }
}
