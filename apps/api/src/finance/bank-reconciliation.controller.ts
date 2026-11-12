import { Body, Controller, Delete, Get, Param, Post, Query, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { IsArray, IsDateString, IsNumber, IsOptional, IsString, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionsGuard, RequirePermissions } from '../auth/guards/permissions.guard';
import { BankReconciliationService } from './bank-reconciliation.service';

class CreateBankReconciliationDto {
  @IsString() bankAccountId: string;
  @IsDateString() startDate: string;
  @IsDateString() endDate: string;
  @IsNumber() openingBalance: number;
  @IsNumber() endingBalance: number;
}

class BankStatementLineDto {
  @IsDateString() transactionDate: string;
  @IsNumber() amount: number;
  @IsString() @IsOptional() reference?: string;
  @IsString() @IsOptional() description?: string;
  @IsString() @IsOptional() externalId?: string;
}

class AddBankStatementLinesDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => BankStatementLineDto)
  lines: BankStatementLineDto[];
}

class MatchBankStatementLineDto {
  @IsString() @IsOptional() journalEntryLineId?: string;
  @IsString() @IsOptional() legacyJournalEntryId?: string;
}

@ApiTags('Finance - Bank Reconciliation')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('finance/bank-reconciliations')
export class BankReconciliationController {
  constructor(private readonly service: BankReconciliationService) {}

  @Get()
  @RequirePermissions('erp:read')
  findAll(@Req() req: any, @Query('bankAccountId') bankAccountId?: string) {
    return this.service.findAll(req, bankAccountId);
  }

  @Get(':id')
  @RequirePermissions('erp:read')
  findOne(@Req() req: any, @Param('id') id: string) {
    return this.service.findOne(req, id);
  }

  @Post()
  @RequirePermissions('erp:write')
  create(@Req() req: any, @Body() dto: CreateBankReconciliationDto) {
    return this.service.create(req, dto);
  }

  @Post(':id/lines')
  @RequirePermissions('erp:write')
  addLines(@Req() req: any, @Param('id') id: string, @Body() dto: AddBankStatementLinesDto) {
    return this.service.addLines(req, id, dto.lines);
  }

  @Post(':id/auto-match')
  @RequirePermissions('erp:write')
  autoMatch(@Req() req: any, @Param('id') id: string) {
    return this.service.autoMatch(req, id);
  }

  @Post(':id/lines/:lineId/match')
  @RequirePermissions('erp:write')
  matchLine(
    @Req() req: any,
    @Param('id') id: string,
    @Param('lineId') lineId: string,
    @Body() dto: MatchBankStatementLineDto,
  ) {
    return this.service.matchLine(req, id, lineId, dto);
  }

  @Post(':id/lines/:lineId/unmatch')
  @RequirePermissions('erp:write')
  unmatchLine(@Req() req: any, @Param('id') id: string, @Param('lineId') lineId: string) {
    return this.service.unmatchLine(req, id, lineId);
  }

  @Post(':id/complete')
  @RequirePermissions('erp:write')
  complete(@Req() req: any, @Param('id') id: string) {
    return this.service.complete(req, id);
  }

  @Post(':id/reopen')
  @RequirePermissions('erp:write')
  reopen(@Req() req: any, @Param('id') id: string) {
    return this.service.reopen(req, id);
  }

  @Delete(':id')
  @RequirePermissions('erp:write')
  remove(@Req() req: any, @Param('id') id: string) {
    return this.service.remove(req, id);
  }
}
