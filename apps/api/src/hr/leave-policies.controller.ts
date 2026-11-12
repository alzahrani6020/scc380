import { Body, Controller, Get, Param, Patch, Post, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsBoolean, IsIn, IsInt, IsOptional, IsString, Min } from 'class-validator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionsGuard, RequirePermissions } from '../auth/guards/permissions.guard';
import { LeavePoliciesService } from './leave-policies.service';

class CreateLeavePolicyDto {
  @IsIn(['ANNUAL','SICK','EMERGENCY','UNPAID','MATERNITY','PATERNITY','HAJJ','STUDY','COMPASSIONATE']) type: string;
  @IsString() name: string;
  @Type(() => Number) @IsInt() @Min(0) annualEntitlement: number;
  @Type(() => Number) @IsInt() @Min(0) @IsOptional() maxCarryForward?: number;
  @IsBoolean() @IsOptional() requiresApproval?: boolean;
  @IsBoolean() @IsOptional() isActive?: boolean;
}

class UpdateLeavePolicyDto {
  @IsString() @IsOptional() name?: string;
  @Type(() => Number) @IsInt() @Min(0) @IsOptional() annualEntitlement?: number;
  @Type(() => Number) @IsInt() @Min(0) @IsOptional() maxCarryForward?: number;
  @IsBoolean() @IsOptional() requiresApproval?: boolean;
  @IsBoolean() @IsOptional() isActive?: boolean;
}

@ApiTags('HR - Leave Policies')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('hr/leave-policies')
export class LeavePoliciesController {
  constructor(private readonly service: LeavePoliciesService) {}

  @Get()
  @RequirePermissions('hr:leave-admin:read')
  findAll(@Req() req: any) { return this.service.findAll(req); }

  @Post()
  @RequirePermissions('hr:leave-admin:write')
  create(@Req() req: any, @Body() dto: CreateLeavePolicyDto) { return this.service.create(req, dto); }

  @Patch(':id')
  @RequirePermissions('hr:leave-admin:write')
  update(@Req() req: any, @Param('id') id: string, @Body() dto: UpdateLeavePolicyDto) {
    return this.service.update(req, id, dto);
  }
}
