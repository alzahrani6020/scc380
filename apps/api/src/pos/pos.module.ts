import { Module } from '@nestjs/common';
import { PosController } from './pos.controller';
import { PosService } from './pos.service';
import { AccountingCoreModule } from '../accounting-core/accounting-core.module';

@Module({
  imports: [AccountingCoreModule],
  controllers: [PosController],
  providers: [PosService],
  exports: [PosService],
})
export class PosModule {}
