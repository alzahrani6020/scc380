import { CanActivate, ExecutionContext, HttpException, HttpStatus, Injectable } from '@nestjs/common';
import type { Request } from 'express';
import { createHash } from 'node:crypto';

type Bucket = { count: number; resetAt: number };

@Injectable()
export class AuthRateLimitGuard implements CanActivate {
  private static readonly buckets = new Map<string, Bucket>();

  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest<Request>();
    const path = req.path || req.url || 'unknown';
    const ip = this.clientIp(req);
    const { limit, windowMs } = this.policy(path);
    const now = Date.now();
    const isLogin = path.endsWith('/login');
    // A Web reverse proxy may make unrelated users share req.ip.
    // Bound login attempts per identity across ALL client IPs, and retain
    // a stricter source-wide anti-spray ceiling. Never trust raw XFF.
    const normalizedEmail =
      isLogin && typeof req.body?.email === 'string'
        ? req.body.email.trim().toLowerCase().slice(0, 254)
        : '';
    const accountHash = normalizedEmail
      ? createHash('sha256').update(normalizedEmail).digest('hex')
      : '';
    const scopes = isLogin && accountHash
      ? [
          { key: `login:identity:${accountHash}`, limit, windowMs },
          { key: `login:source:${ip}`, limit: 60, windowMs },
        ]
      : [{ key: `${ip}:${path}`, limit, windowMs }];

    // Evaluate every scope before incrementing to avoid consuming an
    // unrelated account bucket when a broad source limit is already hit.
    const nextBuckets = scopes.map((scope) => {
      const existing = AuthRateLimitGuard.buckets.get(scope.key);
      const bucket: Bucket =
        !existing || existing.resetAt <= now
          ? { count: 0, resetAt: now + scope.windowMs }
          : existing;
      return { ...scope, bucket };
    });
    const blocked = nextBuckets.find(({ bucket, limit: scopeLimit }) => bucket.count >= scopeLimit);
    if (blocked) {
      const retryAfter = Math.max(1, Math.ceil((blocked.bucket.resetAt - now) / 1000));
      throw new HttpException(
        {
          statusCode: HttpStatus.TOO_MANY_REQUESTS,
          error: 'Too Many Requests',
          message: 'Too many authentication attempts. Please try again later.',
          retryAfter,
        },
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }
    for (const scope of nextBuckets) {
      scope.bucket.count += 1;
      AuthRateLimitGuard.buckets.set(scope.key, scope.bucket);
    }

    // Opportunistic cleanup to prevent unbounded memory growth.
    if (AuthRateLimitGuard.buckets.size > 5000) {
      for (const [bucketKey, value] of AuthRateLimitGuard.buckets) {
        if (value.resetAt <= now) AuthRateLimitGuard.buckets.delete(bucketKey);
      }
    }

    return true;
  }

  private clientIp(req: Request): string {
    // Express trust proxy is configured centrally; do not trust raw X-Forwarded-For here.
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
