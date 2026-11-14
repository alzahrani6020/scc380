import 'reflect-metadata';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { HttpException } from '@nestjs/common';
import type { ExecutionContext } from '@nestjs/common';
import { AuthRateLimitGuard } from '../src/auth/guards/auth-rate-limit.guard';

const guard = new AuthRateLimitGuard();
const makeRequest = (ip: string, email: unknown, path = '/auth/login') => ({
  ip, path, body: { email }, socket: { remoteAddress: 'fallback' },
  headers: { 'x-forwarded-for': 'forged-IP-not-trusted' },
});
const makeContext = (req: ReturnType<typeof makeRequest>) => ({
  switchToHttp: () => ({ getRequest: () => req }),
} as unknown as ExecutionContext);
const status = (run: () => unknown) => {
  try { run(); return 200; }
  catch (e) { if (e instanceof HttpException) return e.getStatus(); throw e; }
};

test('login: authenticated request is never rejected by pre-verification IP counters', () => {
  const req = makeRequest('192.0.2.10', 'user@example.test');
  for (let n = 0; n < 100; n++) {
    assert.equal(status(() => guard.canActivate(makeContext(req))), 200);
  }
});

test('login: 10 failed credentials per identity trigger 429 and a measurable retryAfter', () => {
  const req = makeRequest('192.0.2.11', 'target@example.test');
  for (let n = 0; n < 9; n++) assert.equal(status(() => guard.recordFailedLogin(req as any, req.body.email)), 200);
  let caught: HttpException | null = null;
  try { guard.recordFailedLogin(req as any, req.body.email); }
  catch (e) { if (e instanceof HttpException) caught = e; else throw e; }
  assert.equal(caught?.getStatus(), 429);
  const payload = caught?.getResponse() as { retryAfter?: number };
  assert.ok(payload.retryAfter && payload.retryAfter > 0 && payload.retryAfter <= 900);
  assert.equal(status(() => guard.canActivate(makeContext(req))), 200, 'valid login path cannot be blocked');
  guard.clearSuccessfulLogin('target@example.test');
  assert.equal(status(() => guard.recordFailedLogin(req as any, 'TARGET@example.test')), 200);
});

test('failed logins for independent accounts behind same proxy do not share an account counter', () => {
  const ip = '192.0.2.20';
  for (let n = 0; n < 10; n++) {
    status(() => guard.recordFailedLogin(makeRequest(ip, 'first@example.test') as any, 'first@example.test'));
  }
  assert.equal(status(() => guard.recordFailedLogin(makeRequest(ip, 'second@example.test') as any, 'second@example.test')), 200);
});

test('distributed credential failures cannot evade identity limit via changing source IP', () => {
  for (let n = 0; n < 9; n++) {
    assert.equal(status(() => guard.recordFailedLogin(makeRequest('198.51.100.' + n, 'distributed@example.test') as any, 'distributed@example.test')), 200);
  }
  assert.equal(status(() => guard.recordFailedLogin(makeRequest('203.0.113.3', 'DISTRIBUTED@example.test') as any, 'DISTRIBUTED@example.test')), 429);
});

test('source-wide brute force is throttled after 60 failed guesses', () => {
  const ip = '192.0.2.21';
  for (let n = 0; n < 59; n++) {
    assert.equal(status(() => guard.recordFailedLogin(makeRequest(ip, `guess-${n}@example.test`) as any, `guess-${n}@example.test`)), 200);
  }
  assert.equal(status(() => guard.recordFailedLogin(makeRequest(ip, 'guess-59@example.test') as any, 'guess-59@example.test')), 429);
  assert.equal(status(() => guard.canActivate(makeContext(makeRequest(ip, 'valid@example.test')))), 200);
});

test('non-login endpoints retain original independent limits and forged XFF is ignored', () => {
  const ip = '192.0.2.75';
  for (let n = 0; n < 5; n++) assert.equal(status(() => guard.canActivate(makeContext(makeRequest(ip, undefined, '/auth/register')))), 200);
  assert.equal(status(() => guard.canActivate(makeContext(makeRequest(ip, undefined, '/auth/register')))), 429);
  const refreshIp = '192.0.2.76';
  for (let n = 0; n < 30; n++) assert.equal(status(() => guard.canActivate(makeContext(makeRequest(refreshIp, undefined, '/auth/refresh')))), 200);
  assert.equal(status(() => guard.canActivate(makeContext(makeRequest(refreshIp, undefined, '/auth/refresh')))), 429);
});
