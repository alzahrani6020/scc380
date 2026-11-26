import { Module } from '@nestjs/common';
import { SurveillanceController } from './surveillance.controller';
import { SurveillanceGatewayController } from './surveillance-gateway.controller';
import { SurveillanceDeviceCommandsController } from './surveillance-device-commands.controller';

@Module({ controllers: [SurveillanceController, SurveillanceGatewayController, SurveillanceDeviceCommandsController] })
export class SurveillanceModule {}
