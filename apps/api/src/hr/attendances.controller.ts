import { Controller, Get, Post, Patch, Delete, Body, Param, Query, UseGuards, Req } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { AttendancesService } from './attendances.service';
import { IsString, IsOptional, IsNumber } from 'class-validator';

class CreateAttendanceDto {
  @IsString() employeeId: string;
  @IsString() @IsOptional() date?: string;
  @IsString() @IsOptional() checkIn?: string;
  @IsString() @IsOptional() checkOut?: string;
  @IsString() status: string;
  @IsString() @IsOptional() notes?: string;
}

class UpdateAttendanceDto {
  @IsString() @IsOptional() checkIn?: string;
  @IsString() @IsOptional() checkOut?: string;
  @IsString() @IsOptional() status?: string;
  @IsNumber() @IsOptional() workHours?: number;
  @IsNumber() @IsOptional() overtimeHours?: number;
}

@ApiTags('HR - Attendance')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('hr/attendances')
export class AttendancesController {
  constructor(private readonly service: AttendancesService) {}

  @Get()
  findAll(@Req() req: any, @Query() query: any) { return this.service.findAll(req, query); }

  @Get(':id')
  findOne(@Req() req: any, @Param('id') id: string) { return this.service.findOne(req, id); }

  @Post()
  create(@Req() req: any, @Body() dto: CreateAttendanceDto) { return this.service.create(req, dto); }

  @Patch(':id')
  update(@Req() req: any, @Param('id') id: string, @Body() dto: UpdateAttendanceDto) { return this.service.update(req, id, dto); }

  @Delete(':id')
  remove(@Req() req: any, @Param('id') id: string) { return this.service.remove(req, id); }
}
