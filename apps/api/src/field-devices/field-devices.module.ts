import { Module } from '@nestjs/common';
import { FieldDevicesController } from './field-devices.controller';
import { FieldDeviceInventoryController } from './field-device-inventory.controller';
import { FieldDeviceAssignmentsController } from './field-device-assignments.controller';

@Module({ controllers: [FieldDevicesController, FieldDeviceInventoryController, FieldDeviceAssignmentsController] })
export class FieldDevicesModule {}
