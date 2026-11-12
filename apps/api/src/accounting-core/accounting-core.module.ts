import { Module } from '@nestjs/common';
import { AccountingPostingService } from './accounting-posting.service';

@Module({
  providers: [AccountingPostingService],
  exports: [AccountingPostingService],
})
export class AccountingCoreModule {}
