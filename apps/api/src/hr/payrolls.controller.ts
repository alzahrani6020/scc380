import { Controller, Get, Post, Patch, Delete, Body, Param, Query, UseGuards, Req } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PayrollsService } from './payrolls.service';
import { IsString, IsOptional, IsNumber } from 'class-validator';

class CreatePayrollDto {
  @IsString() employeeId: string;
  @IsNumber() month: number;
  @IsNumber() year: number;
  @IsNumber() basicSalary: number;
  @IsNumber() @IsOptional() housingAllowance?: number;
  @IsNumber() @IsOptional() transportAllowance?: number;
  @IsNumber() @IsOptional() otherAllowances?: number;
  @IsNumber() @IsOptional() gosiDeduction?: number;
  @IsNumber() @IsOptional() taxDeduction?: number;
  @IsNumber() @IsOptional() otherDeductions?: number;
  @IsNumber() netSalary: number;
}

class UpdatePayrollDto {
  @IsString() @IsOptional() status?: string;
  @IsNumber() @IsOptional() netSalary?: number;
  @IsString() @IsOptional() paidAt?: string;
}

@ApiTags('HR - Payroll')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('hr/payrolls')
export class PayrollsController {
  constructor(private readonly service: PayrollsService) {}

  @Get()
  findAll(@Req() req: any, @Query() query: any) { return this.service.findAll(req, query); }

  @Get(':id')
  findOne(@Req() req: any, @Param('id') id: string) { return this.service.findOne(req, id); }

  @Post()
  create(@Req() req: any, @Body() dto: CreatePayrollDto) { return this.service.create(req, dto); }

  @Patch(':id')
  update(@Req() req: any, @Param('id') id: string, @Body() dto: UpdatePayrollDto) { return this.service.update(req, id, dto); }

  @Delete(':id')
  remove(@Req() req: any, @Param('id') id: string) { return this.service.remove(req, id); }
}
