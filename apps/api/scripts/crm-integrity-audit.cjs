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

(async () => {
  const result = {};
  for (const [name, sql] of Object.entries(checks)) {
    const rows = await prisma.$queryRawUnsafe(sql);
    result[name] = Number(rows?.[0]?.count || 0);
  }
  console.log('CRM_INTEGRITY_AUDIT ' + JSON.stringify(result));
})()
  .catch((error) => {
    console.error('CRM_INTEGRITY_AUDIT_ERROR', error?.message || error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
