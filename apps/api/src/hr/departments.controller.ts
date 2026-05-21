import { Controller, Get, Post, Patch, Delete, Body, Param, Query, UseGuards, Req } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { DepartmentsService } from './departments.service';
import { IsString, IsOptional } from 'class-validator';

class CreateDepartmentDto {
  @IsString() name: string;
  @IsString() @IsOptional() code?: string;
  @IsString() @IsOptional() parentId?: string;
  @IsString() @IsOptional() managerId?: string;
}

class UpdateDepartmentDto {
  @IsString() @IsOptional() name?: string;
  @IsString() @IsOptional() code?: string;
  @IsString() @IsOptional() parentId?: string;
  @IsString() @IsOptional() managerId?: string;
}

@ApiTags('HR - Departments')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('hr/departments')
export class DepartmentsController {
  constructor(private readonly service: DepartmentsService) {}

  @Get()
  findAll(@Req() req: any, @Query('search') search?: string) {
    return this.service.findAll(req, search);
  }

  @Get(':id')
  findOne(@Req() req: any, @Param('id') id: string) {
    return this.service.findOne(req, id);
  }

  @Post()
  create(@Req() req: any, @Body() dto: CreateDepartmentDto) {
    return this.service.create(req, dto);
  }

  @Patch(':id')
  update(@Req() req: any, @Param('id') id: string, @Body() dto: UpdateDepartmentDto) {
    return this.service.update(req, id, dto);
  }

  @Delete(':id')
  remove(@Req() req: any, @Param('id') id: string) {
    return this.service.remove(req, id);
  }
}
