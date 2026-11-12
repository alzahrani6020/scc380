import { Body, Controller, Get, Param, Patch, Post, Query, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsNumber, IsOptional, IsString, MaxLength, Min } from 'class-validator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionsGuard, RequirePermissions } from '../auth/guards/permissions.guard';
import { PerformanceService } from './performance.service';

class CreateCycleDto { @IsString() name: string; @IsString() startDate: string; @IsString() endDate: string; }
class StatusDto { @IsString() status: string; }
class CreateReviewDto { @IsString() cycleId: string; @IsString() employeeId: string; @IsString() @IsOptional() reviewerUserId?: string; }
class GoalDto {
  @IsString() title: string;
  @IsString() @MaxLength(2000) @IsOptional() description?: string;
  @Type(() => Number) @IsNumber() @Min(0.01) weight: number;
  @IsString() @IsOptional() target?: string;
}
class GoalUpdateDto {
  @IsString() @IsOptional() title?: string;
  @IsString() @IsOptional() description?: string;
  @Type(() => Number) @IsNumber() @IsOptional() weight?: number;
  @IsString() @IsOptional() target?: string;
  @IsString() @IsOptional() result?: string;
  @Type(() => Number) @IsNumber() @IsOptional() rating?: number;
  @IsString() @IsOptional() status?: string;
}
class SubmitDto { @IsString() @MaxLength(5000) @IsOptional() managerSummary?: string; }
class AckDto { @IsString() @MaxLength(5000) @IsOptional() employeeComment?: string; }

@ApiTags('HR - Performance')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('hr/performance')
export class PerformanceController {
  constructor(private readonly service: PerformanceService) {}

  @Get('cycles') @RequirePermissions('hr:read')
  cycles(@Req() req: any) { return this.service.cycles(req); }
  @Post('cycles') @RequirePermissions('hr:write')
  createCycle(@Req() req: any, @Body() dto: CreateCycleDto) { return this.service.createCycle(req, dto); }
  @Post('cycles/:id/status') @RequirePermissions('hr:write')
  cycleStatus(@Req() req: any, @Param('id') id: string, @Body() dto: StatusDto) { return this.service.setCycleStatus(req, id, dto.status); }

  @Get('reviews') @RequirePermissions('hr:read')
  reviews(@Req() req: any, @Query() query: any) { return this.service.reviews(req, query); }
  @Post('reviews') @RequirePermissions('hr:write')
  createReview(@Req() req: any, @Body() dto: CreateReviewDto) { return this.service.createReview(req, dto); }
  @Post('reviews/:id/goals') @RequirePermissions('hr:write')
  addGoal(@Req() req: any, @Param('id') id: string, @Body() dto: GoalDto) { return this.service.addGoal(req, id, dto); }
  @Patch('reviews/:id/goals/:goalId') @RequirePermissions('hr:write')
  updateGoal(@Req() req: any, @Param('id') id: string, @Param('goalId') goalId: string, @Body() dto: GoalUpdateDto) {
    return this.service.updateGoal(req, id, goalId, dto);
  }
  @Post('reviews/:id/submit') @RequirePermissions('hr:write')
  submit(@Req() req: any, @Param('id') id: string, @Body() dto: SubmitDto) { return this.service.submit(req, id, dto); }
}

@ApiTags('HR - Self Performance')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('hr/self/performance')
export class PerformanceSelfController {
  constructor(private readonly service: PerformanceService) {}
  @Get() list(@Req() req: any) { return this.service.selfReviews(req); }
  @Post(':id/acknowledge') acknowledge(@Req() req: any, @Param('id') id: string, @Body() dto: AckDto) {
    return this.service.acknowledge(req, id, dto.employeeComment);
  }
}
