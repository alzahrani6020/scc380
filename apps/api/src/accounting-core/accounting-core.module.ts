import { Module } from '@nestjs/common';
import { AccountingPostingService } from './accounting-posting.service';
import { AccountMappingService } from './account-mapping.service';

@Module({
  providers: [AccountingPostingService, AccountMappingService],
  exports: [AccountingPostingService, AccountMappingService],
})
export class AccountingCoreModule {}
