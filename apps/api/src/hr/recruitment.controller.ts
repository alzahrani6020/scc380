import { Body, Controller, Get, Param, Post, Query, Req, Res, StreamableFile, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsIn, IsInt, IsNumber, IsOptional, IsString, MaxLength, Min } from 'class-validator';
import type { Response } from 'express';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionsGuard, RequirePermissions } from '../auth/guards/permissions.guard';
import { RecruitmentService } from './recruitment.service';

class CreateJobDto {
  @IsString() title: string;
  @IsString() @IsOptional() code?: string;
  @IsString() @IsOptional() departmentId?: string;
  @Type(() => Number) @IsInt() @Min(1) @IsOptional() headcount?: number;
  @IsString() @IsOptional() employmentType?: string;
  @IsString() @IsOptional() location?: string;
  @IsString() @MaxLength(5000) @IsOptional() description?: string;
  @IsString() @MaxLength(5000) @IsOptional() requirements?: string;
}
class AddCandidateDto {
  @IsString() jobOpeningId: string;
  @IsString() firstName: string;
  @IsString() lastName: string;
  @IsString() @IsOptional() email?: string;
  @IsString() @IsOptional() phone?: string;
  @IsString() @IsOptional() source?: string;
  @IsString() @IsOptional() notes?: string;
  @IsString() @IsOptional() resumeFileName?: string;
  @IsString() @IsOptional() resumeMimeType?: string;
  @IsString() @IsOptional() resumeContentBase64?: string;
}
class StatusDto { @IsString() status: string; @IsString() @IsOptional() notes?: string; }
class InterviewDto {
  @IsString() scheduledAt: string;
  @IsString() @IsOptional() interviewerUserId?: string;
  @IsString() @IsOptional() type?: string;
}
class CompleteInterviewDto {
  @Type(() => Number) @IsNumber() @Min(0) score: number;
  @IsString() @IsOptional() feedback?: string;
}
class OfferDto {
  @Type(() => Number) @IsNumber() @Min(0.01) offerSalary: number;
  @IsString() @IsOptional() notes?: string;
}
class HireDto {
  @IsString() employeeCode: string;
  @IsString() hireDate: string;
  @IsString() @IsOptional() jobTitle?: string;
  @IsString() @IsOptional() employmentType?: string;
  @Type(() => Number) @IsNumber() @Min(0) @IsOptional() basicSalary?: number;
  @Type(() => Number) @IsNumber() @Min(0) @IsOptional() housingAllowance?: number;
  @Type(() => Number) @IsNumber() @Min(0) @IsOptional() transportAllowance?: number;
  @Type(() => Number) @IsNumber() @Min(0) @IsOptional() otherAllowances?: number;
}

@ApiTags('HR - Recruitment')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('hr/recruitment')
export class RecruitmentController {
  constructor(private readonly service: RecruitmentService) {}

  @Get('jobs') @RequirePermissions('hr:read')
  jobs(@Req() req: any, @Query() query: any) { return this.service.jobs(req, query); }

  @Post('jobs') @RequirePermissions('hr:write')
  createJob(@Req() req: any, @Body() dto: CreateJobDto) { return this.service.createJob(req, dto); }

  @Post('jobs/:id/status') @RequirePermissions('hr:write')
  jobStatus(@Req() req: any, @Param('id') id: string, @Body() dto: StatusDto) { return this.service.setJobStatus(req, id, dto.status); }

  @Get('candidates') @RequirePermissions('hr:read')
  candidates(@Req() req: any, @Query() query: any) { return this.service.candidates(req, query); }

  @Post('candidates') @RequirePermissions('hr:write')
  addCandidate(@Req() req: any, @Body() dto: AddCandidateDto) { return this.service.addCandidate(req, dto); }

  @Get('candidates/:id/resume') @RequirePermissions('hr:read')
  async resume(@Req() req: any, @Param('id') id: string, @Res({ passthrough: true }) res: Response) {
    const c = await this.service.getResume(req, id);
    res.setHeader('Content-Type', c.resumeMimeType!);
    res.setHeader('Content-Length', String(c.resumeSizeBytes || c.resumeContent!.length));
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Content-Disposition', `attachment; filename*=UTF-8''${encodeURIComponent(c.resumeFileName!)}`);
    return new StreamableFile(Buffer.from(c.resumeContent!));
  }

  @Post('candidates/:id/status') @RequirePermissions('hr:write')
  candidateStatus(@Req() req: any, @Param('id') id: string, @Body() dto: StatusDto) {
    return this.service.setCandidateStatus(req, id, dto.status, dto.notes);
  }

  @Post('candidates/:id/interviews') @RequirePermissions('hr:write')
  interview(@Req() req: any, @Param('id') id: string, @Body() dto: InterviewDto) {
    return this.service.scheduleInterview(req, id, dto);
  }

  @Post('candidates/:id/interviews/:interviewId/complete') @RequirePermissions('hr:write')
  completeInterview(@Req() req: any, @Param('id') id: string, @Param('interviewId') interviewId: string, @Body() dto: CompleteInterviewDto) {
    return this.service.completeInterview(req, id, interviewId, dto);
  }

  @Post('candidates/:id/offer') @RequirePermissions('hr:write')
  offer(@Req() req: any, @Param('id') id: string, @Body() dto: OfferDto) { return this.service.makeOffer(req, id, dto); }

  @Post('candidates/:id/hire') @RequirePermissions('hr:write')
  hire(@Req() req: any, @Param('id') id: string, @Body() dto: HireDto) { return this.service.hire(req, id, dto); }
}
