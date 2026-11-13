import { Body, Controller, Get, Patch, Post, Query, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsArray,
  IsDateString,
  IsNumber,
  IsOptional,
  IsString,
  Matches,
  ValidateNested,
} from 'class-validator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionsGuard, RequirePermissions } from '../auth/guards/permissions.guard';
import { ForeignExchangeService } from './foreign-exchange.service';

class CurrencyDto {
  @IsString()
  @Matches(/^[A-Za-z]{3}$/)
  currency: string;
}

class FxSettlementAccountsDto {
  @IsString() gainAccountId: string;
  @IsString() lossAccountId: string;
}

class ExchangeRateDto {
  @IsString() @Matches(/^[A-Za-z]{3}$/) fromCurrency: string;
  @IsString() @Matches(/^[A-Za-z]{3}$/) toCurrency: string;
  @IsNumber() rate: number;
  @IsDateString() effectiveDate: string;
  @IsString() @IsOptional() source?: string;
}

class ForeignJournalLineDto {
  @IsString() accountId: string;
  @IsNumber() @IsOptional() foreignDebitAmount?: number;
  @IsNumber() @IsOptional() foreignCreditAmount?: number;
  @IsString() @IsOptional() description?: string;
  @IsString() @IsOptional() costCenterId?: string;
  @IsString() @IsOptional() projectId?: string;
  @IsString() @IsOptional() branchId?: string;
}

class ForeignJournalDto {
  @IsString() entryNumber: string;
  @IsString() description: string;
  @IsString() @Matches(/^[A-Za-z]{3}$/) currency: string;
  @IsDateString() @IsOptional() date?: string;
  @IsNumber() @IsOptional() exchangeRate?: number;
  @IsString() @IsOptional() reference?: string;
  @IsString() @IsOptional() sourceType?: string;
  @IsString() @IsOptional() sourceId?: string;
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ForeignJournalLineDto)
  lines: ForeignJournalLineDto[];
}

class RevaluationDto {
  @IsString() accountId: string;
  @IsString() @Matches(/^[A-Za-z]{3}$/) currency: string;
  @IsDateString() asOfDate: string;
  @IsString() gainAccountId: string;
  @IsString() lossAccountId: string;
  @IsString() @IsOptional() entryNumber?: string;
  @IsString() @IsOptional() reference?: string;
}

@ApiTags('Finance - Foreign Exchange')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('finance/fx')
export class ForeignExchangeController {
  constructor(private readonly service: ForeignExchangeService) {}

  @Get('config')
  @RequirePermissions('erp:read')
  getConfig(@Req() req: any) {
    return this.service.getConfig(req);
  }

  @Patch('config/base-currency')
  @RequirePermissions('erp:write')
  setBaseCurrency(@Req() req: any, @Body() dto: CurrencyDto) {
    return this.service.setBaseCurrency(req, dto.currency);
  }

  @Patch('config/settlement-accounts')
  @RequirePermissions('erp:write')
  setSettlementAccounts(@Req() req: any, @Body() dto: FxSettlementAccountsDto) {
    return this.service.setSettlementAccounts(req, dto.gainAccountId, dto.lossAccountId);
  }

  @Get('rates')
  @RequirePermissions('erp:read')
  listRates(
    @Req() req: any,
    @Query('fromCurrency') fromCurrency?: string,
    @Query('toCurrency') toCurrency?: string,
  ) {
    return this.service.listRates(req, { fromCurrency, toCurrency });
  }

  @Post('rates')
  @RequirePermissions('erp:write')
  createRate(@Req() req: any, @Body() dto: ExchangeRateDto) {
    return this.service.createRate(req, dto);
  }

  @Post('journals')
  @RequirePermissions('erp:write')
  postForeignJournal(@Req() req: any, @Body() dto: ForeignJournalDto) {
    return this.service.postForeignJournal(req, dto);
  }

  @Post('revalue')
  @RequirePermissions('erp:write')
  revalue(@Req() req: any, @Body() dto: RevaluationDto) {
    return this.service.revalue(req, dto);
  }
}
