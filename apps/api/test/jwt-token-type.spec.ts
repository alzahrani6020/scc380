import 'reflect-metadata';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { UnauthorizedException } from '@nestjs/common';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { JwtStrategy } from '../src/auth/strategies/jwt.strategy';

const strategy = new JwtStrategy({
  get: (key: string) => key === 'JWT_SECRET' ? 'test-secret-at-least-32-characters-long' : undefined,
} as any);

for (const type of [undefined, 'refresh', '2fa_pending']) {
  test(`JwtStrategy rejects non-access token type: ${String(type)}`, async () => {
    await assert.rejects(
      () => strategy.validate({ sub: 'user-1', type }),
      (error: unknown) =>
        error instanceof UnauthorizedException &&
        error.message === 'Invalid token type',
    );
  });
}

test('AuthService explicitly tags both access and refresh JWT payloads', () => {
  const source = readFileSync(
    join(process.cwd(), 'src/auth/auth.service.ts'),
    'utf8',
  );

  const accessTags = source.match(/type:\s*'access'/g) ?? [];
  const refreshTags = source.match(/type:\s*'refresh'/g) ?? [];

  // One pair for normal login and one pair for the post-2FA login path.
  assert.equal(accessTags.length, 2);
  assert.equal(refreshTags.length, 2);
});


test('reset password policy stays aligned at 12-128 characters', () => {
  const controllerSource = readFileSync(
    join(process.cwd(), 'src/auth/auth.controller.ts'),
    'utf8',
  );
  assert.match(controllerSource, /newPassword\.length < 12/);
  assert.match(controllerSource, /newPassword\.length > 128/);
});

test('2FA temporary token is not placed in a URL', () => {
  const webRoot = join(process.cwd(), '../web/src/app/auth');
  const loginSource = readFileSync(join(webRoot, 'login/page.tsx'), 'utf8');
  const verifySource = readFileSync(join(webRoot, 'verify-2fa/page.tsx'), 'utf8');

  assert.doesNotMatch(loginSource, /verify-2fa\?token=/);
  assert.match(loginSource, /sessionStorage\.setItem\('scc_2fa_temp_token'/);
  assert.match(verifySource, /sessionStorage\.getItem\('scc_2fa_temp_token'/);
  assert.match(verifySource, /sessionStorage\.removeItem\('scc_2fa_temp_token'/);
});


test('password reset tokens and 2FA backup codes are hashed at rest', () => {
  const source = readFileSync(
    join(process.cwd(), 'src/auth/auth.service.ts'),
    'utf8',
  );

  assert.match(source, /createHash\('sha256'\)\.update\(token\)\.digest\('hex'\)/);
  assert.match(source, /token:\s*tokenHash/);
  assert.match(source, /backupCodeHashes/);
  assert.match(source, /storedCode === backupCodeHash \|\| storedCode === code/);
});

test('login page validates an existing token with auth me before redirecting', () => {
  const loginSource = readFileSync(
    join(process.cwd(), '../web/src/app/auth/login/page.tsx'),
    'utf8',
  );

  assert.match(loginSource, /api\.get\('\/auth\/me'\)/);
  assert.doesNotMatch(loginSource, /if \(token\) router\.push\('\/dashboard'\)/);
});

test('public auth requests do not inherit stale tenant context', () => {
  const apiSource = readFileSync(
    join(process.cwd(), '../web/src/lib/api.ts'),
    'utf8',
  );

  assert.match(apiSource, /publicAuthRequest/);
  assert.match(apiSource, /tenantSlug && !publicAuthRequest/);
});

test('web middleware requires an access token type and expiry', () => {
  const middlewareSource = readFileSync(
    join(process.cwd(), '../web/src/middleware.ts'),
    'utf8',
  );

  assert.match(middlewareSource, /payload\?\.type === 'access'/);
  assert.match(middlewareSource, /typeof payload\.exp === 'number'/);
});


test('2FA setup refuses to overwrite an already-enabled secret', () => {
  const source = readFileSync(
    join(process.cwd(), 'src/auth/auth.service.ts'),
    'utf8',
  );
  assert.match(source, /if \(existing\.twoFactorEnabled\)/);
  assert.match(source, /disable it before setting up a new secret/);
});

test('2FA login UI accepts both TOTP and 8-character backup codes', () => {
  const verifySource = readFileSync(
    join(process.cwd(), '../web/src/app/auth/verify-2fa/page.tsx'),
    'utf8',
  );
  assert.match(verifySource, /maxLength=\{8\}/);
  assert.match(verifySource, /\^\\d\{6\}\$/);
  assert.match(verifySource, /\^\[0-9A-F\]\{8\}\$/);
});


test('tenantless non-super-admin users are rejected by JwtStrategy', () => {
  const source = readFileSync(
    join(process.cwd(), 'src/auth/strategies/jwt.strategy.ts'),
    'utf8',
  );
  assert.match(source, /user\.role !== 'SUPER_ADMIN' && !user\.tenantId/);
  assert.match(source, /Tenant context is required/);
});

test('CORS allows the custom tenant and branch headers used by the web client', () => {
  const source = readFileSync(
    join(process.cwd(), 'src/main.ts'),
    'utf8',
  );
  assert.match(source, /X-Tenant-Slug/);
  assert.match(source, /X-Branch-Id/);
});
