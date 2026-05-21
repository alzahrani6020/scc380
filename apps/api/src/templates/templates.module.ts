import { Module } from '@nestjs/common';
import { TemplatesService } from './templates.service';
import { TemplatesController } from './templates.controller';
import { TemplatesSeedController } from './templates.seed.controller';

@Module({
  controllers: [TemplatesController, TemplatesSeedController],
  providers: [TemplatesService],
  exports: [TemplatesService],
})
export class TemplatesModule {}
