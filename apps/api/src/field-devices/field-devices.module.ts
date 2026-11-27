import { Module } from '@nestjs/common';
import { FieldDevicesController } from './field-devices.controller';
import { FieldDeviceInventoryController } from './field-device-inventory.controller';

@Module({ controllers: [FieldDevicesController, FieldDeviceInventoryController] })
export class FieldDevicesModule {}
