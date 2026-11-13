import { Module } from '@nestjs/common';
import { AccountingPostingService } from './accounting-posting.service';
import { AccountMappingService } from './account-mapping.service';
import { AccountingDualWriteService } from './accounting-dual-write.service';
import { CurrencyAccountingService } from './currency-accounting.service';
import { VatLedgerService } from './vat-ledger.service';

@Module({
  providers: [AccountingPostingService, AccountMappingService, AccountingDualWriteService, CurrencyAccountingService, VatLedgerService],
  exports: [AccountingPostingService, AccountMappingService, AccountingDualWriteService, CurrencyAccountingService, VatLedgerService],
})
export class AccountingCoreModule {}
