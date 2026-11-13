import { Body, Controller, Get, Param, Post, Query, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { IsInt, IsString, Max, Min } from 'class-validator';
import { Type } from 'class-transformer';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionsGuard, RequirePermissions } from '../auth/guards/permissions.guard';
import { YearEndClosingService } from './year-end-closing.service';

class CloseFiscalYearDto {
  @Type(() => Number)
  @IsInt()
  @Min(1900)
  @Max(3000)
  year: number;

  @IsString()
  retainedEarningsAccountId: string;
}

@ApiTags('Finance - Year End Closing')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('finance/year-end-closing')
export class YearEndClosingController {
  constructor(private readonly service: YearEndClosingService) {}

  @Get()
  @RequirePermissions('erp:read')
  list(@Req() req: any, @Query('year') rawYear?: string) {
    const year = rawYear ? Number(rawYear) : undefined;
    return this.service.list(req, year);
  }

  @Get('preview')
  @RequirePermissions('erp:read')
  preview(
    @Req() req: any,
    @Query('year') rawYear: string,
    @Query('retainedEarningsAccountId') retainedEarningsAccountId: string,
  ) {
    return this.service.preview(
      req,
      Number(rawYear),
      retainedEarningsAccountId,
    );
  }

  @Post()
  @RequirePermissions('erp:write')
  close(@Req() req: any, @Body() dto: CloseFiscalYearDto) {
    return this.service.close(req, dto);
  }

  @Post(':year/reverse')
  @RequirePermissions('erp:write')
  reverse(@Req() req: any, @Param('year') rawYear: string) {
    return this.service.reverse(req, Number(rawYear));
  }
}
