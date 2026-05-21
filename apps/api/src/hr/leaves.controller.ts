import { Controller, Get, Post, Patch, Delete, Body, Param, Query, UseGuards, Req } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { LeavesService } from './leaves.service';
import { IsString, IsOptional, IsNumber } from 'class-validator';

class CreateLeaveDto {
  @IsString() employeeId: string;
  @IsString() type: string;
  @IsString() startDate: string;
  @IsString() endDate: string;
  @IsNumber() days: number;
  @IsString() @IsOptional() reason?: string;
}

class UpdateLeaveDto {
  @IsString() @IsOptional() status?: string;
  @IsString() @IsOptional() approvedById?: string;
  @IsString() @IsOptional() startDate?: string;
  @IsString() @IsOptional() endDate?: string;
}

@ApiTags('HR - Leaves')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('hr/leaves')
export class LeavesController {
  constructor(private readonly service: LeavesService) {}

  @Get()
  findAll(@Req() req: any, @Query() query: any) { return this.service.findAll(req, query); }

  @Get(':id')
  findOne(@Req() req: any, @Param('id') id: string) { return this.service.findOne(req, id); }

  @Post()
  create(@Req() req: any, @Body() dto: CreateLeaveDto) { return this.service.create(req, dto); }

  @Patch(':id')
  update(@Req() req: any, @Param('id') id: string, @Body() dto: UpdateLeaveDto) { return this.service.update(req, id, dto); }

  @Delete(':id')
  remove(@Req() req: any, @Param('id') id: string) { return this.service.remove(req, id); }
}
