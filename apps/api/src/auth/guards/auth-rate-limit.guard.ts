import { CanActivate, ExecutionContext, HttpException, HttpStatus, Injectable } from '@nestjs/common';
import type { Request } from 'express';
import { createHash } from 'node:crypto';

type Bucket = { count: number; resetAt: number };
type LoginFailure = { count: number; resetAt: number };

@Injectable()
export class AuthRateLimitGuard implements CanActivate {
  private static readonly buckets = new Map<string, Bucket>();
  private static readonly failedLogins = new Map<string, LoginFailure>();
  private static readonly loginWindowMs = 15 * 60 * 1000;
  private static readonly failedAccountLimit = 10;
  private static readonly failedSourceLimit = 60;
  // Bounded in-flight checks and adaptive delay prevent the failure-only
  // policy from becoming an unbounded password-hash brute-force endpoint.
  private static readonly activeLogins = new Map<string, number>();


  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest<Request>();
    const path = req.path || req.url || 'unknown';

    // For login, the user must be allowed to prove correct credentials.
    // Otherwise shared-proxy IP buckets and an attacker exhausting a victim's
    // email budget can lock out an innocent user before password validation.
    // Failed credentials are counted by recordFailedLogin() AFTER validation.
    if (path.endsWith('/login')) return true;

    const ip = this.clientIp(req);
    const { limit, windowMs } = this.policy(path);
    const key = `${ip}:${path}`;
    const now = Date.now();
    const existing = AuthRateLimitGuard.buckets.get(key);
    const bucket: Bucket =
      !existing || existing.resetAt <= now
        ? { count: 0, resetAt: now + windowMs }
        : existing;
    bucket.count += 1;
    AuthRateLimitGuard.buckets.set(key, bucket);
    if (bucket.count > limit) {
      this.reject(Math.max(1, Math.ceil((bucket.resetAt - now) / 1000)));
    }
    this.cleanup();
    return true;
  }

  /**
   * Called only when the password/tenant check rejects the login. Invalid
   * credentials remain 401 while within the budget, then become 429 with an
   * explicit remaining retry window. Never include raw email in bucket keys.
   *
   * A valid login is NEVER blocked by failure counters, including after an
   * attacker exhausted the victim's budget. This limits failed attempts
   * without turning failure tracking into an account-lockout primitive.
   */
  async beginLogin(req: Request, email: unknown): Promise<() => void> {
    const ip = this.clientIp(req);
    const normalized = typeof email === 'string' ? email.trim().toLowerCase().slice(0, 254) : '';
    const hash = normalized ? createHash('sha256').update(normalized).digest('hex') : 'malformed';
    const identityKey = `login:active:identity:${hash}`;
    const sourceKey = `login:active:source:${ip}`;
    const active = AuthRateLimitGuard.activeLogins;
    // Short-lived concurrency limiting is separate from account lockout;
    // it bounds hashing load while allowing genuine login after the slot frees.
    if ((active.get(identityKey) || 0) >= 3 || (active.get(sourceKey) || 0) >= 20) {
      this.reject(1, 'LOGIN_CONCURRENT_LIMIT');
    }
    active.set(identityKey, (active.get(identityKey) || 0) + 1);
    active.set(sourceKey, (active.get(sourceKey) || 0) + 1);
    const release = () => {
      for (const key of [identityKey, sourceKey]) {
        const left = (active.get(key) || 1) - 1;
        if (left <= 0) active.delete(key);
        else active.set(key, left);
      }
    };
    try {
      const identityFailures = AuthRateLimitGuard.failedLogins.get(`auth:failed:identity:${hash}`);
      const sourceFailures = AuthRateLimitGuard.failedLogins.get(`auth:failed:source:${ip}`);
      const now = Date.now();
      const failureCount = Math.max(
        identityFailures && identityFailures.resetAt > now ? identityFailures.count : 0,
        sourceFailures && sourceFailures.resetAt > now ? sourceFailures.count / 6 : 0,
      );
      // Legitimate credentials are still verified; repeated bad credentials
      // incur progressive cost so observing 429 never enables fast guessing.
      const delayMs = failureCount >= 30 ? 10000 : failureCount >= 15 ? 3000 : failureCount >= 10 ? 1000 : 0;
      if (delayMs) await new Promise<void>((resolve) => setTimeout(resolve, delayMs));
      return release;
    } catch (error) {
      release();
      throw error;
    }
  }

  recordFailedLogin(req: Request, email: unknown): void {
    const ip = this.clientIp(req);
    const normalized = typeof email === 'string'
      ? email.trim().toLowerCase().slice(0, 254)
      : '';
    const identityHash = normalized
      ? createHash('sha256').update(normalized).digest('hex')
      : null;
    const scopes = identityHash
      ? [
          { key: `auth:failed:identity:${identityHash}`, limit: AuthRateLimitGuard.failedAccountLimit },
          { key: `auth:failed:source:${ip}`, limit: AuthRateLimitGuard.failedSourceLimit },
        ]
      : [{ key: `auth:failed:malformed:${ip}`, limit: 10 }];
    const now = Date.now();
    const updated = scopes.map((scope) => {
      const current = AuthRateLimitGuard.failedLogins.get(scope.key);
      const bucket = current && current.resetAt > now
        ? current : { count: 0, resetAt: now + AuthRateLimitGuard.loginWindowMs };
      bucket.count++;
      AuthRateLimitGuard.failedLogins.set(scope.key, bucket);
      return { ...scope, bucket };
    });
    this.cleanup();
    const exceeded = updated.find(({ bucket, limit }) => bucket.count >= limit);
    if (exceeded) this.reject(Math.max(1, Math.ceil((exceeded.bucket.resetAt - now) / 1000)), 'LOGIN_FAILED_ATTEMPTS');
  }

  clearSuccessfulLogin(email: unknown): void {
    if (typeof email !== 'string' || !email.trim()) return;
    const hash = createHash('sha256').update(email.trim().toLowerCase().slice(0, 254)).digest('hex');
    AuthRateLimitGuard.failedLogins.delete(`auth:failed:identity:${hash}`);
  }

  private reject(retryAfter: number, errorCode = 'LOGIN_RATE_LIMITED'): never {
    throw new HttpException(
      {
        statusCode: HttpStatus.TOO_MANY_REQUESTS,
        error: 'Too Many Requests',
        message: 'Too many failed authentication attempts. Please try again later.',
        errorCode,
        retryAfter,
      },
      HttpStatus.TOO_MANY_REQUESTS,
    );
  }

  private cleanup(): void {
    const now = Date.now();
    if (AuthRateLimitGuard.buckets.size > 5000) {
      for (const [key, value] of AuthRateLimitGuard.buckets) {
        if (value.resetAt <= now) AuthRateLimitGuard.buckets.delete(key);
      }
    }
    if (AuthRateLimitGuard.failedLogins.size > 5000) {
      for (const [key, value] of AuthRateLimitGuard.failedLogins) {
        if (value.resetAt <= now) AuthRateLimitGuard.failedLogins.delete(key);
      }
    }
  }

  private clientIp(req: Request): string {
    // Express trust proxy is configured centrally. Never trust raw client-sent XFF.
    return req.ip || req.socket?.remoteAddress || 'unknown';
  }

  private policy(path: string) {
    if (path.endsWith('/login')) return { limit: 10, windowMs: 15 * 60 * 1000 };
    if (path.endsWith('/register')) return { limit: 5, windowMs: 60 * 60 * 1000 };
    if (path.endsWith('/forgot-password')) return { limit: 5, windowMs: 15 * 60 * 1000 };
    if (path.endsWith('/reset-password')) return { limit: 10, windowMs: 15 * 60 * 1000 };
    if (path.endsWith('/google')) return { limit: 20, windowMs: 15 * 60 * 1000 };
    if (path.endsWith('/verify-2fa-login')) return { limit: 10, windowMs: 15 * 60 * 1000 };
    return { limit: 30, windowMs: 15 * 60 * 1000 };
  }
}
