import { Module } from '@nestjs/common';
import { AccountingPostingService } from './accounting-posting.service';
import { AccountMappingService } from './account-mapping.service';
import { AccountingDualWriteService } from './accounting-dual-write.service';
import { CurrencyAccountingService } from './currency-accounting.service';

@Module({
  providers: [AccountingPostingService, AccountMappingService, AccountingDualWriteService, CurrencyAccountingService],
  exports: [AccountingPostingService, AccountMappingService, AccountingDualWriteService, CurrencyAccountingService],
})
export class AccountingCoreModule {}
