/**
 * P0 dashboard truthfulness gate.
 * A missing response is not a zero-valued business metric.
 */
export function isVerifiedDashboardPayload(
  stats: unknown,
  revenueTrend: unknown,
  crm: unknown,
  erp: unknown,
  fleet: unknown,
): boolean {
  const obj = (value: unknown): value is Record<string, unknown> =>
    value !== null && typeof value === 'object' && !Array.isArray(value);
  if (!obj(stats) || !obj(stats.counts) || !obj(stats.revenue) ||
      !obj(crm) || !obj(erp) || !obj(fleet)) return false;

  const requiredCounts = ['contacts', 'deals', 'employees', 'vehicles', 'invoices'];
  if (!requiredCounts.every(key =>
    typeof stats.counts[key] === 'number' &&
    Number.isSafeInteger(stats.counts[key]) &&
    (stats.counts[key] as number) >= 0)) return false;

  const invoiceTotal = stats.revenue.invoices;
  if (invoiceTotal === undefined || invoiceTotal === null ||
      (typeof invoiceTotal !== 'number' && typeof invoiceTotal !== 'string') ||
      (typeof invoiceTotal === 'string' && invoiceTotal.trim() === '') ||
      !Number.isFinite(Number(invoiceTotal)) || Number(invoiceTotal) < 0) return false;

  return Array.isArray(revenueTrend) &&
    Array.isArray(crm.byStage) &&
    Array.isArray(erp.byStatus) &&
    Array.isArray(fleet.byStatus);
}
