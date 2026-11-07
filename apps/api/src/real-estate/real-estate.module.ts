import { Module } from '@nestjs/common';
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
    EjarService,
  ],
  exports: [
    PropertiesService,
    UnitsService,
    LeaseContractsService,
    RentPaymentsService,
  ],
})
export class RealEstateModule {}
