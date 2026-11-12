import { Body, Controller, Get, Param, Patch, Query, Req, Res, StreamableFile, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';
import type { Response } from 'express';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { HrSelfService } from './self-service.service';

class UpdateSelfProfileDto {
  @IsString() @IsOptional() phone?: string;
  @IsString() @IsOptional() emergencyContactName?: string;
  @IsString() @IsOptional() emergencyContactPhone?: string;
}

@ApiTags('HR - Self Service')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('hr/self')
export class HrSelfServiceController {
  constructor(private readonly service: HrSelfService) {}

  @Get('me')
  me(@Req() req: any) { return this.service.getMe(req); }

  @Patch('profile')
  updateProfile(@Req() req: any, @Body() dto: UpdateSelfProfileDto) {
    return this.service.updateProfile(req, dto);
  }

  @Get('payroll')
  payroll(@Req() req: any, @Query('limit') limit?: string) {
    return this.service.getPayroll(req, limit);
  }

  @Get('documents')
  documents(@Req() req: any) { return this.service.getDocuments(req); }

  @Get('documents/:id/download')
  async download(@Req() req: any, @Param('id') id: string, @Res({ passthrough: true }) res: Response) {
    const doc = await this.service.getDocumentFile(req, id);
    res.setHeader('Content-Type', doc.mimeType);
    res.setHeader('Content-Length', String(doc.sizeBytes));
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Content-Disposition', `attachment; filename*=UTF-8''${encodeURIComponent(doc.fileName)}`);
    return new StreamableFile(Buffer.from(doc.content));
  }
}
