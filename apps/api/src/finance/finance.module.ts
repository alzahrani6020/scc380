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
import { BankReconciliationController } from './bank-reconciliation.controller';
import { BankReconciliationService } from './bank-reconciliation.service';
import { YearEndClosingController } from './year-end-closing.controller';
import { YearEndClosingService } from './year-end-closing.service';
import { CostCentersController } from './cost-centers.controller';
import { CostCentersService } from './cost-centers.service';
import { AccountingJournalsController } from './accounting-journals.controller';

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
    BankReconciliationController,
    YearEndClosingController,
    CostCentersController,
    AccountingJournalsController,
  ],
  providers: [
    PaymentsService,
    ExpensesService,
    ChartOfAccountsService,
    JournalEntriesService,
    BankAccountsService,
    PurchaseOrdersService,
    FinancialPeriodsService,
    BankReconciliationService,
    YearEndClosingService,
    CostCentersService,
  ],
})
export class FinanceModule {}
