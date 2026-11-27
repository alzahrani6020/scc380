import { Module } from '@nestjs/common';
import { FieldDevicesController } from './field-devices.controller';
import { FieldDeviceInventoryController } from './field-device-inventory.controller';
import { FieldDeviceAssignmentsController } from './field-device-assignments.controller';
import { FieldDeviceShiftsController } from './field-device-shifts.controller';

@Module({ controllers: [FieldDevicesController, FieldDeviceInventoryController, FieldDeviceAssignmentsController, FieldDeviceShiftsController] })
export class FieldDevicesModule {}
