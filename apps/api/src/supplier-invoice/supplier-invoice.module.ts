import { Module } from '@nestjs/common';
import { SupplierInvoiceController } from './supplier-invoice.controller';
import { SupplierInvoiceService } from './supplier-invoice.service';
import { AccountingCoreModule } from '../accounting-core/accounting-core.module';

@Module({
  imports: [AccountingCoreModule],
  controllers: [SupplierInvoiceController],
  providers: [SupplierInvoiceService],
})
export class SupplierInvoiceModule {}
