import { PrismaClient } from '@prisma/client';
import { hashPassword } from '../packages/auth/src';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding database...');

  // Create demo tenant
  const tenant = await prisma.tenant.upsert({
    where: { slug: 'demo' },
    update: {},
    create: {
      name: 'شركة التقنية المتقدمة',
      slug: 'demo',
      domain: 'demo.localhost',
      type: 'SHARED',
      status: 'ACTIVE',
      plan: 'PROFESSIONAL',
      vatNumber: '300000000000003',
      crNumber: '1010000000',
      settings: { language: 'ar', timezone: 'Asia/Riyadh', currency: 'SAR' },
      features: ['crm', 'erp', 'hr', 'fleet', 'analytics', 'projects', 'ai'],
      primaryColor: '#0066CC',
    },
  });
  console.log('✅ Tenant:', tenant.name);

  // Create admin user
  const adminPassword = await hashPassword('admin123');
  const admin = await prisma.user.upsert({
    where: { email: 'admin@demo.sa' },
    update: {},
    create: {
      email: 'admin@demo.sa',
      passwordHash: adminPassword,
      firstName: 'أحمد',
      lastName: 'المدير',
      phone: '0500000000',
      role: 'ADMIN',
      status: 'ACTIVE',
      emailVerified: true,
      tenantId: tenant.id,
    },
  });
  console.log('✅ Admin:', admin.email);

  // Create regular user
  const userPassword = await hashPassword('user123');
  const user = await prisma.user.upsert({
    where: { email: 'user@demo.sa' },
    update: {},
    create: {
      email: 'user@demo.sa',
      passwordHash: userPassword,
      firstName: 'محمد',
      lastName: 'الموظف',
      phone: '0500000001',
      role: 'USER',
      status: 'ACTIVE',
      emailVerified: true,
      tenantId: tenant.id,
    },
  });
  console.log('✅ User:', user.email);

  // Clear existing demo data to avoid duplicates (children first)
  await prisma.notification.deleteMany({ where: { tenantId: tenant.id } });
  await prisma.subscription.deleteMany({ where: { tenantId: tenant.id } });
  await prisma.fleetFuelLog.deleteMany({ where: { tenantId: tenant.id } });
  await prisma.fleetMaintenance.deleteMany({ where: { tenantId: tenant.id } });
  await prisma.fleetTrip.deleteMany({ where: { tenantId: tenant.id } });
  await prisma.payroll.deleteMany({ where: { tenantId: tenant.id } });
  await prisma.attendance.deleteMany({ where: { tenantId: tenant.id } });
  await prisma.leave.deleteMany({ where: { tenantId: tenant.id } });
  await prisma.task.deleteMany({ where: { tenantId: tenant.id } });
  await prisma.project.deleteMany({ where: { tenantId: tenant.id } });
  await prisma.journalEntry.deleteMany({ where: { tenantId: tenant.id } });
  await prisma.chartOfAccount.deleteMany({ where: { tenantId: tenant.id } });
  await prisma.expense.deleteMany({ where: { tenantId: tenant.id } });
  await prisma.payment.deleteMany({ where: { tenantId: tenant.id } });
  await prisma.invoiceItem.deleteMany({ where: { tenantId: tenant.id } });
  await prisma.invoice.deleteMany({ where: { tenantId: tenant.id } });
  await prisma.activity.deleteMany({ where: { tenantId: tenant.id } });
  await prisma.deal.deleteMany({ where: { tenantId: tenant.id } });
  await prisma.contact.deleteMany({ where: { tenantId: tenant.id } });
  await prisma.employee.deleteMany({ where: { tenantId: tenant.id } });
  await prisma.department.deleteMany({ where: { tenantId: tenant.id } });
  await prisma.driver.deleteMany({ where: { tenantId: tenant.id } });
  await prisma.vehicle.deleteMany({ where: { tenantId: tenant.id } });

  // Create contacts
  const contact1 = await prisma.contact.create({
    data: {
      tenantId: tenant.id, firstName: 'خالد', lastName: 'العميل', email: 'khaled@client.sa',
      phone: '0501111111', type: 'CUSTOMER', status: 'ACTIVE', companyName: 'شركة العميل الأول', city: 'الرياض',
    },
  });
  const contact2 = await prisma.contact.create({
    data: {
      tenantId: tenant.id, firstName: 'سعد', lastName: 'العميل', email: 'saad@client.sa',
      phone: '0502222222', type: 'LEAD', status: 'ACTIVE', companyName: 'مؤسسة سعد', city: 'جدة',
    },
  });
  const contact3 = await prisma.contact.create({
    data: {
      tenantId: tenant.id, firstName: 'فهد', lastName: 'المورد', email: 'fahd@supplier.sa',
      phone: '0503333333', type: 'SUPPLIER', status: 'ACTIVE', companyName: 'مؤسسة فهد التجارية', city: 'الدمام',
    },
  });
  console.log('✅ Contacts: 3');

  // Create departments
  const dept1 = await prisma.department.create({
    data: { tenantId: tenant.id, name: 'المبيعات', code: 'SALES' },
  });
  const dept2 = await prisma.department.create({
    data: { tenantId: tenant.id, name: 'الموارد البشرية', code: 'HR' },
  });
  console.log('✅ Departments: 2');

  // Create employees
  const emp1 = await prisma.employee.create({
    data: {
      tenantId: tenant.id, employeeCode: 'EMP-' + Math.random().toString(36).slice(2, 8).toUpperCase(), firstName: 'عبدالله', lastName: 'المالكي',
      email: 'abdullah@demo.sa', phone: '0504444444', idNumber: 'ID-' + Math.random().toString(36).slice(2, 10), nationality: 'SA',
      departmentId: dept1.id, jobTitle: 'مدير مبيعات', employmentType: 'FULL_TIME', status: 'ACTIVE',
      hireDate: new Date('2023-01-15'), basicSalary: 15000,
    },
  });
  const emp2 = await prisma.employee.create({
    data: {
      tenantId: tenant.id, employeeCode: 'EMP-' + Math.random().toString(36).slice(2, 8).toUpperCase(), firstName: 'نورة', lastName: 'القحطاني',
      email: 'noura@demo.sa', phone: '0505555555', idNumber: 'ID-' + Math.random().toString(36).slice(2, 10), nationality: 'SA',
      departmentId: dept2.id, jobTitle: 'محاسبة', employmentType: 'FULL_TIME', status: 'ACTIVE',
      hireDate: new Date('2023-06-01'), basicSalary: 12000,
    },
  });
  console.log('✅ Employees: 2');

  // Create vehicles
  const v1 = await prisma.vehicle.create({
    data: {
      tenantId: tenant.id, plateNumber: 'أ ب ج 1234', plateType: 'PRIVATE', make: 'تويوتا',
      model: 'كامري', year: 2023, color: 'أبيض', status: 'ACTIVE', ownershipType: 'OWNED', fuelType: 'PETROL',
    },
  });
  const v2 = await prisma.vehicle.create({
    data: {
      tenantId: tenant.id, plateNumber: 'د هـ و 5678', plateType: 'COMMERCIAL', make: 'هيونداي',
      model: 'H1', year: 2022, color: 'فضي', status: 'ACTIVE', ownershipType: 'OWNED', fuelType: 'DIESEL',
    },
  });
  console.log('✅ Vehicles: 2');

  // Create drivers
  const driver1 = await prisma.driver.create({
    data: {
      tenantId: tenant.id, firstName: 'عبدالرحمن', lastName: 'السائق', phone: '0506666666',
      idNumber: 'ID-' + Math.random().toString(36).slice(2, 10), licenseNumber: 'LIC-' + Math.random().toString(36).slice(2, 8).toUpperCase(), status: 'ACTIVE',
    },
  });
  console.log('✅ Drivers: 1');

  // Create deals
  await prisma.deal.createMany({
    data: [
      { tenantId: tenant.id, title: 'مشروع موقع إلكتروني', contactId: contact1.id, value: 50000, currency: 'SAR', stage: 'PROPOSAL', probability: 60, expectedClose: new Date('2024-12-01') },
      { tenantId: tenant.id, title: 'عقد صيانة سنوي', contactId: contact2.id, value: 25000, currency: 'SAR', stage: 'NEGOTIATION', probability: 80, expectedClose: new Date('2024-11-15') },
      { tenantId: tenant.id, title: 'نظام ERP متكامل', contactId: contact3.id, value: 120000, currency: 'SAR', stage: 'LEAD', probability: 20, expectedClose: new Date('2025-01-01') },
    ],
  });
  console.log('✅ Deals: 3');

  // Create activities
  await prisma.activity.createMany({
    data: [
      { tenantId: tenant.id, type: 'CALL', subject: 'مكالمة متابعة', contactId: contact1.id, scheduledAt: new Date('2024-11-01') },
      { tenantId: tenant.id, type: 'MEETING', subject: 'اجتماع عرض', contactId: contact2.id, scheduledAt: new Date('2024-11-05') },
      { tenantId: tenant.id, type: 'TASK', subject: 'إرسال عرض سعر', contactId: contact3.id, scheduledAt: new Date('2024-11-03') },
    ],
  });
  console.log('✅ Activities: 3');

  // Create invoices
  const inv1 = await prisma.invoice.create({
    data: {
      tenantId: tenant.id, invoiceNumber: 'INV-2024-001', contactId: contact1.id,
      status: 'PAID', subtotal: 10000, taxRate: 15, taxAmount: 1500, discount: 0, total: 11500,
      currency: 'SAR', dueDate: new Date('2024-12-31'), paidAt: new Date(), paidAmount: 11500,
    },
  });
  const inv2 = await prisma.invoice.create({
    data: {
      tenantId: tenant.id, invoiceNumber: 'INV-2024-002', contactId: contact2.id,
      status: 'SENT', subtotal: 25000, taxRate: 15, taxAmount: 3750, discount: 0, total: 28750,
      currency: 'SAR', dueDate: new Date('2024-12-15'), paidAmount: 0,
    },
  });
  console.log('✅ Invoices: 2');

  // Create payments
  await prisma.payment.create({
    data: {
      tenantId: tenant.id, invoiceId: inv1.id, amount: 11500, method: 'BANK_TRANSFER',
      status: 'COMPLETED', reference: 'TRF-001', paidAt: new Date(),
    },
  });
  console.log('✅ Payments: 1');

  // Create expenses
  await prisma.expense.createMany({
    data: [
      { tenantId: tenant.id, category: 'OFFICE', amount: 5000, description: 'إيجار المكتب', incurredAt: new Date('2024-10-01') },
      { tenantId: tenant.id, category: 'UTILITIES', amount: 1200, description: 'فاتورة الكهرباء', incurredAt: new Date('2024-10-05') },
      { tenantId: tenant.id, category: 'MARKETING', amount: 3000, description: 'حملة إعلانية', incurredAt: new Date('2024-10-10') },
    ],
  });
  console.log('✅ Expenses: 3');

  // Create chart of accounts
  await prisma.chartOfAccount.createMany({
    data: [
      { tenantId: tenant.id, code: '1000', name: 'الأصول المتداولة', type: 'ASSET', balance: 0 },
      { tenantId: tenant.id, code: '1100', name: 'النقدية', type: 'ASSET', balance: 50000 },
      { tenantId: tenant.id, code: '2000', name: 'الخصوم', type: 'LIABILITY', balance: 0 },
      { tenantId: tenant.id, code: '4000', name: 'الإيرادات', type: 'REVENUE', balance: 0 },
      { tenantId: tenant.id, code: '5000', name: 'المصروفات', type: 'EXPENSE', balance: 0 },
    ],
  });
  console.log('✅ Chart of Accounts: 5');

  // Create projects
  const proj1 = await prisma.project.create({
    data: {
      tenantId: tenant.id, name: 'تطوير CRM', description: 'تطوير نظام إدارة العملاء',
      status: 'ACTIVE', priority: 'HIGH', startDate: new Date('2024-09-01'), budget: 200000, progress: 45,
    },
  });
  const proj2 = await prisma.project.create({
    data: {
      tenantId: tenant.id, name: 'ترقية البنية التحتية', description: 'ترقية السيرفرات والشبكة',
      status: 'PLANNING', priority: 'MEDIUM', startDate: new Date('2024-12-01'), budget: 100000, progress: 10,
    },
  });
  console.log('✅ Projects: 2');

  // Create tasks
  await prisma.task.createMany({
    data: [
      { tenantId: tenant.id, projectId: proj1.id, title: 'تصميم قاعدة البيانات', status: 'DONE', priority: 'HIGH', boardColumn: 'DONE' },
      { tenantId: tenant.id, projectId: proj1.id, title: 'تطوير API', status: 'IN_PROGRESS', priority: 'HIGH', boardColumn: 'IN_PROGRESS' },
      { tenantId: tenant.id, projectId: proj1.id, title: 'تصميم الواجهة', status: 'TODO', priority: 'MEDIUM', boardColumn: 'TODO' },
      { tenantId: tenant.id, projectId: proj2.id, title: 'تقييم السيرفرات', status: 'TODO', priority: 'MEDIUM', boardColumn: 'TODO' },
    ],
  });
  console.log('✅ Tasks: 4');

  // Create leaves
  await prisma.leave.createMany({
    data: [
      { tenantId: tenant.id, employeeId: emp1.id, type: 'ANNUAL', startDate: new Date('2024-12-01'), endDate: new Date('2024-12-05'), days: 5, reason: 'إجازة سنوية', status: 'APPROVED', approvedById: admin.id, approvedAt: new Date() },
      { tenantId: tenant.id, employeeId: emp2.id, type: 'SICK', startDate: new Date('2024-11-10'), endDate: new Date('2024-11-11'), days: 2, reason: 'مرض', status: 'PENDING' },
    ],
  });
  console.log('✅ Leaves: 2');

  // Create attendances
  await prisma.attendance.createMany({
    data: [
      { tenantId: tenant.id, employeeId: emp1.id, date: new Date(), status: 'PRESENT', workHours: 8 },
      { tenantId: tenant.id, employeeId: emp2.id, date: new Date(), status: 'PRESENT', workHours: 8 },
    ],
  });
  console.log('✅ Attendances: 2');

  // Create payrolls
  await prisma.payroll.createMany({
    data: [
      {
        tenantId: tenant.id, employeeId: emp1.id, month: 10, year: 2024, basicSalary: 15000,
        housingAllowance: 3000, transportAllowance: 1000, otherAllowances: 0,
        gosiDeduction: 900, taxDeduction: 0, otherDeductions: 0, netSalary: 18100, status: 'PAID', paidAt: new Date(),
      },
      {
        tenantId: tenant.id, employeeId: emp2.id, month: 10, year: 2024, basicSalary: 12000,
        housingAllowance: 2400, transportAllowance: 800, otherAllowances: 0,
        gosiDeduction: 720, taxDeduction: 0, otherDeductions: 0, netSalary: 14480, status: 'PAID', paidAt: new Date(),
      },
    ],
  });
  console.log('✅ Payrolls: 2');

  // Create fleet trips
  await prisma.fleetTrip.createMany({
    data: [
      { tenantId: tenant.id, vehicleId: v1.id, driverId: driver1.id, purpose: 'توصيل موظفين', startOdometer: 10000, startedAt: new Date(), status: 'IN_PROGRESS' },
    ],
  });
  console.log('✅ Fleet Trips: 1');

  // Create maintenance records
  await prisma.fleetMaintenance.createMany({
    data: [
      { tenantId: tenant.id, vehicleId: v1.id, type: 'ROUTINE', description: 'تغيير زيت', cost: 500, serviceDate: new Date('2024-10-01'), nextServiceDate: new Date('2025-01-01'), mileage: 10000, status: 'COMPLETED' },
    ],
  });
  console.log('✅ Maintenance: 1');

  // Create fuel logs
  await prisma.fleetFuelLog.createMany({
    data: [
      { tenantId: tenant.id, vehicleId: v1.id, driverId: driver1.id, fuelType: 'PETROL', liters: 50, pricePerLiter: 2.33, totalCost: 116.5, odometer: 10050, fueledAt: new Date() },
    ],
  });
  console.log('✅ Fuel Logs: 1');

  // Create subscriptions
  await prisma.subscription.create({
    data: {
      tenantId: tenant.id, userId: admin.id, plan: 'PROFESSIONAL', status: 'ACTIVE',
      startDate: new Date(), autoRenew: true, seats: 5, pricePerSeat: 100, totalPrice: 500, billingCycle: 'MONTHLY',
    },
  });
  console.log('✅ Subscriptions: 1');

  // Create notifications
  await prisma.notification.createMany({
    data: [
      { tenantId: tenant.id, userId: admin.id, type: 'IN_APP', title: 'مرحباً بك في SCC', body: 'تم إنشاء حسابك بنجاح', channel: 'IN_APP', status: 'DELIVERED' },
      { tenantId: tenant.id, userId: admin.id, type: 'IN_APP', title: 'فاتورة جديدة', body: 'تم إنشاء فاتورة INV-2024-002', channel: 'IN_APP', status: 'DELIVERED' },
      { tenantId: tenant.id, userId: admin.id, type: 'IN_APP', title: 'مهمة جديدة', body: 'تم تعيينك لمشروع تطوير CRM', channel: 'IN_APP', status: 'PENDING' },
    ],
  });
  console.log('✅ Notifications: 3');

  console.log('\n🎉 Seeding completed successfully!');
  console.log('Login with: admin@demo.sa / admin123 (tenant: demo)');
  console.log('Or: user@demo.sa / user123 (tenant: demo)');
  console.log('VIP: vip@scc.sa / vip123456 (Super Admin)');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
