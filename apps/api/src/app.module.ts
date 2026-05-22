import { Module, MiddlewareConsumer, NestModule } from '@nestjs/common';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { ConfigModule } from '@nestjs/config';
import { BullModule } from '@nestjs/bullmq';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { TenantMiddleware } from './common/middleware/tenant.middleware';
import { AuditLogInterceptor } from './common/interceptors/audit-log.interceptor';

import { AuthModule } from './auth/auth.module';
import { TenantModule } from './tenant/tenant.module';
import { CrmModule } from './crm/crm.module';
import { ErpModule } from './erp/erp.module';
import { HrModule } from './hr/hr.module';
import { FleetModule } from './fleet/fleet.module';
import { AnalyticsModule } from './analytics/analytics.module';
import { GovernmentModule } from './government/government.module';
import { AiModule } from './ai/ai.module';
import { NotificationsModule } from './notifications/notifications.module';
import { ProjectsModule } from './projects/projects.module';
import { FinanceModule } from './finance/finance.module';
import { SecurityModule } from './security/security.module';
import { BillingModule } from './billing/billing.module';
import { UsersModule } from './users/users.module';
import { ApprovalsModule } from './approvals/approvals.module';
import { ZatcaModule } from './zatca/zatca.module';
import { TemplatesModule } from './templates/templates.module';
import { InventoryModule } from './inventory/inventory.module';
import { PosModule } from './pos/pos.module';
import { ReportsModule } from './reports/reports.module';
import { AutoJournalModule } from './auto-journal/auto-journal.module';
import { SupplierModule } from './supplier/supplier.module';
import { BranchModule } from './branch/branch.module';
import { SupplierInvoiceModule } from './supplier-invoice/supplier-invoice.module';
import { StockTransferModule } from './stock-transfer/stock-transfer.module';
import { AlertsModule } from './alerts/alerts.module';
import { ComplianceModule } from './compliance/compliance.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['../../.env', '.env'],
    }),
    BullModule.forRoot({
      connection: {
        url: process.env.REDIS_URL || 'redis://localhost:6379',
      },
      defaultJobOptions: {
        attempts: 3,
        backoff: { type: 'exponential', delay: 1000 },
      },
    }),
    AuthModule,
    TenantModule,
    CrmModule,
    ErpModule,
    HrModule,
    FleetModule,
    AnalyticsModule,
    GovernmentModule,
    AiModule,
    NotificationsModule,
    ProjectsModule,
    FinanceModule,
    SecurityModule,
    BillingModule,
    UsersModule,
    ApprovalsModule,
    ZatcaModule,
    TemplatesModule,
    InventoryModule,
    PosModule,
    ReportsModule,
    AutoJournalModule,
    SupplierModule,
    BranchModule,
    SupplierInvoiceModule,
    StockTransferModule,
    AlertsModule,
    ComplianceModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    {
      provide: APP_INTERCEPTOR,
      useClass: AuditLogInterceptor,
    },
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(TenantMiddleware).forRoutes('*');
  }
}
