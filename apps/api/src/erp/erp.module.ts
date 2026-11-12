import { Module } from '@nestjs/common';
import { InvoicesController } from './invoices.controller';
import { InvoicesService } from './invoices.service';
import { AccountingCoreModule } from '../accounting-core/accounting-core.module';

@Module({
  imports: [AccountingCoreModule],
  controllers: [InvoicesController],
  providers: [InvoicesService],
})
export class ErpModule {}
