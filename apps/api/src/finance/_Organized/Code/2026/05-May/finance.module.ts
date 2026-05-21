import { Module } from '@nestjs/common';
import { PaymentsController } from './payments.controller';
import { PaymentsService } from './payments.service';
import { ExpensesController } from './expenses.controller';
import { ExpensesService } from './expenses.service';
import { ChartOfAccountsController } from './chart-of-accounts.controller';
import { ChartOfAccountsService } from './chart-of-accounts.service';
import { JournalEntriesController } from './journal-entries.controller';
import { JournalEntriesService } from './journal-entries.service';
import { BankAccountsController } from './bank-accounts.controller';
import { BankAccountsService } from './bank-accounts.service';
import { PurchaseOrdersController } from './purchase-orders.controller';
import { PurchaseOrdersService } from './purchase-orders.service';

@Module({
  controllers: [
    PaymentsController,
    ExpensesController,
    ChartOfAccountsController,
    JournalEntriesController,
    BankAccountsController,
    PurchaseOrdersController,
  ],
  providers: [
    PaymentsService,
    ExpensesService,
    ChartOfAccountsService,
    JournalEntriesService,
    BankAccountsService,
    PurchaseOrdersService,
  ],
})
export class FinanceModule {}
