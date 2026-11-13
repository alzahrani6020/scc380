import {
  Body,
  Controller,
  Delete,
  ForbiddenException,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import {
  IsArray,
  IsBoolean,
  IsDateString,
  IsEnum,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  Min,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import {
  AccountingScheduleFrequency,
  AccountingScheduleKind,
} from '@scc/database';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionsGuard, RequirePermissions } from '../auth/guards/permissions.guard';
import { AccountingSchedulesService } from './accounting-schedules.service';

class AccountingScheduleLineDto {
  @IsString() accountId: string;
  @IsNumber() @IsOptional() debitAmount?: number;
  @IsNumber() @IsOptional() creditAmount?: number;
  @IsString() @IsOptional() description?: string;
  @IsString() @IsOptional() costCenterId?: string;
  @IsString() @IsOptional() projectId?: string;
  @IsString() @IsOptional() branchId?: string;
}

class CreateAccountingScheduleDto {
  @IsString() name: string;
  @IsEnum(AccountingScheduleKind) kind: AccountingScheduleKind;
  @IsEnum(AccountingScheduleFrequency) frequency: AccountingScheduleFrequency;
  @IsDateString() startDate: string;
  @IsDateString() @IsOptional() endDate?: string;
  @IsBoolean() @IsOptional() autoReverse?: boolean;
  @IsInt() @Min(1) @Max(31) @IsOptional() reverseAfterDays?: number;
  @IsString() entryPrefix: string;
  @IsString() description: string;
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => AccountingScheduleLineDto)
  lines: AccountingScheduleLineDto[];
}

class UpdateAccountingScheduleDto {
  @IsString() @IsOptional() name?: string;
  @IsEnum(AccountingScheduleKind) @IsOptional() kind?: AccountingScheduleKind;
  @IsEnum(AccountingScheduleFrequency) @IsOptional() frequency?: AccountingScheduleFrequency;
  @IsDateString() @IsOptional() startDate?: string;
  @IsDateString() @IsOptional() endDate?: string;
  @IsBoolean() @IsOptional() autoReverse?: boolean;
  @IsInt() @Min(1) @Max(31) @IsOptional() reverseAfterDays?: number;
  @IsString() @IsOptional() entryPrefix?: string;
  @IsString() @IsOptional() description?: string;
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => AccountingScheduleLineDto)
  @IsOptional()
  lines?: AccountingScheduleLineDto[];
}

class RunDueDto {
  @IsDateString() @IsOptional() asOf?: string;
}

class ReverseScheduleRunDto {
  @IsDateString() @IsOptional() date?: string;
}

@ApiTags('Finance - Accounting Schedules')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('finance/accounting-schedules')
export class AccountingSchedulesController {
  constructor(private readonly service: AccountingSchedulesService) {}

  @Get()
  @RequirePermissions('erp:read')
  list(@Req() req: any, @Query() query: any) {
    return this.service.list(req.user?.tenantId, query);
  }

  @Get('runs')
  @RequirePermissions('erp:read')
  runs(@Req() req: any, @Query('scheduleId') scheduleId?: string) {
    return this.service.listRuns(req.user?.tenantId, scheduleId);
  }

  @Post('run-due')
  @RequirePermissions('erp:write')
  runDue(@Req() req: any, @Body() dto: RunDueDto) {
    if (!['ADMIN', 'SUPER_ADMIN'].includes(String(req.user?.role || ''))) {
      throw new ForbiddenException('Only ADMIN or SUPER_ADMIN can run due accounting schedules');
    }
    return this.service.runDue(req.user?.tenantId, dto.asOf);
  }

  @Post()
  @RequirePermissions('erp:write')
  create(@Req() req: any, @Body() dto: CreateAccountingScheduleDto) {
    return this.service.create(req.user?.tenantId, req.user?.id, dto);
  }

  @Get(':id')
  @RequirePermissions('erp:read')
  get(@Req() req: any, @Param('id') id: string) {
    return this.service.get(req.user?.tenantId, id);
  }

  @Patch(':id')
  @RequirePermissions('erp:write')
  update(@Req() req: any, @Param('id') id: string, @Body() dto: UpdateAccountingScheduleDto) {
    return this.service.update(req.user?.tenantId, id, dto);
  }

  @Post(':id/pause')
  @RequirePermissions('erp:write')
  pause(@Req() req: any, @Param('id') id: string) {
    return this.service.pause(req.user?.tenantId, id);
  }

  @Post(':id/resume')
  @RequirePermissions('erp:write')
  resume(@Req() req: any, @Param('id') id: string) {
    return this.service.resume(req.user?.tenantId, id);
  }

  @Post('runs/:runId/reverse')
  @RequirePermissions('erp:write')
  reverse(@Req() req: any, @Param('runId') runId: string, @Body() dto: ReverseScheduleRunDto) {
    return this.service.reverse(req.user?.tenantId, runId, req.user?.role, dto.date);
  }

  @Delete(':id')
  @RequirePermissions('erp:write')
  remove(@Req() req: any, @Param('id') id: string) {
    return this.service.remove(req.user?.tenantId, id);
  }
}
