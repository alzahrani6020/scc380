import { Body, Controller, Get, Param, Post, Query, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, IsString, Max, Min } from 'class-validator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionsGuard, RequirePermissions } from '../auth/guards/permissions.guard';
import { LeaveBalancesService } from './leave-balances.service';

class InitializeBalanceDto {
  @IsString() employeeId: string;
  @Type(() => Number) @IsInt() @Min(2000) @Max(2100) year: number;
}

class AdjustBalanceDto {
  @Type(() => Number) @IsInt() amount: number;
  @IsString() reason: string;
}

@ApiTags('HR - Leave Balances')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('hr/leave-balances')
export class LeaveBalancesController {
  constructor(private readonly service: LeaveBalancesService) {}

  @Get()
  @RequirePermissions('hr:read')
  findAll(@Req() req: any, @Query() query: any) { return this.service.findAll(req, query); }

  @Post('initialize')
  @RequirePermissions('hr:write')
  initialize(@Req() req: any, @Body() dto: InitializeBalanceDto) {
    return this.service.initialize(req, dto.employeeId, dto.year);
  }

  @Post(':id/adjust')
  @RequirePermissions('hr:write')
  adjust(@Req() req: any, @Param('id') id: string, @Body() dto: AdjustBalanceDto) {
    return this.service.adjust(req, id, dto.amount, dto.reason);
  }
}
