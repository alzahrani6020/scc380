import { Module } from '@nestjs/common';
import { FieldDevicesController } from './field-devices.controller';

@Module({ controllers: [FieldDevicesController] })
export class FieldDevicesModule {}
