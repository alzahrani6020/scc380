import { Body, Controller, Post, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsArray,
  IsDateString,
  IsNumber,
  IsOptional,
  IsString,
  ValidateNested,
} from 'class-validator';
import { AccountingPostingService } from '../accounting-core/accounting-posting.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionsGuard, RequirePermissions } from '../auth/guards/permissions.guard';

class AccountingJournalLineDto {
  @IsString() accountId: string;
  @IsNumber() @IsOptional() debitAmount?: number;
  @IsNumber() @IsOptional() creditAmount?: number;
  @IsString() @IsOptional() description?: string;
  @IsString() @IsOptional() costCenterId?: string;
  @IsString() @IsOptional() projectId?: string;
  @IsString() @IsOptional() branchId?: string;
}

class PostAccountingJournalDto {
  @IsString() entryNumber: string;
  @IsString() description: string;
  @IsString() @IsOptional() reference?: string;
  @IsDateString() @IsOptional() date?: string;
  @IsString() @IsOptional() sourceType?: string;
  @IsString() @IsOptional() sourceId?: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => AccountingJournalLineDto)
  lines: AccountingJournalLineDto[];
}

@ApiTags('Finance - Accounting Journals')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('finance/accounting-journals')
export class AccountingJournalsController {
  constructor(private readonly posting: AccountingPostingService) {}

  @Post()
  @RequirePermissions('erp:write')
  post(@Req() req: any, @Body() dto: PostAccountingJournalDto) {
    return this.posting.post({
      tenantId: req.user?.tenantId,
      entryNumber: dto.entryNumber,
      date: dto.date ? new Date(dto.date) : undefined,
      description: dto.description,
      reference: dto.reference,
      sourceType: dto.sourceType,
      sourceId: dto.sourceId,
      lines: dto.lines,
    });
  }
}
