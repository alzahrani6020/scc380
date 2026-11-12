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

@Module({
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
  ],
})
export class HrModule {}
