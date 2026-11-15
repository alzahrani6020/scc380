import {
  BONDS_APPLICATIONS,
  type BondsApplicationKey,
} from './application-catalog';

/**
 * This is a pure entitlement policy, not an HTTP guard.
 * Call it only with an authenticated, database-resolved tenant. A client
 * selection, UI flag, JWT role or raw request header is NOT proof of payment.
 */
export type ProductEntitlement = {
  product: BondsApplicationKey;
  state: 'ACTIVE' | 'TRIAL' | 'SUSPENDED' | 'EXPIRED' | 'CANCELLED';
  startsAt: Date;
  endsAt: Date | null;
};

export function evaluateProductAccess(
  tenantId: string | null | undefined,
  authenticatedTenantId: string | null | undefined,
  entitlements: readonly ProductEntitlement[],
  product: BondsApplicationKey,
  now: Date = new Date(),
): boolean {
  if (!tenantId || !authenticatedTenantId || tenantId !== authenticatedTenantId) return false;
  if (Number.isNaN(now.getTime())) return false;
  if (!BONDS_APPLICATIONS.some((entry) => entry.key === product)) return false;
  return entitlements.some((entry) =>
    entry.product === product &&
    (entry.state === 'ACTIVE' || entry.state === 'TRIAL') &&
    entry.startsAt instanceof Date &&
    !Number.isNaN(entry.startsAt.getTime()) &&
    entry.startsAt.getTime() <= now.getTime() &&
    (entry.endsAt === null || (
      entry.endsAt instanceof Date &&
      !Number.isNaN(entry.endsAt.getTime()) &&
      now.getTime() < entry.endsAt.getTime()
    )),
  );
}
