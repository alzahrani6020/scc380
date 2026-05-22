import { Module } from '@nestjs/common';
import { ZatcaController } from './zatca.controller';
import { ZatcaService } from './zatca.service';
import { ZatcaCredentialService } from './zatca-credential.service';
import { ZatcaApiClient } from './zatca-api.client';

@Module({
  controllers: [ZatcaController],
  providers: [ZatcaService, ZatcaCredentialService, ZatcaApiClient],
  exports: [ZatcaApiClient],
})
export class ZatcaModule {}
