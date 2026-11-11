import { Module } from '@nestjs/common';
import { ContactsController } from './contacts.controller';
import { ContactsService } from './contacts.service';
import { DealsController } from './deals.controller';
import { DealsService } from './deals.service';
import { ActivitiesController } from './activities.controller';
import { ActivitiesService } from './activities.service';
import { ActivityReminderService } from './activity-reminder.service';
import { CompaniesController } from './companies.controller';
import { CompaniesService } from './companies.service';
import { PipelinesController } from './pipelines.controller';
import { PipelinesService } from './pipelines.service';
import { CrmCsvController } from './crm-csv.controller';
import { CrmCsvService } from './crm-csv.service';

@Module({
  controllers: [
    ContactsController,
    DealsController,
    ActivitiesController,
    CompaniesController,
    PipelinesController,
    CrmCsvController,
  ],
  providers: [
    ContactsService,
    DealsService,
    ActivitiesService,
    ActivityReminderService,
    CompaniesService,
    PipelinesService,
    CrmCsvService,
  ],
})
export class CrmModule {}
