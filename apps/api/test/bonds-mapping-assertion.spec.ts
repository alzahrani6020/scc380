import test from 'node:test';
import assert from 'node:assert/strict';
import { generateKeyPairSync, sign } from 'node:crypto';
import { verifyBondsMappingProof } from '../src/auth/bonds-mapping-assertion';

const { publicKey, privateKey } = generateKeyPairSync('ed25519');
const publicPem = publicKey.export({ type: 'spki', format: 'pem' }).toString();
const base = {
  iss: 'bonds-global', aud: 'scc380:mapping-verification',
  purpose: 'verify-identity-only',
  workspaceLinkId: '11111111-1111-4111-8111-111111111111',
  bondsUserId: '22222222-2222-4222-8222-222222222222',
  tenantId: 'makkin-tenant-a', userId: 'makkin-user-a',
  programKey: 'hr', email: 'owner@example.org', emailConfirmed: true,
  iat: 1000, exp: 1040, jti: '33333333-3333-4333-8333-333333333333',
};
function ticket(claims: object, key=privateKey) {
  const payload = Buffer.from(JSON.stringify(claims)).toString('base64url');
  return payload + '.' + sign(null, Buffer.from(payload), key).toString('base64url');
}
test('valid authenticated BONDS identity proof contains no session token', () => {
  const claims = verifyBondsMappingProof(ticket(base), publicPem, 1010);
  assert.equal(claims.userId, 'makkin-user-a');
  assert.equal(claims.purpose, 'verify-identity-only');
  assert.ok(!('accessToken' in claims));
});
test('tampered payload and forged signer are denied', () => {
  const original = ticket(base);
  const [payload, signature] = original.split('.');
  const changed = Buffer.from(JSON.stringify({...base,tenantId:'another-tenant'})).toString('base64url');
  assert.throws(() => verifyBondsMappingProof(changed+'.'+signature, publicPem, 1010));
  const attacker = generateKeyPairSync('ed25519');
  assert.throws(() => verifyBondsMappingProof(ticket(base,attacker.privateKey),publicPem,1010));
  assert.throws(() => verifyBondsMappingProof(payload+'.invalid',publicPem,1010));
});
test('expired, wrong audience, unverified email and unknown product are denied', () => {
  assert.throws(() => verifyBondsMappingProof(ticket(base),publicPem,1040));
  for (const change of [
    {aud:'scc380:login'},
    {emailConfirmed:false},
    {programKey:'all'},
    {purpose:'issue-session'},
    {workspaceLinkId:'not-a-uuid'},
    {iat:2000,exp:2040},
    {exp:1400},
  ]) assert.throws(() => verifyBondsMappingProof(ticket({...base,...change}),publicPem,1010));
});
test('missing public verification key cannot authorize a mapping', () => {
  assert.throws(() => verifyBondsMappingProof(ticket(base),undefined,1010));
});
