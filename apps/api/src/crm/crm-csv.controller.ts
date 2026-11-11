import { Body, Controller, Get, Header, Post, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { IsBoolean, IsOptional, IsString, MaxLength } from 'class-validator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionsGuard, RequirePermissions } from '../auth/guards/permissions.guard';
import { CrmCsvService } from './crm-csv.service';

class ImportContactsCsvDto {
  @IsString()
  @MaxLength(1100000)
  csv: string;

  @IsOptional()
  @IsBoolean()
  dryRun?: boolean;
}

@ApiTags('CRM - CSV')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('crm/csv')
export class CrmCsvController {
  constructor(private readonly service: CrmCsvService) {}

  @Get('contacts')
  @Header('Content-Type', 'text/csv; charset=utf-8')
  @Header('Content-Disposition', 'attachment; filename="crm-contacts.csv"')
  @RequirePermissions('crm:read')
  exportContacts(@Req() req: any) {
    return this.service.exportContacts(req);
  }

  @Post('contacts/import')
  @RequirePermissions('crm:write')
  importContacts(@Req() req: any, @Body() dto: ImportContactsCsvDto) {
    return this.service.importContacts(req, dto.csv, dto.dryRun !== false);
  }
}
