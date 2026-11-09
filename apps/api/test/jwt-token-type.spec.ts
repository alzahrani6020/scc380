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
