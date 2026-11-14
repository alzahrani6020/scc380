import 'reflect-metadata';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { HttpException, UnauthorizedException } from '@nestjs/common';
import { LoginDiagnosticFilter } from '../src/auth/filters/login-diagnostic.filter';

const makeHarness = (requestPath = '/auth/login') => {
  const headers = new Map<string, string>();
  const response = {
    statusCode: 0,
    payload: null as unknown,
    setHeader(key: string, value: string) { headers.set(key.toLowerCase(), value); },
  };
  const adapter = {
    isHeadersSent: () => false,
    reply: (_res: unknown, payload: unknown, status: number) => {
      response.statusCode = status;
      response.payload = payload;
    },
  };
  const filter = new LoginDiagnosticFilter({ httpAdapter: adapter } as any);
  const host = {
    switchToHttp: () => ({
      getResponse: () => response,
      getRequest: () => ({ path: requestPath, method: 'POST' }),
    }),
  };
  return { filter, response, headers, host };
};

test('login diagnostics: API 429 preserves status/body and publishes safe retry and reason headers', () => {
  const h = makeHarness();
  const error = new HttpException({
    message: 'Too many failed authentication attempts.',
    statusCode: 429,
    errorCode: 'LOGIN_FAILED_ATTEMPTS',
    retryAfter: 71,
  }, 429);
  h.filter.catch(error, h.host as any);
  assert.equal(h.response.statusCode, 429);
  assert.equal(h.headers.get('retry-after'), '71');
  assert.equal(h.headers.get('x-scc-auth-error-code'), 'LOGIN_FAILED_ATTEMPTS');
  assert.deepEqual(h.response.payload, error.getResponse(), 'Do not replace the original failure payload');
});

test('login diagnostics: 401 remains 401 and never claims a retry window', () => {
  const h = makeHarness();
  h.filter.catch(new UnauthorizedException('Invalid credentials'), h.host as any);
  assert.equal(h.response.statusCode, 401);
  assert.equal(h.headers.get('x-scc-auth-error-code'), 'INVALID_CREDENTIALS');
  assert.equal(h.headers.has('retry-after'), false);
});

test('login diagnostics: unknown errorCode is not reflected into response headers', () => {
  const h = makeHarness();
  h.filter.catch(new HttpException({
    errorCode: 'UNTRUSTED_SECRET_VALUE', retryAfter: 999999, statusCode: 429,
  }, 429), h.host as any);
  assert.equal(h.headers.get('x-scc-auth-error-code'), 'LOGIN_RATE_LIMITED');
  assert.equal(h.headers.get('retry-after'), '3600');
});

test('login diagnostics: other routes are unaffected', () => {
  const h = makeHarness('/auth/register');
  h.filter.catch(new HttpException({ statusCode: 429, retryAfter: 90 }, 429), h.host as any);
  assert.equal(h.response.statusCode, 429);
  assert.equal(h.headers.size, 0);
});
