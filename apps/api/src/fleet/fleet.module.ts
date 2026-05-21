import { Module } from '@nestjs/common';
import { VehiclesController } from './vehicles.controller';
import { VehiclesService } from './vehicles.service';
import { FleetTripsController } from './fleet-trips.controller';
import { FleetTripsService } from './fleet-trips.service';
import { DriversController } from './drivers.controller';
import { DriversService } from './drivers.service';
import { FleetMaintenanceController } from './fleet-maintenance.controller';
import { FleetMaintenanceService } from './fleet-maintenance.service';
import { FleetFuelLogsController } from './fleet-fuel-logs.controller';
import { FleetFuelLogsService } from './fleet-fuel-logs.service';

@Module({
  controllers: [
    VehiclesController,
    FleetTripsController,
    DriversController,
    FleetMaintenanceController,
    FleetFuelLogsController,
  ],
  providers: [
    VehiclesService,
    FleetTripsService,
    DriversService,
    FleetMaintenanceService,
    FleetFuelLogsService,
  ],
})
export class FleetModule {}
