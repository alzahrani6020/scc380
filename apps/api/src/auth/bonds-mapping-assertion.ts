import { createPublicKey, verify as verifySignature } from 'node:crypto';
import { ServiceUnavailableException, UnauthorizedException } from '@nestjs/common';

// This is a short-lived BONDS identity assertion, never itself a login credential.
export type BondsProofPurpose = 'verify-identity-only' | 'issue-program-session';
const PROGRAMS = new Set([
  'crm','hr','real_estate','fleet','sales','purchasing','inventory',
  'finance','accounting','projects','governance',
]);
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export interface BondsMappingClaims {
  iss: 'bonds-global';
  aud: 'scc380:mapping-verification' | 'scc380:program-session';
  purpose: BondsProofPurpose;
  workspaceLinkId: string;
  bondsUserId: string;
  tenantId: string;
  userId: string;
  programKey: string;
  email: string;
  emailConfirmed: true;
  iat: number;
  exp: number;
  jti: string;
}
export function verifyBondsMappingProof(
  assertion: string, publicKeyPem: string | undefined, nowSeconds = Math.floor(Date.now() / 1000),
  expectedPurpose: BondsProofPurpose = 'verify-identity-only',
): BondsMappingClaims {
  if (!publicKeyPem) throw new ServiceUnavailableException('BONDS mapping verifier disabled');
  if (typeof assertion !== 'string' || assertion.length > 4096 || assertion.length < 64) {
    throw new UnauthorizedException('Invalid mapping proof');
  }
  const parts = assertion.split('.');
  if (parts.length !== 2 || !parts.every(v => /^[A-Za-z0-9_-]+$/.test(v))) {
    throw new UnauthorizedException('Invalid mapping proof');
  }
  let claims: Record<string, any>;
  try {
    const key = createPublicKey(publicKeyPem.replace(/\\n/g, '\n'));
    if (key.asymmetricKeyType !== 'ed25519') throw new Error('key algorithm mismatch');
    const sig = Buffer.from(parts[1], 'base64url');
    if (sig.length !== 64 || !verifySignature(null, Buffer.from(parts[0], 'utf8'), key, sig)) {
      throw new Error('signature rejected');
    }
    claims = JSON.parse(Buffer.from(parts[0], 'base64url').toString('utf8'));
  } catch {
    throw new UnauthorizedException('Invalid mapping proof');
  }
  const expectedAudience = expectedPurpose === 'issue-program-session'
    ? 'scc380:program-session' : 'scc380:mapping-verification';
  if (!claims || claims.iss !== 'bonds-global' || claims.aud !== expectedAudience ||
      claims.purpose !== expectedPurpose || !UUID.test(claims.workspaceLinkId) ||
      !UUID.test(claims.bondsUserId) || !UUID.test(claims.jti) ||
      typeof claims.tenantId !== 'string' || !claims.tenantId || claims.tenantId.length > 128 ||
      typeof claims.userId !== 'string' || !claims.userId || claims.userId.length > 128 ||
      !PROGRAMS.has(claims.programKey) || claims.emailConfirmed !== true ||
      typeof claims.email !== 'string' || !/^[^@\s]+@[^@\s]+$/.test(claims.email) ||
      claims.email !== claims.email.trim().toLowerCase() || claims.email.length > 254 ||
      !Number.isInteger(claims.iat) || !Number.isInteger(claims.exp) ||
      !Number.isFinite(nowSeconds) ||
      claims.iat > nowSeconds + 5 || claims.iat < nowSeconds - 60 ||
      claims.exp <= nowSeconds || claims.exp > claims.iat + 40 || claims.exp <= claims.iat) {
    throw new UnauthorizedException('Invalid or expired mapping proof');
  }
  return claims as unknown as BondsMappingClaims;
}
