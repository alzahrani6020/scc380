import { Module } from '@nestjs/common';
import { ContactsController } from './contacts.controller';
import { ContactsService } from './contacts.service';
import { DealsController } from './deals.controller';
import { DealsService } from './deals.service';
import { ActivitiesController } from './activities.controller';
import { ActivitiesService } from './activities.service';

@Module({
  controllers: [ContactsController, DealsController, ActivitiesController],
  providers: [ContactsService, DealsService, ActivitiesService],
})
export class CrmModule {}
