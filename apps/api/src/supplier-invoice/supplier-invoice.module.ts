import { Module } from '@nestjs/common';
import { SupplierInvoiceController } from './supplier-invoice.controller';
import { SupplierInvoiceService } from './supplier-invoice.service';

@Module({
  controllers: [SupplierInvoiceController],
  providers: [SupplierInvoiceService],
})
export class SupplierInvoiceModule {}
