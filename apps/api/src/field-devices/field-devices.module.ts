import { Module } from '@nestjs/common';
import { FieldDevicesController } from './field-devices.controller';
import { FieldDeviceInventoryController } from './field-device-inventory.controller';
import { FieldDeviceAssignmentsController } from './field-device-assignments.controller';
import { FieldDeviceShiftsController } from './field-device-shifts.controller';
import { FieldDeviceCommandsController } from './field-device-commands.controller';
import { FieldDeviceLocationsController } from './field-device-locations.controller';
import { FieldDeviceEnrollmentController } from './field-device-enrollment.controller';
import { FieldDeviceDispatchController } from './field-device-dispatch.controller';
import { FieldOperationsController } from './field-operations.controller';
import { FieldProcurementReviewController } from './field-procurement-review.controller';

@Module({ controllers: [FieldDevicesController, FieldDeviceInventoryController, FieldDeviceAssignmentsController, FieldDeviceShiftsController, FieldDeviceCommandsController, FieldDeviceLocationsController, FieldDeviceEnrollmentController, FieldDeviceDispatchController, FieldOperationsController, FieldProcurementReviewController] })
export class FieldDevicesModule {}
