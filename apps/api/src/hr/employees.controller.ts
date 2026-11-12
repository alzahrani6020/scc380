import { Controller, Get, Post, Patch, Delete, Body, Param, Query, Request, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsEmail, IsNumber, IsOptional, IsString } from 'class-validator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionsGuard, RequirePermissions } from '../auth/guards/permissions.guard';
import { EmployeesService } from './employees.service';

class CreateEmployeeDto {
  @IsString() employeeCode: string;
  @IsString() firstName: string;
  @IsString() lastName: string;
  @IsEmail() @IsOptional() email?: string;
  @IsString() @IsOptional() phone?: string;
  @IsString() @IsOptional() idNumber?: string;
  @IsString() @IsOptional() nationality?: string;
  @IsString() @IsOptional() departmentId?: string;
  @IsString() @IsOptional() jobTitle?: string;
  @IsString() @IsOptional() employmentType?: string;
  @IsString() @IsOptional() status?: string;
  @IsString() hireDate: string;
  @Type(() => Number) @IsNumber() @IsOptional() basicSalary?: number;
  @Type(() => Number) @IsNumber() @IsOptional() housingAllowance?: number;
  @Type(() => Number) @IsNumber() @IsOptional() transportAllowance?: number;
  @Type(() => Number) @IsNumber() @IsOptional() otherAllowances?: number;
  @IsString() @IsOptional() gosiNumber?: string;
  @Type(() => Number) @IsNumber() @IsOptional() gosiSalary?: number;
  @IsString() @IsOptional() emergencyContactName?: string;
  @IsString() @IsOptional() emergencyContactPhone?: string;
}

class UpdateEmployeeDto {
  @IsString() @IsOptional() employeeCode?: string;
  @IsString() @IsOptional() firstName?: string;
  @IsString() @IsOptional() lastName?: string;
  @IsEmail() @IsOptional() email?: string;
  @IsString() @IsOptional() phone?: string;
  @IsString() @IsOptional() idNumber?: string;
  @IsString() @IsOptional() nationality?: string;
  @IsString() @IsOptional() departmentId?: string;
  @IsString() @IsOptional() jobTitle?: string;
  @IsString() @IsOptional() employmentType?: string;
  @IsString() @IsOptional() status?: string;
  @IsString() @IsOptional() hireDate?: string;
  @IsString() @IsOptional() terminationDate?: string;
  @Type(() => Number) @IsNumber() @IsOptional() basicSalary?: number;
  @Type(() => Number) @IsNumber() @IsOptional() housingAllowance?: number;
  @Type(() => Number) @IsNumber() @IsOptional() transportAllowance?: number;
  @Type(() => Number) @IsNumber() @IsOptional() otherAllowances?: number;
  @IsString() @IsOptional() gosiNumber?: string;
  @Type(() => Number) @IsNumber() @IsOptional() gosiSalary?: number;
  @IsString() @IsOptional() emergencyContactName?: string;
  @IsString() @IsOptional() emergencyContactPhone?: string;
}

@ApiTags('HR - Employees')
@UseGuards(JwtAuthGuard, PermissionsGuard)
@ApiBearerAuth()
@Controller('hr/employees')
export class EmployeesController {
  constructor(private readonly employeesService: EmployeesService) {}

  @Get()
  @RequirePermissions('hr:read')
  findAll(@Request() req, @Query('status') status?: string, @Query('departmentId') departmentId?: string, @Query('search') search?: string) {
    return this.employeesService.findAll(req.user.tenantId, { status, departmentId, search });
  }

  @Get(':id')
  @RequirePermissions('hr:read')
  findOne(@Request() req, @Param('id') id: string) {
    return this.employeesService.findOne(req.user.tenantId, id);
  }

  @Post()
  @RequirePermissions('hr:write')
  create(@Request() req, @Body() body: CreateEmployeeDto) {
    return this.employeesService.create(req.user.tenantId, body);
  }

  @Patch(':id')
  @RequirePermissions('hr:write')
  update(@Request() req, @Param('id') id: string, @Body() body: UpdateEmployeeDto) {
    return this.employeesService.update(req.user.tenantId, id, body);
  }

  @Delete(':id')
  @RequirePermissions('hr:write')
  remove(@Request() req, @Param('id') id: string) {
    return this.employeesService.terminate(req.user.tenantId, id);
  }
}
