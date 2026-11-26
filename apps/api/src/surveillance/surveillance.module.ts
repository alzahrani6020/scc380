import { Module } from '@nestjs/common';
import { SurveillanceController } from './surveillance.controller';

@Module({ controllers: [SurveillanceController] })
export class SurveillanceModule {}
