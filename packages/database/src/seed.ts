import { PrismaClient, Prisma } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Starting seed...');

  // Clean existing data (respect FK order)
  await prisma.aIMessage.deleteMany();
  await prisma.aIConversation.deleteMany();
  await prisma.notification.deleteMany();
  await prisma.subscription.deleteMany();
  await prisma.template.deleteMany();
  await prisma.loginAttempt.deleteMany();
  await prisma.apiKey.deleteMany();
  await prisma.session.deleteMany();
  await prisma.fleetFuelLog.deleteMany();
  await prisma.fleetMaintenance.deleteMany();
  await prisma.fleetTrip.deleteMany();
  await prisma.driver.deleteMany();
  await prisma.vehicle.deleteMany();
  await prisma.task.deleteMany();
  await prisma.project.deleteMany();
  await prisma.payroll.deleteMany();
  await prisma.shift.deleteMany();
  await prisma.attendance.deleteMany();
  await prisma.leave.deleteMany();
  await prisma.employee.deleteMany();
  await prisma.department.deleteMany();
  await prisma.supplierPayment.deleteMany();
  await prisma.supplierInvoice.deleteMany();
  await prisma.supplier.deleteMany();
  await prisma.stockTransferItem.deleteMany();
  await prisma.stockTransfer.deleteMany();
  await prisma.stockMovement.deleteMany();
  await prisma.alert.deleteMany();
  await prisma.journalEntry.deleteMany();
  await prisma.chartOfAccount.deleteMany();
  await prisma.purchaseOrder.deleteMany();
  await prisma.payment.deleteMany();
  await prisma.invoiceItem.deleteMany();
  await prisma.expense.deleteMany();
  await prisma.bankAccount.deleteMany();
  await prisma.invoice.deleteMany();
  await prisma.activity.deleteMany();
  await prisma.deal.deleteMany();
  await prisma.contact.deleteMany();
  await prisma.auditLog.deleteMany();
  await prisma.user.deleteMany();
  await prisma.tenant.deleteMany();

  // ─── TENANT ───
  const tenant = await prisma.tenant.create({
    data: {
      name: 'شركة التقنية المتقدمة',
      slug: 'advanced-tech',
      domain: 'advanced-tech.local',
      type: 'SHARED',
      status: 'ACTIVE',
      plan: 'ENTERPRISE',
      vatNumber: '300123456700003',
      crNumber: '1010123456',
      settings: { theme: 'light', language: 'ar', currency: 'SAR' },
      features: ['crm', 'erp', 'hr', 'fleet', 'analytics', 'zatca', 'ai'],
      primaryColor: '#0066CC',
    },
  });
  console.log('✅ Tenant created:', tenant.name);

  // ─── USERS ───
  const users = await prisma.user.createMany({
    data: [
      {
        id: 'user_super_admin',
        email: 'super@admin.com',
        firstName: 'مدير',
        lastName: 'النظام',
        role: 'SUPER_ADMIN',
        status: 'ACTIVE',
        emailVerified: true,
      },
      {
        id: 'user_admin_1',
        email: 'admin@company.com',
        firstName: 'أحمد',
        lastName: 'السعود',
        role: 'ADMIN',
        status: 'ACTIVE',
        emailVerified: true,
        tenantId: tenant.id,
      },
      {
        id: 'user_manager_1',
        email: 'manager@company.com',
        firstName: 'فهد',
        lastName: 'العتيبي',
        role: 'MANAGER',
        status: 'ACTIVE',
        emailVerified: true,
        tenantId: tenant.id,
      },
      {
        id: 'user_sales_1',
        email: 'sales@company.com',
        firstName: 'خالد',
        lastName: 'القحطاني',
        role: 'USER',
        status: 'ACTIVE',
        emailVerified: true,
        tenantId: tenant.id,
      },
    ],
  });
  console.log('✅ Users created:', 4);

  // ─── CONTACTS (CRM) ───
  const contacts = await prisma.contact.createMany({
    data: [
      {
        tenantId: tenant.id,
        firstName: 'محمد',
        lastName: 'الراجحي',
        email: 'm.alrajhi@example.com',
        phone: '0501234567',
        companyName: 'مصرف الراجحي',
        jobTitle: 'مدير علاقات',
        type: 'CUSTOMER',
        status: 'ACTIVE',
        city: 'الرياض',
        country: 'SA',
        source: 'REFERRAL',
        stage: 'CLOSED_WON',
      },
      {
        tenantId: tenant.id,
        firstName: 'سارة',
        lastName: 'الغامدي',
        email: 's.ghamdi@example.com',
        phone: '0559876543',
        companyName: 'STC',
        jobTitle: 'مديرة مشتريات',
        type: 'PROSPECT',
        status: 'ACTIVE',
        city: 'جدة',
        country: 'SA',
        source: 'WEBSITE',
        stage: 'QUALIFIED',
      },
      {
        tenantId: tenant.id,
        firstName: 'عبدالله',
        lastName: 'الشمري',
        email: 'a.shammari@example.com',
        phone: '0561122334',
        companyName: 'أرامكو',
        jobTitle: 'مهندس',
        type: 'LEAD',
        status: 'ACTIVE',
        city: 'الدمام',
        country: 'SA',
        source: 'TRADE_SHOW',
        stage: 'LEAD',
      },
      {
        tenantId: tenant.id,
        firstName: 'نورة',
        lastName: 'الحربي',
        email: 'n.harbi@example.com',
        phone: '0575566778',
        companyName: 'سابك',
        jobTitle: 'محاسبة',
        type: 'PARTNER',
        status: 'ACTIVE',
        city: 'الرياض',
        country: 'SA',
        source: 'SOCIAL_MEDIA',
        stage: 'PROPOSAL',
      },
      {
        tenantId: tenant.id,
        firstName: 'فaisal',
        lastName: 'Bin Salman',
        email: 'f.bin.salman@example.com',
        phone: '0588899001',
        companyName: 'ACME Corp',
        jobTitle: 'CEO',
        type: 'CUSTOMER',
        status: 'ACTIVE',
        city: 'Dubai',
        country: 'AE',
        source: 'EMAIL',
        stage: 'NEGOTIATION',
      },
    ],
  });
  console.log('✅ Contacts created:', 5);

  const allContacts = await prisma.contact.findMany({ where: { tenantId: tenant.id } });

  // ─── DEALS ───
  await prisma.deal.createMany({
    data: [
      {
        tenantId: tenant.id,
        title: 'عقد توريد برمجيات ERP',
        contactId: allContacts[0].id,
        value: 450000,
        currency: 'SAR',
        stage: 'CLOSED_WON',
        probability: 100,
        assignedToId: 'user_sales_1',
      },
      {
        tenantId: tenant.id,
        title: 'ترخيص SaaS سنوي',
        contactId: allContacts[1].id,
        value: 120000,
        currency: 'SAR',
        stage: 'NEGOTIATION',
        probability: 75,
        assignedToId: 'user_sales_1',
      },
      {
        tenantId: tenant.id,
        title: 'مشروع تطوير تطبيق الجوال',
        contactId: allContacts[3].id,
        value: 85000,
        currency: 'SAR',
        stage: 'PROPOSAL',
        probability: 50,
        assignedToId: 'user_manager_1',
      },
    ],
  });
  console.log('✅ Deals created:', 3);

  // ─── ACTIVITIES ───
  await prisma.activity.createMany({
    data: [
      {
        tenantId: tenant.id,
        type: 'CALL',
        subject: 'مكالمة متابعة عقد ERP',
        description: 'تمت مناقشة تفاصيل العقد والجدول الزمني',
        contactId: allContacts[0].id,
        scheduledAt: new Date('2026-05-20T10:00:00Z'),
        assignedToId: 'user_sales_1',
      },
      {
        tenantId: tenant.id,
        type: 'MEETING',
        subject: 'اجتماع عرض SaaS',
        description: 'عرض تجريبي للمنصة',
        contactId: allContacts[1].id,
        scheduledAt: new Date('2026-05-22T14:00:00Z'),
        assignedToId: 'user_sales_1',
      },
      {
        tenantId: tenant.id,
        type: 'EMAIL',
        subject: 'إرسال عرض سعر',
        description: 'تم إرسال عرض السعر للعميل',
        contactId: allContacts[3].id,
        completedAt: new Date(),
        assignedToId: 'user_manager_1',
      },
    ],
  });
  console.log('✅ Activities created:', 3);

  // ─── DEPARTMENTS (HR) ───
  const departments = await prisma.department.createMany({
    data: [
      { tenantId: tenant.id, name: 'الإدارة العامة', code: 'GM' },
      { tenantId: tenant.id, name: 'التقنية', code: 'IT' },
      { tenantId: tenant.id, name: 'المبيعات', code: 'SALES' },
      { tenantId: tenant.id, name: 'الموارد البشرية', code: 'HR' },
      { tenantId: tenant.id, name: 'المحاسبة', code: 'ACC' },
      { tenantId: tenant.id, name: 'التسويق', code: 'MKT' },
    ],
  });
  console.log('✅ Departments created:', 6);

  const allDepts = await prisma.department.findMany({ where: { tenantId: tenant.id } });

  // ─── EMPLOYEES ───
  const employees = await prisma.employee.createMany({
    data: [
      {
        tenantId: tenant.id,
        employeeCode: 'EMP001',
        firstName: 'عبدالرحman',
        lastName: 'الفوزان',
        email: 'a.fawzan@company.com',
        phone: '0501111111',
        idNumber: '1098765432',
        departmentId: allDepts[0].id,
        jobTitle: 'المدير التنفيذي',
        employmentType: 'FULL_TIME',
        status: 'ACTIVE',
        hireDate: new Date('2020-01-15'),
        basicSalary: 25000,
        housingAllowance: 5000,
        transportAllowance: 2000,
        gosiNumber: '1234567890',
        gosiSalary: 25000,
      },
      {
        tenantId: tenant.id,
        employeeCode: 'EMP002',
        firstName: 'منى',
        lastName: 'الدوسري',
        email: 'm.dosari@company.com',
        phone: '0502222222',
        idNumber: '1122334455',
        departmentId: allDepts[1].id,
        jobTitle: 'مطورة برمجيات',
        employmentType: 'FULL_TIME',
        status: 'ACTIVE',
        hireDate: new Date('2021-03-01'),
        basicSalary: 18000,
        housingAllowance: 3500,
        transportAllowance: 1500,
        gosiNumber: '2233445566',
        gosiSalary: 18000,
      },
      {
        tenantId: tenant.id,
        employeeCode: 'EMP003',
        firstName: 'سعد',
        lastName: 'المطيري',
        email: 's.mutairi@company.com',
        phone: '0503333333',
        idNumber: '2233445566',
        departmentId: allDepts[2].id,
        jobTitle: 'مندوب مبيعات',
        employmentType: 'FULL_TIME',
        status: 'ACTIVE',
        hireDate: new Date('2022-06-10'),
        basicSalary: 12000,
        housingAllowance: 2500,
        transportAllowance: 1000,
        gosiNumber: '3344556677',
        gosiSalary: 12000,
      },
      {
        tenantId: tenant.id,
        employeeCode: 'EMP004',
        firstName: 'ليلى',
        lastName: 'الصالح',
        email: 'l.saleh@company.com',
        phone: '0504444444',
        idNumber: '3344556677',
        departmentId: allDepts[3].id,
        jobTitle: 'أخصائية موارد بشرية',
        employmentType: 'FULL_TIME',
        status: 'ACTIVE',
        hireDate: new Date('2021-09-01'),
        basicSalary: 15000,
        housingAllowance: 3000,
        transportAllowance: 1200,
        gosiNumber: '4455667788',
        gosiSalary: 15000,
      },
    ],
  });
  console.log('✅ Employees created:', 4);

  const allEmployees = await prisma.employee.findMany({ where: { tenantId: tenant.id } });

  // ─── LEAVES ───
  await prisma.leave.createMany({
    data: [
      {
        tenantId: tenant.id,
        employeeId: allEmployees[1].id,
        type: 'ANNUAL',
        startDate: new Date('2026-06-01'),
        endDate: new Date('2026-06-10'),
        days: 10,
        reason: 'إجازة سنوية',
        status: 'APPROVED',
        approvedById: 'user_manager_1',
        approvedAt: new Date(),
      },
      {
        tenantId: tenant.id,
        employeeId: allEmployees[2].id,
        type: 'SICK',
        startDate: new Date('2026-05-10'),
        endDate: new Date('2026-05-12'),
        days: 3,
        reason: 'مرضية',
        status: 'APPROVED',
        approvedById: 'user_manager_1',
        approvedAt: new Date(),
      },
      {
        tenantId: tenant.id,
        employeeId: allEmployees[3].id,
        type: 'HAJJ',
        startDate: new Date('2026-07-01'),
        endDate: new Date('2026-07-15'),
        days: 15,
        reason: 'إجازة حج',
        status: 'PENDING',
      },
    ],
  });
  console.log('✅ Leaves created:', 3);

  // ─── ATTENDANCE ───
  await prisma.attendance.createMany({
    data: [
      { tenantId: tenant.id, employeeId: allEmployees[0].id, date: new Date(), checkIn: new Date('2026-05-15T07:00:00Z'), checkOut: new Date('2026-05-15T15:00:00Z'), status: 'PRESENT', workHours: 8 },
      { tenantId: tenant.id, employeeId: allEmployees[1].id, date: new Date(), checkIn: new Date('2026-05-15T07:30:00Z'), checkOut: new Date('2026-05-15T15:30:00Z'), status: 'PRESENT', workHours: 8 },
      { tenantId: tenant.id, employeeId: allEmployees[2].id, date: new Date(), checkIn: new Date('2026-05-15T08:00:00Z'), status: 'PRESENT', workHours: 4 },
    ],
  });
  console.log('✅ Attendance created:', 3);

  // ─── VEHICLES (FLEET) ───
  const vehicles = await prisma.vehicle.createMany({
    data: [
      {
        tenantId: tenant.id,
        plateNumber: 'أ ب س 1234',
        plateType: 'PRIVATE',
        make: 'تويوتا',
        model: 'لاند كروزر',
        year: 2024,
        color: 'أبيض',
        vin: 'JTMCZ5A1XB1234567',
        status: 'ACTIVE',
        ownershipType: 'OWNED',
        fuelType: 'PETROL',
        istimaraExpiry: new Date('2027-03-15'),
        insuranceExpiry: new Date('2027-01-20'),
      },
      {
        tenantId: tenant.id,
        plateNumber: 'ب ج د 5678',
        plateType: 'COMMERCIAL',
        make: 'هيونداي',
        model: 'H1',
        year: 2023,
        color: 'فضي',
        vin: 'KMHDU4AD3BU1234567',
        status: 'ACTIVE',
        ownershipType: 'OWNED',
        fuelType: 'DIESEL',
        istimaraExpiry: new Date('2026-11-10'),
        insuranceExpiry: new Date('2026-09-05'),
      },
      {
        tenantId: tenant.id,
        plateNumber: 'ج ح خ 9012',
        plateType: 'TRANSPORT',
        make: 'مرسيدس',
        model: 'Actros',
        year: 2022,
        color: 'أزرق',
        vin: 'WDB9634761L1234567',
        status: 'IN_MAINTENANCE',
        ownershipType: 'OWNED',
        fuelType: 'DIESEL',
        istimaraExpiry: new Date('2026-08-20'),
        insuranceExpiry: new Date('2026-07-15'),
      },
    ],
  });
  console.log('✅ Vehicles created:', 3);

  const allVehicles = await prisma.vehicle.findMany({ where: { tenantId: tenant.id } });

  // ─── DRIVERS ───
  const drivers = await prisma.driver.createMany({
    data: [
      {
        tenantId: tenant.id,
        firstName: 'ناصر',
        lastName: 'السويلم',
        phone: '0505555555',
        idNumber: '4455667788',
        licenseNumber: '123456789',
        licenseExpiry: new Date('2028-01-01'),
        status: 'ACTIVE',
      },
      {
        tenantId: tenant.id,
        firstName: 'سلطان',
        lastName: 'المالك',
        phone: '0506666666',
        idNumber: '5566778899',
        licenseNumber: '987654321',
        licenseExpiry: new Date('2027-06-15'),
        status: 'ACTIVE',
      },
    ],
  });
  console.log('✅ Drivers created:', 2);

  // ─── FLEET TRIPS ───
  await prisma.fleetTrip.createMany({
    data: [
      {
        tenantId: tenant.id,
        vehicleId: allVehicles[0].id,
        purpose: 'زيارة عميل - الرياض',
        startOdometer: 15420,
        endOdometer: 15485,
        startedAt: new Date('2026-05-15T06:00:00Z'),
        endedAt: new Date('2026-05-15T10:00:00Z'),
        status: 'COMPLETED',
      },
      {
        tenantId: tenant.id,
        vehicleId: allVehicles[1].id,
        purpose: 'توصيل موظفين',
        startOdometer: 32100,
        startedAt: new Date('2026-05-15T05:30:00Z'),
        status: 'IN_PROGRESS',
      },
    ],
  });
  console.log('✅ Fleet trips created:', 2);

  // ─── INVOICES (ERP) ───
  const invoice1 = await prisma.invoice.create({
    data: {
      tenantId: tenant.id,
      invoiceNumber: 'INV-2026-0001',
      contactId: allContacts[0].id,
      type: 'STANDARD',
      status: 'PAID',
      subtotal: 100000,
      taxRate: 15,
      taxAmount: 15000,
      discount: 0,
      total: 115000,
      currency: 'SAR',
      dueDate: new Date('2026-06-15'),
      paidAt: new Date(),
      paidAmount: 115000,
      zatcaStatus: 'REPORTED',
      zatcaUuid: '123e4567-e89b-12d3-a456-426614174000',
    },
  });

  const invoice2 = await prisma.invoice.create({
    data: {
      tenantId: tenant.id,
      invoiceNumber: 'INV-2026-0002',
      contactId: allContacts[1].id,
      type: 'STANDARD',
      status: 'SENT',
      subtotal: 50000,
      taxRate: 15,
      taxAmount: 7500,
      discount: 2500,
      total: 55000,
      currency: 'SAR',
      dueDate: new Date('2026-06-30'),
      zatcaStatus: 'PENDING',
    },
  });
  console.log('✅ Invoices created:', 2);

  await prisma.invoiceItem.createMany({
    data: [
      { tenantId: tenant.id, invoiceId: invoice1.id, description: 'ترخيص برنامج CRM سنوي', quantity: 1, unitPrice: 60000, taxRate: 15, total: 69000 },
      { tenantId: tenant.id, invoiceId: invoice1.id, description: 'خدمة تنفيذ وtraining', quantity: 40, unitPrice: 1000, taxRate: 15, total: 46000 },
      { tenantId: tenant.id, invoiceId: invoice2.id, description: 'اشتراك شهري SaaS', quantity: 12, unitPrice: 4166.67, taxRate: 15, total: 55000 },
    ],
  });
  console.log('✅ Invoice items created:', 3);

  // ─── PAYMENTS ───
  await prisma.payment.createMany({
    data: [
      { tenantId: tenant.id, invoiceId: invoice1.id, amount: 115000, method: 'BANK_TRANSFER', status: 'COMPLETED', reference: 'TRX-2026-001', paidAt: new Date() },
      { tenantId: tenant.id, amount: 25000, method: 'SADAD', status: 'PENDING', reference: 'SADAD-2026-002' },
    ],
  });
  console.log('✅ Payments created:', 2);

  // ─── EXPENSES ───
  await prisma.expense.createMany({
    data: [
      { tenantId: tenant.id, category: 'OFFICE', amount: 3500, description: 'شراء أثاث مكتبي', status: 'APPROVED', approvedById: 'user_admin_1' },
      { tenantId: tenant.id, category: 'TRAVEL', amount: 5200, description: 'تذاكر طيران - معرض تقني', status: 'APPROVED', approvedById: 'user_admin_1' },
      { tenantId: tenant.id, category: 'MARKETING', amount: 15000, description: 'حملة إعلانية Google Ads', status: 'PENDING' },
      { tenantId: tenant.id, category: 'UTILITIES', amount: 2800, description: 'فاتورة كهرباء مايو', status: 'APPROVED', approvedById: 'user_admin_1' },
    ],
  });
  console.log('✅ Expenses created:', 4);

  // ─── SUPPLIERS ───
  await prisma.supplier.createMany({
    data: [
      { tenantId: tenant.id, name: 'شركة التوريدات الحديثة', nameAr: 'شركة التوريدات الحديثة', code: 'SUP-001', taxNumber: '300000000100001', commercialReg: '1010000001', email: 'info@modern-supplies.com', phone: '0112345678', address: 'شارع الملك فهد، الرياض', city: 'الرياض', contactName: 'خالد العتيبي', contactPhone: '0501111111', paymentTerms: 30, creditLimit: 100000, balance: 0, isActive: true },
      { tenantId: tenant.id, name: 'مؤسسة الأمل للتجارة', nameAr: 'مؤسسة الأمل للتجارة', code: 'SUP-002', taxNumber: '300000000100002', commercialReg: '1010000002', email: 'sales@alamal.com', phone: '0123456789', address: 'شارع الأمير سلطان، جدة', city: 'جدة', contactName: 'فهد الشمري', contactPhone: '0502222222', paymentTerms: 45, creditLimit: 75000, balance: 0, isActive: true },
      { tenantId: tenant.id, name: 'شركة النور للإلكترونيات', nameAr: 'شركة النور للإلكترونيات', code: 'SUP-003', taxNumber: '300000000100003', commercialReg: '1010000003', email: 'orders@noorelec.com', phone: '0134567890', address: 'شارع الخليج، الدمام', city: 'الدمام', contactName: 'عبدالله الحربي', contactPhone: '0503333333', paymentTerms: 15, creditLimit: 50000, balance: 0, isActive: true },
      { tenantId: tenant.id, name: 'مؤسسة الصفا للمواد الغذائية', nameAr: 'مؤسسة الصفا للمواد الغذائية', code: 'SUP-004', taxNumber: '300000000100004', commercialReg: '1010000004', email: 'info@safatrading.com', phone: '0145678901', address: 'شارع التخصصي، الرياض', city: 'الرياض', contactName: 'سعد المطيري', contactPhone: '0504444444', paymentTerms: 60, creditLimit: 120000, balance: 0, isActive: true },
      { tenantId: tenant.id, name: 'شركة البناء المتطور', nameAr: 'شركة البناء المتطور', code: 'SUP-005', taxNumber: '300000000100005', commercialReg: '1010000005', email: 'contact@advancedbuild.com', phone: '0156789012', address: 'شارع الملك عبدالله، الرياض', city: 'الرياض', contactName: 'ناصر الدوسري', contactPhone: '0505555555', paymentTerms: 30, creditLimit: 200000, balance: 0, isActive: true },
    ],
  });
  console.log('✅ Suppliers created:', 5);

  // ─── CHART OF ACCOUNTS (بأرصدة صفر لنحسبها من القيود) ───
  await prisma.chartOfAccount.createMany({
    data: [
      { tenantId: tenant.id, code: '1000', name: 'الأصول', type: 'ASSET', balance: 0 },
      { tenantId: tenant.id, code: '1100', name: 'الأصول المتداولة', type: 'ASSET', parentId: null, balance: 0 },
      { tenantId: tenant.id, code: '1110', name: 'النقدية', type: 'ASSET', balance: 0 },
      { tenantId: tenant.id, code: '1120', name: 'الذمم المدينة', type: 'ASSET', balance: 0 },
      { tenantId: tenant.id, code: '1130', name: 'المخزون', type: 'ASSET', balance: 0 },
      { tenantId: tenant.id, code: '1200', name: 'الأصول الثابتة', type: 'ASSET', balance: 0 },
      { tenantId: tenant.id, code: '2000', name: 'الخصوم', type: 'LIABILITY', balance: 0 },
      { tenantId: tenant.id, code: '2100', name: 'الذمم الدائنة', type: 'LIABILITY', balance: 0 },
      { tenantId: tenant.id, code: '2200', name: 'القروض', type: 'LIABILITY', balance: 0 },
      { tenantId: tenant.id, code: '3000', name: 'حقوق الملكية', type: 'EQUITY', balance: 0 },
      { tenantId: tenant.id, code: '3100', name: 'رأس المال', type: 'EQUITY', balance: 0 },
      { tenantId: tenant.id, code: '3200', name: 'الأرباح المحتجزة', type: 'EQUITY', balance: 0 },
      { tenantId: tenant.id, code: '4000', name: 'الإيرادات', type: 'REVENUE', balance: 0 },
      { tenantId: tenant.id, code: '4100', name: 'إيرادات المبيعات', type: 'REVENUE', balance: 0 },
      { tenantId: tenant.id, code: '5000', name: 'المصروفات', type: 'EXPENSE', balance: 0 },
      { tenantId: tenant.id, code: '5100', name: 'مصروفات الإيجار', type: 'EXPENSE', balance: 0 },
      { tenantId: tenant.id, code: '5200', name: 'مصروفات الرواتب', type: 'EXPENSE', balance: 0 },
      { tenantId: tenant.id, code: '5300', name: 'مصروفات التسويق', type: 'EXPENSE', balance: 0 },
      { tenantId: tenant.id, code: '5400', name: 'مصروفات المرافق', type: 'EXPENSE', balance: 0 },
      { tenantId: tenant.id, code: '5500', name: 'مصروفات الصيانة', type: 'EXPENSE', balance: 0 },
    ],
  });
  console.log('✅ Chart of accounts created:', 20);

  const allAccounts = await prisma.chartOfAccount.findMany({ where: { tenantId: tenant.id } });
  const findAcc = (code: string) => allAccounts.find(a => a.code === code)!;

  // ─── JOURNAL ENTRIES ───
  await prisma.journalEntry.createMany({
    data: [
      { tenantId: tenant.id, entryNumber: 'JV-001-DR', date: new Date('2026-01-01'), description: 'رصيد افتتاحي - تأسيس الشركة', reference: 'OP-001', accountId: findAcc('1110').id, debitAmount: 150000, creditAmount: 0, type: 'GENERAL', status: 'POSTED' },
      { tenantId: tenant.id, entryNumber: 'JV-001-CR', date: new Date('2026-01-01'), description: 'رصيد افتتاحي - تأسيس الشركة', reference: 'OP-001', accountId: findAcc('3100').id, debitAmount: 0, creditAmount: 150000, type: 'GENERAL', status: 'POSTED' },
      { tenantId: tenant.id, entryNumber: 'JV-002-DR1', date: new Date('2026-01-15'), description: 'مبيعات - فاتورة INV-2026-0001', reference: 'INV-2026-0001', accountId: findAcc('1120').id, debitAmount: 115000, creditAmount: 0, type: 'GENERAL', status: 'POSTED' },
      { tenantId: tenant.id, entryNumber: 'JV-002-CR1', date: new Date('2026-01-15'), description: 'مبيعات - فاتورة INV-2026-0001', reference: 'INV-2026-0001', accountId: findAcc('4100').id, debitAmount: 0, creditAmount: 100000, type: 'GENERAL', status: 'POSTED' },
      { tenantId: tenant.id, entryNumber: 'JV-002-CR2', date: new Date('2026-01-15'), description: 'مبيعات - ضريبة الفاتورة', reference: 'INV-2026-0001', accountId: findAcc('2100').id, debitAmount: 0, creditAmount: 15000, type: 'GENERAL', status: 'POSTED' },
      { tenantId: tenant.id, entryNumber: 'JV-003-DR', date: new Date('2026-02-01'), description: 'شراء أثاث مكتبي', reference: 'PO-001', accountId: findAcc('1200').id, debitAmount: 3500, creditAmount: 0, type: 'GENERAL', status: 'POSTED' },
      { tenantId: tenant.id, entryNumber: 'JV-003-CR', date: new Date('2026-02-01'), description: 'شراء أثاث مكتبي', reference: 'PO-001', accountId: findAcc('1110').id, debitAmount: 0, creditAmount: 3500, type: 'GENERAL', status: 'POSTED' },
      { tenantId: tenant.id, entryNumber: 'JV-004-DR', date: new Date('2026-02-15'), description: 'دفع إيجار شهر فبراير', reference: 'RENT-002', accountId: findAcc('5100').id, debitAmount: 8000, creditAmount: 0, type: 'GENERAL', status: 'POSTED' },
      { tenantId: tenant.id, entryNumber: 'JV-004-CR', date: new Date('2026-02-15'), description: 'دفع إيجار شهر فبراير', reference: 'RENT-002', accountId: findAcc('1110').id, debitAmount: 0, creditAmount: 8000, type: 'GENERAL', status: 'POSTED' },
      { tenantId: tenant.id, entryNumber: 'JV-005-DR', date: new Date('2026-03-01'), description: 'حملة إعلانية Google Ads', reference: 'MKT-001', accountId: findAcc('5300').id, debitAmount: 15000, creditAmount: 0, type: 'GENERAL', status: 'POSTED' },
      { tenantId: tenant.id, entryNumber: 'JV-005-CR', date: new Date('2026-03-01'), description: 'حملة إعلانية Google Ads', reference: 'MKT-001', accountId: findAcc('1110').id, debitAmount: 0, creditAmount: 15000, type: 'GENERAL', status: 'POSTED' },
      { tenantId: tenant.id, entryNumber: 'JV-006-DR', date: new Date('2026-03-10'), description: 'رواتب شهر مارس', reference: 'PAY-003', accountId: findAcc('5200').id, debitAmount: 70000, creditAmount: 0, type: 'GENERAL', status: 'POSTED' },
      { tenantId: tenant.id, entryNumber: 'JV-006-CR', date: new Date('2026-03-10'), description: 'رواتب شهر مارس', reference: 'PAY-003', accountId: findAcc('1110').id, debitAmount: 0, creditAmount: 70000, type: 'GENERAL', status: 'POSTED' },
      { tenantId: tenant.id, entryNumber: 'JV-007-DR', date: new Date('2026-04-05'), description: 'فاتورة كهرباء أبريل', reference: 'UTIL-004', accountId: findAcc('5400').id, debitAmount: 2800, creditAmount: 0, type: 'GENERAL', status: 'POSTED' },
      { tenantId: tenant.id, entryNumber: 'JV-007-CR', date: new Date('2026-04-05'), description: 'فاتورة كهرباء أبريل', reference: 'UTIL-004', accountId: findAcc('1110').id, debitAmount: 0, creditAmount: 2800, type: 'GENERAL', status: 'POSTED' },
      { tenantId: tenant.id, entryNumber: 'JV-008-DR', date: new Date('2026-04-20'), description: 'صيانة أجهزة تقنية', reference: 'MNT-001', accountId: findAcc('5500').id, debitAmount: 4500, creditAmount: 0, type: 'GENERAL', status: 'POSTED' },
      { tenantId: tenant.id, entryNumber: 'JV-008-CR', date: new Date('2026-04-20'), description: 'صيانة أجهزة تقنية', reference: 'MNT-001', accountId: findAcc('1110').id, debitAmount: 0, creditAmount: 4500, type: 'GENERAL', status: 'POSTED' },
      { tenantId: tenant.id, entryNumber: 'JV-009-DR', date: new Date('2026-05-01'), description: 'تحصيل فاتورة INV-2026-0001', reference: 'TRX-001', accountId: findAcc('1110').id, debitAmount: 115000, creditAmount: 0, type: 'GENERAL', status: 'POSTED' },
      { tenantId: tenant.id, entryNumber: 'JV-009-CR', date: new Date('2026-05-01'), description: 'تحصيل فاتورة INV-2026-0001', reference: 'TRX-001', accountId: findAcc('1120').id, debitAmount: 0, creditAmount: 115000, type: 'GENERAL', status: 'POSTED' },
    ],
  });
  console.log('✅ Journal entries created:', 20);

  // ─── BANK ACCOUNTS ───
  await prisma.bankAccount.createMany({
    data: [
      { tenantId: tenant.id, bankName: 'البنك الأهلي', accountName: 'شركة التقنية المتقددة', accountNumber: 'SA0380000000608010167519', iban: 'SA0380000000608010167519', currency: 'SAR', balance: 150000, isDefault: true, isActive: true },
      { tenantId: tenant.id, bankName: 'بنك الرياض', accountName: 'شركة التقنية المتقددة', accountNumber: 'SA0380000000608010167520', iban: 'SA0380000000608010167520', currency: 'SAR', balance: 45000, isDefault: false, isActive: true },
    ],
  });
  console.log('✅ Bank accounts created:', 2);

  // ─── PROJECTS ───
  const project1 = await prisma.project.create({
    data: {
      tenantId: tenant.id,
      name: 'تطوير منصة CRM جديدة',
      description: 'مشروع تطوير نظام CRM متكامل للعملاء',
      status: 'ACTIVE',
      priority: 'HIGH',
      startDate: new Date('2026-01-01'),
      endDate: new Date('2026-12-31'),
      budget: 500000,
      progress: 35,
      managerId: 'user_manager_1',
    },
  });

  const project2 = await prisma.project.create({
    data: {
      tenantId: tenant.id,
      name: 'تكامل ZATCA',
      description: 'ربط النظام مع الفاتورة الإلكترونية',
      status: 'ACTIVE',
      priority: 'CRITICAL',
      startDate: new Date('2026-03-01'),
      endDate: new Date('2026-08-30'),
      budget: 120000,
      progress: 60,
      managerId: 'user_admin_1',
    },
  });
  console.log('✅ Projects created:', 2);

  // ─── TASKS ───
  await prisma.task.createMany({
    data: [
      { tenantId: tenant.id, projectId: project1.id, title: 'تحليل المتطلبات', status: 'DONE', priority: 'HIGH', assignedToId: 'user_manager_1', completedAt: new Date('2026-01-15') },
      { tenantId: tenant.id, projectId: project1.id, title: 'تصميم قاعدة البيانات', status: 'DONE', priority: 'HIGH', assignedToId: 'user_admin_1', completedAt: new Date('2026-02-01') },
      { tenantId: tenant.id, projectId: project1.id, title: 'تطوير API الـ Backend', status: 'IN_PROGRESS', priority: 'HIGH', assignedToId: 'user_admin_1', dueDate: new Date('2026-06-30') },
      { tenantId: tenant.id, projectId: project1.id, title: 'تطوير واجهة المستخدم', status: 'TODO', priority: 'MEDIUM', assignedToId: 'user_sales_1', dueDate: new Date('2026-08-15') },
      { tenantId: tenant.id, projectId: project2.id, title: 'دراسة متطلبات ZATCA', status: 'DONE', priority: 'HIGH', assignedToId: 'user_admin_1', completedAt: new Date('2026-03-15') },
      { tenantId: tenant.id, projectId: project2.id, title: 'تطوير مولد XML', status: 'IN_PROGRESS', priority: 'URGENT', assignedToId: 'user_manager_1', dueDate: new Date('2026-06-15') },
    ],
  });
  console.log('✅ Tasks created:', 6);

  // ─── TEMPLATES ───
  await prisma.template.createMany({
    data: [
      {
        tenantId: tenant.id,
        name: 'عقد عمل',
        nameAr: 'عقد عمل',
        category: 'HR',
        templateKey: 'employment-contract',
        htmlTemplate: '<h1>عقد عمل</h1><p>الطرف الأول: {{companyName}}</p><p>الطرف الثاني: {{employeeName}}</p>',
        isSystem: false,
        isActive: true,
      },
      {
        tenantId: tenant.id,
        name: 'عرض سعر',
        nameAr: 'عرض سعر',
        category: 'SALES',
        templateKey: 'quotation-template',
        htmlTemplate: '<h1>عرض سعر</h1><p>العميل: {{clientName}}</p><p>المبلغ: {{amount}} {{currency}}</p>',
        isSystem: false,
        isActive: true,
      },
      {
        tenantId: tenant.id,
        name: 'فاتورة ضريبية',
        nameAr: 'فاتورة ضريبية',
        category: 'ACCOUNTING',
        templateKey: 'tax-invoice',
        htmlTemplate: '<h1>فاتورة ضريبية مبسطة</h1><p>رقم الفاتورة: {{invoiceNumber}}</p><p>الإجمالي: {{total}}</p>',
        isSystem: true,
        isActive: true,
      },
    ],
  });
  console.log('✅ Templates created:', 3);

  // ─── AI CONVERSATIONS ───
  const aiConv = await prisma.aIConversation.create({
    data: {
      tenantId: tenant.id,
      title: 'مساعدة في CRM',
      model: 'llama3',
      context: 'CRM',
      status: 'ACTIVE',
    },
  });

  await prisma.aIMessage.createMany({
    data: [
      { tenantId: tenant.id, conversationId: aiConv.id, role: 'USER', content: 'ما إجمالي المبيعات هذا الشهر؟' },
      { tenantId: tenant.id, conversationId: aiConv.id, role: 'ASSISTANT', content: 'إجمالي المبيعات لشهر مايو 2026 هو 115,000 ريال سعودي. هناك فاتورتان: واحدة مدفوعة وواحدة مرسلة.' },
    ],
  });
  console.log('✅ AI conversation created:', 1);

  // ─── SUBSCRIPTIONS ───
  await prisma.subscription.createMany({
    data: [
      {
        tenantId: tenant.id,
        userId: 'user_admin_1',
        plan: 'ENTERPRISE',
        status: 'ACTIVE',
        startDate: new Date('2026-01-01'),
        endDate: new Date('2026-12-31'),
        autoRenew: true,
        seats: 10,
        pricePerSeat: 500,
        totalPrice: 5000,
        currency: 'SAR',
        billingCycle: 'MONTHLY',
      },
    ],
  });
  console.log('✅ Subscriptions created:', 1);

  // ─── AUDIT LOGS ───
  await prisma.auditLog.createMany({
    data: [
      { tenantId: tenant.id, userId: 'user_super_admin', action: 'CREATE', entityType: 'Tenant', entityId: tenant.id, newValues: { name: tenant.name } },
      { tenantId: tenant.id, userId: 'user_admin_1', action: 'CREATE', entityType: 'Contact', entityId: allContacts[0].id, newValues: { name: 'محمد الراجحي' } },
    ],
  });
  console.log('✅ Audit logs created:', 2);

  console.log('\n🎉 Seed completed successfully!');
  console.log('📊 Summary:');
  console.log('   • 1 Tenant');
  console.log('   • 4 Users');
  console.log('   • 5 Contacts');
  console.log('   • 3 Deals');
  console.log('   • 3 Activities');
  console.log('   • 4 Employees + 6 Departments');
  console.log('   • 3 Leaves + 3 Attendance');
  console.log('   • 3 Vehicles + 2 Drivers + 2 Trips');
  console.log('   • 2 Invoices + 3 Items + 2 Payments');
  console.log('   • 4 Expenses + 9 Chart of Accounts + 2 Bank Accounts');
  console.log('   • 2 Projects + 6 Tasks');
  console.log('   • 3 Templates + 1 AI Conversation + 1 Subscription');
}

main()
  .catch((e) => {
    console.error('❌ Seed error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
