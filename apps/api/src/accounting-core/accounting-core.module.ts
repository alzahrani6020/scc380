import { Module } from '@nestjs/common';
import { AccountingPostingService } from './accounting-posting.service';
import { AccountMappingService } from './account-mapping.service';
import { AccountingDualWriteService } from './accounting-dual-write.service';

@Module({
  providers: [AccountingPostingService, AccountMappingService, AccountingDualWriteService],
  exports: [AccountingPostingService, AccountMappingService, AccountingDualWriteService],
})
export class AccountingCoreModule {}
