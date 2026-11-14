import { Module } from '@nestjs/common';
import { AccountingCoreModule } from '../accounting-core/accounting-core.module';
import { RentAccountingService } from './rent-accounting.service';
import { PropertiesController } from './properties.controller';
import { UnitsController } from './units.controller';
import { LeaseContractsController } from './lease-contracts.controller';
import { RentPaymentsController } from './rent-payments.controller';
import { PropertiesService } from './properties.service';
import { UnitsService } from './units.service';
import { LeaseContractsService } from './lease-contracts.service';
import { RentPaymentsService } from './rent-payments.service';
import { EjarService } from './ejar.service';

@Module({
  imports: [AccountingCoreModule],
  controllers: [
    PropertiesController,
    UnitsController,
    LeaseContractsController,
    RentPaymentsController,
  ],
  providers: [
    PropertiesService,
    UnitsService,
    LeaseContractsService,
    RentPaymentsService,
    RentAccountingService,
    EjarService,
  ],
  exports: [
    PropertiesService,
    UnitsService,
    LeaseContractsService,
    RentPaymentsService,
    RentAccountingService,
  ],
})
export class RealEstateModule {}
