import { Body, Controller, Delete, Get, Param, Patch, Post, Query, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsBoolean, IsBooleanString, IsEmail, IsInt, IsOptional, IsString, Max, MaxLength, Min, MinLength } from 'class-validator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionsGuard, RequirePermissions } from '../auth/guards/permissions.guard';
import { CompaniesService } from './companies.service';

class ListCompaniesQueryDto {
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) page: number = 1;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(100) limit: number = 25;
  @IsOptional() @IsString() @MaxLength(100) search?: string;
  @IsOptional() @IsBooleanString() active?: string;
}

class CreateCompanyDto {
  @IsString() @MinLength(1) @MaxLength(150) name: string;
  @IsOptional() @IsString() @MaxLength(200) legalName?: string;
  @IsOptional() @IsString() @MaxLength(50) crNumber?: string;
  @IsOptional() @IsString() @MaxLength(50) vatNumber?: string;
  @IsOptional() @IsString() @MaxLength(255) website?: string;
  @IsOptional() @IsEmail() @MaxLength(255) email?: string;
  @IsOptional() @IsString() @MaxLength(30) phone?: string;
  @IsOptional() @IsString() @MaxLength(255) address?: string;
  @IsOptional() @IsString() @MaxLength(100) city?: string;
  @IsOptional() @IsString() @MaxLength(100) country?: string;
  @IsOptional() @IsBoolean() isActive?: boolean;
}

class UpdateCompanyDto {
  @IsOptional() @IsString() @MinLength(1) @MaxLength(150) name?: string;
  @IsOptional() @IsString() @MaxLength(200) legalName?: string;
  @IsOptional() @IsString() @MaxLength(50) crNumber?: string;
  @IsOptional() @IsString() @MaxLength(50) vatNumber?: string;
  @IsOptional() @IsString() @MaxLength(255) website?: string;
  @IsOptional() @IsEmail() @MaxLength(255) email?: string;
  @IsOptional() @IsString() @MaxLength(30) phone?: string;
  @IsOptional() @IsString() @MaxLength(255) address?: string;
  @IsOptional() @IsString() @MaxLength(100) city?: string;
  @IsOptional() @IsString() @MaxLength(100) country?: string;
  @IsOptional() @IsBoolean() isActive?: boolean;
}

@ApiTags('CRM - Companies')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('crm/companies')
export class CompaniesController {
  constructor(private readonly service: CompaniesService) {}

  @Get()
  @RequirePermissions('crm:read')
  findAll(@Req() req: any, @Query() query: ListCompaniesQueryDto) { return this.service.findAll(req, query); }

  @Get(':id')
  @RequirePermissions('crm:read')
  findOne(@Req() req: any, @Param('id') id: string) { return this.service.findOne(req, id); }

  @Post()
  @RequirePermissions('crm:write')
  create(@Req() req: any, @Body() dto: CreateCompanyDto) { return this.service.create(req, dto); }

  @Patch(':id')
  @RequirePermissions('crm:write')
  update(@Req() req: any, @Param('id') id: string, @Body() dto: UpdateCompanyDto) {
    return this.service.update(req, id, dto);
  }

  @Delete(':id')
  @RequirePermissions('crm:write')
  remove(@Req() req: any, @Param('id') id: string) { return this.service.remove(req, id); }
}
