import { Module } from '@nestjs/common';
import { AutoJournalService } from './auto-journal.service';

@Module({
  providers: [AutoJournalService],
  exports: [AutoJournalService],
})
export class AutoJournalModule {}
