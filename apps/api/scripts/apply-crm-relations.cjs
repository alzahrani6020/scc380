const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

const checks = {
  deal_contact_orphan: `
    SELECT COUNT(*)::int AS count
    FROM deals d
    LEFT JOIN contacts c ON c.id = d."contactId"
    WHERE c.id IS NULL
  `,
  deal_contact_cross_tenant: `
    SELECT COUNT(*)::int AS count
    FROM deals d
    JOIN contacts c ON c.id = d."contactId"
    WHERE c."tenantId" IS DISTINCT FROM d."tenantId"
  `,
  deal_assignee_orphan: `
    SELECT COUNT(*)::int AS count
    FROM deals d
    LEFT JOIN users u ON u.id = d."assignedToId"
    WHERE d."assignedToId" IS NOT NULL AND u.id IS NULL
  `,
  deal_assignee_cross_tenant: `
    SELECT COUNT(*)::int AS count
    FROM deals d
    JOIN users u ON u.id = d."assignedToId"
    WHERE d."assignedToId" IS NOT NULL
      AND u."tenantId" IS DISTINCT FROM d."tenantId"
  `,
  contact_assignee_orphan: `
    SELECT COUNT(*)::int AS count
    FROM contacts c
    LEFT JOIN users u ON u.id = c."assignedToId"
    WHERE c."assignedToId" IS NOT NULL AND u.id IS NULL
  `,
  contact_assignee_cross_tenant: `
    SELECT COUNT(*)::int AS count
    FROM contacts c
    JOIN users u ON u.id = c."assignedToId"
    WHERE c."assignedToId" IS NOT NULL
      AND u."tenantId" IS DISTINCT FROM c."tenantId"
  `,
  activity_contact_orphan: `
    SELECT COUNT(*)::int AS count
    FROM activities a
    LEFT JOIN contacts c ON c.id = a."contactId"
    WHERE a."contactId" IS NOT NULL AND c.id IS NULL
  `,
  activity_contact_cross_tenant: `
    SELECT COUNT(*)::int AS count
    FROM activities a
    JOIN contacts c ON c.id = a."contactId"
    WHERE a."contactId" IS NOT NULL
      AND c."tenantId" IS DISTINCT FROM a."tenantId"
  `,
  activity_deal_orphan: `
    SELECT COUNT(*)::int AS count
    FROM activities a
    LEFT JOIN deals d ON d.id = a."dealId"
    WHERE a."dealId" IS NOT NULL AND d.id IS NULL
  `,
  activity_deal_cross_tenant: `
    SELECT COUNT(*)::int AS count
    FROM activities a
    JOIN deals d ON d.id = a."dealId"
    WHERE a."dealId" IS NOT NULL
      AND d."tenantId" IS DISTINCT FROM a."tenantId"
  `,
  activity_assignee_orphan: `
    SELECT COUNT(*)::int AS count
    FROM activities a
    LEFT JOIN users u ON u.id = a."assignedToId"
    WHERE a."assignedToId" IS NOT NULL AND u.id IS NULL
  `,
  activity_assignee_cross_tenant: `
    SELECT COUNT(*)::int AS count
    FROM activities a
    JOIN users u ON u.id = a."assignedToId"
    WHERE a."assignedToId" IS NOT NULL
      AND u."tenantId" IS DISTINCT FROM a."tenantId"
  `,
};

const constraints = [
  {
    name: 'contacts_assignedToId_fkey',
    sql: `ALTER TABLE "contacts" ADD CONSTRAINT "contacts_assignedToId_fkey"
      FOREIGN KEY ("assignedToId") REFERENCES "users"("id")
      ON DELETE SET NULL ON UPDATE CASCADE`,
  },
  {
    name: 'deals_contactId_fkey',
    sql: `ALTER TABLE "deals" ADD CONSTRAINT "deals_contactId_fkey"
      FOREIGN KEY ("contactId") REFERENCES "contacts"("id")
      ON DELETE RESTRICT ON UPDATE CASCADE`,
  },
  {
    name: 'deals_assignedToId_fkey',
    sql: `ALTER TABLE "deals" ADD CONSTRAINT "deals_assignedToId_fkey"
      FOREIGN KEY ("assignedToId") REFERENCES "users"("id")
      ON DELETE SET NULL ON UPDATE CASCADE`,
  },
  {
    name: 'activities_contactId_fkey',
    sql: `ALTER TABLE "activities" ADD CONSTRAINT "activities_contactId_fkey"
      FOREIGN KEY ("contactId") REFERENCES "contacts"("id")
      ON DELETE SET NULL ON UPDATE CASCADE`,
  },
  {
    name: 'activities_dealId_fkey',
    sql: `ALTER TABLE "activities" ADD CONSTRAINT "activities_dealId_fkey"
      FOREIGN KEY ("dealId") REFERENCES "deals"("id")
      ON DELETE SET NULL ON UPDATE CASCADE`,
  },
  {
    name: 'activities_assignedToId_fkey',
    sql: `ALTER TABLE "activities" ADD CONSTRAINT "activities_assignedToId_fkey"
      FOREIGN KEY ("assignedToId") REFERENCES "users"("id")
      ON DELETE SET NULL ON UPDATE CASCADE`,
  },
];

async function readIntegrity() {
  const result = {};
  for (const [name, sql] of Object.entries(checks)) {
    const rows = await prisma.$queryRawUnsafe(sql);
    result[name] = Number(rows?.[0]?.count || 0);
  }
  return result;
}

(async () => {
  const integrity = await readIntegrity();
  const violations = Object.values(integrity).reduce((sum, value) => sum + value, 0);

  if (violations !== 0) {
    console.error('CRM_RELATIONS_APPLY_BLOCKED ' + JSON.stringify(integrity));
    return;
  }

  await prisma.$transaction(async (tx) => {
    for (const constraint of constraints) {
      const existing = await tx.$queryRawUnsafe(
        `SELECT 1 FROM pg_constraint WHERE conname = $1 LIMIT 1`,
        constraint.name,
      );
      if (existing.length === 0) {
        await tx.$executeRawUnsafe(constraint.sql);
      }
    }
  });

  const names = constraints.map((item) => item.name);
  const rows = await prisma.$queryRawUnsafe(
    `SELECT conname FROM pg_constraint WHERE conname = ANY($1::text[]) ORDER BY conname`,
    names,
  );

  console.log(
    'CRM_RELATIONS_APPLY ' +
      JSON.stringify({
        integrity,
        expectedConstraints: constraints.length,
        installedConstraints: rows.length,
      }),
  );
})()
  .catch((error) => {
    console.error('CRM_RELATIONS_APPLY_ERROR', error?.message || error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
