import { CanActivate, ExecutionContext, HttpException, HttpStatus, Injectable } from '@nestjs/common';
import type { Request } from 'express';

type Bucket = { count: number; resetAt: number };

@Injectable()
export class AuthRateLimitGuard implements CanActivate {
  private static readonly buckets = new Map<string, Bucket>();

  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest<Request>();
    const path = req.path || req.url || 'unknown';
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
      const retryAfter = Math.max(1, Math.ceil((bucket.resetAt - now) / 1000));
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

    // Opportunistic cleanup to prevent unbounded memory growth.
    if (AuthRateLimitGuard.buckets.size > 5000) {
      for (const [bucketKey, value] of AuthRateLimitGuard.buckets) {
        if (value.resetAt <= now) AuthRateLimitGuard.buckets.delete(bucketKey);
      }
    }

    return true;
  }

  private clientIp(req: Request): string {
    const forwarded = req.headers['x-forwarded-for'];
    if (typeof forwarded === 'string' && forwarded.length > 0) {
      return forwarded.split(',')[0].trim();
    }
    if (Array.isArray(forwarded) && forwarded.length > 0) {
      return forwarded[0];
    }
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
