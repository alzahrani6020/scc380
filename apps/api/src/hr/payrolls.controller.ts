import { Controller, Get, Post, Patch, Delete, Body, Param, Query, UseGuards, Req } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsString, IsOptional, IsNumber, Max, Min } from 'class-validator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionsGuard, RequirePermissions } from '../auth/guards/permissions.guard';
import { PayrollsService } from './payrolls.service';

class CreatePayrollDto {
  @IsString() employeeId: string;
  @Type(() => Number) @IsNumber() @Min(1) @Max(12) month: number;
  @Type(() => Number) @IsNumber() year: number;
  @Type(() => Number) @IsNumber() basicSalary: number;
  @Type(() => Number) @IsNumber() @IsOptional() housingAllowance?: number;
  @Type(() => Number) @IsNumber() @IsOptional() transportAllowance?: number;
  @Type(() => Number) @IsNumber() @IsOptional() otherAllowances?: number;
  @Type(() => Number) @IsNumber() @IsOptional() gosiDeduction?: number;
  @Type(() => Number) @IsNumber() @IsOptional() taxDeduction?: number;
  @Type(() => Number) @IsNumber() @IsOptional() otherDeductions?: number;
  @Type(() => Number) @IsNumber() netSalary: number;
}

class UpdatePayrollDto {
  @IsString() @IsOptional() status?: string;
  @Type(() => Number) @IsNumber() @IsOptional() month?: number;
  @Type(() => Number) @IsNumber() @IsOptional() year?: number;
  @Type(() => Number) @IsNumber() @IsOptional() basicSalary?: number;
  @Type(() => Number) @IsNumber() @IsOptional() housingAllowance?: number;
  @Type(() => Number) @IsNumber() @IsOptional() transportAllowance?: number;
  @Type(() => Number) @IsNumber() @IsOptional() otherAllowances?: number;
  @Type(() => Number) @IsNumber() @IsOptional() gosiDeduction?: number;
  @Type(() => Number) @IsNumber() @IsOptional() taxDeduction?: number;
  @Type(() => Number) @IsNumber() @IsOptional() otherDeductions?: number;
  @Type(() => Number) @IsNumber() @IsOptional() netSalary?: number;
  @IsString() @IsOptional() paidAt?: string;
}

@ApiTags('HR - Payroll')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('hr/payrolls')
export class PayrollsController {
  constructor(private readonly service: PayrollsService) {}

  @Get()
  @RequirePermissions('hr:read')
  findAll(@Req() req: any, @Query() query: any) { return this.service.findAll(req, query); }

  @Get(':id')
  @RequirePermissions('hr:read')
  findOne(@Req() req: any, @Param('id') id: string) { return this.service.findOne(req, id); }

  @Post()
  @RequirePermissions('hr:write')
  create(@Req() req: any, @Body() dto: CreatePayrollDto) { return this.service.create(req, dto); }

  @Patch(':id')
  @RequirePermissions('hr:write')
  update(@Req() req: any, @Param('id') id: string, @Body() dto: UpdatePayrollDto) { return this.service.update(req, id, dto); }

  @Delete(':id')
  @RequirePermissions('hr:write')
  remove(@Req() req: any, @Param('id') id: string) { return this.service.remove(req, id); }
}
