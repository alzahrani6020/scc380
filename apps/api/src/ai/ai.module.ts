import { Module } from '@nestjs/common';
import { AnalyticsModule } from '../analytics/analytics.module';
import { AiController } from './ai.controller';
import { AiService } from './ai.service';
import { ConversationsController } from './conversations.controller';
import { ConversationsService } from './conversations.service';
import { SccIntelligenceService } from './scc-intelligence.service';

@Module({
  imports: [AnalyticsModule],
  controllers: [AiController, ConversationsController],
  providers: [AiService, ConversationsService, SccIntelligenceService],
})
export class AiModule {}
