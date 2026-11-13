import { Body, Controller, Get, Param, Post, Query, Req, Res, StreamableFile, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import { IsIn, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionsGuard, RequirePermissions } from '../auth/guards/permissions.guard';
import { GOVERNANCE_CATEGORIES, HrGovernanceService } from './hr-governance.service';

class NewCaseDto {
  @IsString() employeeId: string;
  @IsString() @IsOptional() contractId?: string;
  @IsIn([...GOVERNANCE_CATEGORIES]) category: string;
  @IsString() @MinLength(5) @MaxLength(180) title: string;
  @IsString() @MinLength(10) @MaxLength(4000) description: string;
  @IsIn(['NORMAL', 'HIGH', 'CRITICAL']) @IsOptional() priority?: string;
}
class EvidenceDto {
  @IsString() @MaxLength(255) fileName: string;
  @IsIn(['application/pdf','image/jpeg','image/png']) mimeType: string;
  @IsString() contentBase64: string;
  @IsString() @MaxLength(1000) @IsOptional() description?: string;
}
class NoteDto { @IsString() @MinLength(2) @MaxLength(4000) details: string; }
class TransitionDto {
  @IsIn(['IN_REVIEW', 'RESOLVED', 'CLOSED']) status: string;
  @IsString() @MaxLength(4000) @IsOptional() resolution?: string;
}
@ApiTags('HR - Governance Cases')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('hr/governance')
export class HrGovernanceController {
  constructor(private readonly service: HrGovernanceService) {}
  @Get()
  @RequirePermissions('hr:governance:read')
  list(@Req() req: any, @Query() query: any) { return this.service.list(req, query); }
  @Get(':id')
  @RequirePermissions('hr:governance:read')
  one(@Req() req: any, @Param('id') id: string) { return this.service.findOne(req, id); }
  @Post()
  @RequirePermissions('hr:governance:write')
  create(@Req() req: any, @Body() dto: NewCaseDto) { return this.service.create(req, dto); }
  @Get(':id/evidence')
  @RequirePermissions('hr:governance:read')
  evidenceList(@Req() req: any, @Param('id') id: string) { return this.service.listEvidence(req,id); }
  @Post(':id/evidence')
  @RequirePermissions('hr:governance:write')
  uploadEvidence(@Req() req: any, @Param('id') id: string, @Body() dto: EvidenceDto) {
    return this.service.addEvidence(req,id,dto);
  }
  @Get(':id/evidence/:evidenceId/download')
  @RequirePermissions('hr:governance:read')
  async downloadEvidence(@Req() req:any, @Param('id') id:string, @Param('evidenceId') evidenceId:string,
    @Res({passthrough:true}) res:Response) {
    const item=await this.service.getEvidence(req,id,evidenceId);
    res.setHeader('Content-Type',item.mimeType);
    res.setHeader('X-Content-Type-Options','nosniff');
    res.setHeader('Content-Disposition',`attachment; filename*=UTF-8''${encodeURIComponent(item.fileName)}`);
    return new StreamableFile(Buffer.from(item.content));
  }
  @Post(':id/notes')
  @RequirePermissions('hr:governance:write')
  note(@Req() req: any, @Param('id') id: string, @Body() dto: NoteDto) { return this.service.addNote(req, id, dto.details); }
  @Post(':id/transition')
  @RequirePermissions('hr:governance:write')
  transition(@Req() req: any, @Param('id') id: string, @Body() dto: TransitionDto) {
    return this.service.transition(req, id, dto.status, dto.resolution);
  }
}
