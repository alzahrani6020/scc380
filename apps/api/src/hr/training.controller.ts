import { Body, Controller, Get, Param, Post, Query, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsBoolean, IsInt, IsNumber, IsOptional, IsString, Min } from 'class-validator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionsGuard, RequirePermissions } from '../auth/guards/permissions.guard';
import { TrainingService } from './training.service';

class CreateCourseDto {
  @IsString() title: string;
  @IsString() @IsOptional() code?: string;
  @IsString() @IsOptional() provider?: string;
  @Type(() => Number) @IsNumber() @Min(0.01) @IsOptional() hours?: number;
  @IsString() @IsOptional() deliveryMode?: string;
  @Type(() => Number) @IsNumber() @Min(0) @IsOptional() cost?: number;
  @IsBoolean() @IsOptional() certificateRequired?: boolean;
  @IsString() @IsOptional() description?: string;
}
class CreateSessionDto {
  @IsString() courseId: string;
  @IsString() startAt: string;
  @IsString() endAt: string;
  @Type(() => Number) @IsInt() @Min(1) @IsOptional() capacity?: number;
  @IsString() @IsOptional() location?: string;
  @IsString() @IsOptional() trainer?: string;
}
class EnrollmentDto {
  @IsString() employeeId: string;
  @IsString() @IsOptional() status?: string;
  @IsString() @IsOptional() notes?: string;
}
class UpdateEnrollmentDto {
  @IsString() status: string;
  @Type(() => Number) @IsNumber() @IsOptional() score?: number;
  @IsString() @IsOptional() certificateNumber?: string;
  @IsString() @IsOptional() certificateUrl?: string;
  @IsString() @IsOptional() notes?: string;
}
class StatusDto { @IsString() status: string; }

@ApiTags('HR - Training')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('hr/training')
export class TrainingController {
  constructor(private readonly service: TrainingService) {}

  @Get('courses') @RequirePermissions('hr:read')
  courses(@Req() req: any, @Query() query: any) { return this.service.courses(req, query); }
  @Post('courses') @RequirePermissions('hr:write')
  createCourse(@Req() req: any, @Body() dto: CreateCourseDto) { return this.service.createCourse(req, dto); }

  @Get('sessions') @RequirePermissions('hr:read')
  sessions(@Req() req: any, @Query() query: any) { return this.service.sessions(req, query); }
  @Post('sessions') @RequirePermissions('hr:write')
  createSession(@Req() req: any, @Body() dto: CreateSessionDto) { return this.service.createSession(req, dto); }
  @Post('sessions/:id/status') @RequirePermissions('hr:write')
  sessionStatus(@Req() req: any, @Param('id') id: string, @Body() dto: StatusDto) { return this.service.setSessionStatus(req, id, dto.status); }

  @Post('sessions/:id/enrollments') @RequirePermissions('hr:write')
  enroll(@Req() req: any, @Param('id') id: string, @Body() dto: EnrollmentDto) { return this.service.enroll(req, id, dto); }
  @Post('sessions/:id/enrollments/:enrollmentId') @RequirePermissions('hr:write')
  updateEnrollment(@Req() req: any, @Param('id') id: string, @Param('enrollmentId') enrollmentId: string, @Body() dto: UpdateEnrollmentDto) {
    return this.service.updateEnrollment(req, id, enrollmentId, dto);
  }
}

@ApiTags('HR - Self Training')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('hr/self/training')
export class TrainingSelfController {
  constructor(private readonly service: TrainingService) {}
  @Get() list(@Req() req: any) { return this.service.selfTraining(req); }
}
