/**
 * BONDS / MAKKIN commercial product catalog.
 *
 * This registry describes the eleven purchasable applications. It does NOT
 * grant access: server-side tenant entitlements and permissions must be
 * evaluated separately before exposing any protected API.
 *
 * Shared foundations (identity, workspaces, users, permissions, notifications,
 * analytics and audit) must not become separately billable applications.
 */
export const BONDS_APPLICATIONS = [
  { key: 'crm', nameAr: 'BONDS CRM', nameEn: 'BONDS CRM', home: '/dashboard/crm', apiRoots: ['/crm'], audience: 'all-businesses' },
  { key: 'hr', nameAr: 'مكين للموارد البشرية', nameEn: 'Makkin HR', home: '/dashboard/hr', apiRoots: ['/hr'], audience: 'employers' },
  { key: 'real-estate', nameAr: 'مكين للعقارات', nameEn: 'Makkin Real Estate', home: '/dashboard/real-estate', apiRoots: ['/real-estate'], audience: 'property-businesses' },
  { key: 'fleet', nameAr: 'مكين للأسطول', nameEn: 'Makkin Fleet', home: '/dashboard/fleet', apiRoots: ['/fleet'], audience: 'transport-businesses' },
  { key: 'sales', nameAr: 'مكين للمبيعات', nameEn: 'Makkin Sales', home: '/dashboard/erp', apiRoots: ['/erp', '/pos'], audience: 'merchants' },
  { key: 'purchasing', nameAr: 'مكين للمشتريات', nameEn: 'Makkin Purchasing', home: '/dashboard/suppliers', apiRoots: ['/suppliers', '/supplier-invoices'], audience: 'businesses' },
  { key: 'inventory', nameAr: 'مكين للمخزون', nameEn: 'Makkin Inventory', home: '/dashboard/inventory', apiRoots: ['/inventory', '/stock-transfers'], audience: 'trading-and-industry' },
  { key: 'finance', nameAr: 'مكين للمالية', nameEn: 'Makkin Finance', home: '/dashboard/finance', apiRoots: ['/finance'], audience: 'businesses' },
  { key: 'accounting', nameAr: 'مكين للمحاسبة', nameEn: 'Makkin Accounting', home: '/dashboard/finance/chart-of-accounts', apiRoots: ['/accounting-core', '/auto-journal'], audience: 'accounting-teams' },
  { key: 'projects', nameAr: 'مكين للمشاريع', nameEn: 'Makkin Projects', home: '/dashboard/projects', apiRoots: ['/projects'], audience: 'project-businesses' },
  { key: 'governance', nameAr: 'مكين للحوكمة والامتثال', nameEn: 'Makkin Governance & Compliance', home: '/dashboard/compliance', apiRoots: ['/compliance', '/approvals'], audience: 'regulated-businesses' },
] as const;

export type BondsApplicationKey = (typeof BONDS_APPLICATIONS)[number]['key'];
export const SHARED_FOUNDATIONS = [
  'identity', 'workspaces', 'users', 'permissions',
  'notifications', 'analytics', 'audit',
] as const;

/**
 * A commercial selection is distinct from a paid, active entitlement.
 * It cannot be used as an authorization decision.
 */
export function normalizeApplicationSelection(values: readonly string[]): BondsApplicationKey[] {
  const valid = new Set<string>(BONDS_APPLICATIONS.map((app) => app.key));
  return [...new Set(values.filter((value): value is BondsApplicationKey => valid.has(value)))];
}
