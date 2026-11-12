import { Body, Controller, Delete, Get, Param, Patch, Post, Query, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsIn, IsInt, IsNumber, IsOptional, IsString, Min } from 'class-validator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionsGuard, RequirePermissions } from '../auth/guards/permissions.guard';
import { ContractsService } from './contracts.service';

class CreateContractDto {
  @IsString() employeeId: string;
  @IsString() contractNumber: string;
  @IsIn(['FIXED_TERM','INDEFINITE','TEMPORARY','TRAINING']) @IsOptional() type?: string;
  @IsString() startDate: string;
  @IsString() @IsOptional() endDate?: string;
  @IsString() @IsOptional() probationEndDate?: string;
  @IsString() @IsOptional() jobTitle?: string;
  @Type(() => Number) @IsNumber() @IsOptional() basicSalary?: number;
  @Type(() => Number) @IsNumber() @IsOptional() housingAllowance?: number;
  @Type(() => Number) @IsNumber() @IsOptional() transportAllowance?: number;
  @Type(() => Number) @IsNumber() @IsOptional() otherAllowances?: number;
  @Type(() => Number) @IsInt() @Min(1) @IsOptional() workingHoursPerWeek?: number;
  @IsString() @IsOptional() signedAt?: string;
  @IsString() @IsOptional() notes?: string;
}

class UpdateContractDto {
  @IsString() @IsOptional() contractNumber?: string;
  @IsIn(['FIXED_TERM','INDEFINITE','TEMPORARY','TRAINING']) @IsOptional() type?: string;
  @IsString() @IsOptional() startDate?: string;
  @IsString() @IsOptional() endDate?: string;
  @IsString() @IsOptional() probationEndDate?: string;
  @IsString() @IsOptional() jobTitle?: string;
  @Type(() => Number) @IsNumber() @IsOptional() basicSalary?: number;
  @Type(() => Number) @IsNumber() @IsOptional() housingAllowance?: number;
  @Type(() => Number) @IsNumber() @IsOptional() transportAllowance?: number;
  @Type(() => Number) @IsNumber() @IsOptional() otherAllowances?: number;
  @Type(() => Number) @IsInt() @Min(1) @IsOptional() workingHoursPerWeek?: number;
  @IsString() @IsOptional() signedAt?: string;
  @IsString() @IsOptional() notes?: string;
}

class ActivateContractDto {
  @IsString() @IsOptional() signedAt?: string;
}

class TerminateContractDto {
  @IsString() @IsOptional() reason?: string;
}

@ApiTags('HR - Contracts')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('hr/contracts')
export class ContractsController {
  constructor(private readonly service: ContractsService) {}

  @Get()
  @RequirePermissions('hr:contracts:read')
  findAll(@Req() req: any, @Query() query: any) { return this.service.findAll(req, query); }

  @Get(':id')
  @RequirePermissions('hr:contracts:read')
  findOne(@Req() req: any, @Param('id') id: string) { return this.service.findOne(req, id); }

  @Post()
  @RequirePermissions('hr:contracts:write')
  create(@Req() req: any, @Body() dto: CreateContractDto) { return this.service.create(req, dto); }

  @Patch(':id')
  @RequirePermissions('hr:contracts:write')
  update(@Req() req: any, @Param('id') id: string, @Body() dto: UpdateContractDto) {
    return this.service.updateDraft(req, id, dto);
  }

  @Post(':id/activate')
  @RequirePermissions('hr:contracts:write')
  activate(@Req() req: any, @Param('id') id: string, @Body() dto: ActivateContractDto) {
    return this.service.activate(req, id, dto.signedAt);
  }

  @Post(':id/terminate')
  @RequirePermissions('hr:contracts:write')
  terminate(@Req() req: any, @Param('id') id: string, @Body() dto: TerminateContractDto) {
    return this.service.terminate(req, id, dto.reason);
  }

  @Delete(':id')
  @RequirePermissions('hr:contracts:write')
  remove(@Req() req: any, @Param('id') id: string) { return this.service.removeDraft(req, id); }
}
