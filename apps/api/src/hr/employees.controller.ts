import { Controller, Get, Post, Patch, Delete, Body, Param, Query, Request, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { EmployeesService } from './employees.service';

@ApiTags('HR - Employees')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
@Controller('hr/employees')
export class EmployeesController {
  constructor(private readonly employeesService: EmployeesService) {}

  @Get()
  findAll(@Request() req, @Query('status') status?: string, @Query('departmentId') departmentId?: string, @Query('search') search?: string) {
    return this.employeesService.findAll(req.user.tenantId, { status, departmentId, search });
  }

  @Get(':id')
  findOne(@Request() req, @Param('id') id: string) {
    return this.employeesService.findOne(req.user.tenantId, id);
  }

  @Post()
  create(@Request() req, @Body() body: any) {
    return this.employeesService.create(req.user.tenantId, body);
  }

  @Patch(':id')
  update(@Request() req, @Param('id') id: string, @Body() body: any) {
    return this.employeesService.update(req.user.tenantId, id, body);
  }

  @Delete(':id')
  remove(@Request() req, @Param('id') id: string) {
    return this.employeesService.delete(req.user.tenantId, id);
  }
}
