import 'reflect-metadata';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { HttpException, UnauthorizedException } from '@nestjs/common';
import { AuthController } from '../src/auth/auth.controller';
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

test('login concurrency safety: limit same identity to three simultaneous password verifications', async () => {
  const req = makeRequest('192.0.2.111', 'parallel@example.test');
  const releases: Array<() => void> = [];
  for (let i = 0; i < 3; i++) releases.push(await guard.beginLogin(req as any, 'parallel@example.test'));
  try {
    assert.equal(await (async () => {
      try { const extra = await guard.beginLogin(makeRequest('192.0.2.112', 'PARALLEL@example.test') as any, 'PARALLEL@example.test'); extra(); return 200; }
      catch (e) { if (e instanceof HttpException) return e.getStatus(); throw e; }
    })(), 429);
  } finally { for (const release of releases) release(); }
  const after = await guard.beginLogin(req as any, 'parallel@example.test');
  after();
});

test('login concurrency safety: allow unrelated accounts but cap twenty concurrent checks per source', async () => {
  const ip = '192.0.2.112';
  const releases: Array<() => void> = [];
  for (let i = 0; i < 20; i++) releases.push(await guard.beginLogin(makeRequest(ip, `active-${i}@example.test`) as any, `active-${i}@example.test`));
  try {
    assert.equal(await (async () => {
      try { const extra = await guard.beginLogin(makeRequest(ip, 'active-extra@example.test') as any, 'active-extra@example.test'); extra(); return 200; }
      catch (e) { if (e instanceof HttpException) return e.getStatus(); throw e; }
    })(), 429);
  } finally { releases.forEach(release => release()); }
  const after = await guard.beginLogin(makeRequest(ip, 'new@example.test') as any, 'new@example.test');
  after();
});

test('real controller flow: correct credentials succeed after ten rejected attempts', async () => {
  const email = 'qa-controller-flow@example.test';
  const req = makeRequest('203.0.113.99', email);
  const fakeService = {
    authenticate: async (providedEmail: string, password: string) => {
      assert.equal(providedEmail, email);
      if (password !== 'correct-only-for-test') throw new UnauthorizedException('Invalid credentials');
      return { id: 'test-user', email, role: 'ADMIN', tenantId: 'test-tenant' };
    },
    login: async () => ({ accessToken: 'test-only-placeholder', user: { email } }),
  };
  const controller = new AuthController(fakeService as any, guard);
  for (let n = 0; n < 10; n++) {
    let statusCode = 0;
    try { await controller.login({ email, password: 'incorrect' }, req as any); }
    catch (e) { if (e instanceof HttpException) statusCode = e.getStatus(); else throw e; }
    assert.equal(statusCode, n === 9 ? 429 : 401);
  }
  const valid = await controller.login({ email, password: 'correct-only-for-test' }, req as any);
  assert.equal(valid.accessToken, 'test-only-placeholder', 'Correct credentials must bypass failed attempt lockout');
  let statusAfterRecovery = 0;
  try { await controller.login({ email, password: 'incorrect' }, req as any); }
  catch (e) { if (e instanceof HttpException) statusAfterRecovery = e.getStatus(); else throw e; }
  assert.equal(statusAfterRecovery, 401, 'Success must clear account failure count');
});
