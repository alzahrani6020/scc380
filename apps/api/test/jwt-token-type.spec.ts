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

test('AuthService explicitly tags access and refresh JWT payloads and reuses one token-pair factory', () => {
  const source = readFileSync(
    join(process.cwd(), 'src/auth/auth.service.ts'),
    'utf8',
  );

  assert.match(source, /type:\s*'access'/);
  assert.match(source, /type:\s*'refresh'/);
  assert.match(source, /private buildTokenPair/);
  assert.ok((source.match(/this\.buildTokenPair\(/g) ?? []).length >= 3);
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
  assert.match(verifySource, /maxLength=\{16\}/);
  assert.match(verifySource, /\^\\d\{6\}\$/);
  assert.match(verifySource, /\^\[0-9A-F\]\{8\}\$/);
  assert.match(verifySource, /\^\[0-9A-F\]\{16\}\$/);
});


test('tenantless non-super-admin users are rejected by the shared access-session validator', () => {
  const strategySource = readFileSync(
    join(process.cwd(), 'src/auth/strategies/jwt.strategy.ts'),
    'utf8',
  );
  const validatorSource = readFileSync(
    join(process.cwd(), 'src/auth/access-session.ts'),
    'utf8',
  );
  assert.match(strategySource, /validateAccessSessionPayload/);
  assert.match(validatorSource, /user\.role !== 'SUPER_ADMIN' && !user\.tenantId/);
  assert.match(validatorSource, /Tenant context is required/);
});

test('CORS allows the custom tenant and branch headers used by the web client', () => {
  const source = readFileSync(
    join(process.cwd(), 'src/main.ts'),
    'utf8',
  );
  assert.match(source, /X-Tenant-Slug/);
  assert.match(source, /X-Branch-Id/);
});


test('new 2FA backup codes use 64 bits of randomness', () => {
  const source = readFileSync(
    join(process.cwd(), 'src/auth/auth.service.ts'),
    'utf8',
  );
  assert.match(source, /randomBytes\(8\)\.toString\('hex'\)/);
});


test('registration requires tenant name and slug to avoid tenantless users', () => {
  const dtoSource = readFileSync(
    join(process.cwd(), 'src/auth/dto/register.dto.ts'),
    'utf8',
  );
  assert.doesNotMatch(dtoSource, /ValidateIf/);
  assert.match(dtoSource, /tenantName!:/);
  assert.match(dtoSource, /tenantSlug!:/);
});

test('Google OAuth does not auto-register tenantless users', () => {
  const source = readFileSync(
    join(process.cwd(), 'src/auth/auth.service.ts'),
    'utf8',
  );
  assert.doesNotMatch(source, /Auto-register Google user/);
  assert.match(source, /Google account is not registered/);
  assert.match(source, /!user\.tenantId/);
});

test('refresh rotation preserves session identity with atomic compare-and-swap', () => {
  const source = readFileSync(join(process.cwd(), 'src/auth/auth.service.ts'), 'utf8');
  const refresh = source.split('  async refresh(refreshToken: string) {')[1].split('  async logout(')[0];

  assert.match(source, /refreshTokenHash:\s*this\.hashToken\(refreshToken\)/);
  assert.match(source, /existingSessionId\?: string/);
  assert.match(source, /sid: sessionKey/);
  assert.match(source, /jti: randomBytes\(24\)\.toString\('hex'\)/);
  assert.match(refresh, /prisma\.session\.findUnique/);
  assert.match(refresh, /const rotated = await prisma\.session\.updateMany/);
  assert.match(refresh, /token:\s*tokenHash/);
  assert.match(refresh, /token:\s*tokens\.refreshTokenHash/);
  assert.match(refresh, /session\.id,/);
  assert.match(refresh, /lastActiveAt:\s*now/);
  assert.match(refresh, /if \(rotated\.count !== 1\)/);
  assert.doesNotMatch(refresh, /tx\.session\.create/);
  assert.doesNotMatch(refresh, /where:\s*\{\s*userId:\s*session\.userId,\s*revokedAt:\s*null/);
});

test('password reset revokes all active sessions', () => {
  const source = readFileSync(
    join(process.cwd(), 'src/auth/auth.service.ts'),
    'utf8',
  );

  assert.match(
    source,
    /prisma\.session\.updateMany\([\s\S]*userId:\s*user\.id[\s\S]*revokedAt:\s*null/,
  );
});

test('auth controller exposes refresh, logout, and authenticated logout-all', () => {
  const source = readFileSync(
    join(process.cwd(), 'src/auth/auth.controller.ts'),
    'utf8',
  );

  assert.match(source, /@Post\('refresh'\)/);
  assert.match(source, /@Post\('logout'\)/);
  assert.match(source, /@Post\('logout-all'\)/);
  assert.match(source, /return this\.authService\.refresh\(refreshToken\)/);
  assert.match(source, /return this\.authService\.logoutAll\(req\.user\.userId\)/);
});

test('web API refreshes once and retries the failed request without recursive refresh', () => {
  const source = readFileSync(
    join(process.cwd(), '../web/src/lib/api.ts'),
    'utf8',
  );

  assert.match(source, /let refreshPromise:/);
  assert.match(source, /if \(refreshPromise\) return refreshPromise/);
  assert.match(source, /\/auth\/refresh/);
  assert.match(source, /!original\?\._retry/);
  assert.match(source, /original\._retry = true/);
  assert.match(source, /return api\(original\)/);
  assert.match(source, /!isAuthEndpoint/);
});

test('access tokens are bound to persisted session ids for immediate revocation', () => {
  const authSource = readFileSync(
    join(process.cwd(), 'src/auth/auth.service.ts'),
    'utf8',
  );
  const strategySource = readFileSync(
    join(process.cwd(), 'src/auth/strategies/jwt.strategy.ts'),
    'utf8',
  );
  const validatorSource = readFileSync(
    join(process.cwd(), 'src/auth/access-session.ts'),
    'utf8',
  );

  assert.ok((authSource.match(/id:\s*tokens\.sessionKey/g) ?? []).length >= 2);
  assert.match(authSource, /sid:\s*sessionKey/);
  assert.match(authSource, /jti:\s*randomBytes\(24\)\.toString\('hex'\)/);
  assert.match(strategySource, /validateAccessSessionPayload/);
  assert.match(validatorSource, /where:\s*\{\s*id:\s*payload\.sid\s*\}/);
  assert.match(validatorSource, /session\.revokedAt/);
  assert.match(validatorSource, /session\.expiresAt <= new Date\(\)/);
  assert.match(validatorSource, /Session is not active/);
});

test('sidebar logout revokes the refresh session before clearing local auth', () => {
  const source = readFileSync(
    join(process.cwd(), '../web/src/components/layout/Sidebar.tsx'),
    'utf8',
  );

  assert.match(source, /getRefreshToken\(\)/);
  assert.match(source, /api\.post\('\/auth\/logout', \{ refreshToken \}\)/);
  assert.match(source, /finally\s*\{[\s\S]*clearAuth\(\)/);
  assert.match(source, /onClick=\{handleLogout\}/);
});

test('logout endpoints are excluded from automatic refresh recursion', () => {
  const source = readFileSync(
    join(process.cwd(), '../web/src/lib/api.ts'),
    'utf8',
  );

  assert.match(source, /'\/auth\/logout'/);
  assert.match(source, /'\/auth\/logout-all'/);
});
