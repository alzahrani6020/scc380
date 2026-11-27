import 'reflect-metadata';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { prisma } from '@scc/database';
import { FieldDeviceInventoryController } from '../src/field-devices/field-device-inventory.controller';
import { FieldDeviceCommandsController } from '../src/field-devices/field-device-commands.controller';
import { FieldDeviceAssignmentsController } from '../src/field-devices/field-device-assignments.controller';
import { FieldDeviceShiftsController } from '../src/field-devices/field-device-shifts.controller';
import { FieldDeviceDispatchController } from '../src/field-devices/field-device-dispatch.controller';
import { FieldOperationsController } from '../src/field-devices/field-operations.controller';

test('field devices: two tenant DB isolation, notice identity and fail-closed commands', {
  skip: process.env.CRM_DB_E2E !== '1' ? 'CRM_DB_E2E=1 required' : false,
}, async () => {
  const marker = process.pid + '-' + Date.now();
  const a = await prisma.tenant.create({ data: { name: 'Device tenant A '+marker, slug: 'dev-a-'+marker } });
  const b = await prisma.tenant.create({ data: { name: 'Device tenant B '+marker, slug: 'dev-b-'+marker } });
  const inventory = new FieldDeviceInventoryController();
  const assignments = new FieldDeviceAssignmentsController();
  const commands = new FieldDeviceCommandsController();
  const shifts = new FieldDeviceShiftsController();
  const dispatch = new FieldDeviceDispatchController();
  const operations = new FieldOperationsController();
  const reqA = { user: { tenantId: a.id, userId: 'admin-a-'+marker, role: 'ADMIN' } };
  const reqB = { user: { tenantId: b.id, userId: 'admin-b-'+marker, role: 'ADMIN' } };
  try {
    const employee = await prisma.employee.create({ data: {
      tenantId: a.id, employeeCode: 'DEVICE-'+marker,
      firstName: 'Test', lastName: 'Employee', hireDate: new Date('2026-01-01T00:00:00Z'),
    } });
    const device = await inventory.create(reqA, { assetTag: 'ASSET-'+marker, platform: 'ANDROID' });
    assert.equal(device.managementState, 'UNCONFIGURED');
    assert.equal((await inventory.list(reqA)).length, 1);
    assert.equal((await inventory.list(reqB)).length, 0);
    const overviewA = await operations.overview(reqA);
    const overviewB = await operations.overview(reqB);
    assert.equal(overviewA.fieldDevices.total, 1);
    assert.equal(overviewB.fieldDevices.total, 0);
    assert.equal(overviewB.cameraCoverage.total, 0);
    assert.equal(overviewB.workflow.unconfirmedCommands, 0);
    assert.equal(overviewA.acceptance.playableStreamsVerified, false);
    await assert.rejects(() => inventory.detail(reqB, device.id), /not found in company/);
    await assert.rejects(() => assignments.assign(reqB, device.id, {
      employeeId: employee.id, noticeVersion: 'v1',
    }), /Employee not found/);
    const assigned = await assignments.assign(reqA, device.id, {
      employeeId: employee.id, noticeVersion: 'v1',
    });
    assert.equal(assigned.noticeAcknowledged, false);
    await assert.rejects(() => shifts.start(reqA, device.id, { reason: 'Field work' }),
      /MDM verification/);
    await assert.rejects(() => commands.request(reqB, device.id, {
      action: 'LOCK', reason: 'Test', idempotencyKey: 'cross_tenant_command_'+marker,
    }), /Device not found/);
    const command = await commands.request(reqA, device.id, {
      action: 'WIPE', reason: 'Controlled test', idempotencyKey: 'company_a_command_'+marker,
    });
    assert.equal(command.status, 'NOT_DISPATCHED');
    await assert.rejects(() => commands.approve(reqA, device.id, command.id),
      /Requester cannot approve/);
    const otherApprover = { user: { tenantId: a.id, userId: 'second-admin-'+marker, role: 'ADMIN' } };
    const approval = await commands.approve(otherApprover, device.id, command.id);
    assert.equal(approval.status, 'NOT_DISPATCHED');
    await assert.rejects(() => dispatch.lock(reqA, device.id, command.id),
      /recently verified company-managed Android device/);
    await assert.rejects(() => dispatch.lock(reqB, device.id, command.id),
      /Device not found in company/);
    const stored = await prisma.fieldDeviceCommand.findFirst({
      where: { id: command.id, tenantId: a.id },
    });
    assert.equal(stored?.approvedById, otherApprover.user.userId);
    assert.equal(stored?.providerReceipt, null);
    await assert.rejects(() => commands.history(reqB, device.id), /Device not found/);
  } finally {
    await prisma.fieldDeviceAudit.deleteMany({ where: { tenantId: a.id } });
    await prisma.fieldDeviceCommand.deleteMany({ where: { tenantId: a.id } });
    await prisma.fieldDeviceLocation.deleteMany({ where: { tenantId: a.id } });
    await prisma.fieldDeviceShift.deleteMany({ where: { tenantId: a.id } });
    await prisma.fieldManagedDevice.deleteMany({ where: { tenantId: a.id } });
    await prisma.employee.deleteMany({ where: { tenantId: a.id } });
    await prisma.tenant.deleteMany({ where: { id: { in: [a.id, b.id] } } });
    await prisma.$disconnect();
  }
});
