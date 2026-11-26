import { Module } from '@nestjs/common';
import { SurveillanceController } from './surveillance.controller';
import { SurveillanceGatewayController } from './surveillance-gateway.controller';

@Module({ controllers: [SurveillanceController, SurveillanceGatewayController] })
export class SurveillanceModule {}
