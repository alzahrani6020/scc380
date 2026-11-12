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
import { AccountingCoreModule } from '../accounting-core/accounting-core.module';
import { FinancialPeriodsController } from './financial-periods.controller';
import { FinancialPeriodsService } from './financial-periods.service';

@Module({
  imports: [AccountingCoreModule],
  controllers: [
    PaymentsController,
    ExpensesController,
    ChartOfAccountsController,
    JournalEntriesController,
    BankAccountsController,
    PurchaseOrdersController,
    FinancialPeriodsController,
  ],
  providers: [
    PaymentsService,
    ExpensesService,
    ChartOfAccountsService,
    JournalEntriesService,
    BankAccountsService,
    PurchaseOrdersService,
    FinancialPeriodsService,
  ],
})
export class FinanceModule {}
