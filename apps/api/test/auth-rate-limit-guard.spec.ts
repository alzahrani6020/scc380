import 'reflect-metadata';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { HttpException } from '@nestjs/common';
import type { ExecutionContext } from '@nestjs/common';
import { AuthRateLimitGuard } from '../src/auth/guards/auth-rate-limit.guard';

// No HTTP server, database, or live authentication is used.
const guard = new AuthRateLimitGuard();
const makeContext = (ip: string, email: unknown, path = '/auth/login') => ({
  switchToHttp: () => ({
    getRequest: () => ({
      ip, path, body: { email }, socket: { remoteAddress: 'untrusted-socket' },
      headers: { 'x-forwarded-for': 'forged-client-address' },
    }),
  }),
} as unknown as ExecutionContext);

function allowed(ip: string, email: unknown, path = '/auth/login'): boolean {
  try { return guard.canActivate(makeContext(ip, email, path)); }
  catch (err) { if (err instanceof HttpException && err.getStatus() === 429) return false; throw err; }
}

test('login: independent identities behind one reverse proxy do not share the 10-attempt limit', () => {
  const ip = '192.0.2.17';
  for (let i = 0; i < 10; i++) assert.equal(allowed(ip, 'first@example.test'), true);
  assert.equal(allowed(ip, 'first@example.test'), false);
  assert.equal(allowed(ip, 'other@example.test'), true);
  assert.equal(allowed(ip, '  OTHER@EXAMPLE.TEST '), true, 'Identity normalization should share the same bucket');
  for (let i = 0; i < 8; i++) assert.equal(allowed(ip, 'other@example.test'), true);
  assert.equal(allowed(ip, 'other@example.test'), false);
});

test('login: source-wide anti-spray limit remains effective and no raw forwarded IP is trusted', () => {
  const ip = '192.0.2.29';
  for (let i = 0; i < 300; i++) {
    assert.equal(allowed(ip, `spray-${i}@example.test`), true, `Request ${i + 1} should be allowed`);
  }
  assert.equal(allowed(ip, 'next@example.test'), false, 'Source-wide limit must still block credential spraying');
  assert.equal(allowed('192.0.2.30', 'next@example.test'), true, 'Different verified request IP must be independent');
});

test('login malformed email retains conservative 10-request limiter', () => {
  const ip = '192.0.2.53';
  for (let i = 0; i < 10; i++) assert.equal(allowed(ip, undefined), true);
  assert.equal(allowed(ip, undefined), false);
});

test('registration and refresh policies remain unchanged', () => {
  const ip = '192.0.2.75';
  for (let i = 0; i < 5; i++) assert.equal(allowed(ip, 'a@example.test', '/auth/register'), true);
  assert.equal(allowed(ip, 'a@example.test', '/auth/register'), false);
  const refreshIp = '192.0.2.76';
  for (let i = 0; i < 30; i++) assert.equal(allowed(refreshIp, undefined, '/auth/refresh'), true);
  assert.equal(allowed(refreshIp, undefined, '/auth/refresh'), false);
});
