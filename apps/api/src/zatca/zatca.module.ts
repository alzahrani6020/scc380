import { Module } from '@nestjs/common';
import { ZatcaController } from './zatca.controller';
import { ZatcaService } from './zatca.service';
import { ZatcaCredentialService } from './zatca-credential.service';

@Module({
  controllers: [ZatcaController],
  providers: [ZatcaService, ZatcaCredentialService],
})
export class ZatcaModule {}
