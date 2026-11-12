import { Module } from '@nestjs/common';
import { EmployeesController } from './employees.controller';
import { EmployeesService } from './employees.service';
import { DepartmentsController } from './departments.controller';
import { DepartmentsService } from './departments.service';
import { LeavesController } from './leaves.controller';
import { LeavesService } from './leaves.service';
import { AttendancesController } from './attendances.controller';
import { AttendancesService } from './attendances.service';
import { PayrollsController } from './payrolls.controller';
import { PayrollsService } from './payrolls.service';
import { ShiftsController } from './shifts.controller';
import { ShiftsService } from './shifts.service';
import { HrDashboardController } from './dashboard.controller';
import { HrDashboardService } from './dashboard.service';
import { ContractsController } from './contracts.controller';
import { ContractsService } from './contracts.service';
import { LeavePoliciesController } from './leave-policies.controller';
import { LeavePoliciesService } from './leave-policies.service';
import { LeaveBalancesController } from './leave-balances.controller';
import { LeaveBalancesService } from './leave-balances.service';
import { PayrollRunsController } from './payroll-runs.controller';
import { PayrollRunsService } from './payroll-runs.service';
import { AccountingCoreModule } from '../accounting-core/accounting-core.module';
import { EmployeeDocumentsController } from './employee-documents.controller';
import { EmployeeDocumentsService } from './employee-documents.service';
import { EmployeeLoansController } from './employee-loans.controller';
import { EmployeeLoansService } from './employee-loans.service';
import { EndServiceSettlementsController } from './end-service-settlements.controller';
import { EndServiceSettlementsService } from './end-service-settlements.service';
import { HrSelfServiceController } from './self-service.controller';
import { HrSelfService } from './self-service.service';
import { HrRequestsController, HrSelfRequestsController } from './hr-requests.controller';
import { HrRequestsService } from './hr-requests.service';
import { HrLifecycleController } from './hr-lifecycle.controller';
import { HrLifecycleService } from './hr-lifecycle.service';
import { HrAssetCustodyController, HrSelfAssetCustodyController } from './asset-custody.controller';
import { HrAssetCustodyService } from './asset-custody.service';

@Module({
  imports: [AccountingCoreModule],
  controllers: [
    EmployeesController,
    DepartmentsController,
    LeavesController,
    AttendancesController,
    PayrollsController,
    ShiftsController,
    HrDashboardController,
    ContractsController,
    LeavePoliciesController,
    LeaveBalancesController,
    PayrollRunsController,
    EmployeeDocumentsController,
    EmployeeLoansController,
    EndServiceSettlementsController,
    HrSelfServiceController,
    HrRequestsController,
    HrSelfRequestsController,
    HrLifecycleController,
    HrAssetCustodyController,
    HrSelfAssetCustodyController,
  ],
  providers: [
    EmployeesService,
    DepartmentsService,
    LeavesService,
    AttendancesService,
    PayrollsService,
    ShiftsService,
    HrDashboardService,
    ContractsService,
    LeavePoliciesService,
    LeaveBalancesService,
    PayrollRunsService,
    EmployeeDocumentsService,
    EmployeeLoansService,
    EndServiceSettlementsService,
    HrSelfService,
    HrRequestsService,
    HrLifecycleService,
    HrAssetCustodyService,
  ],
})
export class HrModule {}
