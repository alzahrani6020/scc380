import { PrismaClient } from '@prisma/client';
import { hash } from 'argon2';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding database...');

  const admin = await prisma.user.upsert({
    where: { email: 'admin@scc.sa' },
    update: {},
    create: {
      email: 'admin@scc.sa',
      firstName: 'System',
      lastName: 'Admin',
      role: 'SUPER_ADMIN',
      status: 'ACTIVE',
      emailVerified: true,
      passwordHash: await hash('admin123'),
    },
  });

  const tenant = await prisma.tenant.upsert({
    where: { slug: 'demo' },
    update: {},
    create: {
      name: 'Demo Company',
      slug: 'demo',
      type: 'SHARED',
      status: 'ACTIVE',
      plan: 'PROFESSIONAL',
      vatNumber: '300000000000003',
      crNumber: '1010000000',
      features: ['crm', 'erp', 'hr', 'fleet', 'analytics'],
    },
  });

  await prisma.contact.createMany({
    data: [
      { firstName: 'أحمد', lastName: 'السعود', email: 'ahmed@example.com', phone: '+966501234567', type: 'CUSTOMER', status: 'ACTIVE', companyName: 'شركة النماء', source: 'WEBSITE', stage: 'QUALIFIED', country: 'SA' },
      { firstName: 'Mohammed', lastName: 'Al-Rashid', email: 'mohammed@example.com', phone: '+966509876543', type: 'LEAD', status: 'ACTIVE', source: 'REFERRAL', stage: 'LEAD', country: 'SA' },
    ],
  });

  await prisma.employee.createMany({
    data: [
      { employeeCode: 'EMP001', firstName: 'Khalid', lastName: 'Al-Otaibi', email: 'khalid@demo.com', phone: '+966501112223', idNumber: '1000000001', nationality: 'SA', jobTitle: 'Sales Manager', employmentType: 'FULL_TIME', status: 'ACTIVE', hireDate: new Date('2023-01-15'), basicSalary: 15000 },
    ],
  });

  await prisma.vehicle.createMany({
    data: [
      { plateNumber: 'أ ب ت 1234', plateType: 'COMMERCIAL', make: 'Toyota', model: 'Land Cruiser', year: 2023, status: 'ACTIVE', fuelType: 'PETROL', ownershipType: 'OWNED' },
    ],
  });

  console.log('✅ Seed completed!');
  console.log('👤 Admin:', admin.email, '/ password: admin123');
  console.log('🏢 Tenant:', tenant.name);
}

main().catch(console.error).finally(() => prisma.$disconnect());
