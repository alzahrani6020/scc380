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

@Module({
  controllers: [
    EmployeesController,
    DepartmentsController,
    LeavesController,
    AttendancesController,
    PayrollsController,
    ShiftsController,
  ],
  providers: [
    EmployeesService,
    DepartmentsService,
    LeavesService,
    AttendancesService,
    PayrollsService,
    ShiftsService,
  ],
})
export class HrModule {}
