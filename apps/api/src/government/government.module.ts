import { Module } from '@nestjs/common';
import { GovernmentController } from './government.controller';
import { GovernmentService } from './government.service';

@Module({
  controllers: [GovernmentController],
  providers: [GovernmentService],
})
export class GovernmentModule {}
